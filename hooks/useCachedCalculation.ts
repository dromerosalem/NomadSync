import { useState, useEffect } from 'react';
import { CacheService } from '../services/CacheService';

/**
 * A hook that returns a cached value or `null` while computing.
 * It automatically handles async fetching from IndexedDB.
 * @param key Unique cache key (e.g. `trip_balance_123_v4`)
 * @param computeFn The expensive calculation function
 * @param dependencies Array of dependencies that trigger a re-check (usually [key])
 */
export function useCachedCalculation<T>(
    key: string,
    computeFn: () => T | Promise<T>,
    dependencies: any[] = []
): { result: T | null; isComputing: boolean } {
    const [result, setResult] = useState<T | null>(null);
    const [isComputing, setIsComputing] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setIsComputing(true);

        const fetch = async () => {
            try {
                const value = await CacheService.getOrCompute(key, computeFn);
                if (isMounted) {
                    setResult(value);
                    setIsComputing(false);
                }
            } catch (err) {
                console.error("[useCachedCalculation] Error:", err);
                if (isMounted) setIsComputing(false);
            }
        };

        fetch();

        return () => {
            isMounted = false;
        };
    }, [key, ...dependencies]);

    return { result, isComputing };
}
