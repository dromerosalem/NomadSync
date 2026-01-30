import Dexie, { type EntityTable } from 'dexie';
import { Trip, ItineraryItem } from '../types';

interface CachedBalance {
    cacheKey: string;
    data: any;
    updatedAt: number;
}

interface SyncLog {
    id?: number;
    table: 'trips' | 'itinerary_items' | 'expense_splits' | 'trip_members';
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    base_payload?: any; // Added to store base state for merging
    timestamp: number;
    status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
    errorMessage?: string;
    retries: number;
}

interface LocationCache {
    id?: number;
    query: string;
    results: any;
    timestamp: number;
}

const db = new Dexie('NomadSyncDB') as Dexie & {
    trips: EntityTable<Trip, 'id'>;
    items: EntityTable<ItineraryItem, 'id'>;
    calculated_balances: EntityTable<CachedBalance, 'cacheKey'>;
    sync_queue: EntityTable<SyncLog, 'id'>;
    location_cache: EntityTable<LocationCache, 'id'>;
};

// Schema Definition
db.version(1).stores({
    trips: 'id, updated_at',
    items: 'id, tripId, updated_at',
    calculated_balances: 'cacheKey'
});

db.version(2).stores({
    sync_queue: '++id, table, operation, status, timestamp'
});

db.version(3).stores({
    sync_queue: '++id, status, table, timestamp'
});

db.version(4).stores({
    trips: 'id, updatedAt',
    items: 'id, tripId, updatedAt',
    sync_queue: '++id, status, table, timestamp',
    location_cache: '++id, query, timestamp'
});

export { db };
export type { CachedBalance, SyncLog, LocationCache };

// ==========================================
// HELPER FUNCTIONS FOR LOCAL-FIRST OPERATIONS
// ==========================================

/**
 * Upsert a single trip to local cache
 */
export async function cacheTrip(trip: Trip): Promise<void> {
    await db.trips.put(trip);
}

/**
 * Upsert multiple trips to local cache
 */
export async function cacheTrips(trips: Trip[]): Promise<void> {
    await db.trips.bulkPut(trips);
}

/**
 * Upsert a single itinerary item to local cache
 */
export async function cacheItem(item: ItineraryItem): Promise<void> {
    await db.items.put(item);
}

/**
 * Upsert multiple itinerary items to local cache
 */
export async function cacheItems(items: ItineraryItem[]): Promise<void> {
    await db.items.bulkPut(items);
}

/**
 * Delete an itinerary item from local cache
 */
export async function removeItem(itemId: string): Promise<void> {
    await db.items.delete(itemId);
}

/**
 * Get all trips from local cache
 */
export async function getCachedTrips(): Promise<Trip[]> {
    return db.trips.toArray();
}

/**
 * Get a single trip from local cache
 */
export async function getCachedTrip(tripId: string): Promise<Trip | undefined> {
    return db.trips.get(tripId);
}

/**
 * Get all items for a trip from local cache
 */
export async function getCachedItems(tripId: string): Promise<ItineraryItem[]> {
    return db.items.where('tripId').equals(tripId).toArray();
}

/**
 * Get a single item from local cache
 */
export async function getCachedItem(itemId: string): Promise<ItineraryItem | undefined> {
    return db.items.get(itemId);
}
