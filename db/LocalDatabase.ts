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
    timestamp: number;
    status: 'PENDING' | 'SYNCING' | 'FAILED';
    errorMessage?: string;
    retries: number;
}

const db = new Dexie('NomadSyncDB') as Dexie & {
    trips: EntityTable<Trip, 'id'>;
    items: EntityTable<ItineraryItem, 'id'>;
    calculated_balances: EntityTable<CachedBalance, 'cacheKey'>;
    sync_queue: EntityTable<SyncLog, 'id'>;
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

export { db };
export type { CachedBalance, SyncLog };
