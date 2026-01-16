
import React, { useState, useEffect } from 'react';
import { ItemType, ItineraryItem, Member } from '../types';
import { ChevronLeftIcon, MapPinIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, PlusIcon, EyeOffIcon, EyeIcon, UserIcon, WalletIcon } from './Icons';

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
}

const ItemForm: React.FC<ItemFormProps> = ({ type, onClose, onSave, tripStartDate, initialItem, availableTags = [], queueLength, currentUserId, members = [] }) => {
  // Filter helper: Active or undefined (legacy) members only. Exclude Blocked/Pending.
  const activeMembers = members.filter(m => m.status === 'ACTIVE' || !m.status);

  // Reset state when initialItem changes (important for the queue flow)
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
        setCost(initialItem.cost?.toString() || '');
        setDetails(extractCleanDetails(initialItem.details));
        setSeat(extractSeat(initialItem.details));
        setTags(initialItem.tags || []);
        setDurationMinutes(initialItem.durationMinutes);
        setIsPrivate(initialItem.isPrivate || false);
        
        // Default to all active members if no split list exists (new item default)
        const defaultSplit = activeMembers.map(m => m.id);
        setSplitWith(initialItem.splitWith || defaultSplit);
        
        // Default Payer
        setPaidBy(initialItem.paidBy || currentUserId);
    } else {
        // Initialize new item defaults
        const defaultSplit = activeMembers.map(m => m.id);
        setSplitWith(defaultSplit);
        setPaidBy(currentUserId);
    }
  }, [initialItem, tripStartDate, members, currentUserId]);

  // Helper to extract seat from details if present (Format: "Seat: XX | Details...")
  const extractSeat = (detailsStr?: string | null) => {
    if (!detailsStr) return '';
    const seatMatch = detailsStr.match(/Seat:\s*(.*?)\s*\|/);
    return seatMatch ? seatMatch[1] : '';
  };
  
  const extractCleanDetails = (detailsStr?: string | null) => {
    if (!detailsStr) return '';
    return detailsStr.replace(/Seat:\s*.*?\s*\|\s*/, '');
  };

  // Date formatting for input type="datetime-local"
  const formatDateForInput = (date: Date) => {
    // Handling timezone offset to keep local time in input
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const formatDuration = (mins?: number) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // Form State
  const [title, setTitle] = useState(initialItem?.title || '');
  const [location, setLocation] = useState(initialItem?.location || '');
  const [endLocation, setEndLocation] = useState(initialItem?.endLocation || '');
  
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
  
  const [cost, setCost] = useState(initialItem?.cost?.toString() || '');
  
  const [details, setDetails] = useState(
    initialItem ? extractCleanDetails(initialItem.details) : ''
  );
  
  const [seat, setSeat] = useState(
    initialItem ? extractSeat(initialItem.details) : ''
  );
  
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(initialItem?.durationMinutes);
  
  const [isPrivate, setIsPrivate] = useState(initialItem?.isPrivate || false);
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>(currentUserId);
  
  const [showFinancialOptions, setShowFinancialOptions] = useState(false);

  // Tag State
  const [tags, setTags] = useState<string[]>(initialItem?.tags || []);
  const [tagInput, setTagInput] = useState('');

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

  const handleSubmit = () => {
    if (!title) return;

    onSave({
      id: initialItem?.id, // Pass back ID if editing
      title,
      location,
      endLocation: type === ItemType.TRANSPORT ? endLocation : undefined,
      startDate: new Date(startDate),
      endDate: type === ItemType.STAY || type === ItemType.TRANSPORT ? new Date(endDate) : undefined,
      cost: parseFloat(cost) || 0,
      details: seat ? `Seat: ${seat} | ${details}` : details,
      type,
      tags,
      durationMinutes, // IMPORTANT: Pass this back to parent
      isPrivate,
      splitWith,
      paidBy,
      showInTimeline: true // Standard items added via this form always appear on Timeline
    });
  };

  const getTypeColor = () => {
    switch(type) {
      case ItemType.STAY: return 'text-yellow-500';
      case ItemType.TRANSPORT: return 'text-orange-500';
      case ItemType.ACTIVITY: return 'text-blue-400';
      case ItemType.FOOD: return 'text-red-500';
      default: return 'text-white';
    }
  };

  const getHeaderTitle = () => {
    switch(type) {
      case ItemType.STAY: return 'MISSION: ACCOMMODATION';
      case ItemType.TRANSPORT: return 'MISSION: EXTRACTION';
      case ItemType.ACTIVITY: return 'MISSION: INTEL & VIEWS';
      case ItemType.FOOD: return 'MISSION: REFUEL';
    }
  };

  const renderIcon = () => {
    const className = `w-12 h-12 p-3 rounded bg-tactical-card border border-tactical-muted/30 ${getTypeColor()}`;
    switch(type) {
      case ItemType.STAY: return <BedIcon className={className} />;
      case ItemType.TRANSPORT: return <TrainIcon className={className} />;
      case ItemType.FOOD: return <UtensilsIcon className={className} />;
      default: return <CameraIcon className={className} />;
    }
  };

  // Ownership Check
  // New items are owned by current user. Existing items check createdBy.
  // If no createdBy exists on initialItem (legacy), assume editable or public.
  const isOwner = !initialItem || !initialItem.id || (initialItem.createdBy === currentUserId);

  // Calculate cost per person for preview
  const costNum = parseFloat(cost) || 0;
  const costPerPerson = splitWith.length > 0 ? (costNum / splitWith.length).toFixed(2) : '0.00';
  const payer = members.find(m => m.id === paidBy);

  return (
    <div className="flex flex-col h-full bg-tactical-bg animate-fade-in overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10 w-full max-w-2xl mx-auto">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
             <div className="px-3 py-1 rounded-full border border-tactical-muted/30 bg-tactical-card text-[10px] uppercase font-bold tracking-widest text-gray-500">
             {initialItem?.id ? 'Modifying Intel' : 'Secured by User'}
             </div>
             {queueLength !== undefined && queueLength > 1 && (
                 <div className="text-[10px] text-tactical-accent font-bold mt-1 tracking-widest animate-pulse">
                     DETECTED INTEL: +{queueLength - 1} MORE
                 </div>
             )}
        </div>
        <button className="text-gray-400">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </header>

      <div className="p-6 space-y-8 pb-32 w-full max-w-2xl mx-auto flex-1">
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
                  'Fortress Identifier'}
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
        <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isPrivate ? 'bg-gray-700 text-white' : 'bg-black/20 text-gray-500'}`}>
                    {isPrivate ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </div>
                <div>
                    <div className="font-display font-bold text-white uppercase text-sm tracking-wide">
                        {isPrivate ? 'Private Intel' : 'Public Intel'}
                    </div>
                    <div className="text-xs text-gray-500">
                        {isOwner 
                          ? (isPrivate ? 'Only visible to you' : 'Visible to entire squad')
                          : 'Created by another operative (Locked)'}
                    </div>
                </div>
            </div>
            
            {isOwner ? (
                <button 
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isPrivate ? 'bg-gray-600' : 'bg-tactical-muted/30'}`}
                >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
            ) : (
                <div className="px-2 py-1 rounded bg-black/40 border border-white/10 text-[9px] font-bold text-gray-500 uppercase">
                    LOCKED
                </div>
            )}
        </div>

        {/* Expense Split & Payer Configuration - Only if NOT Private */}
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
                                Financial Config
                            </div>
                            <div className="text-xs text-gray-500">
                                Paid by <span className="text-white font-bold">{paidBy === currentUserId ? 'YOU' : payer?.name}</span> • Split by <span className="text-white font-bold">{splitWith.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className={`text-gray-400 transition-transform ${showFinancialOptions ? 'rotate-90' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                </div>
                
                {showFinancialOptions && (
                    <div className="p-4 pt-0 border-t border-tactical-muted/10 bg-black/10">
                        {/* 1. Paid By Section */}
                        <div className="mt-4 mb-6">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                                Who Paid?
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {activeMembers.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => setPaidBy(member.id)}
                                        className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition-colors flex items-center gap-2 ${
                                            paidBy === member.id 
                                            ? 'bg-tactical-accent border-tactical-accent text-black' 
                                            : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-500'
                                        }`}
                                    >
                                        <img src={member.avatarUrl} className="w-4 h-4 rounded-full" />
                                        {member.isCurrentUser ? 'Me' : member.name.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Split With Section */}
                        <div className="space-y-2">
                             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
                                Split Among
                             </label>
                             {activeMembers.map(member => (
                                 <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5">
                                     <div className="flex items-center gap-3">
                                         <img 
                                            src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`} 
                                            alt={member.name}
                                            className="w-8 h-8 rounded-full border border-gray-600"
                                         />
                                         <span className={`text-sm font-bold uppercase ${splitWith.includes(member.id) ? 'text-white' : 'text-gray-500'}`}>
                                             {member.name}
                                         </span>
                                     </div>
                                     <button 
                                        onClick={() => toggleSplitMember(member.id)}
                                        className={`w-6 h-6 rounded border flex items-center justify-center ${
                                            splitWith.includes(member.id) 
                                            ? 'bg-tactical-accent border-tactical-accent text-black' 
                                            : 'border-gray-600 bg-transparent'
                                        }`}
                                     >
                                         {splitWith.includes(member.id) && (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                         )}
                                     </button>
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Date / Time Section */}
        <div className="grid grid-cols-2 gap-4 border-t border-b border-tactical-muted/10 py-6">
           <div>
             <label className="text-[10px] font-bold text-tactical-muted uppercase tracking-widest border-l-2 border-tactical-accent pl-2 mb-2 block">
               {type === ItemType.TRANSPORT ? 'Departure' : 'Infiltration'}
             </label>
             <input 
               type="datetime-local"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
               className="bg-tactical-card text-white text-sm p-2 rounded w-full border border-tactical-muted/30 focus:border-tactical-accent outline-none"
             />
           </div>
           
           {(type === ItemType.STAY || type === ItemType.TRANSPORT) && (
             <div>
               <label className="text-[10px] font-bold text-tactical-muted uppercase tracking-widest border-l-2 border-tactical-muted pl-2 mb-2 block">
                 {type === ItemType.TRANSPORT ? 'Arrival' : 'Extraction'}
               </label>
               <input 
                 type="datetime-local"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="bg-tactical-card text-white text-sm p-2 rounded w-full border border-tactical-muted/30 focus:border-tactical-accent outline-none"
               />
               
               {/* Display Detected Duration for verification */}
               {durationMinutes && (
                 <div className="mt-2 text-[10px] text-tactical-accent font-bold uppercase tracking-wider flex items-center gap-1">
                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                {type === ItemType.TRANSPORT ? 'Origin Coordinates' : 'Target Coordinates'}
              </label>
              <div className="relative">
                <input 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Address or City"
                  className="w-full bg-tactical-card p-4 pr-10 rounded-lg border border-tactical-muted/30 text-white placeholder-gray-600 focus:border-tactical-accent outline-none"
                />
                <MapPinIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-tactical-accent w-5 h-5" />
              </div>
           </div>

           {type === ItemType.TRANSPORT && (
             <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                  Target Coordinates (Destination)
                </label>
                <div className="relative">
                  <input 
                    value={endLocation}
                    onChange={(e) => setEndLocation(e.target.value)}
                    placeholder="Destination City"
                    className="w-full bg-tactical-card p-4 pr-10 rounded-lg border border-tactical-muted/30 text-white placeholder-gray-600 focus:border-tactical-accent outline-none"
                  />
                  <MapPinIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 w-5 h-5" />
                </div>
             </div>
           )}
        </div>

        {/* Tags / Labels Section */}
        <div className="mt-6">
           <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
              Tactical Labels
           </label>
           
           {/* Available Tags Helper */}
           {availableTags.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-3">
               {availableTags.map(tag => (
                 <button 
                   key={tag}
                   onClick={() => handleAddTag(tag)}
                   disabled={tags.includes(tag)}
                   className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                     tags.includes(tag) 
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
                 placeholder="Add tag (e.g., 'Work', 'Chill')"
                 className="flex-1 bg-tactical-card p-3 rounded-lg border border-tactical-muted/30 text-white text-sm outline-none focus:border-tactical-accent"
              />
              <button 
                onClick={() => handleAddTag(tagInput)}
                className="bg-tactical-muted/20 hover:bg-tactical-accent/20 text-tactical-accent p-3 rounded-lg transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
           </div>
           
           {tags.length > 0 && (
             <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                   <div key={tag} className="bg-tactical-accent/10 border border-tactical-accent/30 text-tactical-accent text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                      <span>{tag}</span>
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                   </div>
                ))}
             </div>
           )}
        </div>

        {/* Specialized Cards */}
        
        {/* Boarding Pass Style for Transport */}
        {type === ItemType.TRANSPORT && (
          <div className="bg-[#A0522D] rounded-xl p-0 overflow-hidden relative shadow-lg mt-4">
             {/* Notches */}
             <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-tactical-bg"></div>
             <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-tactical-bg"></div>
             
             <div className="p-4 border-b border-dashed border-black/20">
                <div className="flex justify-between items-end mb-2">
                   <div>
                      <span className="text-[10px] font-bold text-white/60 uppercase">Passenger</span>
                      <div className="font-display font-bold text-xl text-white">THE TRAVELER</div>
                   </div>
                   <div className="text-right">
                      <span className="text-[10px] font-bold text-white/60 uppercase">Class</span>
                      <div className="font-display font-bold text-white">ECONOMY</div>
                   </div>
                </div>
             </div>
             
             <div className="p-4 flex gap-4">
                 <div className="flex-1 bg-black/20 rounded p-2">
                    <span className="text-[10px] font-bold text-white/60 uppercase block">Details</span>
                    <input 
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Flight # / Train #"
                      className="bg-transparent w-full text-white font-mono placeholder-white/40 outline-none"
                    />
                 </div>
                 <div className="w-24 bg-black/20 rounded p-2">
                    <span className="text-[10px] font-bold text-white/60 uppercase block">Seat</span>
                    <input 
                      value={seat}
                      onChange={(e) => setSeat(e.target.value)}
                      placeholder="04A"
                      className="bg-transparent w-full text-white font-mono font-bold text-center placeholder-white/40 outline-none"
                    />
                 </div>
             </div>
          </div>
        )}

        {/* Notes / Details for Non-Transport (Includes Food) */}
        {type !== ItemType.TRANSPORT && (
          <div className="space-y-2 mt-4">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
               {type === ItemType.FOOD ? 'Reservation Details & Notes' : 'Mission Notes'}
             </label>
             <textarea 
               value={details}
               onChange={(e) => setDetails(e.target.value)}
               placeholder={type === ItemType.FOOD ? "Reservation time, dress code, booking reference..." : "Additional intelligence or details..."}
               className="w-full bg-tactical-card border border-tactical-muted/30 rounded-lg p-4 text-white placeholder-gray-600 focus:border-tactical-accent outline-none min-h-[100px]"
             />
          </div>
        )}

      </div>

      {/* Footer / Cost / Save */}
      <div className="mt-auto sticky bottom-0 bg-tactical-bg p-6 border-t border-tactical-muted/20 z-20 w-full max-w-2xl mx-auto">
         <div className="flex items-end justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Financial Toll</span>
            <div className="flex items-baseline text-tactical-accent">
               <span className="text-lg font-bold mr-1">$</span>
               <input 
                 type="number" 
                 value={cost} 
                 onChange={(e) => setCost(e.target.value)}
                 placeholder="0.00"
                 className="bg-transparent w-32 text-4xl font-display font-bold text-right outline-none placeholder-tactical-muted/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
               />
            </div>
         </div>
         
         <button 
           onClick={handleSubmit}
           disabled={!title}
           className="w-full bg-tactical-accent hover:bg-yellow-400 text-black font-display font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
         >
           {queueLength && queueLength > 1 
             ? 'CONFIRM & NEXT INTEL' 
             : (initialItem?.id ? 'UPDATE MISSION' : (type === ItemType.FOOD ? 'LOG RECEIPT' : 'CONFIRM MISSION'))
           }
         </button>
      </div>
    </div>
  );
};

export default ItemForm;
