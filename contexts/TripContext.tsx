import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Trip, ItineraryItem, ItemType, Member } from '../types';
import { tripService } from '../services/tripService';
import { supabase } from '../services/supabaseClient';

// --- Types ---
interface TripContextState {
    trips: Trip[];
    isLoading: boolean;
}

interface TripContextValue extends TripContextState {
    // Actions
    loadAllData: (userId: string) => Promise<void>;
    refreshTrip: (tripId: string) => Promise<void>;
    setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

// --- Context ---
const TripContext = createContext<TripContextValue | undefined>(undefined);

// --- Semantic Sort Logic (moved from App.tsx) ---
const semanticSort = (items: ItineraryItem[]): ItineraryItem[] => {
    return [...items].sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);

        const dayDiff = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime() -
            new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();

        if (dayDiff !== 0) return dayDiff;

        const getWeight = (type: ItemType) => {
            if (type === ItemType.TRANSPORT) return 1;
            if (type === ItemType.STAY) return 2;
            if (type === ItemType.FOOD || type === ItemType.ACTIVITY) return 3;
            if (type === ItemType.SETTLEMENT) return 5;
            return 4;
        };

        const weightA = getWeight(a.type);
        const weightB = getWeight(b.type);

        if (weightA !== weightB) return weightA - weightB;

        return dateA.getTime() - dateB.getTime();
    });
};

// --- Provider ---
interface TripProviderProps {
    children: React.ReactNode;
    currentUserId: string | null;
}

export const TripProvider: React.FC<TripProviderProps> = ({ children, currentUserId }) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadAllData = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            // Stage 1: Fetch Trip Headers (Fast)
            const userTrips = await tripService.fetchUserTrips(userId);
            console.log('[TripContext] Staged Loading: Fetched trip headers:', userTrips.length);
            setTrips(userTrips);
            setIsLoading(false);

            // Stage 2: Fetch Itineraries in Background (Slower, concurrent)
            Promise.all(userTrips.map(async (trip) => {
                try {
                    const items = await tripService.fetchTripItinerary(trip.id);
                    const sorted = semanticSort(items);
                    setTrips(prev => prev.map(t =>
                        t.id === trip.id ? { ...t, items: sorted } : t
                    ));
                } catch (itemErr) {
                    console.error(`[TripContext] Failed to load itinerary for trip ${trip.id}:`, itemErr);
                }
            })).then(() => {
                console.log('[TripContext] Staged Loading: Background sync complete.');
            });

        } catch (err) {
            console.error('[TripContext] Error loading data:', err);
            setIsLoading(false);
        }
    }, []);

    const refreshTrip = useCallback(async (tripId: string) => {
        console.log(`[TripContext] Silent Refresh for trip: ${tripId}`);
        try {
            const items = await tripService.fetchTripItinerary(tripId);
            const sorted = semanticSort(items);
            setTrips(prev => prev.map(t =>
                t.id === tripId ? { ...t, items: sorted, updatedAt: Date.now() } : t
            ));
        } catch (err) {
            console.error('[TripContext] Silent refresh failed:', err);
        }
    }, []);

    // --- GLOBAL REAL-TIME SYNC (Moved from App.tsx) ---
    useEffect(() => {
        if (!currentUserId) return;

        console.log('[TripContext] Initializing Global Realtime Subscription');

        const channel = supabase.channel('global-user-updates-context')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'trip_members',
                    filter: `user_id=eq.${currentUserId}`
                },
                (payload) => {
                    console.log('[TripContext] Trip Member Invocation:', payload);
                    loadAllData(currentUserId);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'trips'
                },
                (payload) => {
                    const tripId = (payload.new as any)?.id;
                    const isRelevant = trips.some(t => t.id === tripId);
                    if (isRelevant || payload.eventType === 'INSERT') {
                        console.log('[TripContext] Trip Update Detected:', payload);
                        loadAllData(currentUserId);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, loadAllData, trips]);

    // --- GLOBAL ITINERARY ITEMS SYNC ---
    useEffect(() => {
        if (!currentUserId || trips.length === 0) return;

        const tripIds = trips.map(t => t.id);
        console.log('[TripContext] Initializing Itinerary Realtime for trips:', tripIds.length);

        const channel = supabase.channel('global-itinerary-sync-context')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'itinerary_items'
                },
                async (payload) => {
                    const newItem = payload.new as any;
                    if (tripIds.includes(newItem.trip_id)) {
                        console.log('[TripContext] New itinerary item detected:', newItem.id);
                        const item = await tripService.fetchSingleItem(newItem.id);
                        if (item) {
                            setTrips(prevTrips => prevTrips.map(t => {
                                if (t.id === item.tripId) {
                                    const exists = t.items.some(i => i.id === item.id);
                                    if (!exists) {
                                        return { ...t, items: [...t.items, item] };
                                    }
                                }
                                return t;
                            }));
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'itinerary_items'
                },
                async (payload) => {
                    const updatedItem = payload.new as any;
                    if (tripIds.includes(updatedItem.trip_id)) {
                        console.log('[TripContext] Updated itinerary item detected:', updatedItem.id);
                        const item = await tripService.fetchSingleItem(updatedItem.id);
                        if (item) {
                            setTrips(prevTrips => prevTrips.map(t => {
                                if (t.id === item.tripId) {
                                    return { ...t, items: t.items.map(i => i.id === item.id ? item : i) };
                                }
                                return t;
                            }));
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'itinerary_items'
                },
                async (payload) => {
                    const deletedItem = payload.old as any;
                    console.log('[TripContext] Deleted itinerary item detected:', deletedItem.id);
                    await tripService.deleteItemFromCache(deletedItem.id);
                    setTrips(prevTrips => prevTrips.map(t => ({
                        ...t,
                        items: t.items.filter(i => i.id !== deletedItem.id)
                    })));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, trips.length]);


    const value = useMemo(() => ({
        trips,
        isLoading,
        loadAllData,
        refreshTrip,
        setTrips,
        setIsLoading,
    }), [trips, isLoading, loadAllData, refreshTrip]);

    return (
        <TripContext.Provider value={value}>
            {children}
        </TripContext.Provider>
    );
};

// --- Hooks ---
export const useTrips = (): TripContextValue => {
    const context = useContext(TripContext);
    if (!context) {
        throw new Error('useTrips must be used within a TripProvider');
    }
    return context;
};

export const useTrip = (tripId: string | null): { trip: Trip | null; loading: boolean } => {
    const { trips, isLoading } = useTrips();
    const trip = useMemo(() => {
        if (!tripId) return null;
        return trips.find(t => t.id === tripId) || null;
    }, [trips, tripId]);

    return { trip, loading: isLoading };
};
