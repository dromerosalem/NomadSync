import React, { useState, useMemo } from 'react';
import { ArrowRightIcon, ChevronLeftIcon } from './Icons';
import { Member } from '../types';
import { getCurrencySymbol } from '../utils/currencyUtils';
import PlaceAutocomplete from './PlaceAutocomplete';
import { LocationResult } from '../services/LocationService';

interface CreateMissionProps {
  onCreate: (name: string, location: string, budget: number, startDate: Date, endDate: Date, initialMembers: Member[], baseCurrency: string, metadata?: { lat: number, lon: number, countryCode: string }, dailyBudget?: number, budgetViewMode?: 'SMART' | 'DIRECT') => void;
  onBack: () => void;
  isLoading: boolean;
}

import CurrencySelector from './CurrencySelector';

const INSPIRING_PHRASES = [
  "Leave the coordinates behind and let the horizon find you.",
  "There are some paths you can only find when you’re willing to get lost.",
  "The best stories aren't told; they are lived in the places you haven't been.",
  "Collect moments that your soul will remember long after the tan fades.",
  "Somewhere between the map and the destination, you’ll find the magic.",
  "Your comfort zone is a beautiful place, but nothing ever grows there.",
  "Adventure is the bridge between who you are and who you’re becoming.",
  "Wander with purpose, explore with passion, and return with a new soul.",
  "The world is too big to stay in one place, and your spirit is too bright to stay small.",
  "Every sunrise in a new city is a chance to start your story over again.",
  "Build a life you don't need a vacation from, one discovery at a time.",
  "True discovery isn't finding new lands, but seeing through new eyes.",
  "Life is short and the world is wide. Better get started.",
  "Follow the compass of your heart; it always knows the way to the extraordinary.",
  "The mountains are calling, the oceans are waiting, and your circle is ready.",
  "Let’s go where the Wi-Fi is weak but the connection is real.",
  "Traveling is the only thing you buy that makes you richer.",
  "A journey of a thousand miles begins with a single 'Yes'.",
  "Find a place where your soul feels as vast as the open road.",
  "Pack light, live deep, and let the adventure write the rest.",
  "The road ahead is a blank page; your footsteps are the ink.",
  "Don't just travel to see; travel to feel the pulse of the unknown.",
  "The greatest legacy is the collection of horizons you've touched.",
  "Seek not to find yourself, but to create yourself in new places.",
  "Every passport stamp is a badge of courage for the curious soul.",
  "The stars look different from every corner of the earth; go see them.",
  "Adventure isn't outside; it's the spark within that calls you forward.",
  "Bridges were meant to be crossed, and borders were meant to be blurred.",
  "Distance is just a measure of how far your dreams can reach.",
  "The destination is the period, but the journey is the poetry.",
];

