import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurrencyService } from '../CurrencyService';

// Mock supabase client
vi.mock('../supabaseClient', () => ({
    supabase: {
        functions: {
            invoke: vi.fn()
        }
    }
}));

import { supabase } from '../supabaseClient';

describe('CurrencyService', () => {
    let service: CurrencyService;

    beforeEach(() => {
        service = new CurrencyService();
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('searchCurrencies', () => {
        it('returns empty array for queries less than 2 characters', async () => {
            const result = await service.searchCurrencies('V');
            expect(result).toEqual([]);
        });

        it('returns matching currencies from API', async () => {
            const mockCurrencies = [
                { code: 'VND', name: 'Vietnamese Dong' },
                { code: 'VUV', name: 'Vanuatu Vatu' }
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { currencies: mockCurrencies },
                error: null
            });

            const result = await service.searchCurrencies('VN');
            expect(result).toEqual(mockCurrencies);
            expect(supabase.functions.invoke).toHaveBeenCalledWith('search-currencies', {
                body: { query: 'VN' }
            });
        });

        it('handles API errors gracefully', async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: new Error('API Error')
            });

            const result = await service.searchCurrencies('VND');
            expect(result).toEqual([]);
        });
    });

    describe('cacheSelectedCurrency', () => {
        it('caches a new extended currency', () => {
            const currency = { code: 'VND', name: 'Vietnamese Dong' };
            service.cacheSelectedCurrency(currency);

            const cached = service.getCachedCurrencies();
            expect(cached).toContainEqual(currency);
        });

        it('does not duplicate cached currencies', () => {
            const currency = { code: 'VND', name: 'Vietnamese Dong' };
            service.cacheSelectedCurrency(currency);
            service.cacheSelectedCurrency(currency);

            const cached = service.getCachedCurrencies();
            expect(cached.filter(c => c.code === 'VND')).toHaveLength(1);
        });

        it('caches multiple currencies', () => {
            const vnd = { code: 'VND', name: 'Vietnamese Dong' };
            const bdt = { code: 'BDT', name: 'Bangladeshi Taka' };
            
            service.cacheSelectedCurrency(vnd);
            service.cacheSelectedCurrency(bdt);

            const cached = service.getCachedCurrencies();
            expect(cached).toHaveLength(2);
            expect(cached).toContainEqual(vnd);
            expect(cached).toContainEqual(bdt);
        });
    });

    describe('getCachedCurrencies', () => {
        it('returns empty array when no cache exists', () => {
            const cached = service.getCachedCurrencies();
            expect(cached).toEqual([]);
        });

        it('returns cached currencies for current day', () => {
            const currency = { code: 'VND', name: 'Vietnamese Dong' };
            service.cacheSelectedCurrency(currency);

            const cached = service.getCachedCurrencies();
            expect(cached).toContainEqual(currency);
        });

        it('uses daily cache key format', () => {
            const currency = { code: 'VND', name: 'Vietnamese Dong' };
            service.cacheSelectedCurrency(currency);

            const today = new Date().toISOString().split('T')[0];
            const key = `nomadsync_extended_currencies_${today}`;
            
            expect(localStorage.getItem(key)).toBeTruthy();
        });
    });
});
