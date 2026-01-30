import { db, LocationCache } from '../db/LocalDatabase';
import { supabase } from './supabaseClient';

// API key now stored server-side in Supabase secrets

export interface LocationResult {
    name: string;
    city?: string;
    country: string;
    countryCode: string;
    lat: number;
    lon: number;
    formatted: string;
}

class LocationService {
    private cacheExpiry = 1000 * 60 * 60 * 24 * 7; // 7 days

    async searchPlaces(query: string): Promise<LocationResult[]> {
        if (!query || query.length < 2) return [];

        // 1. Check Cache
        const cached = await db.location_cache
            .where('query')
            .equals(query.toLowerCase().trim())
            .first();

        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            console.log(`[LocationService] Returning cached results for: ${query}`);
            return cached.results;
        }

        // 2. Fetch from Edge Function (proxy to Geoapify)
        try {
            console.log(`[LocationService] 🚀 Calling search-location Edge Function: ${query}`);
            
            const { data, error } = await supabase.functions.invoke('search-location', {
                body: { query }
            });

            if (error) {
                console.error('[LocationService] Edge Function error:', error);
                throw error;
            }

            const results: LocationResult[] = data?.results || [];

            // 3. Store in Cache
            if (results.length > 0) {
                await db.location_cache.put({
                    query: query.toLowerCase().trim(),
                    results: results,
                    timestamp: Date.now()
                });
            }

            console.log(`[LocationService] ✅ Found ${results.length} locations`);
            return results;
        } catch (error) {
            console.error('[LocationService] Search failed:', error);
            return [];
        }
    }

    /**
     * Converts a country code to a flag emoji.
     */
    getFlagEmoji(countryCode: string): string {
        if (!countryCode || countryCode.length !== 2) return '📍';
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    }
}

export const locationService = new LocationService();
