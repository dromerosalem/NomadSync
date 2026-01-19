
import React, { useState } from 'react';
import { Trip } from '../types';
import { MapPinIcon, ChevronLeftIcon } from './Icons';
import { getCurrencySymbol } from '../utils/currencyUtils';

interface EditTripProps {
  trip: Trip;
  onUpdate: (updatedTrip: Trip) => void;
  onCancel: () => void;
  currentUserId: string;
}

import CurrencySelector from './CurrencySelector';

const EditTrip: React.FC<EditTripProps> = ({ trip, onUpdate, onCancel, currentUserId }) => {
  const [name, setName] = useState(trip.name);
  const [location, setLocation] = useState(trip.destination);
  const [baseCurrency, setBaseCurrency] = useState(trip.baseCurrency || 'USD');

  // Initialize budget from Current User's Personal Budget
  const currentUser = trip.members.find(m => m.id === currentUserId);
  const [budget, setBudget] = useState(currentUser?.budget?.toString() || '');

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date(trip.startDate));
  const [startDate, setStartDate] = useState<Date | null>(new Date(trip.startDate));
  const [endDate, setEndDate] = useState<Date | null>(new Date(trip.endDate));

  const handleSubmit = () => {
    if (name && location && startDate && endDate) {
      // Update Current User's budget in the members list
      const updatedMembers = trip.members.map(m =>
        m.id === currentUserId ? { ...m, budget: parseInt(budget) || 0 } : m
      );

      onUpdate({
        ...trip,
        name,
        destination: location,
        baseCurrency,
        startDate,
        endDate,
        members: updatedMembers // Pass updated members with new budget
      });
    }
  };

  // Calendar Logic
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentYear, currentMonth, day);
    clickedDate.setHours(0, 0, 0, 0);

    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
    } else {
      if (clickedDate < startDate) {
        setStartDate(clickedDate);
        setEndDate(null);
      } else if (isSameDay(clickedDate, startDate)) {
        // Do nothing
      } else {
        setEndDate(clickedDate);
      }
    }
  };

  const getDayClass = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);

    const isStart = startDate && isSameDay(date, startDate);
    const isEnd = endDate && isSameDay(date, endDate);

    let isInRange = false;
    if (startDate && endDate) {
      isInRange = date > startDate && date < endDate;
    }

    if (isStart || isEnd) {
      return 'bg-tactical-accent text-black font-bold shadow-[0_0_10px_rgba(255,215,0,0.5)]';
    }
    if (isInRange) {
      return 'bg-tactical-accent/20 text-white';
    }
    return 'text-gray-400 hover:text-white hover:bg-tactical-card';
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Modify Mission
        </div>
        <div className="w-6"></div> {/* Spacer */}
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        <div className="space-y-8">
          {/* Mission Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mission Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors"
            />
          </div>

          {/* Target Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Target Location</label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 pr-12 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors"
              />
              <MapPinIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Personal Budget ({getCurrencySymbol(baseCurrency)})</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-[10px] text-gray-500">Updating this value changes your personal tracking only.</p>
          </div>

          {/* Mission Currency */}
          <CurrencySelector
            label="Mission Base Currency"
            value={baseCurrency}
            onChange={setBaseCurrency}
          />
          <p className="text-[10px] text-gray-500 mt-1">All expenses for this mission will be converted to this currency.</p>

          {/* Interactive Calendar */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mission Timeline</label>
            <div className="bg-tactical-card rounded-xl p-6 border border-tactical-muted/20">
              <div className="flex justify-between items-center mb-6">
                <button onClick={handlePrevMonth} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center hover:text-white hover:bg-tactical-highlight rounded-full transition-colors">‹</button>
                <h3 className="font-display font-bold text-white uppercase tracking-wider">
                  {monthNames[currentMonth]} {currentYear}
                </h3>
                <button onClick={handleNextMonth} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center hover:text-white hover:bg-tactical-highlight rounded-full transition-colors">›</button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-sm">
                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
                  <span key={d} className="text-tactical-muted font-bold text-[10px] tracking-widest">{d}</span>
                ))}

                {/* Empty spaces */}
                {Array.from({ length: firstDayOfWeek }, (_, i) => (
                  <div key={`empty-${i}`} className="p-2"></div>
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    className={`p-2 rounded-full text-xs transition-all duration-200 ${getDayClass(day)}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 pb-2">
            <button
              onClick={handleSubmit}
              disabled={!name || !location || !startDate || !endDate}
              className="w-full bg-tactical-accent hover:bg-yellow-500 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            >
              CONFIRM UPDATES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTrip;
