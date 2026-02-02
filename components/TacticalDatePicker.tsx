import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeftIcon } from './Icons';

interface TimeWheelProps {
    value: number;
    range: number;
    onChange: (val: number) => void;
}

const TimeWheel: React.FC<TimeWheelProps> = ({ value, range, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemHeight = 40; // Matches CSS .wheel-item height
    const loopCount = 5; // Repeat range to simulate infinite scroll
    const options = Array.from({ length: range * loopCount }, (_, i) => i % range);

    const scrollToValue = useCallback((val: number, smooth = true) => {
        if (!containerRef.current) return;
        const targetIndex = val + range * Math.floor(loopCount / 2);
        containerRef.current.scrollTo({
            top: targetIndex * itemHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, [range, itemHeight, loopCount]);

    useEffect(() => {
        scrollToValue(value, false);
    }, []); // Initial scroll

    // Sync if external value changes (e.g. from scan)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Calculate current scroll index to see if we need to sync
        const currentIndex = Math.round(container.scrollTop / itemHeight) % range;
        if (currentIndex !== value) {
            scrollToValue(value);
        }
    }, [value, range, scrollToValue]);

    const handleScroll = () => {
        const container = containerRef.current;
        if (!container) return;

        const scrollTop = container.scrollTop;
        const index = Math.round(scrollTop / itemHeight);
        const actualValue = options[index];

        // Infinite loop logic: if we get too close to edges, jump to middle
        if (index < range) {
            container.scrollTo({ top: (index + range * 2) * itemHeight, behavior: 'auto' });
        } else if (index > range * 4) {
            container.scrollTo({ top: (index - range * 2) * itemHeight, behavior: 'auto' });
        }

        if (actualValue !== value) {
            onChange(actualValue);
        }
    };

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="wheel-container w-20 bg-white/5 rounded-xl border border-white/10"
        >
            {/* Pad top/bottom to allow snapping to middle */}
            <div style={{ height: itemHeight }} />
            {options.map((opt, i) => (
                <div
                    key={i}
                    className={`wheel-item ${opt === value ? 'selected' : ''}`}
                >
                    {opt.toString().padStart(2, '0')}
                </div>
            ))}
            <div style={{ height: itemHeight }} />
        </div>
    );
};

interface TacticalDatePickerProps {
    label: string;
    value: Date | string;
    onChange: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
}

const TacticalDatePicker: React.FC<TacticalDatePickerProps> = ({ label, value, onChange, minDate, maxDate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dateValue = typeof value === 'string' ? new Date(value) : value;

    // View state
    const [viewDate, setViewDate] = useState(dateValue);
    const [selectedDate, setSelectedDate] = useState(dateValue);

    // Time state
    const [hours, setHours] = useState(dateValue.getHours());
    const [minutes, setMinutes] = useState(dateValue.getMinutes());

    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setViewDate(typeof value === 'string' ? new Date(value) : value);
            const d = typeof value === 'string' ? new Date(value) : value;
            setSelectedDate(d);
            setHours(d.getHours());
            setMinutes(d.getMinutes());
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, value]);

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

    // Calendar Logic
    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const handleDateClick = (day: number) => {
        const newDate = new Date(currentYear, currentMonth, day);
        newDate.setHours(hours, minutes);
        setSelectedDate(newDate);
    };

    const isSameDay = (d1: Date, d2: Date) =>
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    const handleConfirm = () => {
        const finalDate = new Date(selectedDate);
        finalDate.setHours(hours, minutes);
        onChange(finalDate);
        setIsOpen(false);
    };

    const formatDisplay = (date: Date) => {
        const d = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const t = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${d} @ ${t}`;
    };

    // Quick Time Selectors
    const updateTime = (h: number, m: number) => {
        setHours(h);
        setMinutes(m);
        const newDate = new Date(selectedDate);
        newDate.setHours(h, m);
        setSelectedDate(newDate);
    };

    return (
        <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">{label}</label>

            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-3 flex items-center justify-between group active:scale-[0.99] transition-all"
            >
                <span className="font-mono text-white text-sm font-bold tracking-wide">
                    {formatDisplay(dateValue)}
                </span>
                <div className="text-tactical-accent opacity-70 group-hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                </div>
            </button>

            {/* Bottom Sheet Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div
                        ref={modalRef}
                        className="bg-[#1A1A18] w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border border-tactical-muted/20 shadow-2xl overflow-hidden animate-slide-up"
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em]">Select Timeframe</span>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* Month Nav */}
                            <div className="flex justify-between items-center">
                                <button onClick={handlePrevMonth} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition-colors">
                                    <ChevronLeftIcon className="w-5 h-5" />
                                </button>
                                <div className="font-display font-bold text-white text-lg tracking-wider">
                                    {monthNames[currentMonth]} <span className="text-tactical-accent">{currentYear}</span>
                                </div>
                                <button onClick={handleNextMonth} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition-colors rotate-180">
                                    <ChevronLeftIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                    <span key={`${d}-${i}`} className="text-[10px] font-bold text-gray-600 py-2">{d}</span>
                                ))}
                                {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const date = new Date(currentYear, currentMonth, day);
                                    const isSelected = isSameDay(date, selectedDate);
                                    const isToday = isSameDay(date, new Date());

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => handleDateClick(day)}
                                            className={`
                                                h-9 w-9 rounded-full text-xs font-bold flex items-center justify-center mx-auto transition-all
                                                ${isSelected
                                                    ? 'bg-tactical-accent text-black shadow-[0_0_10px_rgba(255,215,0,0.4)] scale-110'
                                                    : 'text-gray-300 hover:bg-white/10'}
                                                ${isToday && !isSelected ? 'border border-tactical-accent/50 text-tactical-accent' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Time Selector - Wheel Scroller */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 block text-center">Operation Time (24H)</label>

                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex justify-center items-center gap-4 relative">
                                        {/* Central Highlight Bar - Now perfectly centered with the wheels */}
                                        <div className="absolute inset-x-[-12px] top-1/2 -translate-y-1/2 h-10 border-y border-tactical-accent/30 pointer-events-none bg-tactical-accent/5 rounded-md" />

                                        <TimeWheel value={hours} range={24} onChange={(h) => updateTime(h, minutes)} />

                                        <div className="text-2xl font-bold text-gray-600 z-10">:</div>

                                        <TimeWheel value={minutes} range={60} onChange={(m) => updateTime(hours, m)} />
                                    </div>

                                    {/* Labels outside the centered wheel block */}
                                    <div className="flex justify-between w-full max-w-[180px] px-2">
                                        <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Hours</span>
                                        <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Minutes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Confirm Button */}
                            <button
                                onClick={handleConfirm}
                                className="w-full bg-tactical-accent text-black font-bold uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.2)] active:scale-[0.98] transition-transform"
                            >
                                Confirm Timing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TacticalDatePicker;
