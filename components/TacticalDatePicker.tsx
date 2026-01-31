import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon } from './Icons';

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

                            {/* Time Selector - Wheel Simulation */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block text-center">Operation Time (24H)</label>
                                <div className="flex justify-center items-center gap-4">
                                    {/* Hours */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button onClick={() => updateTime((hours + 1) % 24, minutes)} className="text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="m6 9 6 6 6-6" /></svg></button>
                                        <div className="bg-white/5 w-16 py-2 rounded-lg text-center font-mono text-2xl font-bold text-white border border-white/10">
                                            {hours.toString().padStart(2, '0')}
                                        </div>
                                        <button onClick={() => updateTime((hours - 1 + 24) % 24, minutes)} className="text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-600 pb-1">:</div>
                                    {/* Minutes */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button onClick={() => updateTime(hours, (minutes + 5) % 60)} className="text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="m6 9 6 6 6-6" /></svg></button>
                                        <div className="bg-white/5 w-16 py-2 rounded-lg text-center font-mono text-2xl font-bold text-white border border-white/10">
                                            {minutes.toString().padStart(2, '0')}
                                        </div>
                                        <button onClick={() => updateTime(hours, (minutes - 5 + 60) % 60)} className="text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
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
