import { supabase } from './supabaseClient';
import { Trip, ItineraryItem, Member, Role } from '../types';
import { db } from '../db/LocalDatabase';

export const tripService = {
    // --- TRIP OPERATIONS ---

    async fetchUserTrips(userId: string): Promise<Trip[]> {
        try {
            // 1. Try Network
            const { data, error } = await supabase
                .from('trip_members')
                .select(`
        role,
        personal_budget,
        status,
        trips (
          id,
          name,
          destination,
          start_date,
          end_date,
          budget,
          cover_image_url,
          budget_view_mode,
          status,
          base_currency,
          created_by,
          updated_at,
          trip_members (
            user_id,
            role,
            personal_budget,
            status,
            profiles (
              full_name,
              email,
              avatar_url
            )
          )
        )
      `)
                .eq('user_id', userId);

            if (error) throw error;

            const trips = (data || []).map((membership: any) => {
                const trip = membership.trips;
                return {
                    id: trip.id,
                    name: trip.name,
                    destination: trip.destination,
                    latitude: trip.latitude,
                    longitude: trip.longitude,
                    countryCode: trip.country_code,
                    startDate: new Date(trip.start_date),
                    endDate: new Date(trip.end_date),
                    budget: trip.budget,
                    status: trip.status,
                    coverImage: trip.cover_image_url,
                    budgetViewMode: trip.budget_view_mode || 'SMART',
                    baseCurrency: trip.base_currency || 'USD',
                    items: [], // Will fetch separate or with another join
                    members: trip.trip_members.map((m: any) => ({
                        id: m.user_id,
                        name: m.profiles?.full_name || m.profiles?.email?.split('@')[0] || 'Unknown Traveler',
                        email: m.profiles?.email || 'N/A',
                        role: m.role,
                        avatarUrl: m.profiles?.avatar_url,
                        status: m.status,
                        budget: m.personal_budget || 0,
                        isCurrentUser: m.user_id === userId
                    })),
                    updatedAt: new Date(trip.updated_at || Date.now()).getTime()
                } as Trip;
            });

            // 2. Sync to Local DB
            await db.trips.bulkPut(trips);
            return trips;

        } catch (networkError) {
            console.warn('[tripService] Network failed, falling back to local DB', networkError);
            const cachedTrips = await db.trips.toArray();
            return cachedTrips;
        }
    },



    // --- ITINERARY OPERATIONS ---

    async fetchTripItinerary(tripId: string): Promise<ItineraryItem[]> {
        try {
            // 1. Try Network
            const { data, error } = await supabase
                .from('itinerary_items')
                .select(`
        *,
        expense_splits (
          user_id,
          amount
        )
      `)
                .eq('trip_id', tripId);

            if (error) throw error;

            const items = (data || []).map((item: any) => ({
                id: item.id,
                tripId: item.trip_id,
                type: item.type,
                title: item.title,
                location: item.location,
                endLocation: item.end_location,
                latitude: item.latitude,
                longitude: item.longitude,
                countryCode: item.country_code,
                endLatitude: item.end_latitude,
                endLongitude: item.end_longitude,
                endCountryCode: item.end_country_code,
                startDate: new Date(item.start_date),
                endDate: item.end_date ? new Date(item.end_date) : undefined,
                durationMinutes: item.duration_minutes,
                cost: item.cost,
                paidBy: item.paid_by,
                createdBy: item.created_by,
                isPrivate: item.is_private,
                showInTimeline: item.show_in_timeline,
                details: item.details,
                mapUri: item.map_uri,
                tags: item.tags || [],
                originalAmount: item.original_amount,
                currencyCode: item.currency_code,
                exchangeRate: item.exchange_rate,
                receiptItems: item.receipt_items,
                updatedAt: new Date(item.updated_at || Date.now()).getTime(),
                splitWith: item.expense_splits.map((s: any) => s.user_id),
                splitDetails: item.expense_splits.reduce((acc: any, s: any) => {
                    acc[s.user_id] = s.amount;
                    return acc;
                }, {})
            } as ItineraryItem));

            // 2. Sync to Local DB
            await db.items.bulkPut(items);
            return items;

        } catch (networkError) {
            console.warn('[tripService] Network failed, falling back to local DB', networkError);
            const cachedItems = await db.items.where('tripId').equals(tripId).toArray();
            return cachedItems;
        }
    },

    /**
     * Fetch a single itinerary item by ID and cache it.
     * Used for incremental realtime updates.
     */
    async fetchSingleItem(itemId: string): Promise<ItineraryItem | null> {
        try {
            const { data, error } = await supabase
                .from('itinerary_items')
                .select(`
                    *,
                    expense_splits (
                        user_id,
                        amount
                    )
                `)
                .eq('id', itemId)
                .single();

            if (error) throw error;
            if (!data) return null;

            const item: ItineraryItem = {
                id: data.id,
                tripId: data.trip_id,
                type: data.type,
                title: data.title,
                location: data.location,
                endLocation: data.end_location,
                latitude: data.latitude,
                longitude: data.longitude,
                countryCode: data.country_code,
                endLatitude: data.end_latitude,
                endLongitude: data.end_longitude,
                endCountryCode: data.end_country_code,
                startDate: new Date(data.start_date),
                endDate: data.end_date ? new Date(data.end_date) : undefined,
                durationMinutes: data.duration_minutes,
                cost: data.cost,
                paidBy: data.paid_by,
                createdBy: data.created_by,
                isPrivate: data.is_private,
                showInTimeline: data.show_in_timeline,
                details: data.details,
                mapUri: data.map_uri,
                tags: data.tags || [],
                originalAmount: data.original_amount,
                currencyCode: data.currency_code,
                exchangeRate: data.exchange_rate,
                receiptItems: data.receipt_items,
                updatedAt: new Date(data.updated_at || Date.now()).getTime(),
                splitWith: data.expense_splits?.map((s: any) => s.user_id) || [],
                splitDetails: data.expense_splits?.reduce((acc: any, s: any) => {
                    acc[s.user_id] = s.amount;
                    return acc;
                }, {}) || {}
            };

            // Cache immediately
            await db.items.put(item);
            return item;

        } catch (error) {
            console.error('[tripService] Failed to fetch single item:', error);
            // Try to return from cache
            const cached = await db.items.get(itemId);
            return cached || null;
        }
    },

    /**
     * Delete an item from local cache (for realtime DELETE events)
     */
    async deleteItemFromCache(itemId: string): Promise<void> {
        await db.items.delete(itemId);
    },

    async createTrip(tripData: Omit<Trip, 'id' | 'items'>, creatorId: string): Promise<Trip> {
        // 1. Insert Trip
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .insert({
                name: tripData.name,
                destination: tripData.destination,
                latitude: tripData.latitude,
                longitude: tripData.longitude,
                country_code: tripData.countryCode,
                start_date: new Date(tripData.startDate).toISOString(),
                end_date: new Date(tripData.endDate).toISOString(),
                budget: tripData.budget,
                cover_image_url: tripData.coverImage,
                budget_view_mode: tripData.budgetViewMode,
                status: tripData.status,
                base_currency: tripData.baseCurrency || 'USD',
                created_by: creatorId
            })
            .select()
            .single();

        if (tripError) throw tripError;

        // 2. Add members (only real users or correctly mapped creator)
        const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const membersToInsert = tripData.members
            .filter(m => m.id === '1' || isValidUuid(m.id))
            .map(m => ({
                trip_id: trip.id,
                user_id: m.id === '1' ? creatorId : m.id,
                role: m.role,
                personal_budget: m.budget || 0,
                status: m.status || 'ACTIVE'
            }));

        const { error: memberError } = await supabase
            .from('trip_members')
            .insert(membersToInsert);

        if (memberError) throw memberError;

        return {
            ...tripData,
            id: trip.id,
            startDate: new Date(trip.start_date),
            endDate: new Date(trip.end_date),
            coverImage: trip.cover_image_url,
            items: []
        } as Trip;
    },

    async updateTrip(tripId: string, updates: Partial<Trip>): Promise<void> {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.destination) dbUpdates.destination = updates.destination;
        if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
        if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
        if (updates.countryCode) dbUpdates.country_code = updates.countryCode;
        if (updates.startDate) dbUpdates.start_date = new Date(updates.startDate).toISOString();
        if (updates.endDate) dbUpdates.end_date = new Date(updates.endDate).toISOString();
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.budgetViewMode) dbUpdates.budget_view_mode = updates.budgetViewMode;
        if (updates.baseCurrency) dbUpdates.base_currency = updates.baseCurrency;

        const { error } = await supabase
            .from('trips')
            .update(dbUpdates)
            .eq('id', tripId);

        if (error) throw error;
    },

    async updateMemberBudget(tripId: string, userId: string, budget: number): Promise<void> {
        const { error } = await supabase
            .from('trip_members')
            .update({ personal_budget: budget })
            .eq('trip_id', tripId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    // --- ITINERARY WRITES (Offline Aware) ---

    async saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem> {
        const isNew = !item.id || item.id.length < 10;
        // 1. Capture base state for merging before optimistic update
        const basePayload = isNew ? null : await db.items.get(item.id);

        const optimisticItem: ItineraryItem = {
            ...item,
            id: isNew ? `temp-${Date.now()}` : item.id,
            updatedAt: Date.now()
        };

        // 1. Update Local DB Immediately (Optimistic)
        await db.items.put(optimisticItem);

        // 2. Try Sync
        try {
            const dbItem = {
                trip_id: optimisticItem.tripId,
                type: optimisticItem.type,
                title: optimisticItem.title,
                location: optimisticItem.location,
                end_location: optimisticItem.endLocation,
                latitude: optimisticItem.latitude,
                longitude: optimisticItem.longitude,
                country_code: optimisticItem.countryCode,
                end_latitude: optimisticItem.endLatitude,
                end_longitude: optimisticItem.endLongitude,
                end_country_code: optimisticItem.endCountryCode,
                start_date: new Date(optimisticItem.startDate).toISOString(),
                end_date: optimisticItem.endDate ? new Date(optimisticItem.endDate).toISOString() : null,
                duration_minutes: optimisticItem.durationMinutes,
                cost: optimisticItem.cost,
                paid_by: optimisticItem.paidBy,
                created_by: optimisticItem.createdBy,
                is_private: optimisticItem.isPrivate,
                show_in_timeline: optimisticItem.showInTimeline,
                details: optimisticItem.details,
                map_uri: optimisticItem.mapUri,
                tags: optimisticItem.tags,
                original_amount: optimisticItem.originalAmount,
                currency_code: optimisticItem.currencyCode,
                exchange_rate: optimisticItem.exchangeRate,
                receipt_items: optimisticItem.receiptItems
            };

            let resultId = optimisticItem.id;

            if (isNew) {
                const { data, error } = await supabase
                    .from('itinerary_items')
                    .insert(dbItem)
                    .select()
                    .single();
                if (error) throw error;
                resultId = data.id;
            } else {
                const { error } = await supabase
                    .from('itinerary_items')
                    .update(dbItem)
                    .eq('id', optimisticItem.id);
                if (error) throw error;
            }

            // Sync Splits
            await supabase.from('expense_splits').delete().eq('item_id', resultId);
            if (optimisticItem.splitWith && optimisticItem.splitWith.length > 0) {
                const splits = optimisticItem.splitWith.map(userId => ({
                    item_id: resultId,
                    user_id: userId,
                    amount: optimisticItem.splitDetails?.[userId] || (optimisticItem.cost / optimisticItem.splitWith.length)
                }));
                const { error: splitError } = await supabase.from('expense_splits').insert(splits);
                if (splitError) throw splitError;
            }

            // Update local ID if it was temporary
            if (isNew) {
                await db.items.delete(optimisticItem.id);
                const finalItem = { ...optimisticItem, id: resultId };
                await db.items.put(finalItem);
                return finalItem;
            }

            return optimisticItem;

        } catch (err) {
            console.warn('[tripService] Supabase write failed, enqueuing for background sync:', err);

            // 3. Fallback to Sync Queue
            const syncService = (await import('./SyncService')).syncService;
            await syncService.enqueue(
                'itinerary_items',
                isNew ? 'INSERT' : 'UPDATE',
                optimisticItem,
                basePayload
            );

            return optimisticItem;
        }
    },

    async deleteItineraryItem(itemId: string): Promise<void> {
        // 1. Update Local DB Immediately
        await db.items.delete(itemId);

        // 2. Try Sync
        try {
            const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
            if (error) throw error;
        } catch (err) {
            console.warn('[tripService] Supabase delete failed, enqueuing for background sync:', err);

            // 3. Fallback to Sync Queue
            const syncService = (await import('./SyncService')).syncService;
            await syncService.enqueue(
                'itinerary_items',
                'DELETE',
                { id: itemId }
            );
        }
    },

    // --- RECRUITMENT OPERATIONS ---

    async searchUsers(query: string): Promise<Member[]> {
        if (!query || query.length < 3) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(5);

        if (error) throw error;

        return data.map((p: any) => ({
            id: p.id,
            name: p.full_name || p.email.split('@')[0],
            email: p.email,
            avatarUrl: p.avatar_url,
            role: 'SCOUT', // Default placeholder
            status: 'ACTIVE'
        } as Member));
    },

    async addMemberToTrip(tripId: string, userId: string, role: Role): Promise<void> {
        // 1. Join the mission first with status ACTIVE (gaining RLS clearance)
        const { error: joinError } = await supabase
            .from('trip_members')
            .upsert({
                trip_id: tripId,
                user_id: userId,
                role: role,
                status: 'ACTIVE',
                personal_budget: 0
            }, { onConflict: 'trip_id,user_id' });

        if (joinError) throw joinError;

        // 2. Fetch the trip's overall budget (now allowed because we are a member)
        const { data: tripData, error: tripFetchError } = await supabase
            .from('trips')
            .select('budget')
            .eq('id', tripId)
            .single();

        // If trip fetch fails (e.g. invalid ID), we've already joined, 
        // but we can't sync budget. We'll ignore it as non-critical or log it.
        if (tripFetchError) {
            console.warn('Could not sync mission budget for recruit:', tripFetchError);
            return;
        }

        // 3. Synchronize the operatives personal budget with the mission budget
        if (tripData?.budget) {
            const { error: syncError } = await supabase
                .from('trip_members')
                .update({ personal_budget: tripData.budget })
                .eq('trip_id', tripId)
                .eq('user_id', userId);

            if (syncError) console.warn('Budget sync handshake failed:', syncError);
        }
    }
};