const CreateMission: React.FC<CreateMissionProps> = ({ onCreate, onBack, isLoading }) => {
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Logistics, Step 2: Financials

  // Step 1 State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locationMetadata, setLocationMetadata] = useState<{ lat: number, lon: number, countryCode: string } | undefined>();

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Step 2 State
  const [budget, setBudget] = useState('2000');
  const [dailyBudget, setDailyBudget] = useState('');
  const [showDailyBudget, setShowDailyBudget] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [budgetViewMode, setBudgetViewMode] = useState<'SMART' | 'DIRECT'>('SMART');

  const randomSubheader = useMemo(() => INSPIRING_PHRASES[Math.floor(Math.random() * INSPIRING_PHRASES.length)], []);

  const handleNext = () => {
    if (name && location && startDate) {
      setStep(2);
    }
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleSubmit = () => {
    if (name && location && startDate) {
      const mockMembers: Member[] = [];
      // Default to single day trip if no end date selected
      onCreate(name, location, parseInt(budget) || 0, startDate, endDate || startDate, mockMembers, baseCurrency, locationMetadata, parseInt(dailyBudget) || 0, budgetViewMode);
    }
  };

  // Calendar Logic
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth); // 0 = Sun

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
        // Deselect logic if needed
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
    <div className="flex flex-col h-full animate-fade-in bg-tactical-bg">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-30 border-b border-tactical-muted/10">
        <button onClick={step === 1 ? onBack : handleBackStep} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex gap-2">
          <div className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${step === 1 ? 'bg-tactical-accent' : 'bg-gray-700'}`}></div>
          <div className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${step === 2 ? 'bg-tactical-accent' : 'bg-gray-700'}`}></div>
        </div>
        <div className="w-6"></div> {/* Spacer */}
      </header>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        <header className="mb-8 mt-2">
          <h1 className="font-display text-4xl font-bold text-tactical-accent uppercase leading-tight mb-2">
            {step === 1 ? "Chart Your\nAdventure" : "Fund The\nJourney"}
          </h1>
          <p className="text-tactical-muted tracking-widest text-xs uppercase font-medium">
            {step === 1 ? randomSubheader : "Set your boundaries, then break them."}
          </p>
        </header>

        <div className="space-y-8">

          {/* STEP 1: LOGISTICS */}
          {step === 1 && (
            <div className="animate-fade-in space-y-8">
              {/* Mission Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trip Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spain Adventure"
                  className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors"
                />
              </div>

              {/* Base Location */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Departure City</label>
                <PlaceAutocomplete
                  value={location}
                  onChange={(val, meta) => {
                    setLocation(val);
                    if (meta) {
                      setLocationMetadata({ lat: meta.lat, lon: meta.lon, countryCode: meta.countryCode });
                    }
                  }}
                  placeholder="Enter origin city"
                />
              </div>

              {/* Calendar */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trip Dates</label>
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
            </div>
          )}

          {/* STEP 2: FINANCIALS */}
          {step === 2 && (
            <div className="animate-fade-in space-y-8">
              {/* Budget */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Personal Budget ({getCurrencySymbol(baseCurrency)})</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="2000"
                  className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-[10px] text-gray-500">This budget is private to you and tracked separately from other members.</p>
              </div>

              {/* Daily Budget (Optional Toggle) */}
              <div className="space-y-4">
                {!showDailyBudget ? (
                  <button
                    type="button"
                    onClick={() => setShowDailyBudget(true)}
                    className="w-full py-3 border border-dashed border-tactical-muted/30 rounded-lg text-tactical-muted text-xs font-bold uppercase tracking-wider hover:border-tactical-accent/50 hover:text-tactical-accent transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span> Set Daily Spending Limit
                  </button>
                ) : (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Daily Budget ({getCurrencySymbol(baseCurrency)})</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDailyBudget(false);
                          setDailyBudget('');
                        }}
                        className="text-[10px] text-red-500/70 hover:text-red-500 uppercase font-bold tracking-tighter"
                      >
                        Remove Limit
                      </button>
                    </div>
                    <input
                      type="number"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      placeholder="e.g. 150"
                      className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-500">Resets daily at 00:00. You'll get notified if you exceed this limit.</p>
                  </div>
                )}
              </div>

              {/* Base Currency */}
              <CurrencySelector
                label="Trip Currency"
                value={baseCurrency}
                onChange={setBaseCurrency}
              />

              {/* Split Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expense Split Mode</label>
                <div className="flex items-center gap-2 bg-tactical-card rounded-lg p-1 border border-tactical-muted/30">
                  <button
                    type="button"
                    onClick={() => setBudgetViewMode('DIRECT')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${budgetViewMode === 'DIRECT' ? 'bg-tactical-accent text-black' : 'text-gray-500 hover:text-white'}`}
                  >
                    Direct View
                  </button>
                  <button
                    type="button"
                    onClick={() => setBudgetViewMode('SMART')}
                    className={`flex-1 px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${budgetViewMode === 'SMART' ? 'bg-tactical-accent text-black' : 'text-gray-500 hover:text-white'}`}
                  >
                    Smart Route
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  {budgetViewMode === 'SMART'
                    ? 'Smart Route optimizes group settlements with fewer transfers.'
                    : 'Direct View shows exact individual debts between members.'}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Action Button - Spans full width */}
        <div className="pt-8 pb-2">
          {step === 1 ? (
            <button
              onClick={handleNext}
              disabled={!name || !location || !startDate}
              className="w-full bg-white hover:bg-gray-200 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              START PLANNING <ArrowRightIcon className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-tactical-accent hover:bg-yellow-500 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            >
              {isLoading ? (
                <span>SYNCHRONIZING TRIP...</span>
              ) : (
                <>
                  CHART ADVENTURE <ArrowRightIcon className="w-6 h-6" />
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default CreateMission;
