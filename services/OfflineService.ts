
import { ItineraryItem } from '../types';

const DB_NAME = 'NomadSyncOfflineDB';
const STORE_NAME = 'offline_expenses';

export class OfflineService {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = this.initDB();
    }

    private initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    async saveOfflineItem(item: Partial<ItineraryItem>) {
        const db = await this.dbPromise;
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            // We use a temporary ID or just push it. If it has no ID, autoIncrement handles it.
            // But we probably want to assume it's a "PENDING_SYNC" item.
            const request = store.add({ ...item, syncStatus: 'PENDING' });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingItems(): Promise<any[]> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearSyncedItems(ids: number[]) {
        const db = await this.dbPromise;
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            ids.forEach(id => store.delete(id));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export const offlineService = new OfflineService();
