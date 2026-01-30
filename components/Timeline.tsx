import React, { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { getMissionCover } from '../utils/assetUtils';
import { Trip, ItineraryItem, ItemType } from '../types';
import { getCurrencySymbol } from '../utils/currencyUtils';
import MissionGlobe from './MissionGlobe';
import TacticalImage from './TacticalImage';
import { NotificationManager } from '../services/NotificationManager';
import { BedIcon, BellIcon, CameraIcon, ChevronLeftIcon, EyeOffIcon, GlobeIcon, MapPinIcon, PlusIcon, TrainIcon, UsersIcon, UtensilsIcon, WalletIcon } from './Icons';

const ExpandableDetails: React.FC<{
  details: string,
  borderColor: string,
  textColor: string,
  bgColor?: string,
  isQuote?: boolean
}> = ({ details, borderColor, textColor, bgColor = "bg-tactical-bg/50", isQuote = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = details.length > 150;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // CRITICAL: Stop propagation so card click doesn't trigger
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`mt-3 mb-4 text-sm ${textColor} ${bgColor} p-3 rounded border-l-2 ${borderColor} italic overflow-hidden transition-all duration-300`}>
      <div className={!isExpanded && isLong ? "line-clamp-2" : "whitespace-pre-wrap"}>
        {isQuote ? `"${details}"` : details}
      </div>
      {isLong && (
        <button
          onClick={toggle}
          className="mt-2 text-[10px] font-bold uppercase tracking-widest text-tactical-accent hover:text-white flex items-center gap-1 transition-colors"
        >
          {isExpanded ? 'Collapse Intel' : 'Expand Full Intel'}
          <svg className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
};

interface TimelineProps {
  trip: Trip;
  availableTags?: string[];
  canEdit: boolean;
  currentUserId: string;
  onAddItem: () => void;
  onEditTrip: () => void;
  onManageTeam: () => void;
  onItemClick: (item: ItineraryItem) => void;
  onBackToBase: () => void;
  onAcceptPastExpenses: () => void;
  onDeclinePastExpenses: () => void;
  onNavigateBudget: () => void;
  onRefresh: () => void;
}

const ItemCard: React.FC<{ item: ItineraryItem, tripYear: number, isLast: boolean, onClick: () => void, baseCurrency: string }> = ({ item, tripYear, isLast, onClick, baseCurrency }) => {
  const getIcon = (className = "w-5 h-5") => {
    switch (item.type) {
      case ItemType.STAY: return <BedIcon className={className} />;
      case ItemType.TRANSPORT: return <TrainIcon className={className} />;
      case ItemType.FOOD: return <UtensilsIcon className={className} />;
      default: return <CameraIcon className={className} />;
    }
  };

  const getCategoryStyles = () => {
    switch (item.type) {
      case ItemType.STAY:
        return {
          gradient: 'linear-gradient(135deg, #2e1065 0%, #a855f7 100%)',
          icon: BedIcon,
          label: 'STAY',
          color: 'text-purple-400'
        };
      case ItemType.FOOD:
        return {
          gradient: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
          icon: UtensilsIcon,
          label: 'REFUEL',
          color: 'text-emerald-400'
        };
      case ItemType.TRANSPORT:
        return {
          gradient: 'linear-gradient(135deg, #082f49 0%, #06b6d4 100%)',
          icon: TrainIcon,
          label: 'TRANSIT',
          color: 'text-cyan-400'
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #451a03 0%, #f59e0b 100%)',
          icon: CameraIcon,
          label: 'RECON',
          color: 'text-amber-500'
        };
    }
  };

  const theme = getCategoryStyles();
  const startDate = new Date(item.startDate);
  const getDay = (date: Date) => date.getDate();
  const getMonth = (date: Date) => date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const getTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
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
    const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, nights);
  };

  const duration = calculateDuration(item.startDate, item.endDate, item.durationMinutes);

  return (
    <div className="relative pl-8 pb-12 last:pb-0">
      {!isLast && (
        <div className="absolute left-[39px] top-8 bottom-0 w-px bg-tactical-muted/40"></div>
      )}

      <div className="absolute left-0 top-1 text-center w-10">
        <div className="text-[10px] font-bold text-tactical-muted uppercase">{getMonth(startDate)}</div>
        <div className="text-xl font-display font-bold text-tactical-accent">{getDay(startDate)}</div>
        {showYear && (
          <div className="text-[9px] font-bold text-gray-500 border border-gray-600 rounded px-0.5 mt-0.5">
            '{itemYear.toString().slice(2)}
          </div>
        )}
      </div>

      <div className={`absolute left-[34px] top-2.5 w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,215,0,0.5)] border-2 border-tactical-bg z-10 ${item.isPrivate ? 'bg-gray-500 shadow-none' : 'bg-tactical-accent'}`}></div>

      <div className="ml-8 cursor-pointer transform transition-transform active:scale-[0.98]" onClick={onClick}>
        <div className={`relative overflow-hidden rounded-xl border transition-all hover:border-tactical-accent/50 bg-tactical-card border-tactical-muted/20 shadow-lg ${item.isPrivate ? 'opacity-80 border-gray-700 bg-gray-900/40' : ''}`}>
          {item.isPrivate && (
            <div className="absolute top-2 right-2 z-20 text-gray-500 bg-black/50 p-1 rounded-full border border-gray-700" title="Private to you">
              <EyeOffIcon className="w-3 h-3" />
            </div>
          )}

          {item.type === ItemType.TRANSPORT ? (
            <>
              <div className="h-28 w-full relative overflow-hidden" style={{ background: theme.gradient }}>
                <div
                  className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                  }}
                />
                <div className="absolute -bottom-6 -right-6 opacity-30 transform -rotate-12 pointer-events-none">
                  <theme.icon className="w-32 h-32 text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card via-transparent to-black/20"></div>
                <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-1">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] ${theme.color}`}>
                    {getIcon()} <span>{theme.label}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[9px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-white font-bold uppercase tracking-widest">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {duration && (
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[10px] text-tactical-accent font-mono font-bold tracking-wider border border-white/10 z-10">
                    {duration}
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3 className="font-display font-bold text-white text-lg tracking-wide uppercase mb-3">{item.title}</h3>
                {/* Details */}
                {item.details && (
                  <ExpandableDetails
                    details={item.details}
                    borderColor="border-cyan-500/40"
                    textColor="text-cyan-50/80"
                    bgColor="bg-black/40"
                    isQuote={false}
                  />
                )}
                {item.endLocation && item.endDate ? (
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Departs</div>
                      <div className="text-xl font-display font-bold text-white leading-none mb-1">{getTime(startDate)}</div>
                      <div className="text-xs text-gray-400 font-medium">{item.location}</div>
                    </div>
                    <div className="text-tactical-accent px-2 flex flex-col items-center justify-center opacity-80">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Arrives</div>
                      <div className="text-xl font-display font-bold text-white leading-none mb-1">{getTime(new Date(item.endDate))}</div>
                      <div className="text-xs text-gray-400 font-medium">{item.endLocation}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Departure</div>
                    <div className="text-xl font-mono font-bold text-tactical-accent">{getTime(startDate)}</div>
                    <div className="text-xs text-gray-400 mt-1">{item.location}</div>
                  </div>
                )}
              </div>
            </>
          ) : item.type === ItemType.FOOD ? (
            <>
              {/* Premium Gradient Header */}
              <div className="h-28 w-full relative overflow-hidden" style={{ background: theme.gradient }}>
                {/* SVG Noise Texture */}
                <div
                  className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                  }}
                />

                {/* Giant Watermark Icon */}
                <div className="absolute -bottom-6 -right-6 opacity-30 transform -rotate-12 pointer-events-none">
                  <theme.icon className="w-32 h-32 text-white" />
                </div>

                <TacticalImage
                  src={getMissionCover(item.id)}
                  alt={item.title}
                  className={`absolute inset-0 w-full h-full object-cover mix-blend-overlay ${item.isPrivate ? 'opacity-20 grayscale' : 'opacity-40'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card via-transparent to-black/20"></div>

                <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-1">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] ${theme.color}`}>
                    {getIcon()} <span>{theme.label}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[9px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-white font-bold uppercase tracking-widest">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-display font-bold text-white text-xl tracking-wide uppercase leading-tight">{item.title}</h3>
                    <p className="text-gray-500 text-sm flex items-center gap-1">
                      <MapPinIcon className="w-3 h-3" /> {item.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-tactical-accent font-mono font-bold text-lg leading-none">{getTime(startDate)}</div>
                    {item.cost ? <div className="text-xs text-gray-400 font-mono mt-1">-{getCurrencySymbol(baseCurrency)}{item.cost?.toFixed(2)}</div> : null}
                  </div>
                </div>

                {item.details && (
                  <ExpandableDetails
                    details={item.details}
                    borderColor="border-emerald-500/30"
                    textColor="text-gray-400"
                  />
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-tactical-muted/10">
                  {item.mapUri ? (
                    <a href={item.mapUri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-emerald-500 hover:text-white uppercase tracking-widest font-black underline">
                      VIEW INTEL MAP
                    </a>
                  ) : <div></div>}

                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">SECURED</span>
                  </div>
                </div>
              </div>
            </>
          ) : item.type === ItemType.STAY ? (
            <>
              <div className="h-28 w-full relative overflow-hidden" style={{ background: theme.gradient }}>
                <div
                  className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
                />
                <div className="absolute -bottom-6 -right-6 opacity-30 transform -rotate-12 pointer-events-none">
                  <theme.icon className="w-32 h-32 text-white" />
                </div>
                <TacticalImage src={getMissionCover(item.id)} alt={item.title} className={`absolute inset-0 w-full h-full object-cover mix-blend-overlay ${item.isPrivate ? 'opacity-20 grayscale' : 'opacity-40'}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card via-transparent to-black/20"></div>
                <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-1">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] ${theme.color}`}>
                    {getIcon()} <span>{theme.label} • {calculateNights(startDate, item.endDate ? new Date(item.endDate) : undefined)} NIGHTS</span>
                  </div>
                  <div className="flex gap-1.5">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[9px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-white font-bold uppercase tracking-widest">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-3">
                <h3 className="font-display font-bold text-white text-lg tracking-wide mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{item.location}</p>
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
                {item.details && (
                  <ExpandableDetails
                    details={item.details}
                    borderColor="border-tactical-accent/50"
                    textColor="text-gray-300"
                    isQuote={false}
                  />
                )}
                {item.mapUri && (
                  <a href={item.mapUri} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block px-3 py-1.5 border border-tactical-muted/50 rounded text-[10px] font-bold uppercase tracking-widest text-tactical-muted hover:text-tactical-accent hover:border-tactical-accent transition-colors">Sat-Link Available</a>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="h-28 w-full relative overflow-hidden" style={{ background: theme.gradient }}>
                <div
                  className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
                />
                <div className="absolute -bottom-6 -right-6 opacity-30 transform -rotate-12 pointer-events-none">
                  <theme.icon className="w-32 h-32 text-white" />
                </div>
                <TacticalImage src={getMissionCover(item.id)} alt={item.title} className={`absolute inset-0 w-full h-full object-cover mix-blend-overlay ${item.isPrivate ? 'opacity-20 grayscale' : 'opacity-40'}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-tactical-card via-transparent to-black/20"></div>
                <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-1">
                  <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] ${theme.color}`}>
                    {getIcon()} <span>{theme.label}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[9px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-white font-bold uppercase tracking-widest">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-2">
                <h3 className="font-display font-bold text-white text-lg tracking-wide mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm mb-3">{item.location}</p>
                {item.details && (
                  <div className="mb-3 text-sm text-gray-300 bg-tactical-bg/40 p-3 rounded border-l-2 border-tactical-accent/50 whitespace-pre-wrap">{item.details}</div>
                )}
                {item.mapUri && (
                  <a href={item.mapUri} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block px-3 py-1.5 border border-tactical-muted/50 rounded text-[10px] font-bold uppercase tracking-widest text-tactical-muted hover:text-tactical-accent hover:border-tactical-accent transition-colors mb-2">Sat-Link Available</a>
                )}
                {item.cost ? (
                  <div className="text-tactical-accent text-sm font-mono mt-1">-{getCurrencySymbol(baseCurrency)}{item.cost?.toFixed(2)}</div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({ trip, availableTags = [], canEdit, currentUserId, onAddItem, onEditTrip, onManageTeam, onItemClick, onBackToBase, onAcceptPastExpenses, onDeclinePastExpenses, onNavigateBudget, onRefresh }) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showGlobe, setShowGlobe] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(Notification.permission);

  React.useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // REAL-TIME SYNC: Listen for changes to itinerary_items
  React.useEffect(() => {
    // console.log(`[Timeline] Initializing Realtime for trip: ${trip.id}`);

    const channel = supabase
      .channel(`timeline-${trip.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'itinerary_items',
          filter: `trip_id=eq.${trip.id}`
        },
        (payload) => {
          // console.log('[Timeline] Realtime update received:', payload);
          onRefresh(); // Trigger parent refresh to update state
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // console.log('[Timeline] Connected to realtime channel.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trip.id, onRefresh]);

  const visibleItems = useMemo(() => {
    return trip.items.filter(item => {
      const isVisiblePrivate = !item.isPrivate || item.createdBy === currentUserId;
      const isOnTimeline = item.showInTimeline !== false;
      return isVisiblePrivate && isOnTimeline;
    });
  }, [trip.items, currentUserId]);

  const userBudget = useMemo(() => {
    const member = trip.members.find(m => m.id === currentUserId);
    return member?.budget || 0;
  }, [trip.members, currentUserId]);

  const hasPendingInvite = useMemo(() => {
    const member = trip.members.find(m => m.id === currentUserId);
    return !!member?.pendingPastExpensesInvitation;
  }, [trip.members, currentUserId]);

  const myTotalCost = trip.items.reduce((sum, item) => {
    if (item.type === ItemType.SETTLEMENT) return sum;
    if (item.splitWith && item.splitWith.includes(currentUserId)) {
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

  const sortedItems = [...visibleItems].sort((a, b) => {
    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    const dayDiff = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime() -
      new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
    if (dayDiff !== 0) return dayDiff;
    const getWeight = (type: ItemType) => {
      if (type === ItemType.TRANSPORT) return 1;
      if (type === ItemType.STAY) return 2;
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
            <button onClick={onManageTeam} className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-gray-400 hover:text-white hover:border-tactical-accent transition-all" title="Manage Squad">
              <UsersIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => NotificationManager.requestPermission().then(p => setPermissionState(p))}
              className={`p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg transition-all ${permissionState === 'granted' ? 'text-tactical-accent border-tactical-accent/50' : 'text-gray-400 hover:text-white hover:border-tactical-accent'}`}
              title={permissionState === 'granted' ? 'Notifications Active' : 'Enable Notifications'}
            >
              <BellIcon className="w-4 h-4" />
            </button>
            {canEdit && (
              <button onClick={onEditTrip} className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-gray-400 hover:text-white hover:border-tactical-accent transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
              </button>
            )}
            <button onClick={() => setShowGlobe(true)} className="p-2 bg-tactical-card border border-tactical-muted/30 rounded-lg text-tactical-accent hover:text-white hover:border-tactical-accent transition-all" title="View Mission Globe">
              <GlobeIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={onNavigateBudget}
          className="w-full mt-2 mb-1 bg-gradient-to-r from-[#1A1A18] to-[#0F0F0E] border border-tactical-muted/30 rounded-xl p-4 flex items-center justify-between group active:scale-[0.98] transition-all hover:border-tactical-accent/50 cursor-pointer"
        >
          {/* Left: Wallet Info */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-tactical-accent/20 text-tactical-accent">
                <WalletIcon className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-tactical-accent transition-colors">Mission Wallet</span>
            </div>
            <div className="font-mono text-xl text-white leading-none">
              <span className={remainingBudget < 0 ? "text-red-500 font-bold" : "text-white font-bold"}>
                {getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalCost.toFixed(0)}
              </span>
              <span className="text-gray-600 text-sm mx-1.5">/</span>
              <span className="text-gray-500 text-sm">{getCurrencySymbol(trip.baseCurrency || 'USD')}{userBudget}</span>
            </div>
          </div>

          {/* Right: Progress & Chevron */}
          <div className="flex items-center gap-3 pl-4">
            <div className="flex flex-col items-end gap-1.5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${remainingBudget < 0 ? 'text-red-500' : 'text-tactical-accent'}`}>
                {remainingBudget < 0 ? 'OVER BUDGET' : 'AVAILABLE'}
              </span>
              <div className="w-28 h-2 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${remainingBudget < 0 ? 'bg-red-500' : 'bg-tactical-accent'}`}
                  style={{ width: userBudget > 0 ? `${Math.min((myTotalCost / userBudget) * 100, 100)}%` : '0%' }}
                ></div>
              </div>
            </div>
            {/* Chevron indicator */}
            <svg className="w-5 h-5 text-tactical-accent/50 group-hover:text-tactical-accent group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {availableTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-4 scrollbar-hide -mx-6 px-6">
            <button
              onClick={() => setActiveFilter(null)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors whitespace-nowrap uppercase tracking-wider ${activeFilter === null ? 'bg-tactical-accent text-black border-tactical-accent' : 'text-gray-500 border-tactical-muted/30 hover:border-tactical-muted hover:text-white'}`}
            >ALL</button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveFilter(tag === activeFilter ? null : tag)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors whitespace-nowrap uppercase tracking-wider ${activeFilter === tag ? 'bg-tactical-accent text-black border-tactical-accent' : 'text-gray-500 border-tactical-muted/30 hover:border-tactical-muted hover:text-white'}`}
              >{tag}</button>
            ))}
          </div>
        )}
      </div>

      {hasPendingInvite && (
        <div className="mx-6 mt-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-xl animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <WalletIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-white uppercase text-sm mb-1">Share Past Expenses?</h3>
              <p className="text-xs text-blue-200 mb-3">The Pathfinder has shared all past expenses with you. Do you accept the shared costs?</p>
              <div className="flex gap-2">
                <button onClick={onAcceptPastExpenses} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded-lg transition-colors">Accept & Split</button>
                <button onClick={onDeclinePastExpenses} className="px-4 py-2 bg-transparent border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold uppercase rounded-lg transition-colors">Decline</button>
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
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{activeFilter ? 'No Intel Matches Filter' : 'No Timeline Intel'}</p>
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
          <button onClick={onAddItem} className="w-14 h-14 bg-tactical-accent hover:bg-yellow-400 text-black rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <PlusIcon className="w-8 h-8" />
          </button>
        </div>
      )}
      {showGlobe && <MissionGlobe trip={trip} onClose={() => setShowGlobe(false)} />}
    </div>
  );
};

export default Timeline;