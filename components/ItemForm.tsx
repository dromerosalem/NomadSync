import React, { useState, useEffect } from 'react';
import { ItemType, ItineraryItem, Member, ResourceLink } from '../types';
import { ChevronLeftIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, PlusIcon, EyeOffIcon, EyeIcon, WalletIcon, LinkIcon, TrashIcon } from './Icons';
import PlaceAutocomplete from './PlaceAutocomplete';
import TacticalDatePicker from './TacticalDatePicker';
import { sanitizeAsset } from '../utils/assetUtils';

import CurrencySelector from './CurrencySelector';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { currencyService } from '../services/CurrencyService';

interface ItemFormProps {
  type: ItemType;
  onClose: () => void;
  onSave: (item: Partial<ItineraryItem>) => void;
  tripStartDate: Date;
  initialItem?: Partial<ItineraryItem>; // Changed to Partial to support Scanned items
  availableTags?: string[];
  queueLength?: number; // Optional prop to show if multiple items are being processed
  currentUserId: string;
  members: Member[]; // Passed to select split
  baseCurrency?: string;
}

// Helper to parse the rich details string into key-value pairs for the UI
const parseDetails = (detailsStr: string, excludeKeys: string[] = []) => {
  if (!detailsStr) return [];
  const normalizedExcludes = excludeKeys.map(k => k.toLowerCase());

  // Split by newlines and then split each line by first colon
  return detailsStr.split('\n')
    .map(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return null;
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (normalizedExcludes.includes(key.toLowerCase())) return null;

      return { key, value };
    })
    .filter((pair): pair is { key: string; value: string } => pair !== null && pair.value !== '');
};

