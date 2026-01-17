import { supabase } from './supabaseClient';
import { Trip, ItineraryItem, Member, Role } from '../types';

export const tripService = {
    // --- TRIP OPERATIONS ---

    async fetchUserTrips(userId: string): Promise<Trip[]> {
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
          created_by,
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

        return (data || []).map((membership: any) => {
            const trip = membership.trips;
            return {
                id: trip.id,
                name: trip.name,
                destination: trip.destination,
                startDate: new Date(trip.start_date),
                endDate: new Date(trip.end_date),
                budget: trip.budget,
                status: trip.status,
                coverImage: trip.cover_image_url,
                budgetViewMode: trip.budget_view_mode || 'SMART',
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
                }))
            } as Trip;
        });
    },

    async createTrip(tripData: Omit<Trip, 'id' | 'items'>, creatorId: string): Promise<Trip> {
        // 1. Insert Trip
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .insert({
                name: tripData.name,
                destination: tripData.destination,
                start_date: new Date(tripData.startDate).toISOString(),
                end_date: new Date(tripData.endDate).toISOString(),
                budget: tripData.budget,
                cover_image_url: tripData.coverImage,
                budget_view_mode: tripData.budgetViewMode,
                status: tripData.status,
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
        if (updates.startDate) dbUpdates.start_date = new Date(updates.startDate).toISOString();
        if (updates.endDate) dbUpdates.end_date = new Date(updates.endDate).toISOString();
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.budgetViewMode) dbUpdates.budget_view_mode = updates.budgetViewMode;

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

    // --- ITINERARY OPERATIONS ---

    async fetchTripItinerary(tripId: string): Promise<ItineraryItem[]> {
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

        return (data || []).map((item: any) => ({
            id: item.id,
            tripId: item.trip_id,
            type: item.type,
            title: item.title,
            location: item.location,
            endLocation: item.end_location,
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
            splitWith: item.expense_splits.map((s: any) => s.user_id),
            splitDetails: item.expense_splits.reduce((acc: any, s: any) => {
                acc[s.user_id] = s.amount;
                return acc;
            }, {})
        } as ItineraryItem));
    },

    async saveItineraryItem(item: ItineraryItem): Promise<ItineraryItem> {
        const isNew = !item.id || item.id.length < 10; // UUID vs mock ID

        const dbItem = {
            trip_id: item.tripId,
            type: item.type,
            title: item.title,
            location: item.location,
            end_location: item.endLocation,
            start_date: new Date(item.startDate).toISOString(),
            end_date: item.endDate ? new Date(item.endDate).toISOString() : null,
            duration_minutes: item.durationMinutes,
            cost: item.cost,
            paid_by: item.paidBy,
            created_by: item.createdBy,
            is_private: item.isPrivate,
            show_in_timeline: item.showInTimeline,
            details: item.details,
            map_uri: item.mapUri,
            tags: item.tags
        };

        let resultId = item.id;

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
                .eq('id', item.id);
            if (error) throw error;
        }

        // Update Splits
        await supabase.from('expense_splits').delete().eq('item_id', resultId);

        if (item.splitWith && item.splitWith.length > 0) {
            const splits = item.splitWith.map(userId => ({
                item_id: resultId,
                user_id: userId,
                amount: item.splitDetails?.[userId] || (item.cost / item.splitWith.length)
            }));
            const { error: splitError } = await supabase.from('expense_splits').insert(splits);
            if (splitError) throw splitError;
        }

        return { ...item, id: resultId };
    },

    async deleteItineraryItem(itemId: string): Promise<void> {
        const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
        if (error) throw error;
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
        const { error } = await supabase
            .from('trip_members')
            .insert({
                trip_id: tripId,
                user_id: userId,
                role: role,
                status: 'ACTIVE',
                personal_budget: 0
            });

        if (error) {
            // Ignore duplicate key error (already added)
            if (error.code === '23505') return;
            throw error;
        }
    }
};
