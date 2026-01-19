import React from 'react';
import { Trip, ItineraryItem, ItemType, Member } from '../types';
import { ChevronLeftIcon, BedIcon, TrainIcon, CameraIcon, UtensilsIcon, MapPinIcon, EyeOffIcon, UserIcon } from './Icons';
import { getCurrencySymbol } from '../utils/currencyUtils';
import MapComponent from './MapComponent';

interface ItemDetailsProps {
  item: ItineraryItem;
  canEdit: boolean; // Permission check
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  currentUserId: string;
  members?: Member[]; // To resolve names
  trip?: Trip;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ item, canEdit, onClose, onEdit, onDelete, currentUserId, members = [], trip }) => {
  const baseCurrency = trip?.baseCurrency || 'USD';
  const getTypeColor = () => {
    switch (item.type) {
      case ItemType.STAY: return 'text-yellow-500';
      case ItemType.TRANSPORT: return 'text-orange-500';
      case ItemType.ACTIVITY: return 'text-blue-400';
      case ItemType.FOOD: return 'text-red-500';
      default: return 'text-white';
    }
  };

  const getHeaderTitle = () => {
    switch (item.type) {
      case ItemType.STAY: return 'ACCOMMODATION INTEL';
      case ItemType.TRANSPORT: return 'EXTRACTION DETAILS';
      case ItemType.ACTIVITY: return 'RECON REPORT';
      case ItemType.FOOD: return 'SUPPLY LOG';
    }
  };

  const renderIcon = () => {
    const className = `w-12 h-12 p-3 rounded bg-tactical-card border border-tactical-muted/30 ${getTypeColor()}`;
    switch (item.type) {
      case ItemType.STAY: return <BedIcon className={className} />;
      case ItemType.TRANSPORT: return <TrainIcon className={className} />;
      case ItemType.FOOD: return <UtensilsIcon className={className} />;
      default: return <CameraIcon className={className} />;
    }
  };

  const formatDateOnly = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeOnly = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Cost calculations
  const totalCost = item.cost || 0;
  const splitCount = (item.splitWith && item.splitWith.length > 0) ? item.splitWith.length : 0;

  // Custom split or equal split?
  const isUserIncluded = item.splitWith?.includes(currentUserId);
  let myShare = 0;

  if (item.splitDetails && item.splitDetails[currentUserId] !== undefined) {
    myShare = item.splitDetails[currentUserId];
  } else if (isUserIncluded) {
    myShare = totalCost / (splitCount || 1);
  }

  // Payer Info
  const payer = members.find(m => m.id === item.paidBy);
  const isPayer = item.paidBy === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-tactical-bg w-full max-w-md h-[90vh] rounded-2xl border border-tactical-muted/30 flex flex-col overflow-hidden shadow-2xl relative">

        {/* Header Actions */}
        <div className="flex items-center justify-between p-4 border-b border-tactical-muted/10 bg-tactical-card/50">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <ChevronLeftIcon className="w-6 h-6" />
          </button>

          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="p-2 text-tactical-accent hover:bg-tactical-accent/10 rounded-full transition-colors"
                title="Edit Intel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                title="Delete Intel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Title Block */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-current opacity-50"></span> {getHeaderTitle()}
            </div>

            {item.isPrivate && (
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-gray-800 border border-gray-600">
                <EyeOffIcon className="w-3 h-3 text-gray-400" />
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Private Intel</span>
              </div>
            )}

            <h1 className="font-display text-3xl font-bold text-white uppercase leading-tight mb-4">{item.title}</h1>

            <div className="flex items-center gap-4 bg-tactical-card p-4 rounded-xl border border-tactical-muted/20">
              {renderIcon()}
              <div>
                <div className="text-xs text-gray-400 mb-1">LOCATION</div>
                <div className="text-white font-medium flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-tactical-muted" /> {item.location}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Block */}
          <div className="border-t border-b border-tactical-muted/10 py-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Start / Check-In */}
              <div>
                <div className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest mb-2 opacity-80">
                  {item.type === ItemType.TRANSPORT ? 'DEPARTURE' : item.type === ItemType.STAY ? 'CHECK-IN' : 'START TIME'}
                </div>
                <div className="font-mono text-white">
                  <div className="text-sm text-gray-400 mb-0.5">{formatDateOnly(item.startDate)}</div>
                  <div className="text-2xl font-bold tracking-tight">{formatTimeOnly(item.startDate)}</div>
                </div>
              </div>

              {/* End / Check-Out */}
              {((item.type === ItemType.STAY || item.type === ItemType.TRANSPORT) && item.endDate) ? (
                <div className="text-right">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80 ${item.type === ItemType.STAY ? 'text-yellow-500' : 'text-orange-500'}`}>
                    {item.type === ItemType.STAY ? 'CHECK-OUT' : 'ARRIVAL'}
                  </div>
                  <div className="font-mono text-white">
                    <div className="text-sm text-gray-400 mb-0.5">{formatDateOnly(item.endDate)}</div>
                    <div className="text-2xl font-bold tracking-tight">{formatTimeOnly(item.endDate)}</div>
                  </div>
                  {item.type === ItemType.TRANSPORT && item.endLocation && (
                    <div className="text-xs text-gray-500 mt-2 font-medium">{item.endLocation}</div>
                  )}
                </div>
              ) : (
                // Empty div to keep grid structure if needed
                null
              )}
            </div>
          </div>

          {/* Split Cost Section */}
          {!item.isPrivate && splitCount > 0 && (
            <div className="border-b border-tactical-muted/10 pb-6 mb-2">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span>Financial Breakdown</span>
                <span className="text-white">{splitCount} Members Involved</span>
              </div>

              {/* Paid By Info */}
              <div className="mb-4 bg-tactical-card/50 rounded-lg p-3 flex items-center gap-3 border border-tactical-muted/20">
                <div className="bg-green-900/30 p-2 rounded-full border border-green-700/50 text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" /><path d="M12 2v20" /></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">PAID BY</div>
                  <div className="text-white font-bold">{isPayer ? 'YOU' : payer?.name || 'Unknown'}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-mono text-lg text-white font-bold">{getCurrencySymbol(baseCurrency)}{totalCost.toFixed(2)}</div>
                  {item.currencyCode && item.currencyCode !== baseCurrency && item.originalAmount != null && (
                    <div className="text-[10px] font-mono text-gray-500 leading-none">
                      ({getCurrencySymbol(item.currencyCode)}{Number(item.originalAmount).toFixed(2)})
                    </div>
                  )}
                </div>
              </div>

              {/* Split List */}
              <div className="flex flex-col gap-2 mb-4 pl-1">
                {item.splitWith?.map(memberId => {
                  const m = members.find(mem => mem.id === memberId);
                  let share = totalCost / (splitCount || 1);
                  if (item.splitDetails && item.splitDetails[memberId] !== undefined) {
                    share = item.splitDetails[memberId];
                  }

                  return (
                    <div key={memberId} className="flex items-center justify-between bg-white/5 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <img
                          src={m?.avatarUrl || `https://ui-avatars.com/api/?name=U`}
                          className="w-6 h-6 rounded-full border border-gray-600"
                        />
                        <span className="text-xs text-gray-300 font-bold uppercase">{m?.name}</span>
                      </div>
                      <div className="font-mono text-xs text-tactical-accent font-bold">
                        {getCurrencySymbol(baseCurrency)}{share.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Your Share Card */}
              {isUserIncluded ? (
                <div className="bg-tactical-accent/10 border border-tactical-accent/30 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-bold text-tactical-accent uppercase">Your Share (Owed)</span>
                  <span className="font-mono font-bold text-white text-lg">{getCurrencySymbol(baseCurrency)}{myShare.toFixed(2)}</span>
                </div>
              ) : (
                <div className="bg-gray-800/40 border border-white/5 p-3 rounded-lg text-center">
                  <span className="text-xs text-gray-500">You are not included in this split.</span>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Labels</div>
              <div className="flex flex-wrap gap-2">
                {item.tags.map(tag => (
                  <span key={tag} className="bg-tactical-card border border-tactical-muted/50 text-tactical-text text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details & Notes */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Additional Intel</div>
            <div className="bg-tactical-card rounded-lg p-4 border border-tactical-muted/30 min-h-[100px] text-gray-300 leading-relaxed whitespace-pre-wrap">
              {item.details || "No additional intelligence logged."}
            </div>
          </div>

          {/* Tactical Map Block */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest flex items-center justify-between">
              <span>Sat-Link Feed</span>
              {item.mapUri && (
                <a href={item.mapUri} target="_blank" rel="noopener noreferrer" className="text-[8px] underline opacity-50 hover:opacity-100">
                  EXT: FEED
                </a>
              )}
            </div>
            <MapComponent locationName={item.location} />
          </div>

        </div>

        {/* Footer Info */}
        <div className="bg-tactical-card p-6 border-t border-tactical-muted/20">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Cost Logged</span>
            <div className="flex flex-col items-end">
              <span className="font-mono text-xl text-white font-bold">{getCurrencySymbol(baseCurrency)}{(item.cost || 0).toFixed(2)}</span>
              {item.currencyCode && item.currencyCode !== baseCurrency && item.originalAmount != null && (
                <span className="text-xs font-mono text-gray-500">
                  ({getCurrencySymbol(item.currencyCode)}{Number(item.originalAmount).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ItemDetails;