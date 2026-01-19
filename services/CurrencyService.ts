
import { Trip, ItineraryItem } from '../types';

const FRANKFURTER_API = 'https://api.frankfurter.app';
const EXCHANGE_RATE_API_KEY = '5aecdd0e0d6bb013b6849c05';
const EXCHANGE_RATE_API_BASE = 'https://v6.exchangerate-api.com/v6';

// List of currencies supported by Frankfurter (Free & Unlimited)
const OCTOPUS_CURRENCIES = new Set([
    'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
    'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
    'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
]);

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

        let rate: number;

        // 2. Try Frankfurter (If both currencies are supported)
        if (OCTOPUS_CURRENCIES.has(from) && OCTOPUS_CURRENCIES.has(to)) {
            try {
                rate = await this.fetchFrankfurter(from, to, dateStr);
            } catch (err) {
                console.warn('Frankfurter failed, falling back to ExchangeRate-API', err);
                rate = await this.fetchExchangeRateAPI(from, to, dateStr); // Fallback
            }
        } else {
            // 3. Use ExchangeRate-API for exotic currencies
            rate = await this.fetchExchangeRateAPI(from, to, dateStr);
        }

        // 4. Save to Cache
        this.saveToCache(from, to, dateStr, rate);

        return rate;
    }

    private async fetchFrankfurter(from: string, to: string, date: string): Promise<number> {
        // Frankfurter supports historical dates directly
        // If date is today, use 'latest' otherwise use date
        const today = new Date().toISOString().split('T')[0];
        const endpoint = date === today ? 'latest' : date;

        const response = await fetch(`${FRANKFURTER_API}/${endpoint}?from=${from}&to=${to}`);
        if (!response.ok) throw new Error('Frankfurter API Error');

        const data = await response.json();
        return data.rates[to];
    }

    private async fetchExchangeRateAPI(from: string, to: string, date: string): Promise<number> {
        // ExchangeRate-API free tier often only allows 'latest' with base USD?
        // Wait, the key provided is likely a free key. Free tier typically allows limited base currencies? 
        // Actually, ExchangeRate-API (standard) usually allows any base.
        // However, historical data requires a paid plan on some APIs.
        // The PROMPT says: "Primary (Frankfurter API)... Fallback (ExchangeRate-API)".
        // If historical fails on free tier, we might have to use 'latest' as a fallback, 
        // but ideally we try historical first.
        // Docs: https://www.exchangerate-api.com/docs/historical-data-requests (Paid only for historical?)
        // "Historical exchange rates are available on the Pro and Business plans." -> Limitation.
        // So for free tier, we might ONLY be able to get `latest`.
        // STRATEGY: Try historical call, if 403/error, fall back to `latest` and warn.

        const year = date.split('-')[0];
        const month = date.split('-')[1];
        const day = date.split('-')[2];

        try {
            // Try historical first (Standard request format: /v6/key/history/code/year/month/day)
            // Check specific URL format for historical: https://v6.exchangerate-api.com/v6/YOUR-API-KEY/history/USD/2020/4/30
            const url = `${EXCHANGE_RATE_API_BASE}/${EXCHANGE_RATE_API_KEY}/history/${from}/${year}/${month}/${day}`;
            const res = await fetch(url);

            if (res.ok) {
                const data = await res.json();
                if (data.conversion_rates && data.conversion_rates[to]) {
                    return data.conversion_rates[to];
                }
            }
        } catch (e) {
            // Ignore and fallback
        }

        console.warn(`[CurrencyService] Historical data unavailable for ${from} on ${date} (Free Tier limitation). Using LATEST.`);

        // Fallback to Latest
        const urlValues = `${EXCHANGE_RATE_API_BASE}/${EXCHANGE_RATE_API_KEY}/latest/${from}`;
        const res = await fetch(urlValues);
        if (!res.ok) throw new Error('ExchangeRate-API Error');
        const data = await res.json();
        return data.conversion_rates[to];
    }

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
}

export const currencyService = new CurrencyService();
