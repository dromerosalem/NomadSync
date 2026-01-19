import React, { useState, useEffect, useRef } from 'react';
import { MapPinIcon } from './Icons';
import { locationService, LocationResult } from '../services/LocationService';

interface PlaceAutocompleteProps {
    value: string;
    onChange: (value: string, locationData?: LocationResult) => void;
    placeholder?: string;
}

const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({ value, onChange, placeholder = "Enter destination" }) => {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<LocationResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isTyping = useRef(false);

    // Sync external value to internal query
    useEffect(() => {
        if (!isTyping.current) {
            setQuery(value);
        }
    }, [value]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only search if the user is actively typing and the query is long enough
            if (isTyping.current && query.length >= 2) {
                setLoading(true);
                const data = await locationService.searchPlaces(query);
                setResults(data);
                setIsOpen(true); // Don't check length here, we might want to show "no results" fallback
                setLoading(false);
                isTyping.current = false; // Reset after search triggered
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Handle clicks outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                isTyping.current = false;
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (result: LocationResult) => {
        isTyping.current = false;
        setQuery(result.formatted);
        setIsOpen(false);
        onChange(result.formatted, result);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && results[activeIndex]) {
                handleSelect(results[activeIndex]);
            } else {
                // Manual entry on enter if nothing selected
                setIsOpen(false);
                isTyping.current = false;
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            isTyping.current = false;
        }
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase()
                        ? <span key={i} className="text-tactical-accent font-bold">{part}</span>
                        : <span key={i}>{part}</span>
                )}
            </span>
        );
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        isTyping.current = true;
                        setQuery(e.target.value);
                        onChange(e.target.value); // Allow manual entry propagation
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 pr-12 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loading && (
                        <div className="w-4 h-4 border-2 border-tactical-accent border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <MapPinIcon className="text-gray-400 w-5 h-5" />
                </div>
            </div>

            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 bg-tactical-card border border-tactical-muted/30 rounded-lg shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-fade-in divide-y divide-tactical-muted/10">
                    {/* Fallback Option if no results */}
                    {results.length === 0 && !loading && (
                        <li
                            onClick={() => {
                                setIsOpen(false);
                                // onChange(query); // Already handled by input change, just close
                            }}
                            className="p-4 cursor-pointer flex items-center gap-3 hover:bg-tactical-highlight transition-colors"
                        >
                            <div className="p-2 rounded-full bg-white/10 text-white">
                                <MapPinIcon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">Use "{query}"</span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Manual Entry • No Map Data</span>
                            </div>
                        </li>
                    )}

                    {results.map((result, index) => (
                        <li
                            key={`${result.lat}-${result.lon}-${index}`}
                            onClick={() => handleSelect(result)}
                            className={`p-4 cursor-pointer flex items-center justify-between hover:bg-tactical-highlight transition-colors ${index === activeIndex ? 'bg-tactical-highlight' : ''}`}
                        >
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                <span className="text-sm text-tactical-text truncate font-medium">
                                    {highlightMatch(result.formatted, query)}
                                </span>
                                <span className="text-[10px] text-tactical-muted uppercase tracking-widest flex items-center gap-1">
                                    Coordinates: {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                                </span>
                            </div>
                            <span className="text-2xl ml-4 drop-shadow-sm grayscale-[0.2]" title={result.country}>
                                {locationService.getFlagEmoji(result.countryCode)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PlaceAutocomplete;
