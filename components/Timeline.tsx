import React, { useState, useMemo } from 'react';
import { Trip, ItineraryItem, ItemType } from '../types';
import { PlusIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, MapPinIcon, ChevronLeftIcon, EyeOffIcon, WalletIcon, UsersIcon } from './Icons';
import { getCurrencySymbol } from '../utils/currencyUtils';

interface TimelineProps {
  trip: Trip;
  availableTags?: string[]; // New prop for filter tags
  canEdit: boolean; // Permission: Can add/edit items
  currentUserId: string; // Used to filter private items
  onAddItem: () => void;
  onEditTrip: () => void;
  onManageTeam: () => void;
  onItemClick: (item: ItineraryItem) => void;
  onBackToBase: () => void; // New prop
  onAcceptPastExpenses: () => void;
  onDeclinePastExpenses: () => void;
  onNavigateBudget: () => void; // New Prop
}

const ItemCard: React.FC<{ item: ItineraryItem, tripYear: number, isLast: boolean, onClick: () => void, baseCurrency: string }> = ({ item, tripYear, isLast, onClick, baseCurrency }) => {
  const getIcon = () => {
    switch (item.type) {
      case ItemType.STAY: return <BedIcon className="w-5 h-5" />;
      case ItemType.TRANSPORT: return <TrainIcon className="w-5 h-5" />;
      case ItemType.FOOD: return <UtensilsIcon className="w-5 h-5" />;
      default: return <CameraIcon className="w-5 h-5" />;
    }
  };

  const startDate = new Date(item.startDate);
  const getDay = (date: Date) => date.getDate();
  const getMonth = (date: Date) => date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const getTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  // Check if year differs from trip start year, useful for spotting sorting issues
  const itemYear = startDate.getFullYear();
  const showYear = itemYear !== tripYear;

  const calculateDuration = (start: Date, end?: Date, durationMinutes?: number) => {
    let minutes = 0;

    if (durationMinutes) {
      minutes = durationMinutes;
    } else if (end) {
      const diffMs = new Date(end).getTime() - new Date(start).getTime();
      if (diffMs < 0) return null;
      minutes = Math.round(diffMs / (1000 * 60));
    } else {
      return null;
    }

    const diffHrs = Math.floor(minutes / 60);
    const diffMins = minutes % 60;

    if (diffHrs === 0) return `${diffMins}M`;
    return `${diffHrs}H ${diffMins}M`;
  };

  const calculateNights = (start: Date, end?: Date) => {
    if (!end) return 1;
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    // Round to nearest whole day
    const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, nights);
  };

  const duration = calculateDuration(item.startDate, item.endDate, item.durationMinutes);

  return (
    <div className="relative pl-8 pb-12 last:pb-0">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-[39px] top-8 bottom-0 w-px bg-tactical-muted/40"></div>
      )}

      {/* Date Marker (Absolute left) */}
      <div className="absolute left-0 top-1 text-center w-10">
        <div className="text-[10px] font-bold text-tactical-muted uppercase">{getMonth(startDate)}</div>
        <div className="text-xl font-display font-bold text-tactical-accent">{getDay(startDate)}</div>
        {/* Visual Year Debugger: Only shows if year is different */}
        {showYear && (
          <div className="text-[9px] font-bold text-gray-500 border border-gray-600 rounded px-0.5 mt-0.5">
            '{itemYear.toString().slice(2)}
          </div>
        )}
      </div>

      {/* Node on Timeline */}
      <div className={`absolute left-[34px] top-2.5 w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,215,0,0.5)] border-2 border-tactical-bg z-10 ${item.isPrivate ? 'bg-gray-500 shadow-none' : 'bg-tactical-accent'}`}></div>

      {/* Type Icon */}
      {item.type === ItemType.TRANSPORT && (
        <div className="absolute left-[24px] top-12 w-8 h-8 rounded-full bg-tactical-card border border-tactical-muted/50 flex items-center justify-center text-tactical-muted z-10">
          <TrainIcon className="w-4 h-4" />
        </div>
      )}

      {/* Card Content - Clickable Wrapper */}
      <div className="ml-8 cursor-pointer transform transition-transform active:scale-[0.98]" onClick={onClick}>
        <div className={`
          relative overflow-hidden rounded-xl border transition-all hover:border-tactical-accent/50
          ${item.type === ItemType.TRANSPORT
            ? 'bg-transparent border-dashed border-tactical-muted/40 p-5'
            : 'bg-tactical-card border-tactical-muted/20 shadow-lg'
          }
          ${item.isPrivate ? 'opacity-80 border-gray-700 bg-gray-900/40' : ''}
        `}>

          {/* Private Indicator */}
          {item.isPrivate && (
            <div className="absolute top-2 right-2 z-20 text-gray-500 bg-black/50 p-1 rounded-full border border-gray-700" title="Private to you">
              <EyeOffIcon className="w-3 h-3" />
            </div>
          )}

          {/* --- TRANSPORT LAYOUT --- */}
          {item.type === ItemType.TRANSPORT ? (
            <div className="relative">
              {/* Watermark Icon */}
              <div className="absolute right-0 top-8 opacity-[0.03] pointer-events-none scale-150 origin-right">
                <TrainIcon className="w-32 h-32" />
              </div>

              {/* Header: Title & Duration */}
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-display font-bold text-white text-lg tracking-wide uppercase">{item.title}</h3>
                {duration && (
                  <div className="bg-tactical-highlight/80 px-2 py-1 rounded text-[10px] text-tactical-accent font-mono font-bold tracking-wider border border-tactical-muted/20">
                    {duration}
                  </div>
                )}
              </div>

              {/* Subtitle / Details */}
              <div className="flex flex-wrap gap-2 mb-4">
                <p className="text-tactical-muted text-sm">{item.details || 'Transport'}</p>
                {/* Tags */}
                {item.tags?.map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full border border-tactical-muted/50 text-tactical-muted font-bold uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Timeline Row */}
              {item.endLocation && item.endDate ? (
                <div className="flex items-center justify-between relative z-10">
                  {/* Departure */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Departs</div>
                    <div className="text-xl font-display font-bold text-white leading-none mb-1">
                      {getTime(startDate)}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">{item.location}</div>
                  </div>

                  {/* Arrow */}
                  <div className="text-tactical-accent px-2 flex flex-col items-center justify-center opacity-80">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </div>

                  {/* Arrival */}
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Arrives</div>
                    <div className="text-xl font-display font-bold text-white leading-none mb-1">
                      {getTime(new Date(item.endDate))}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">{item.endLocation}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Departure</div>
                  <div className="text-xl font-mono font-bold text-tactical-accent">
                    {getTime(startDate)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{item.location}</div>
                </div>
              )}
            </div>

            /* --- FOOD LAYOUT --- */
          ) : item.type === ItemType.FOOD ? (
            <>
              {/* Header Image */}
              <div className="h-28 w-full bg-gray-800 relative overflow-hidden">
                <img src={`https://picsum.photos/seed/${item.id}/400/200`} alt={item.title} className={`w-full h-full object-cover ${item.isPrivate ? 'opacity-30 grayscale' : 'opacity-50'}`} />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card via-transparent to-black/40"></div>

                {/* Top Right Decoration */}
                <div className="absolute -top-6 -right-6 text-orange-500/10 transform rotate-12">
                  <UtensilsIcon className="w-32 h-32" />
                </div>

                {/* Label */}
                <div className="absolute bottom-3 left-4 flex items-center gap-2 z-10">
                  <div className="text-orange-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                    <UtensilsIcon className="w-4 h-4" /> <span>REFUEL</span>
                  </div>
                  {item.tags?.map(tag => (
                    <span key={tag} className="text-[8px] bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-white font-bold uppercase tracking-widest border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 pt-3">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-display font-bold text-white text-xl tracking-wide uppercase leading-tight">{item.title}</h3>
                    <p className="text-gray-500 text-sm">{item.location}</p>
                  </div>
                  {/* Time Display */}
                  <div className="text-right">
                    <div className="text-tactical-accent font-mono font-bold text-lg leading-none">
                      {getTime(startDate)}
                    </div>
                    {item.cost ? <div className="text-xs text-gray-500 font-mono mt-1">-{getCurrencySymbol(baseCurrency)}{item.cost?.toFixed(2)}</div> : null}
                  </div>
                </div>

                {/* Map Link */}
                {item.mapUri && (
                  <a href={item.mapUri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-tactical-muted hover:text-white uppercase tracking-wider underline mt-1 block mb-2">
                    View Intel Map
                  </a>
                )}

                {/* Details/Notes */}
                {item.details && (
                  <div className="mt-3 mb-2 text-sm text-gray-400 bg-tactical-bg/50 p-3 rounded border-l-2 border-tactical-muted/30 italic">
                    "{item.details}"
                  </div>
                )}

                {/* Footer */}
                <div className="mt-4 border-t border-tactical-muted/10 pt-3 flex justify-end items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">SECURED BY USER</span>
                </div>
              </div>
            </>

            /* --- STAY LAYOUT --- */
          ) : item.type === ItemType.STAY ? (
            <>
              {/* Image placeholder */}
              <div className="h-24 w-full bg-gray-800 relative">
                <img src={`https://picsum.photos/seed/${item.id}/400/200`} alt={item.title} className={`w-full h-full object-cover ${item.isPrivate ? 'opacity-30 grayscale' : 'opacity-60'}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card to-transparent"></div>

                <div className="absolute bottom-2 left-3 z-10 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-500">
                    {getIcon()} <span>STAY • {calculateNights(startDate, item.endDate ? new Date(item.endDate) : undefined)} NIGHTS</span>
                  </div>
                  <div className="flex gap-1">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[8px] bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-white font-bold uppercase tracking-widest border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-3">
                <h3 className="font-display font-bold text-white text-lg tracking-wide mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{item.location}</p>

                {/* Check In / Out Info */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-tactical-bg/50 rounded border border-tactical-muted/30 p-2 text-center">
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Check-In</div>
                    <div className="text-sm font-mono text-white font-bold">{getTime(startDate)}</div>
                  </div>
                  {item.endDate && (
                    <div className="flex-1 bg-tactical-bg/50 rounded border border-tactical-muted/30 p-2 text-center">
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Check-Out</div>
                      <div className="text-sm font-mono text-white font-bold">{getTime(new Date(item.endDate))}</div>
                    </div>
                  )}
                </div>

                {/* Display Details if available */}
                {item.details && (
                  <div className="mb-3 text-sm text-gray-300 bg-tactical-bg/40 p-3 rounded border-l-2 border-tactical-accent/50 whitespace-pre-wrap">
                    {item.details}
                  </div>
                )}

                {item.mapUri && (
                  <a
                    href={item.mapUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block px-3 py-1.5 border border-tactical-muted/50 rounded text-[10px] font-bold uppercase tracking-widest text-tactical-muted hover:text-tactical-accent hover:border-tactical-accent transition-colors"
                  >
                    Sat-Link Available
                  </a>
                )}
              </div>
            </>

            /* --- ACTIVITY / DEFAULT LAYOUT --- */
          ) : (
            <>
              {/* Image placeholder */}
              <div className="h-24 w-full bg-gray-800 relative">
                <img src={`https://picsum.photos/seed/${item.id}/400/200`} alt={item.title} className={`w-full h-full object-cover ${item.isPrivate ? 'opacity-30 grayscale' : 'opacity-60'}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card to-transparent"></div>

                <div className="absolute bottom-2 left-3 z-10 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    {getIcon()} <span>RECON</span>
                  </div>
                  <div className="flex gap-1">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[8px] bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-white font-bold uppercase tracking-widest border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-2">
                <h3 className="font-display font-bold text-white text-lg tracking-wide mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm mb-3">{item.location}</p>

                {/* Display Details if available */}
                {item.details && (
                  <div className="mb-3 text-sm text-gray-300 bg-tactical-bg/40 p-3 rounded border-l-2 border-tactical-accent/50 whitespace-pre-wrap">
                    {item.details}
                  </div>
                )}

                {item.mapUri && (
                  <a
                    href={item.mapUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block px-3 py-1.5 border border-tactical-muted/50 rounded text-[10px] font-bold uppercase tracking-widest text-tactical-muted hover:text-tactical-accent hover:border-tactical-accent transition-colors mb-2"
                  >
                    Sat-Link Available
                  </a>
                )}

                {item.cost ? (
                  <div className="text-tactical-accent text-sm font-mono mt-1">
                    -{getCurrencySymbol(baseCurrency)}{item.cost?.toFixed(2)}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({ trip, availableTags = [], canEdit, currentUserId, onAddItem, onEditTrip, onManageTeam, onItemClick, onBackToBase, onAcceptPastExpenses, onDeclinePastExpenses, onNavigateBudget }) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Filter for Visibility: 
  // 1. Privacy Check (Public OR Private & Created by Current User)
  // 2. Timeline Flag Check (Defaults to TRUE if undefined, explicit FALSE hides it)
  const visibleItems = useMemo(() => {
    return trip.items.filter(item => {
      const isVisiblePrivate = !item.isPrivate || item.createdBy === currentUserId;
      const isOnTimeline = item.showInTimeline !== false; // If undefined, treat as true
      return isVisiblePrivate && isOnTimeline;
    });
  }, [trip.items, currentUserId]);

  // Determine Current User's Personal Budget & Share
  const userBudget = useMemo(() => {
    const member = trip.members.find(m => m.id === currentUserId);
    return member?.budget || 0; // Fallback to 0 if not set
  }, [trip.members, currentUserId]);

  const hasPendingInvite = useMemo(() => {
    const member = trip.members.find(m => m.id === currentUserId);
    return !!member?.pendingPastExpensesInvitation;
  }, [trip.members, currentUserId]);

  // Calculate user's specific cost share (Use visible items or ALL items? Usually budget includes everything, but Timeline view shows filtered)
  // For budget progress bar here, we likely want to show what affects the user, so all items they are part of.
  const myTotalCost = trip.items.reduce((sum, item) => {
    if (item.type === ItemType.SETTLEMENT) return sum;
    // If user is in the split list, add their share
    if (item.splitWith && item.splitWith.includes(currentUserId)) {
      // If private and not mine, skip? Already handled by data model usually, but safety check:
      if (item.isPrivate && item.createdBy !== currentUserId) return sum;

      const splitCount = item.splitWith.length || 1;
      let share = (item.cost || 0) / splitCount;
      if (item.splitDetails && item.splitDetails[currentUserId] !== undefined) {
        share = item.splitDetails[currentUserId];
      }
      return sum + share;
    }
    return sum;
  }, 0);

  const remainingBudget = userBudget - myTotalCost;

  // Semantic Sorting
  const sortedItems = [...visibleItems].sort((a, b) => {
    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    const dayDiff = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime() -
      new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
    if (dayDiff !== 0) return dayDiff;
    const getWeight = (type: ItemType) => {
      if (type === ItemType.TRANSPORT) return 1;
      if (type === ItemType.STAY) return 2;
      if (type === ItemType.FOOD || type === ItemType.ACTIVITY) return 3;
      return 3;
    };
    const weightA = getWeight(a.type);
    const weightB = getWeight(b.type);
    if (weightA !== weightB) return weightA - weightB;
    return dateA.getTime() - dateB.getTime();
  });

  const filteredItems = activeFilter
    ? sortedItems.filter(item => item.tags?.includes(activeFilter))
    : sortedItems;

  const tripStartYear = new Date(trip.startDate).getFullYear();

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      <div className="px-6 py-6 pt-8 bg-tactical-bg z-10 sticky top-0 border-b border-tactical-muted/10 shadow-lg">
        {/* Header Navigation */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-3">
            <button onClick={onBackToBase} className="mt-1 text-gray-400 hover:text-white transition-colors">
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current Mission</h2>
              <h1 className="font-display text-2xl font-bold text-white uppercase leading-none">{trip.name}</h1>
              <div className="flex items-center gap-2 text-tactical-muted text-xs mt-1">
                <MapPinIcon className="w-3 h-3" /> {trip.destination}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNavigateBudget}
              className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-tactical-accent hover:text-white hover:border-tactical-accent transition-all"
              title="Access Budget Engine"
            >
              <WalletIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onManageTeam}
              className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-gray-400 hover:text-white hover:border-tactical-accent transition-all"
              title="Manage Squad"
            >
              <UsersIcon className="w-4 h-4" />
            </button>
            {canEdit && (
              <button onClick={onEditTrip} className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-gray-400 hover:text-white hover:border-tactical-accent transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-gray-500">Your Share</span>
            <span className={remainingBudget < 0 ? "text-red-500" : "text-tactical-accent"}>
              {getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalCost.toFixed(0)} / {getCurrencySymbol(trip.baseCurrency || 'USD')}{userBudget}
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${remainingBudget < 0 ? 'bg-red-500' : 'bg-tactical-accent'}`}
              style={{ width: userBudget > 0 ? `${Math.min((myTotalCost / userBudget) * 100, 100)}%` : '0%' }}
            ></div>
          </div>
        </div>

        {/* Filter Bar */}
        {availableTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-4 scrollbar-hide -mx-6 px-6">
            <button
              onClick={() => setActiveFilter(null)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors whitespace-nowrap uppercase tracking-wider ${activeFilter === null
                ? 'bg-tactical-accent text-black border-tactical-accent'
                : 'text-gray-500 border-tactical-muted/30 hover:border-tactical-muted hover:text-white'
                }`}
            >
              ALL
            </button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveFilter(tag === activeFilter ? null : tag)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors whitespace-nowrap uppercase tracking-wider ${activeFilter === tag
                  ? 'bg-tactical-accent text-black border-tactical-accent'
                  : 'text-gray-500 border-tactical-muted/30 hover:border-tactical-muted hover:text-white'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INVITE BANNER */}
      {hasPendingInvite && (
        <div className="mx-6 mt-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-xl animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <WalletIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-white uppercase text-sm mb-1">Share Past Expenses?</h3>
              <p className="text-xs text-blue-200 mb-3">
                The Pathfinder has shared all past expenses with you. Do you accept the shared costs?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onAcceptPastExpenses}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded-lg transition-colors"
                >
                  Accept & Split
                </button>
                <button
                  onClick={onDeclinePastExpenses}
                  className="px-4 py-2 bg-transparent border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold uppercase rounded-lg transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 pb-24 relative scrollbar-hide">
        <div className="absolute left-[39px] top-0 bottom-0 w-px bg-tactical-muted/20"></div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center opacity-50 mt-10">
            <div className="w-16 h-16 rounded-full bg-tactical-card border-2 border-dashed border-tactical-muted/50 flex items-center justify-center mb-4">
              <PlusIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              {activeFilter ? 'No Intel Matches Filter' : 'No Timeline Intel'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {activeFilter ? 'Clear filters or add labeled items' : 'Items created in Ledger may be hidden from timeline.'}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredItems.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                tripYear={tripStartYear}
                isLast={index === filteredItems.length - 1}
                onClick={() => onItemClick(item)}
                baseCurrency={trip.baseCurrency || 'USD'}
              />
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="absolute bottom-6 right-6 z-20">
          <button
            onClick={onAddItem}
            className="w-14 h-14 bg-tactical-accent hover:bg-yellow-400 text-black rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          >
            <PlusIcon className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Timeline;