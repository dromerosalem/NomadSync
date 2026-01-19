import { db } from '../db/LocalDatabase';

export class CacheService {
    /**
     * Retrieves a value from the cache or computes it if missing/stale.
     * @param key The dynamic cache key (e.g. `trip_balances_${tripId}_${timestamp}`)
     * @param computeFn The expensive function to run if cache miss
     * @returns The computed or cached result
     */
    static async getOrCompute<T>(key: string, computeFn: () => T | Promise<T>): Promise<T> {
        try {
            // 1. Check Cache
            const cachedEntry = await db.calculated_balances.get(key);

            if (cachedEntry) {
                console.log(`[CacheService] Hit: ${key}`);
                return cachedEntry.data as T;
            }

            // 2. Compute
            console.log(`[CacheService] Miss: ${key}. Computing...`);
            const result = await computeFn();

            // 3. Store
            // We use 'put' to overwrite if exists, but keys should be unique per version
            await db.calculated_balances.put({
                cacheKey: key,
                data: result,
                updatedAt: Date.now()
            });

            // 4. Cleanup Stale Entries (Optional, can be done periodically or here)
            // For now, we rely on keys being unique. Real LRU cleaner would go here.
            // Simplified: Remove entries for same trip prefix but different timestamp? 
            // That requires parsing the key. For MVP, we just append.
            // A clearer strategy: `trip_balances_${tripId}` is the prefix.
            // This method assumes the caller constructs the versioned key.

            return result;
        } catch (error) {
            console.error('[CacheService] Error:', error);
            // Fallback to direct compute if DB fails
            return computeFn();
        }
    }

    /**
     * Clears all cached balances. call on logout.
     */
    static async clearAll() {
        await db.calculated_balances.clear();
    }
}
