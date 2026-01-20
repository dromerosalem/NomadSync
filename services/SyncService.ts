
import { db, type SyncLog } from '../db/LocalDatabase';
import { supabase } from './supabaseClient';

class SyncService {
    private isProcessing = false;

    /**
     * Enqueue a mutation for later synchronization.
     */
    async enqueue(
        table: SyncLog['table'],
        operation: SyncLog['operation'],
        payload: any,
        base_payload?: any
    ) {
        const log: SyncLog = {
            table,
            operation,
            payload,
            base_payload,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        };

        await db.sync_queue.add(log);

        // Try to process immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
    }

    /**
     * Process all pending mutations in the queue.
     */
    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        let syncCount = 0;

        try {
            const pending = await db.sync_queue
                .where('status')
                .equals('PENDING')
                .sortBy('timestamp');

            for (const log of pending) {
                const result = await this.syncOne(log);

                if (result === 'SUCCESS') {
                    await db.sync_queue.delete(log.id!);
                    syncCount++;
                } else if (result === 'CONFLICT') {
                    await db.sync_queue.update(log.id!, {
                        status: 'CONFLICT'
                    });
                    // Notify UI about conflict
                    this.notifyConflict();
                } else {
                    // FAILED
                    await db.sync_queue.update(log.id!, {
                        status: 'FAILED',
                        retries: log.retries + 1
                    });
                }
            }

            if (syncCount > 0) {
                this.showSyncNotification(syncCount);
            }
        } catch (error) {
            console.error('Failed to process sync queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    private notifyConflict() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CONFLICT_DETECTED' });
        }
    }

    private async showSyncNotification(count: number) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            registration.showNotification('Logistical Sync Complete', {
                body: `${count} item(s) synchronized with Mission HQ.`,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: 'sync-complete'
            });
        }
    }

    /**
     * Sync a single operation to Supabase with conflict detection.
     */
    private async syncOne(log: SyncLog): Promise<'SUCCESS' | 'CONFLICT' | 'FAILED'> {
        const { table, operation, payload } = log;

        try {
            if (table === 'itinerary_items') {
                return await this.syncItineraryItem(log);
            }

            // Mapping table name to Supabase table
            const supabaseTable = table;

            if (operation === 'INSERT') {
                const { error } = await supabase.from(supabaseTable).insert(payload);
                if (error) throw error;
            }
            else if (operation === 'UPDATE') {
                if (payload.id) {
                    const { error } = await supabase
                        .from(supabaseTable)
                        .update(payload)
                        .eq('id', payload.id);
                    if (error) throw error;
                }
            }
            else if (operation === 'DELETE') {
                if (payload.id) {
                    const { error } = await supabase
                        .from(supabaseTable)
                        .delete()
                        .eq('id', payload.id);
                    if (error) throw error;
                }
            }

            return 'SUCCESS';
        } catch (err) {
            console.error(`Sync failed for ${table}:${operation}`, err);
            return 'FAILED';
        }
    }

    private async syncItineraryItem(log: SyncLog): Promise<'SUCCESS' | 'CONFLICT' | 'FAILED'> {
        const { operation, payload: item, base_payload } = log;
        try {
            const dbItem = { ...item };
            const splitWith = dbItem.splitWith;
            const splitDetails = dbItem.splitDetails;

            // Remove virtual fields before Supabase insert/update
            delete dbItem.splitWith;
            delete dbItem.splitDetails;
            delete dbItem.updatedAt; // Supabase uses updated_at

            // Map fields to DB format
            const mappedItem = {
                trip_id: dbItem.tripId,
                type: dbItem.type,
                title: dbItem.title,
                location: dbItem.location,
                end_location: dbItem.endLocation,
                start_date: new Date(dbItem.startDate).toISOString(),
                end_date: dbItem.endDate ? new Date(dbItem.endDate).toISOString() : null,
                duration_minutes: dbItem.durationMinutes,
                cost: dbItem.cost,
                paid_by: dbItem.paidBy,
                created_by: dbItem.createdBy,
                is_private: dbItem.isPrivate,
                show_in_timeline: dbItem.showInTimeline,
                details: dbItem.details,
                map_uri: dbItem.mapUri,
                tags: dbItem.tags,
                original_amount: dbItem.originalAmount,
                currency_code: dbItem.currencyCode,
                exchange_rate: dbItem.exchangeRate,
                receipt_items: dbItem.receiptItems
            };

            let resultId = item.id;

            if (operation === 'INSERT' || operation === 'UPDATE') {
                if (operation === 'INSERT') {
                    const { data, error } = await supabase
                        .from('itinerary_items')
                        .insert(mappedItem)
                        .select()
                        .single();
                    if (error) throw error;
                    resultId = data.id;
                } else {
                    // Check for conflict BEFORE update
                    const { data: serverState } = await supabase
                        .from('itinerary_items')
                        .select('*')
                        .eq('id', item.id)
                        .single();

                    if (serverState) {
                        const serverTime = new Date(serverState.updated_at).getTime();
                        // 1 second grace period for clock skew
                        if (serverTime > item.updatedAt + 1000) {
                            console.warn(`[SyncService] Resource modified at HQ. Attempting Smart Merge for item ${item.id}.`);

                            if (base_payload) {
                                // Map server state (snake_case) to app state (camelCase)
                                const serverItem = {
                                    ...item, // Fallback for IDs/meta
                                    title: serverState.title,
                                    location: serverState.location,
                                    endLocation: serverState.end_location,
                                    startDate: new Date(serverState.start_date),
                                    endDate: serverState.end_date ? new Date(serverState.end_date) : undefined,
                                    durationMinutes: serverState.duration_minutes,
                                    cost: serverState.cost,
                                    paidBy: serverState.paid_by,
                                    isPrivate: serverState.is_private,
                                    showInTimeline: serverState.show_in_timeline,
                                    details: serverState.details,
                                    mapUri: serverState.map_uri,
                                    tags: serverState.tags || [],
                                    currencyCode: serverState.currency_code,
                                    exchangeRate: serverState.exchange_rate,
                                    receiptItems: serverState.receipt_items,
                                    updatedAt: serverTime
                                };

                                const { merged, hasOverlap } = this.smartMerge(item, base_payload, serverItem);

                                if (!hasOverlap) {
                                    console.log(`[SyncService] Smart Merge successful for item ${item.id}. No overlapping field conflicts.`);
                                    // Update mappedItem with merged values for the actual Supabase write
                                    Object.assign(mappedItem, {
                                        title: merged.title,
                                        location: merged.location,
                                        end_location: merged.endLocation,
                                        start_date: new Date(merged.startDate).toISOString(),
                                        end_date: merged.endDate ? new Date(merged.endDate).toISOString() : null,
                                        duration_minutes: merged.durationMinutes,
                                        cost: merged.cost,
                                        paid_by: merged.paidBy,
                                        is_private: merged.isPrivate,
                                        show_in_timeline: merged.showInTimeline,
                                        details: merged.details,
                                        map_uri: merged.mapUri,
                                        tags: merged.tags,
                                        original_amount: merged.originalAmount,
                                        currency_code: merged.currencyCode,
                                        exchange_rate: merged.exchangeRate,
                                        receipt_items: merged.receiptItems
                                    });
                                } else {
                                    console.warn(`[SyncService] Smart Merge failed for item ${item.id}. Overlapping changes detected.`);
                                    return 'CONFLICT';
                                }
                            } else {
                                console.warn(`[SyncService] No base_payload available for item ${item.id}. Manual resolution required.`);
                                return 'CONFLICT';
                            }
                        }
                    }

                    const { error } = await supabase
                        .from('itinerary_items')
                        .update(mappedItem)
                        .eq('id', item.id);
                    if (error) throw error;
                }

                // Sync Splits (Atomic Replacement)
                await supabase.from('expense_splits').delete().eq('item_id', resultId);

                if (splitWith && splitWith.length > 0) {
                    const splits = splitWith.map((userId: string) => ({
                        item_id: resultId,
                        user_id: userId,
                        amount: splitDetails?.[userId] || (dbItem.cost / splitWith.length)
                    }));
                    const { error: splitError } = await supabase.from('expense_splits').insert(splits);
                    if (splitError) throw splitError;
                }
            } else if (operation === 'DELETE') {
                const { error } = await supabase.from('itinerary_items').delete().eq('id', item.id);
                if (error) throw error;
            }

            return 'SUCCESS';
        } catch (err) {
            console.error('Itinerary sync failed:', err);
            return 'FAILED';
        }
    }

    private smartMerge(local: any, base: any, server: any): { merged: any, hasOverlap: boolean } {
        const merged = { ...server };
        let hasOverlap = false;

        const fields = [
            'title', 'location', 'endLocation', 'startDate', 'endDate',
            'durationMinutes', 'cost', 'paidBy', 'isPrivate',
            'showInTimeline', 'details', 'mapUri', 'tags',
            'originalAmount', 'currencyCode', 'exchangeRate', 'receiptItems'
        ];

        for (const field of fields) {
            const localVal = local[field];
            const baseVal = base[field];
            const serverVal = server[field];

            // Use JSON stringify for deep comparison (simple and effective for these flat-ish objects)
            const localChanged = JSON.stringify(localVal) !== JSON.stringify(baseVal);
            const serverChanged = JSON.stringify(serverVal) !== JSON.stringify(baseVal);

            if (localChanged && serverChanged) {
                if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
                    hasOverlap = true;
                }
            } else if (localChanged) {
                merged[field] = localVal;
            }
        }

        return { merged, hasOverlap };
    }
}

export const syncService = new SyncService();
