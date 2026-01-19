import { db, LocationCache } from '../db/LocalDatabase';

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

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

        // 2. Fetch from Geoapify
        try {
            console.log(`[LocationService] Fetching from Geoapify: ${query}`);
            const response = await fetch(
                `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=10&apiKey=${GEOAPIFY_API_KEY}&lang=en`
            );

            if (!response.ok) throw new Error('Location search failed');

            const data = await response.json();

            const results: LocationResult[] = data.features.map((f: any) => ({
                name: f.properties.name || f.properties.city || f.properties.country,
                city: f.properties.city,
                country: f.properties.country,
                countryCode: f.properties.country_code?.toUpperCase(),
                lat: f.properties.lat,
                lon: f.properties.lon,
                formatted: f.properties.formatted
            }));

            // 3. Store in Cache
            await db.location_cache.put({
                query: query.toLowerCase().trim(),
                results: results,
                timestamp: Date.now()
            });

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
