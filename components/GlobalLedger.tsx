import React, { useMemo, useState } from 'react';
import { Trip, ItemType, Member } from '../types';
import { ChevronLeftIcon, WalletIcon, BanknoteIcon, UtensilsIcon, BedIcon, FuelIcon, ShoppingBagIcon, WrenchIcon } from './Icons';
import AtmosphericAvatar from './AtmosphericAvatar';
import { getCurrencySymbol } from '../utils/currencyUtils';

interface GlobalLedgerProps {
    trips: Trip[];
    currentUser: Member;
    onBack: () => void;
}

interface AggregatedDebt {
    memberId: string;
    memberName: string;
    avatarUrl?: string;
    netBalance: number; // Positive = they owe me, Negative = I owe them
}

interface TransactionWithTrip {
    item: any;
    tripName: string;
    tripId: string;
}

const GlobalLedger: React.FC<GlobalLedgerProps> = ({ trips, currentUser, onBack }) => {
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    // Calculate aggregated debts across all trips
    const aggregatedDebts = useMemo<AggregatedDebt[]>(() => {
        const debtMap = new Map<string, { name: string; avatarUrl?: string; balance: number }>();

        // Filter trips based on selection
        const tripsToAnalyze = selectedTripId
            ? trips.filter(t => t.id === selectedTripId)
            : trips;

        tripsToAnalyze.forEach(trip => {
            trip.items.forEach(item => {
                if (item.isPrivate) return;

                const cost = item.cost || 0;
                const isPayer = item.paidBy === currentUser.id;
                const isSettlement = item.type === ItemType.SETTLEMENT;

                const splitWith = item.splitWith || [];
                const splitDetails = item.splitDetails || {};
                const hasCustomSplit = Object.keys(splitDetails).length > 0;
                const involvedIds = hasCustomSplit ? Object.keys(splitDetails) : splitWith;

                // Am I involved in this transaction?
                const amIInvolved = involvedIds.includes(currentUser.id);

                // Calculate my share
                let myShare = 0;
                if (amIInvolved) {
                    if (hasCustomSplit && splitDetails[currentUser.id] !== undefined) {
                        myShare = splitDetails[currentUser.id];
                    } else {
                        myShare = cost / (involvedIds.length || 1);
                    }
                }

                // Update balances for each involved member
                involvedIds.forEach(memberId => {
                    if (memberId === currentUser.id) return; // Skip self

                    const member = trip.members.find(m => m.id === memberId);
                    if (!member) return;

                    if (!debtMap.has(memberId)) {
                        debtMap.set(memberId, {
                            name: member.name,
                            avatarUrl: member.avatarUrl,
                            balance: 0
                        });
                    }

                    const debt = debtMap.get(memberId)!;

                    let memberShare = 0;
                    if (hasCustomSplit && splitDetails[memberId] !== undefined) {
                        memberShare = splitDetails[memberId];
                    } else {
                        memberShare = cost / (involvedIds.length || 1);
                    }

                    // If I paid and they consumed, they owe me
                    if (isPayer && !isSettlement) {
                        debt.balance += memberShare;
                    }

                    // If they paid and I consumed, I owe them
                    if (item.paidBy === memberId && amIInvolved && !isSettlement) {
                        debt.balance -= myShare;
                    }

                    // Settlements: If I paid them, reduce what they owe me
                    if (isSettlement && isPayer && involvedIds.includes(memberId)) {
                        debt.balance -= cost;
                    }

                    // Settlements: If they paid me, reduce what I owe them
                    if (isSettlement && item.paidBy === memberId && amIInvolved) {
                        debt.balance += cost;
                    }
                });
            });
        });

        return Array.from(debtMap.entries())
            .map(([id, data]) => ({
                memberId: id,
                memberName: data.name,
                avatarUrl: data.avatarUrl,
                netBalance: data.balance
            }))
            .filter(d => Math.abs(d.netBalance) > 0.01)
            .sort((a, b) => b.netBalance - a.netBalance);
    }, [trips, currentUser.id, selectedTripId]);

    // Get all transactions with trip context
    const allTransactions = useMemo<TransactionWithTrip[]>(() => {
        const result: TransactionWithTrip[] = [];

        // Filter trips based on selection
        const tripsToAnalyze = selectedTripId
            ? trips.filter(t => t.id === selectedTripId)
            : trips;

        tripsToAnalyze.forEach(trip => {
            trip.items.forEach(item => {
                if (item.isPrivate) return;

                const involvedIds = item.splitWith || Object.keys(item.splitDetails || {});
                const amIInvolved = involvedIds.includes(currentUser.id) || item.paidBy === currentUser.id;

                if (amIInvolved) {
                    result.push({
                        item,
                        tripName: trip.name,
                        tripId: trip.id
                    });
                }
            });
        });

        return result.sort((a, b) =>
            new Date(b.item.startDate).getTime() - new Date(a.item.startDate).getTime()
        );
    }, [trips, currentUser.id, selectedTripId]);

    const totalOwedToMe = aggregatedDebts
        .filter(d => d.netBalance > 0)
        .reduce((sum, d) => sum + d.netBalance, 0);

    const totalIOwe = aggregatedDebts
        .filter(d => d.netBalance < 0)
        .reduce((sum, d) => sum + Math.abs(d.netBalance), 0);

    const getLedgerIcon = (type: ItemType) => {
        switch (type) {
            case ItemType.FOOD: return <UtensilsIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.STAY: return <BedIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.TRANSPORT: return <FuelIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.ESSENTIALS: return <ShoppingBagIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.SETTLEMENT: return <BanknoteIcon className="w-4 h-4 text-green-500" />;
            default: return <WrenchIcon className="w-4 h-4 text-yellow-500" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in">
            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-30 border-b border-tactical-muted/10">
                <button onClick={onBack} className="text-tactical-accent hover:text-white transition-colors">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-tactical-accent uppercase tracking-wider">
                    Ledger History
                </div>
                <div className="w-6"></div>
            </header>

            <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                {/* Summary Cards */}
                <div className="px-6 py-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-tactical-card border border-green-500/20 rounded-xl p-4">
                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Owed to Me</div>
                            <div className="font-display text-2xl font-bold text-green-500">
                                {getCurrencySymbol('USD')}{totalOwedToMe.toFixed(0)}
                            </div>
                        </div>
                        <div className="bg-tactical-card border border-red-500/20 rounded-xl p-4">
                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">I Owe</div>
                            <div className="font-display text-2xl font-bold text-red-500">
                                {getCurrencySymbol('USD')}{totalIOwe.toFixed(0)}
                            </div>
                        </div>
                    </div>

                    {/* Trip Filter */}
                    <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedTripId(null)}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all border ${selectedTripId === null
                                    ? 'bg-tactical-accent text-black border-tactical-accent shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                    : 'bg-tactical-card text-gray-500 border-tactical-muted/20 hover:border-tactical-accent/50'
                                    }`}
                            >
                                All Trips
                            </button>
                            {trips.map(trip => (
                                <button
                                    key={trip.id}
                                    onClick={() => setSelectedTripId(trip.id)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all border ${selectedTripId === trip.id
                                        ? 'bg-tactical-accent text-black border-tactical-accent shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                        : 'bg-tactical-card text-gray-500 border-tactical-muted/20 hover:border-tactical-accent/50'
                                        }`}
                                >
                                    {trip.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Outstanding Debts */}
                {aggregatedDebts.length > 0 && (
                    <div className="px-6 pb-6">
                        <h3 className="font-display font-bold text-gray-500 uppercase tracking-widest text-sm mb-3">
                            Outstanding Debts
                        </h3>
                        <div className="bg-tactical-card border border-tactical-muted/20 rounded-xl overflow-hidden divide-y divide-white/5">
                            {aggregatedDebts.map(debt => {
                                const isOwed = debt.netBalance > 0;
                                return (
                                    <div key={debt.memberId} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <AtmosphericAvatar
                                                userId={debt.memberId}
                                                avatarUrl={debt.avatarUrl}
                                                name={debt.memberName}
                                                size="md"
                                            />
                                            <div>
                                                <div className="font-bold text-white text-sm">{debt.memberName}</div>
                                                <div className={`text-[10px] font-bold uppercase tracking-widest ${isOwed ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isOwed ? 'OWES YOU' : 'YOU OWE'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`font-mono text-lg font-bold ${isOwed ? 'text-green-500' : 'text-red-500'}`}>
                                            {isOwed ? '+' : '-'}{getCurrencySymbol('USD')}{Math.abs(debt.netBalance).toFixed(0)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Transaction History */}
                <div className="px-6">
                    <h3 className="font-display font-bold text-gray-500 uppercase tracking-widest text-sm mb-3">
                        Transaction History
                    </h3>
                    <div className="space-y-2">
                        {allTransactions.map((tx, idx) => {
                            const item = tx.item;
                            const isPayer = item.paidBy === currentUser.id;
                            const isSettlement = item.type === ItemType.SETTLEMENT;
                            const payer = trips
                                .find(t => t.id === tx.tripId)
                                ?.members.find(m => m.id === item.paidBy);

                            return (
                                <div
                                    key={`${tx.tripId}-${item.id}-${idx}`}
                                    className="bg-tactical-card border border-tactical-muted/20 rounded-lg p-3 flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center shrink-0">
                                        {getLedgerIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-white text-xs truncate uppercase">{item.title}</h4>
                                            <span className={`font-mono text-xs font-bold ${isSettlement ? 'text-green-500' : 'text-tactical-accent'}`}>
                                                {isSettlement ? '' : '-'}{getCurrencySymbol('USD')}{item.cost?.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                                    {isSettlement ? `${payer?.name.split(' ')[0]} settled debt` : `Paid by ${payer?.name.split(' ')[0]}`}
                                                </div>
                                                <div className="text-[8px] bg-tactical-accent/20 text-tactical-accent px-1.5 py-0.5 rounded font-bold uppercase">
                                                    {tx.tripName}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-gray-600">
                                                {new Date(item.startDate).getDate()} {new Date(item.startDate).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {allTransactions.length === 0 && (
                            <div className="text-center text-gray-500 text-xs py-8 border border-dashed border-gray-700 rounded-lg">
                                No transactions found for the selected filter.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalLedger;