const DetailsGrid: React.FC<{ details: string; type?: ItemType }> = ({ details, type }) => {
  const excludeKeys = type === ItemType.TRANSPORT ? ['Flight Number', 'Seat', 'Flight', 'Assigned Seat'] : [];
  const pairs = parseDetails(details, excludeKeys);
  if (pairs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-y-4 mt-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex flex-col border-l-2 border-white/20 pl-4 bg-white/5 p-3 rounded-r-lg">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1.5">
            {pair.key}
          </span>
          <span className="text-sm font-mono font-bold text-white uppercase break-words leading-tight">
            {pair.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ItemForm: React.FC<ItemFormProps> = ({ type, onClose, onSave, tripStartDate, initialItem, availableTags = [], queueLength, currentUserId, members = [], baseCurrency = 'USD' }) => {
  // Filter helper: Active or undefined (legacy) members only. Exclude Blocked/Pending.
  const activeMembers = members.filter(m => m.status === 'ACTIVE' || !m.status);

  // Form State
  const [title, setTitle] = useState(initialItem?.title || '');
  const [location, setLocation] = useState(initialItem?.location || '');
  const [endLocation, setEndLocation] = useState(initialItem?.endLocation || '');

  const formatDateForInput = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [startDate, setStartDate] = useState(
    initialItem?.startDate
      ? formatDateForInput(initialItem.startDate)
      : new Date(tripStartDate).toISOString().slice(0, 16)
  );

  const [endDate, setEndDate] = useState(
    initialItem?.endDate
      ? formatDateForInput(initialItem.endDate)
      : new Date(tripStartDate).toISOString().slice(0, 16)
  );

  const [cost, setCost] = useState(initialItem?.originalAmount?.toString() || initialItem?.cost?.toString() || '');
  const [currencyCode, setCurrencyCode] = useState(initialItem?.currencyCode || baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(initialItem?.exchangeRate || 1);
  const [convertedCost, setConvertedCost] = useState<number>(initialItem?.cost || 0);

  // Helper for formatting large numbers with commas in inputs
  const formatInputAmount = (val: string) => {
    if (!val) return "";
    const parts = val.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/,/g, '');
    if (/^\d*\.?\d*$/.test(val)) {
      setCost(val);
    }
  };

  // Fetch Exchange Rate when currency or date changes
  useEffect(() => {
    const fetchRate = async () => {
      // If currency is same as base, rate is 1
      if (currencyCode === baseCurrency) {
        setExchangeRate(1);
        setConvertedCost(parseFloat(cost) || 0);
        return;
      }

      const amount = parseFloat(cost) || 0;
      if (amount === 0) {
        setConvertedCost(0);
        return;
      }

      try {
        // Use the start date for historical rates
        const dateForRate = startDate || new Date().toISOString();
        const rate = await currencyService.getRate(currencyCode, baseCurrency, dateForRate);
        setExchangeRate(rate);
        setConvertedCost(amount * rate);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        // Fallback to 1:1 if fails, but user should warn?
        // For now, keep previous rate or default to 1
      }
    };

    fetchRate();
  }, [currencyCode, baseCurrency, startDate, cost]);

  // Dynamic Font Size for large numbers
  const getFontSizeClasses = () => {
    const len = formatInputAmount(cost).length;
    if (len <= 8) return { symbol: 'text-xl', input: 'text-4xl sm:text-5xl' };
    if (len <= 12) return { symbol: 'text-lg', input: 'text-3xl sm:text-4xl' };
    if (len <= 16) return { symbol: 'text-base', input: 'text-2xl sm:text-3xl' };
    return { symbol: 'text-sm', input: 'text-xl sm:text-2xl' };
  };

  const fontClasses = getFontSizeClasses();

  const extractCleanDetails = (detailsStr?: string | null) => {
    if (!detailsStr) return '';
    // Remove pattern formats like "Seat: 12A |" or "Flight: BA123 |"
    let cleaned = detailsStr
      .replace(/Seat:\s*.*?\s*\|\s*/gi, '')
      .replace(/Flight:\s*.*?\s*\|\s*/gi, '');

    // Also remove raw multiline entries like "Flight Number: BA123" or "Seat: 12A" 
    // to avoid redundancy in the DetailsGrid/textarea
    return cleaned.split('\n')
      .filter(line => {
        const lower = line.toLowerCase();
        return !lower.startsWith('flight number:') &&
          !lower.startsWith('seat:') &&
          !lower.startsWith('assigned seat:') &&
          !lower.startsWith('flight:');
      })
      .join('\n')
      .trim();
  };

  const extractSeat = (detailsStr?: string | null) => {
    if (!detailsStr) return '';
    // Try the formatted pipe version first
    const pipeMatch = detailsStr.match(/Seat:\s*(.*?)\s*\|/i);
    if (pipeMatch) return pipeMatch[1];
    // Try the raw multiline version next
    const multilineMatch = detailsStr.match(/(?:Seat|Assigned Seat):\s*([^\n\r]*)/i);
    return multilineMatch ? multilineMatch[1].trim() : '';
  };

  const extractFlightNumber = (detailsStr?: string | null) => {
    if (!detailsStr) return '';
    // Try the formatted pipe version first
    const pipeMatch = detailsStr.match(/Flight:\s*(.*?)\s*\|/i);
    if (pipeMatch) return pipeMatch[1];
    // Try the raw multiline version next
    const multilineMatch = detailsStr.match(/(?:Flight Number|Flight):\s*([^\n\r]*)/i);
    return multilineMatch ? multilineMatch[1].trim() : '';
  };

  const [details, setDetails] = useState(
    initialItem ? extractCleanDetails(initialItem.details) : ''
  );

  const [seat, setSeat] = useState(
    initialItem ? extractSeat(initialItem.details) : ''
  );

  const [flightNumber, setFlightNumber] = useState(
    initialItem ? extractFlightNumber(initialItem.details) : ''
  );

  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(initialItem?.durationMinutes);

  // Location Coordinates State
  const [latitude, setLatitude] = useState<number | undefined>(initialItem?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(initialItem?.longitude);
  const [countryCode, setCountryCode] = useState<string | undefined>(initialItem?.countryCode);
  const [endLatitude, setEndLatitude] = useState<number | undefined>(initialItem?.endLatitude);
  const [endLongitude, setEndLongitude] = useState<number | undefined>(initialItem?.endLongitude);
  const [endCountryCode, setEndCountryCode] = useState<string | undefined>(initialItem?.endCountryCode);

  const [isPrivate, setIsPrivate] = useState(initialItem?.isPrivate || false);
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>(currentUserId);

  const [showFinancialOptions, setShowFinancialOptions] = useState(false);

  // Resources State
  const [resources, setResources] = useState<ResourceLink[]>(initialItem?.resources || []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [isAddingResource, setIsAddingResource] = useState(false);

  // Tag State
  const [tags, setTags] = useState<string[]>(initialItem?.tags || []);
  const [tagInput, setTagInput] = useState('');

  // Reset state when initialItem changes
  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title || '');
      setLocation(initialItem.location || '');
      setEndLocation(initialItem.endLocation || '');
      setStartDate(initialItem.startDate
        ? formatDateForInput(initialItem.startDate)
        : new Date(tripStartDate).toISOString().slice(0, 16)
      );
      setEndDate(initialItem.endDate
        ? formatDateForInput(initialItem.endDate)
        : new Date(tripStartDate).toISOString().slice(0, 16)
      );
      setCost(initialItem.originalAmount?.toString() || initialItem.cost?.toString() || '');
      setExchangeRate(initialItem.exchangeRate || 1);
      setConvertedCost(initialItem.cost || 0);
      setDetails(extractCleanDetails(initialItem.details));
      setSeat(extractSeat(initialItem.details));
      setFlightNumber(extractFlightNumber(initialItem.details));
      setTags(initialItem.tags || []);
      setDurationMinutes(initialItem.durationMinutes);
      setIsPrivate(initialItem.isPrivate || false);

      const defaultSplit = activeMembers.map(m => m.id);
      setSplitWith(initialItem.splitWith || defaultSplit);
      setPaidBy(initialItem.paidBy || currentUserId);

      setLatitude(initialItem.latitude);
      setLongitude(initialItem.longitude);
      setCountryCode(initialItem.countryCode);
      setEndLatitude(initialItem.endLatitude);
      setEndLongitude(initialItem.endLongitude);
      setEndCountryCode(initialItem.endCountryCode);
      setCurrencyCode(initialItem.currencyCode || baseCurrency);
      setResources(initialItem.resources || []);
    } else {
      const defaultSplit = activeMembers.map(m => m.id);
      setSplitWith(defaultSplit);
      setPaidBy(currentUserId);
      setCurrencyCode(baseCurrency);
    }
  }, [initialItem, tripStartDate, currentUserId, baseCurrency]);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const toggleSplitMember = (memberId: string) => {
    setSplitWith(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleAddResource = () => {
    if (!newLinkUrl) return;

    // Auto-generate ID (simple random for now, will be stable on save if not regenerating)
    const newLink: ResourceLink = {
      id: Math.random().toString(36).substr(2, 9),
      url: newLinkUrl,
      title: newLinkTitle || new URL(newLinkUrl).hostname.replace('www.', '')
    };

    setResources([...resources, newLink]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setIsAddingResource(false);
  };

  const handleRemoveResource = (id: string) => {
    setResources(resources.filter(r => r.id !== id));
  };

  const handleSubmit = () => {
    if (!title) return;

    let finalDetails = details;
    if (seat) finalDetails = `Seat: ${seat} | ` + finalDetails;
    if (flightNumber) finalDetails = `Flight: ${flightNumber} | ` + finalDetails;

    onSave({
      ...initialItem,
      id: initialItem?.id,
      title,
      location,
      endLocation: type === ItemType.TRANSPORT ? endLocation : undefined,
      startDate: new Date(startDate),
      endDate: type === ItemType.STAY || type === ItemType.TRANSPORT ? new Date(endDate) : undefined,
      cost: convertedCost, // Save the CONVERTED amount as the main cost for budget
      details: finalDetails,
      type,
      tags,
      durationMinutes,
      latitude,
      longitude,
      countryCode,
      endLatitude,
      endLongitude,
      endCountryCode,
      isPrivate,
      splitWith,
      splitDetails: undefined, // FORCE RESET: Ensure old fixed splits don't persist. The backend/service will recalculate equal splits.
      paidBy,
      showInTimeline: true,
      currencyCode,
      originalAmount: parseFloat(cost) || 0, // Save the RAW input as original amount
      exchangeRate,
      resources
    });
  };

  const getTypeColor = () => {
    switch (type) {
      case ItemType.STAY: return 'text-yellow-500';
      case ItemType.TRANSPORT: return 'text-orange-500';
      case ItemType.ACTIVITY: return 'text-blue-400';
      case ItemType.FOOD: return 'text-red-500';
      default: return 'text-white';
    }
  };

  const getHeaderTitle = () => {
    switch (type) {
      case ItemType.STAY: return 'TRIP ITEM: STAY';
      case ItemType.TRANSPORT: return 'TRIP ITEM: TRANSPORT';
      case ItemType.ACTIVITY: return 'TRIP ITEM: ACTIVITY';
      case ItemType.FOOD: return 'TRIP ITEM: FOOD & DRINK';
    }
  };

  const renderIcon = () => {
    const className = `w-12 h-12 p-3 rounded bg-tactical-card border border-tactical-muted/30 ${getTypeColor()}`;
    switch (type) {
      case ItemType.STAY: return <BedIcon className={className} />;
      case ItemType.TRANSPORT: return <TrainIcon className={className} />;
      case ItemType.FOOD: return <UtensilsIcon className={className} />;
      default: return <CameraIcon className={className} />;
    }
  };

  const isOwner = !initialItem || !initialItem.id || (initialItem.createdBy === currentUserId);
  const costNum = parseFloat(cost) || 0;
  const payer = members.find(m => m.id === paidBy);

  const formatDuration = (mins?: number) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="flex flex-col h-full bg-tactical-bg animate-fade-in overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-30 border-b border-tactical-muted/10 w-full max-w-2xl mx-auto">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <div className={`px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-widest ${initialItem?.id ? 'border-tactical-muted/30 bg-tactical-card text-gray-500'
              : isPrivate
                ? 'border-gray-600 bg-gray-900 text-gray-400'
                : 'border-tactical-accent/30 bg-tactical-accent/10 text-tactical-accent'
            }`}>
            {initialItem?.id ? 'Updating Item' : (isPrivate ? 'Private Item' : 'Shared Item')}
          </div>
          {queueLength !== undefined && queueLength > 1 && (
            <div className="text-[10px] text-tactical-accent font-bold mt-1 tracking-widest animate-pulse">
              DETECTED ITEMS: +{queueLength - 1} MORE
            </div>
          )}
        </div>
        <button className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        </button>
      </header>

      <div className="p-6 space-y-8 pb-48 w-full max-w-2xl mx-auto flex-1">
        {/* Title Section */}
        <div>
          <h1 className={`font-display text-3xl font-bold uppercase leading-tight mb-6 ${getTypeColor()}`}>
            {getHeaderTitle()}
          </h1>

          <div className="flex items-center gap-4 mb-6">
            {renderIcon()}
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                {type === ItemType.TRANSPORT ? 'Transport Provider' :
                  type === ItemType.FOOD ? 'Establishment Name' :
                    'Place Name'}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-b border-tactical-muted/50 focus:border-tactical-accent py-1 text-xl font-bold text-white placeholder-gray-700 outline-none transition-colors"
                placeholder={type === ItemType.STAY ? "Desert Mirage Hotel" : "Name of location"}
              />
            </div>
          </div>
        </div>

        {/* Privacy Toggle */}
        <div className={`border rounded-xl p-4 flex items-center justify-between ${!isPrivate ? 'bg-tactical-accent/5 border-tactical-accent/30' : 'bg-tactical-card border-tactical-muted/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${!isPrivate ? 'bg-tactical-accent text-black' : 'bg-black/20 text-gray-500'}`}>
              {!isPrivate ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className={`font-display font-bold uppercase text-sm tracking-wide ${!isPrivate ? 'text-white' : 'text-gray-400'}`}>
                {isPrivate ? 'Private Item' : 'Shared Item'}
              </div>
              <div className="text-xs text-gray-500">
                {isOwner
                  ? (isPrivate ? 'Only visible to you' : 'Visible to everyone in the trip')
                  : 'Created by another traveler (Locked)'}
              </div>
            </div>
          </div>

          {isOwner ? (
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${!isPrivate ? 'bg-tactical-accent' : 'bg-tactical-muted/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${!isPrivate ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          ) : (
            <div className="px-2 py-1 rounded bg-black/40 border border-white/10 text-[9px] font-bold text-gray-500 uppercase">
              LOCKED
            </div>
          )}
        </div>

        {/* Financial Config */}
        {!isPrivate && (
          <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setShowFinancialOptions(!showFinancialOptions)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-black/20 text-tactical-accent">
                  <WalletIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-white uppercase text-sm tracking-wide">
                    Payment & Split
                  </div>
                  <div className="text-xs text-gray-500">
                    Paid by <span className="text-white font-bold">{paidBy === currentUserId ? 'YOU' : payer?.name}</span> • Split by <span className="text-white font-bold">{splitWith.length}</span>
                  </div>
                </div>
              </div>
              <div className={`text-gray-400 transition-transform ${showFinancialOptions ? 'rotate-90' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>

            {showFinancialOptions && (
              <div className="p-4 pt-0 border-t border-tactical-muted/10 bg-black/10">
                <div className="mt-4 mb-6">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                    Who Paid?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => setPaidBy(member.id)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition-colors flex items-center gap-2 ${paidBy === member.id
                          ? 'bg-tactical-accent border-tactical-accent text-black'
                          : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-500'
                          }`}
                      >
                        <img src={sanitizeAsset(member.avatarUrl, member.id)} className="w-4 h-4 rounded-full" />
                        {member.isCurrentUser ? 'Me' : member.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
                    Split With
                  </label>
                  {activeMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <img
                          src={sanitizeAsset(member.avatarUrl, member.id)}
                          alt={member.name}
                          className="w-8 h-8 rounded-full border border-gray-600"
                        />
                        <span className={`text-sm font-bold uppercase ${splitWith.includes(member.id) ? 'text-white' : 'text-gray-500'}`}>
                          {member.name}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleSplitMember(member.id)}
                        className={`w-6 h-6 rounded border flex items-center justify-center ${splitWith.includes(member.id)
                          ? 'bg-tactical-accent border-tactical-accent text-black'
                          : 'border-gray-600 bg-transparent'
                          }`}
                      >
                        {splitWith.includes(member.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date / Time */}
        <div className="grid grid-cols-2 gap-4 border-t border-b border-tactical-muted/10 py-6">
          <div>
            <TacticalDatePicker
              label={type === ItemType.TRANSPORT ? 'Departure' : 'Check-In'}
              value={startDate}
              onChange={(date) => setStartDate(formatDateForInput(date))}
            />
          </div>

          {(type === ItemType.STAY || type === ItemType.TRANSPORT) && (
            <div>
              <TacticalDatePicker
                label={type === ItemType.TRANSPORT ? 'Arrival' : 'Check-Out'}
                value={endDate}
                onChange={(date) => setEndDate(formatDateForInput(date))}
              />
              {durationMinutes && (
                <div className="mt-2 text-[10px] text-tactical-accent font-bold uppercase tracking-wider flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  DETECTED TIME: {formatDuration(durationMinutes)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
              {type === ItemType.TRANSPORT ? 'Origin Coordinates' : 'Location Coordinates'}
            </label>
            <PlaceAutocomplete
              value={location}
              onChange={(val, meta) => {
                setLocation(val);
                if (meta) {
                  setLatitude(meta.lat);
                  setLongitude(meta.lon);
                  setCountryCode(meta.countryCode);
                }
              }}
              placeholder="Address or City"
            />
          </div>

          {type === ItemType.TRANSPORT && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                Destination Coordinates
              </label>
              <PlaceAutocomplete
                value={endLocation}
                onChange={(val, meta) => {
                  setEndLocation(val);
                  if (meta) {
                    setEndLatitude(meta.lat);
                    setEndLongitude(meta.lon);
                    setEndCountryCode(meta.countryCode);
                  }
                }}
                placeholder="Destination City"
              />
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="mt-6">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Trip Labels</label>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  disabled={tags.includes(tag)}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${tags.includes(tag)
                    ? 'bg-tactical-accent/20 text-tactical-accent border-tactical-accent opacity-50 cursor-default'
                    : 'bg-transparent text-gray-400 border-tactical-muted hover:border-tactical-accent hover:text-white'
                    }`}
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="flex-1 bg-tactical-card p-3 rounded-lg border border-tactical-muted/30 text-white text-sm outline-none focus:border-tactical-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <div key={tag} className="bg-tactical-accent/10 border border-tactical-accent/30 text-tactical-accent text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                <span>{tag}</span>
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">&times;</button>
              </div>
            ))}
          </div>
        </div>

        {/* Specialized Detail Cards - REDESIGNED FOR VERTICAL SPACE */}

        {/* TRANSPORT CARD */}
        {type === ItemType.TRANSPORT && (
          <div className="bg-[#A0522D] rounded-2xl overflow-hidden relative shadow-[0_20px_40px_rgba(0,0,0,0.6)] mt-8 group flex flex-col">
            <div className="absolute top-1/2 -left-4 w-8 h-8 rounded-full bg-tactical-bg shadow-inner z-10"></div>
            <div className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-tactical-bg shadow-inner z-10"></div>

            <div className="p-6 border-b border-dashed border-black/30 bg-white/5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">Traveler</span>
                  <div className="font-display font-bold text-2xl text-white tracking-tight">THE TRAVELER</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">Sector</span>
                  <div className="font-display font-bold text-white text-xl">TRANSIT</div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Top Row: Seat and Class in bigger vertical blocks */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/25 rounded-xl p-4 border border-white/5">
                  <span className="text-[10px] font-bold text-white/30 uppercase block mb-2 tracking-widest">Assigned Seat</span>
                  <input
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    placeholder="04A"
                    className="bg-transparent w-full text-white font-mono font-bold text-3xl placeholder-white/10 outline-none"
                  />
                </div>
                <div className="bg-black/25 rounded-xl p-4 border border-white/5 text-center">
                  <span className="text-[10px] font-bold text-white/30 uppercase block mb-2 tracking-widest">Flight Number</span>
                  <input
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="E.G. BA1530"
                    className="bg-transparent w-full text-white font-mono font-bold text-2xl text-center placeholder-white/10 outline-none"
                  />
                </div>
              </div>

              {/* Unified Input Section */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <label className="text-[10px] font-bold text-white/40 uppercase block mb-3 tracking-widest">Flight Details & Notes</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Enter flight details, reservation numbers, or special instructions..."
                  className="bg-black/20 w-full text-white font-mono text-sm p-4 rounded-lg placeholder-white/10 outline-none resize-none min-h-[120px] focus:bg-black/30 transition-all border border-white/5 focus:border-white/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STAY CARD */}
        {type === ItemType.STAY && (
          <div className="bg-tactical-muted/10 border border-tactical-accent/30 rounded-2xl overflow-hidden shadow-2xl mt-8">
            <div className="bg-tactical-accent/15 p-4 border-b border-tactical-accent/30 flex justify-between items-center">
              <span className="text-xs font-extrabold text-tactical-accent uppercase tracking-[0.2em]">Accommodation Details</span>
              <BedIcon className="w-5 h-5 text-tactical-accent animate-pulse" />
            </div>
            <div className="p-6 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">Booking Details & Notes</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add booking reference, security codes, or check-in instructions..."
                  className="w-full bg-black/40 border border-tactical-muted/40 rounded-xl p-4 text-white text-sm placeholder-gray-700 focus:border-tactical-accent outline-none min-h-[120px] shadow-inner transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* OTHER TYPES */}
        {type !== ItemType.TRANSPORT && type !== ItemType.STAY && (
          <div className="space-y-6 mt-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                {type === ItemType.FOOD ? 'Meal Details & Notes' : 'Activity Details & Notes'}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Document your findings here..."
                className="w-full bg-tactical-card border border-tactical-muted/30 rounded-2xl p-5 text-white text-md placeholder-gray-700 focus:border-tactical-accent outline-none min-h-[150px] transition-all"
              />
            </div>
          </div>
        )}

        {/* Resources / Links Section - LOW PROFILE */}
        <div className="space-y-3 mt-4">
          {resources.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                Saved Resources
              </label>
              <div className="space-y-2">
                {resources.map(link => (
                  <div key={link.id} className="flex items-center justify-between bg-tactical-card/30 p-2.5 rounded-xl border border-tactical-muted/10 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <LinkIcon className="w-3.5 h-3.5 text-tactical-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{link.title}</div>
                        <div className="text-[9px] text-gray-500 truncate">{link.url}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveResource(link.id)}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isAddingResource ? (
            <button
              onClick={() => setIsAddingResource(true)}
              disabled={resources.length >= 10}
              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${resources.length >= 10
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-500 hover:text-tactical-accent'
                }`}
            >
              <PlusIcon className="w-3 h-3" />
              {resources.length >= 10
                ? 'Max Links Reached (10)'
                : resources.length > 0
                  ? `Add Another Link (${resources.length}/10)`
                  : '+ Add Link or Resource'}
            </button>
          ) : (
            <div className="bg-tactical-card/50 border border-tactical-muted/20 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-tactical-accent uppercase tracking-widest">Add Resource</span>
                <button
                  onClick={() => setIsAddingResource(false)}
                  className="text-[9px] text-gray-500 hover:text-white uppercase font-bold"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Hyperlink URL</label>
                  <input
                    placeholder="https://example.com"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full bg-black/40 border border-tactical-muted/30 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-tactical-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Alias / Title (Optional)</label>
                  <input
                    placeholder="e.g. Menu, Booking Info..."
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    className="w-full bg-black/40 border border-tactical-muted/30 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-tactical-accent"
                  />
                </div>
              </div>

              <button
                onClick={handleAddResource}
                disabled={!newLinkUrl}
                className="w-full py-3 bg-tactical-accent/10 hover:bg-tactical-accent/20 text-tactical-accent text-[10px] font-bold uppercase rounded-xl transition-all border border-tactical-accent/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Link
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="mt-auto sticky bottom-0 bg-tactical-bg p-6 border-t border-tactical-muted/20 z-20 w-full max-w-2xl mx-auto backdrop-blur-md bg-opacity-95">
        <div className="flex items-end justify-between mb-4">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Cost</span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
              <CurrencySelector
                variant="minimal"
                value={currencyCode}
                onChange={setCurrencyCode}
              />
              <div className="flex items-baseline text-tactical-accent">
                <span className={`${fontClasses.symbol} font-bold mr-1.5 opacity-60 transition-all duration-200`}>{getCurrencySymbol(currencyCode)}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatInputAmount(cost)}
                  onChange={handleCostChange}
                  className={`bg-transparent ${fontClasses.input} font-display font-bold text-right outline-none placeholder-tactical-muted/20 selection:bg-tactical-accent selection:text-black transition-all duration-200`}
                  placeholder="0.00"
                  style={{ width: `${Math.max(4, formatInputAmount(cost).length)}ch` }}
                />
              </div>
            </div>
            {currencyCode !== baseCurrency && (cost) && (
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                ≈ {getCurrencySymbol(baseCurrency)}{convertedCost.toFixed(2)}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!title}
          className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-black text-xl py-5 rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.15)] active:scale-[0.98] disabled:opacity-30 transition-all uppercase tracking-[0.15em]"
        >
          {queueLength && queueLength > 1 ? 'SAVE & NEXT ITEM' : (initialItem?.id ? 'UPDATE ITEM' : 'ADD TO TRIP')}
        </button>
      </div>
    </div>
  );
};

export default ItemForm;
