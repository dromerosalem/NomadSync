// CurrencyService - Currency conversion using Edge Function
// API keys now stored server-side in Supabase secrets

import { Trip, ItineraryItem } from '../types';
import { supabase } from './supabaseClient';

interface RateCache {
    [date: string]: {
        [currency: string]: number; // Rate relative to Base
    };
}

export class CurrencyService {
    private cacheKeyPrefix = 'nomadsync_rates_';

    constructor() { }

    /**
     * Converts an amount from one currency to another using the rate on a specific date.
     */
    async convert(amount: number, from: string, to: string, date: Date | string): Promise<{ amount: number; rate: number }> {
        if (from === to) return { amount, rate: 1 };

        // Normalize date to YYYY-MM-DD
        const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date.split('T')[0];

        const rate = await this.getRate(from, to, dateStr);
        return {
            amount: parseFloat((amount * rate).toFixed(2)),
            rate
        };
    }

    /**
     * Fetches the exchange rate from 'from' currency to 'to' currency on a specific date.
     */
    async getRate(from: string, to: string, date: string): Promise<number> {
        // Ensure date is normalized to YYYY-MM-DD (removes time if present)
        const dateStr = date.split('T')[0];

        // 1. Check Local Cache
        const cachedRate = this.getFromCache(from, to, dateStr);
        if (cachedRate) {
            console.log(`[CurrencyService] Cache Hit: ${from}->${to} on ${dateStr}`);
            return cachedRate;
        }

        // 2. Fetch via Edge Function (handles Frankfurter/ExchangeRate-API logic server-side)
        try {
            console.log(`[CurrencyService] 🚀 Calling convert-currency Edge Function: ${from}->${to} on ${dateStr}`);
            
            const { data, error } = await supabase.functions.invoke('convert-currency', {
                body: { amount: 1, from, to, date: dateStr }
            });

            if (error) {
                console.error('[CurrencyService] Edge Function error:', error);
                throw error;
            }

            const rate = data?.rate || 1;
            console.log(`[CurrencyService] ✅ Rate: ${from}->${to} = ${rate}`);

            // 3. Save to Cache
            this.saveToCache(from, to, dateStr, rate);

            return rate;
        } catch (error) {
            console.error('[CurrencyService] Rate fetch failed:', error);
            throw error;
        }
    }

    // API fetching logic is now handled by the Edge Function (server-side)
    // This keeps API keys secure and simplifies client code

    // --- Caching Logic ---

    private getFromCache(from: string, to: string, date: string): number | null {
        const key = `${this.cacheKeyPrefix}${date}`;
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        try {
            const data = JSON.parse(cached);
            // We might store rates like { "USD": { "EUR": 0.85, ... } } ??
            // Or simpler: We cache specific lookups?
            // "Daily Batch" suggests we might cache a whole base.
            // Let's stick to simple key-value for now: "USD_EUR": 0.95
            if (data[`${from}_${to}`]) return data[`${from}_${to}`];
        } catch (e) {
            return null;
        }
        return null;
    }

    private saveToCache(from: string, to: string, date: string, rate: number) {
        const key = `${this.cacheKeyPrefix}${date}`;
        let data: Record<string, number> = {};

        const existing = localStorage.getItem(key);
        if (existing) {
            try {
                data = JSON.parse(existing);
            } catch (e) { }
        }

        data[`${from}_${to}`] = rate;
        localStorage.setItem(key, JSON.stringify(data));
    }

    // --- Extended Currency Search & Caching ---

    private readonly extendedCurrencyCacheKey = 'nomadsync_extended_currencies';

    /**
     * Search for currencies by code or name via edge function.
     * Returns matching currencies from ExchangeRate-API.
     */
    async searchCurrencies(query: string): Promise<{ code: string; name: string }[]> {
        if (!query || query.length < 2) return [];

        try {
            console.log(`[CurrencyService] 🔍 Searching currencies: "${query}"`);
            
            const { data, error } = await supabase.functions.invoke('search-currencies', {
                body: { query }
            });

            if (error) {
                console.error('[CurrencyService] Search error:', error);
                return [];
            }

            return data?.currencies || [];
        } catch (error) {
            console.error('[CurrencyService] Search failed:', error);
            return [];
        }
    }

    /**
     * Cache a selected extended currency for the current day.
     * This allows the currency to appear in future searches without API calls.
     */
    cacheSelectedCurrency(currency: { code: string; name: string }): void {
        const today = new Date().toISOString().split('T')[0];
        const key = `${this.extendedCurrencyCacheKey}_${today}`;
        
        let cached = this.getCachedCurrencies();
        
        // Avoid duplicates
        if (!cached.some(c => c.code === currency.code)) {
            cached.push(currency);
            localStorage.setItem(key, JSON.stringify(cached));
            console.log(`[CurrencyService] ✅ Cached extended currency: ${currency.code}`);
        }
    }

    /**
     * Get cached extended currencies for the current day.
     */
    getCachedCurrencies(): { code: string; name: string }[] {
        const today = new Date().toISOString().split('T')[0];
        const key = `${this.extendedCurrencyCacheKey}_${today}`;
        
        const cached = localStorage.getItem(key);
        if (!cached) return [];

        try {
            return JSON.parse(cached);
        } catch (e) {
            return [];
        }
    }
}

export const currencyService = new CurrencyService();
