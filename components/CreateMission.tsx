
import React, { useState } from 'react';
import { ArrowRightIcon, MapPinIcon, ChevronLeftIcon } from './Icons';
import { Member } from '../types';
import { getCurrencySymbol } from '../utils/currencyUtils';

interface CreateMissionProps {
  onCreate: (name: string, location: string, budget: number, startDate: Date, endDate: Date, initialMembers: Member[], baseCurrency: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

const CreateMission: React.FC<CreateMissionProps> = ({ onCreate, onBack, isLoading }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('2000');
  const [baseCurrency, setBaseCurrency] = useState('USD');

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleSubmit = () => {
    if (name && location && startDate) {
      const mockMembers: Member[] = [];

      // Default to single day trip if no end date selected
      onCreate(name, location, parseInt(budget) || 0, startDate, endDate || startDate, mockMembers, baseCurrency);
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
        // Deselect if clicking start again? No, let's keep it simple.
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
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Abort Mission Setup
        </div>
        <div className="w-6"></div> {/* Spacer */}
      </header>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        <header className="mb-8 mt-2">
          <h1 className="font-display text-4xl font-bold text-tactical-accent uppercase leading-tight mb-2">
            Plot Your<br />Path
          </h1>
          <p className="text-tactical-muted tracking-widest text-sm uppercase font-medium">
            Initiate New Mission
          </p>
        </header>

        {/* Responsive Grid Layout for Tablet+ */}
        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">

          {/* Left Column: Inputs */}
          <div className="space-y-8">
            {/* Mission Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mission Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spain Adventure"
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
                  placeholder="Enter primary destination"
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
                placeholder="2000"
                className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text placeholder-tactical-muted focus:outline-none focus:border-tactical-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-[10px] text-gray-500">This budget is private to you and tracked separately from other members.</p>
            </div>

            {/* Base Currency */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base Currency</label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-tactical-text focus:outline-none focus:border-tactical-accent transition-colors appearance-none font-bold"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="HKD">HKD - Hong Kong Dollar</option>
                <option value="NZD">NZD - New Zealand Dollar</option>
                <option value="SEK">SEK - Swedish Krona</option>
                <option value="KRW">KRW - South Korean Won</option>
                <option value="SGD">SGD - Singapore Dollar</option>
                <option value="NOK">NOK - Norwegian Krone</option>
                <option value="MXN">MXN - Mexican Peso</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="RUB">RUB - Russian Ruble</option>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="TRY">TRY - Turkish Lira</option>
                <option value="BRL">BRL - Brazilian Real</option>
                <option value="TWD">TWD - Taiwan Dollar</option>
                <option value="DKK">DKK - Danish Krone</option>
                <option value="PLN">PLN - Polish Zloty</option>
                <option value="THB">THB - Thai Baht</option>
                <option value="IDR">IDR - Indonesian Rupiah</option>
                <option value="HUF">HUF - Hungarian Forint</option>
                <option value="CZK">CZK - Czech Koruna</option>
                <option value="ILS">ILS - Israeli Shekel</option>
                <option value="CLP">CLP - Chilean Peso</option>
                <option value="PHP">PHP - Philippine Peso</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="COP">COP - Colombian Peso</option>
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="MYR">MYR - Malaysian Ringgit</option>
                <option value="RON">RON - Romanian Leu</option>
              </select>
            </div>
          </div>

          {/* Right Column: Calendar */}
          <div className="space-y-2 h-full flex flex-col">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mission Timeline</label>
            <div className="bg-tactical-card rounded-xl p-6 border border-tactical-muted/20 flex-1">
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

                {/* Empty spaces for start of month */}
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

        {/* Action Button - Spans full width */}
        <div className="pt-8 pb-2">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name || !location || !startDate}
            className="w-full bg-tactical-accent hover:bg-yellow-500 text-black font-display font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,215,0,0.2)]"
          >
            {isLoading ? (
              <span>ESTABLISHING UPLINK...</span>
            ) : (
              <>
                CREATE MASTER TRIP <ArrowRightIcon className="w-6 h-6" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateMission;
