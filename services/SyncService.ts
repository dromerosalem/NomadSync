
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
        payload: any
    ) {
        const log: SyncLog = {
            table,
            operation,
            payload,
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

        try {
            const pending = await db.sync_queue
                .where('status')
                .equals('PENDING')
                .sortBy('timestamp');

            for (const log of pending) {
                const success = await this.syncOne(log);
                if (success) {
                    await db.sync_queue.delete(log.id!);
                } else {
                    // Update retry count
                    await db.sync_queue.update(log.id!, {
                        status: 'FAILED',
                        retries: log.retries + 1
                    });
                }
            }
        } catch (error) {
            console.error('Failed to process sync queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Sync a single operation to Supabase with conflict detection.
     */
    private async syncOne(log: SyncLog): Promise<boolean> {
        const { table, operation, payload } = log;

        try {
            if (table === 'itinerary_items') {
                return await this.syncItineraryItem(operation, payload);
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

            return true;
        } catch (err) {
            console.error(`Sync failed for ${table}:${operation}`, err);
            return false;
        }
    }

    private async syncItineraryItem(operation: SyncLog['operation'], item: any): Promise<boolean> {
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
                exchange_rate: dbItem.exchangeRate
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
                        .select('updated_at')
                        .eq('id', item.id)
                        .single();

                    if (serverState) {
                        const serverTime = new Date(serverState.updated_at).getTime();
                        if (serverTime > item.updatedAt) {
                            console.warn(`[SyncService] Conflict detected for item ${item.id}. Server newer (${serverTime}) than local base (${item.updatedAt}). Overwriting (Last Write Wins).`);
                            // Here you could implement a merge or user prompt
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

            return true;
        } catch (err) {
            console.error('Itinerary sync failed:', err);
            return false;
        }
    }
}

export const syncService = new SyncService();
