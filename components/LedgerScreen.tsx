import React from 'react';
import { Trip, ItineraryItem, ItemType } from '../types';
import { ChevronLeftIcon, ShoppingBagIcon, WrenchIcon, FuelIcon, UtensilsIcon, BedIcon, TrainIcon, CameraIcon, EyeOffIcon, BanknoteIcon } from './Icons';
import { getCurrencySymbol } from '../utils/currencyUtils';

interface LedgerScreenProps {
    trip: Trip;
    currentUserId: string;
    onBack: () => void;
    onItemClick: (item: ItineraryItem) => void;
}

const LedgerScreen: React.FC<LedgerScreenProps> = ({ trip, currentUserId, onBack, onItemClick }) => {
    const baseCurrency = trip.baseCurrency || 'USD';
    // Filter items that have cost > 0
    // AND are visible (Public OR Created by Current User)
    const expenses = trip.items
        .filter(item => {
            const hasCost = (item.cost || 0) > 0;
            const isVisiblePrivate = !item.isPrivate || item.createdBy === currentUserId;
            return hasCost && isVisiblePrivate;
        })
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    // Group by Month/Year
    const groupedExpenses: Record<string, ItineraryItem[]> = {};

    expenses.forEach(item => {
        const date = new Date(item.startDate);
        const key = date.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
        if (!groupedExpenses[key]) {
            groupedExpenses[key] = [];
        }
        groupedExpenses[key].push(item);
    });

    const getIcon = (type: ItemType) => {
        switch (type) {
            case ItemType.FOOD: return <UtensilsIcon className="w-5 h-5 text-yellow-500" />;
            case ItemType.STAY: return <BedIcon className="w-5 h-5 text-yellow-500" />;
            case ItemType.TRANSPORT: return <FuelIcon className="w-5 h-5 text-yellow-500" />; // Mapped to Fuel for transport/movement vibe in ledger
            case ItemType.ESSENTIALS: return <ShoppingBagIcon className="w-5 h-5 text-yellow-500" />;
            case ItemType.ACTIVITY: return <WrenchIcon className="w-5 h-5 text-yellow-500" />; // Mapped to Wrench/Gear for generic activity
            case ItemType.SETTLEMENT: return <BanknoteIcon className="w-5 h-5 text-green-500" />;
            default: return <CameraIcon className="w-5 h-5 text-yellow-500" />;
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleString('en-US', { day: '2-digit', month: 'short' }).toUpperCase();
    };

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
                <button onClick={onBack} className="text-gray-400 hover:text-white">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-white uppercase tracking-wider">
                    Trip Ledger
                </div>
                <div className="w-6"></div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide pb-24 space-y-8">

                {Object.keys(groupedExpenses).length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <div className="text-sm uppercase tracking-widest font-bold">No Activity Logged</div>
                    </div>
                )}

                {Object.entries(groupedExpenses).map(([month, items]) => (
                    <div key={month}>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">
                            Detailed Activity • {month}
                        </div>

                        <div className="space-y-3">
                            {items.map(item => {
                                const payer = trip.members.find(m => m.id === item.paidBy);
                                const isSettlement = item.type === ItemType.SETTLEMENT;
                                const receiverId = isSettlement && item.splitWith && item.splitWith.length > 0 ? item.splitWith[0] : null;
                                const receiver = receiverId ? trip.members.find(m => m.id === receiverId) : null;

                                return (
                                    <div
                                        onClick={() => onItemClick(item)}
                                        key={item.id}
                                        className={`bg-tactical-card border border-tactical-muted/20 hover:border-tactical-accent/50 transition-colors rounded-xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transform duration-100 ${item.isPrivate ? 'opacity-75 border-gray-700' : ''}`}
                                    >
                                        <div className={`w-12 h-12 border rounded flex items-center justify-center shrink-0 relative ${isSettlement ? 'bg-green-900/20 border-green-500/30' : 'bg-black/40 border-white/5'}`}>
                                            {getIcon(item.type)}
                                            {item.isPrivate && (
                                                <div className="absolute -top-1 -right-1 bg-gray-800 rounded-full p-0.5 border border-gray-600">
                                                    <EyeOffIcon className="w-3 h-3 text-gray-400" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <h3 className="font-display font-bold text-white uppercase truncate pr-2 text-sm md:text-base">
                                                    {item.title}
                                                </h3>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <span className={`font-mono font-bold ${isSettlement ? 'text-green-500' : 'text-tactical-accent'}`}>
                                                        {isSettlement ? '' : '-'}{getCurrencySymbol(baseCurrency)}{item.cost?.toFixed(2)}
                                                    </span>
                                                    {item.currencyCode && item.currencyCode !== baseCurrency && item.originalAmount != null && (
                                                        <span className="text-[10px] font-mono text-gray-500 leading-none mt-0.5">
                                                            ({getCurrencySymbol(item.currencyCode)}{Number(item.originalAmount).toFixed(2)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        {isSettlement
                                                            ? `Transfer: ${payer?.name.split(' ')[0]} -> ${receiver?.name.split(' ')[0]}`
                                                            : `Paid By ${payer?.name.split(' ')[0].toUpperCase()} • ${item.location}`
                                                        }
                                                    </div>
                                                    <div className="text-[9px] text-gray-600 font-medium uppercase mt-0.5">
                                                        {formatDate(new Date(item.startDate))}
                                                    </div>
                                                </div>

                                                {/* Status Indicator (Mock Logic for Visual) */}
                                                <div className="flex items-center gap-1.5 opacity-60">
                                                    <div className={`w-3 h-3 rounded-full flex items-center justify-center ${isSettlement ? 'bg-green-900' : 'bg-gray-700'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={isSettlement ? "text-green-500" : "text-gray-400"}><polyline points="20 6 9 17 4 12" /></svg>
                                                    </div>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isSettlement ? 'text-green-700' : 'text-gray-500'}`}>
                                                        {isSettlement ? 'Settled' : 'Logged'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LedgerScreen;