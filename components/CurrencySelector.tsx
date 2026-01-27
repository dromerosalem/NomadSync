import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon } from './Icons';
import { getCurrencySymbol } from '../utils/currencyUtils';

export const SUPPORTED_CURRENCIES = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'PLN', name: 'Polish Zloty' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'KRW', name: 'South Korean Won' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'MXN', name: 'Mexican Peso' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'RUB', name: 'Russian Ruble' },
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'TRY', name: 'Turkish Lira' },
    { code: 'BRL', name: 'Brazilian Real' },
    { code: 'TWD', name: 'Taiwan Dollar' },
    { code: 'DKK', name: 'Danish Krone' },
    { code: 'THB', name: 'Thai Baht' },
    { code: 'IDR', name: 'Indonesian Rupiah' },
    { code: 'HUF', name: 'Hungarian Forint' },
    { code: 'CZK', name: 'Czech Koruna' },
    { code: 'ILS', name: 'Israeli Shekel' },
    { code: 'CLP', name: 'Chilean Peso' },
    { code: 'PHP', name: 'Philippine Peso' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'COP', name: 'Colombian Peso' },
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'RON', name: 'Romanian Leu' }
];

const COMMON_CODES = ['USD', 'EUR', 'GBP', 'PLN'];

interface CurrencySelectorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
    variant?: 'default' | 'minimal';
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
    value,
    onChange,
    label = "Currency",
    disabled = false,
    variant = 'default'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredCurrencies = useMemo(() => {
        if (!search) return SUPPORTED_CURRENCIES;
        const lowSearch = search.toLowerCase();
        return SUPPORTED_CURRENCIES.filter(c =>
            c.code.toLowerCase().includes(lowSearch) ||
            c.name.toLowerCase().includes(lowSearch)
        );
    }, [search]);

    const commonCurrencies = SUPPORTED_CURRENCIES.filter(c => COMMON_CODES.includes(c.code));
    const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === value) || { code: value, name: value };

    const handleSelect = (code: string) => {
        onChange(code);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <>
            {variant === 'default' ? (
                <div className="space-y-2 w-full">
                    {label && <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>}
                    <button
                        type="button"
                        onClick={() => !disabled && setIsOpen(true)}
                        disabled={disabled}
                        className={`w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 flex items-center justify-between text-tactical-text transition-colors group ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-tactical-accent'}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-tactical-accent bg-tactical-accent/10 px-2 py-1 rounded border border-tactical-accent/20">
                                {selectedCurrency.code}
                            </span>
                            <span className="font-bold uppercase tracking-wide text-sm">{selectedCurrency.name}</span>
                        </div>
                        {!disabled && (
                            <div className="text-tactical-muted group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        )}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(true)}
                    disabled={disabled}
                    className={`bg-tactical-card border border-tactical-muted/30 rounded-lg px-3 py-1 text-sm font-bold text-tactical-accent flex items-center gap-1 transition-colors hover:border-tactical-accent ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {selectedCurrency.code}
                    {!disabled && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>}
                </button>
            )}

            {/* Bottom Sheet Overlay */}
            {isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="absolute inset-0" onClick={() => setIsOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-tactical-bg rounded-t-3xl sm:rounded-2xl border-t sm:border border-tactical-muted/30 flex flex-col h-[85vh] max-h-[85vh] sm:h-[600px] shadow-2xl overflow-hidden animate-slide-up">
                        <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0"></div>
                        <div className="px-6 pt-4 pb-4 border-b border-tactical-muted/10 shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest">Select Intelligence Currency</h3>
                                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white p-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>
                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-tactical-accent" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="SEARCH BY CODE OR EMITTER..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-tactical-muted/30 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-tactical-accent uppercase font-mono text-sm transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide min-h-0">
                            {!search && (
                                <div className="mb-6">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">Quick Assets (Common)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {commonCurrencies.map(c => (
                                            <button
                                                key={c.code}
                                                onClick={() => handleSelect(c.code)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${value === c.code ? 'bg-tactical-accent/20 border-tactical-accent' : 'bg-tactical-card border-tactical-muted/20 hover:border-tactical-accent/50'}`}
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center font-mono font-bold text-tactical-accent shrink-0">
                                                    {getCurrencySymbol(c.code)}
                                                </div>
                                                <div className="text-left overflow-hidden">
                                                    <div className="text-sm font-bold text-white leading-tight">{c.code}</div>
                                                    <div className="text-[9px] text-gray-500 truncate uppercase mt-0.5">{c.name}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">
                                    {search ? `Search Results (${filteredCurrencies.length})` : 'Global Manifest'}
                                </div>
                                <div className="space-y-1">
                                    {filteredCurrencies.map(c => (
                                        <button
                                            key={c.code}
                                            onClick={() => handleSelect(c.code)}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${value === c.code ? 'bg-tactical-accent/10 border border-tactical-accent/30' : 'hover:bg-tactical-card group'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded bg-black/40 border border-white/5 flex items-center justify-center font-mono font-bold text-gray-400 group-hover:text-tactical-accent group-hover:border-tactical-accent/30 transition-all">
                                                    {getCurrencySymbol(c.code)}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-white">{c.code}</div>
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{c.name}</div>
                                                </div>
                                            </div>
                                            {value === c.code && (
                                                <div className="text-tactical-accent">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    {filteredCurrencies.length === 0 && (
                                        <div className="text-center py-10">
                                            <div className="text-gray-600 text-xs font-bold uppercase tracking-widest mb-2">No Match In manifest</div>
                                            <div className="text-[10px] text-gray-700">Check encryption or try another code.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.getElementById('modal-root') || document.body
            )}
        </>
    );
};

export default CurrencySelector;
