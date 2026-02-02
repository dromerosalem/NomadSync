import React, { useMemo, useState } from 'react';
import { Trip, ItemType, ItineraryItem, Member, Role } from '../types';
import { ChevronLeftIcon, GearIcon, UtensilsIcon, BedIcon, TrainIcon, CameraIcon, PlusIcon, ShoppingBagIcon, FuelIcon, WrenchIcon, ArrowRightIcon, WalletIcon, NetworkIcon, LinkIcon, LockIcon, BanknoteIcon, SearchIcon } from './Icons';
import { sanitizeAsset } from '../utils/assetUtils';
import AtmosphericAvatar from './AtmosphericAvatar';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { Money } from '../utils/money';
import { useCachedCalculation } from '../hooks/useCachedCalculation';

interface BudgetEngineProps {
    trip: Trip;
    currentUserId: string;
    currentUserRole: Role;
    onBack: () => void;
    onLogExpense: () => void;
    onViewLedger: () => void;
    onItemClick: (item: ItineraryItem) => void;
    onToggleBudgetMode: (mode: 'SMART' | 'DIRECT') => void;
    onSettleDebt: (fromId: string, toId: string, amount: number) => void;
}

const BudgetEngine: React.FC<BudgetEngineProps> = ({ trip, currentUserId, currentUserRole, onBack, onLogExpense, onViewLedger, onItemClick, onToggleBudgetMode, onSettleDebt }) => {
    const currentUser = trip.members.find(m => m.id === currentUserId);
    const userBudget = currentUser?.budget || 0;

    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [settleModalOpen, setSettleModalOpen] = useState(false);

    // Use Global Trip State (Default to SMART if undefined)
    const useSmartSplit = (trip.budgetViewMode || 'SMART') === 'SMART';
    const isPathfinder = currentUserRole === 'PATHFINDER';

    // ---------------------------------------------------------
    // CORE CALCULATION ENGINE (Cached)
    // ---------------------------------------------------------

    // Generate a unique cache key based on data version
    // We include item count to catch quick updates if timestamp isn't perfectly synced yet
    const cacheKey = `budget_calc_v1_${trip.id}_${currentUserId}_${trip.updatedAt || 0}_${trip.items.length}`;

    const { result: calculationData, isComputing: isCalculating } = useCachedCalculation(cacheKey, async () => {
        // NOTE: This runs asynchronously if cache miss
        let myTotal = new Money(0);
        let groupTotal = new Money(0);
        const catSpend: Record<ItemType, Money> = {
            [ItemType.FOOD]: new Money(0),
            [ItemType.STAY]: new Money(0),
            [ItemType.TRANSPORT]: new Money(0),
            [ItemType.ACTIVITY]: new Money(0),
            [ItemType.ESSENTIALS]: new Money(0),
            [ItemType.SETTLEMENT]: new Money(0)
        };

        const now = new Date().getTime();
        const tripEnd = new Date(trip.endDate).getTime();
        const dRemaining = Math.max(0, Math.ceil((tripEnd - now) / (1000 * 60 * 60 * 24)));

        // 1. SIMPLE MODE: Pairwise Balances 
        // Key: MemberID -> Money. (Positive = They owe me, Negative = I owe them)
        const pDebt: Record<string, Money> = {};

        // 2. SMART MODE: Net Balances
        const netBalances: Record<string, Money> = {};

        // Initialize
        trip.members.forEach(m => {
            pDebt[m.id] = new Money(0);
            netBalances[m.id] = new Money(0);
        });

        // Recent Transactions
        const transactions = trip.items
            .filter(item => (item.cost || 0) > 0)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

        let myPaid = new Money(0);
        let myReceived = new Money(0);

        trip.items.forEach(item => {
            if (item.isPrivate) return;
            const cost = new Money(item.cost || 0); // Convert to Money immediately
            const isSettlement = item.type === ItemType.SETTLEMENT;

            const splitWith = item.splitWith || [];
            const splitDetails = item.splitDetails || {};
            const hasCustomSplit = Object.keys(splitDetails).length > 0;
            const payerId = item.paidBy;
            const involvedIds = hasCustomSplit ? Object.keys(splitDetails) : splitWith;

            if (!isSettlement) {
                groupTotal = groupTotal.add(cost);
                // Payment tracking
                if (payerId === currentUserId) myPaid = myPaid.add(cost);

                // Consumption tracking
                let myShare = new Money(0);
                if (hasCustomSplit && splitDetails[currentUserId] !== undefined) {
                    myShare = new Money(splitDetails[currentUserId]);
                } else if (splitWith.includes(currentUserId)) {
                    myShare = cost.divide(splitWith.length || 1);
                }

                if (myShare.greaterThan(0)) {
                    myTotal = myTotal.add(myShare);
                    if (item.type in catSpend) {
                        catSpend[item.type] = catSpend[item.type].add(myShare);
                    } else {
                        catSpend[ItemType.ESSENTIALS] = catSpend[ItemType.ESSENTIALS].add(myShare);
                    }
                }
            } else {
                // Settlement tracking
                if (payerId === currentUserId) myPaid = myPaid.add(cost);
                if (involvedIds.includes(currentUserId)) myReceived = myReceived.add(cost);
            }

            // --- CALCULATE DEBTS & BALANCES ---
            netBalances[payerId] = (netBalances[payerId] || new Money(0)).add(cost);

            involvedIds.forEach(consumerId => {
                let share = new Money(0);
                if (hasCustomSplit) share = new Money(splitDetails[consumerId]);
                else share = cost.divide(involvedIds.length || 1);

                netBalances[consumerId] = (netBalances[consumerId] || new Money(0)).subtract(share);

                if (consumerId !== payerId) {
                    if (payerId === currentUserId) {
                        pDebt[consumerId] = (pDebt[consumerId] || new Money(0)).add(share);
                    } else if (consumerId === currentUserId) {
                        pDebt[payerId] = (pDebt[payerId] || new Money(0)).subtract(share);
                    }
                }
            });
        });

        // --- SMART SPLIT ALGORITHM ---
        let debtors = Object.keys(netBalances)
            .filter(id => netBalances[id].lessThan(-0.01))
            .map(id => ({ id, amount: netBalances[id] }))
            .sort((a, b) => a.amount.toNumber() - b.amount.toNumber());

        let creditors = Object.keys(netBalances)
            .filter(id => netBalances[id].greaterThan(0.01))
            .map(id => ({ id, amount: netBalances[id] }))
            .sort((a, b) => b.amount.toNumber() - a.amount.toNumber()); // Descending

        const transfers: { from: string, to: string, amount: number }[] = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];

            const debtAbs = debtor.amount.abs();
            const creditAbs = creditor.amount.abs();
            const settleAmount = debtAbs.lessThan(creditAbs) ? debtAbs : creditAbs;

            const roundedAmount = settleAmount.round(2);

            if (roundedAmount.greaterThan(0)) {
                transfers.push({ from: debtor.id, to: creditor.id, amount: roundedAmount.toNumber() });
            }

            debtor.amount = debtor.amount.add(settleAmount);
            creditor.amount = creditor.amount.subtract(settleAmount);

            if (debtor.amount.abs().lessThan(0.01)) i++;
            if (creditor.amount.abs().lessThan(0.01)) j++;
        }

        const catSpendNumbers = {
            [ItemType.FOOD]: catSpend[ItemType.FOOD].toNumber(),
            [ItemType.STAY]: catSpend[ItemType.STAY].toNumber(),
            [ItemType.TRANSPORT]: catSpend[ItemType.TRANSPORT].toNumber(),
            [ItemType.ACTIVITY]: catSpend[ItemType.ACTIVITY].toNumber(),
            [ItemType.ESSENTIALS]: catSpend[ItemType.ESSENTIALS].toNumber(),
            [ItemType.SETTLEMENT]: catSpend[ItemType.SETTLEMENT].toNumber(),
        };

        const pDebtNumbers: Record<string, number> = {};
        Object.keys(pDebt).forEach(id => pDebtNumbers[id] = pDebt[id].toNumber());

        return {
            myTotalSpend: myTotal.toNumber(),
            myTotalPaid: myPaid.toNumber(),
            myTotalReceived: myReceived.toNumber(),
            groupTotalSpend: groupTotal.toNumber(),
            categorySpend: catSpendNumbers,
            pairwiseDebt: pDebtNumbers,
            smartTransfers: transfers,
            recentTransactions: transactions.slice(0, 3),
            daysUntilEnd: dRemaining
        };
    }, [trip.id, trip.updatedAt, trip.items.length]);

    const {
        myTotalSpend,
        myTotalPaid,
        myTotalReceived,
        groupTotalSpend,
        categorySpend,
        pairwiseDebt,
        smartTransfers,
        recentTransactions,
        daysUntilEnd
    } = calculationData || {
        myTotalSpend: 0,
        myTotalPaid: 0,
        myTotalReceived: 0,
        groupTotalSpend: 0,
        categorySpend: {
            [ItemType.FOOD]: 0,
            [ItemType.STAY]: 0,
            [ItemType.TRANSPORT]: 0,
            [ItemType.ACTIVITY]: 0,
            [ItemType.ESSENTIALS]: 0,
            [ItemType.SETTLEMENT]: 0
        },
        pairwiseDebt: {},
        smartTransfers: [],
        recentTransactions: [],
        daysUntilEnd: 0
    };

    // Derived UI Stats
    const burnRate = userBudget > 0 ? Math.min((myTotalSpend / userBudget) * 100, 100) : 0;
    const remaining = userBudget - myTotalSpend;
    const daysRemaining = daysUntilEnd;


    // Helper: Get Display Balance for Main List AND Detail View
    const getDisplayBalance = (memberId: string) => {
        if (useSmartSplit) {
            // In Smart Mode, check if there is a simplified transfer instruction involving me and them
            const iOweThem = smartTransfers.find(t => t.from === currentUserId && t.to === memberId);
            if (iOweThem) return -iOweThem.amount;

            const theyOweMe = smartTransfers.find(t => t.from === memberId && t.to === currentUserId);
            if (theyOweMe) return theyOweMe.amount;

            return 0; // Settled in the shuffle
        } else {
            // In Simple Mode, use the direct pairwise debt
            return pairwiseDebt[memberId] || 0;
        }
    };

    // Selected Member Data
    const selectedMember = selectedMemberId ? trip.members.find(m => m.id === selectedMemberId) : null;
    // Dynamic Balance based on Toggle
    const selectedMemberBalance = selectedMemberId ? getDisplayBalance(selectedMemberId) : 0;

    // History Logic (Direct interactions proof, includes Settlements)
    const sharedHistory = useMemo(() => {
        if (!selectedMemberId) return [];
        return trip.items.filter(item => {
            if (item.isPrivate) return false;
            const iPaid = item.paidBy === currentUserId;
            const theyPaid = item.paidBy === selectedMemberId;
            const iAmInvolved = item.splitWith?.includes(currentUserId) || item.splitDetails?.[currentUserId];
            const theyAreInvolved = item.splitWith?.includes(selectedMemberId) || item.splitDetails?.[selectedMemberId];
            return (iPaid && theyAreInvolved) || (theyPaid && iAmInvolved);
        }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [trip.items, currentUserId, selectedMemberId]);


    // ---------------------------------------------------------
    // RENDER HELPERS
    // ---------------------------------------------------------

    const getCategoryIcon = (type: ItemType) => {
        switch (type) {
            case ItemType.FOOD: return <UtensilsIcon className="w-5 h-5 text-tactical-accent" />;
            case ItemType.STAY: return <BedIcon className="w-5 h-5 text-tactical-accent" />;
            case ItemType.TRANSPORT: return <TrainIcon className="w-5 h-5 text-tactical-accent" />;
            default: return <CameraIcon className="w-5 h-5 text-tactical-accent" />;
        }
    };

    const getLedgerIcon = (type: ItemType) => {
        switch (type) {
            case ItemType.FOOD: return <UtensilsIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.STAY: return <BedIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.TRANSPORT: return <FuelIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.ESSENTIALS: return <ShoppingBagIcon className="w-4 h-4 text-yellow-500" />;
            case ItemType.SETTLEMENT: return <BanknoteIcon className="w-4 h-4 text-green-500" />;
            default: return <WrenchIcon className="w-4 h-4 text-yellow-500" />;
        }
    }

    const getCategoryName = (type: ItemType) => {
        switch (type) {
            case ItemType.FOOD: return 'FOOD';
            case ItemType.STAY: return 'STAYS';
            case ItemType.TRANSPORT: return 'MOVER';
            case ItemType.ESSENTIALS: return 'SUPPLIES';
            default: return 'RECON';
        }
    };

    const handleConfirmSettlement = () => {
        if (selectedMemberId) {
            // We settle the amount shown in the display (either Direct or Smart)
            // Usually we settle the amount I owe them.
            const amountToSettle = Math.abs(selectedMemberBalance);
            onSettleDebt(currentUserId, selectedMemberId, amountToSettle);
            setSettleModalOpen(false);
        }
    };

    // ---------------------------------------------------------
    // JSX
    // ---------------------------------------------------------
    return (
        <div className="flex flex-col h-full bg-tactical-bg animate-fade-in relative">
            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-tactical-bg z-20 border-b border-tactical-muted/10">
                <button onClick={onBack} className="text-white hover:text-tactical-accent transition-colors">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div className="font-display font-bold text-lg text-white uppercase tracking-wider">
                    Budget Engine
                </div>
                <button className="text-white hover:text-tactical-accent transition-colors">
                    <GearIcon className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide pb-24">

                {/* 1. Personal Budget Card */}
                <div className="bg-tactical-card rounded-2xl p-6 border border-tactical-muted/30 shadow-lg relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 p-6 opacity-20">
                        <div className="w-16 h-16 bg-tactical-accent rounded-xl flex items-center justify-center text-black">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                    </div>

                    <div className="text-[10px] font-bold text-tactical-accent uppercase tracking-widest mb-1">My Personal Budget</div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="font-display text-5xl font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalSpend.toFixed(0)}</span>
                        <span className="font-mono text-gray-500 font-bold">/ {getCurrencySymbol(trip.baseCurrency || 'USD')}{userBudget}</span>
                    </div>

                    <div className="flex justify-between items-end mb-2">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Spending Progress</div>
                        <div className={`text-xs font-bold ${burnRate > 90 ? 'text-red-500' : 'text-tactical-accent'}`}>{burnRate.toFixed(0)}%</div>
                    </div>
                    <div className="h-3 bg-black rounded-full overflow-hidden border border-white/5 mb-4">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${burnRate > 90 ? 'bg-red-600' : 'bg-tactical-accent'}`}
                            style={{ width: `${burnRate}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                        <span className="text-gray-500 uppercase">Trip ends in {daysRemaining} days</span>
                        <span className="text-white font-bold">Remaining: {getCurrencySymbol(trip.baseCurrency || 'USD')}{remaining.toFixed(0)}</span>
                    </div>
                </div>

                {/* 2. Category Breakdown - Responsive Grid */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-display font-bold text-gray-500 uppercase tracking-widest text-sm">Category Breakdown</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[ItemType.FOOD, ItemType.STAY, ItemType.TRANSPORT, ItemType.ACTIVITY, ItemType.ESSENTIALS].map((type) => {
                            const spent = categorySpend[type];
                            const percent = userBudget > 0 ? Math.min((spent / userBudget) * 100, 100) : 0;

                            if (type === ItemType.ESSENTIALS && spent === 0) return null;

                            return (
                                <div key={type} className="bg-tactical-card border border-tactical-muted/20 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-4">
                                        {getCategoryIcon(type)}
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{getCategoryName(type)}</span>
                                    </div>
                                    <div className="flex items-baseline gap-1 mb-2">
                                        <span className="font-display text-xl font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{spent.toFixed(0)}</span>
                                    </div>
                                    <div className="h-1.5 bg-black rounded-full overflow-hidden">
                                        <div className="h-full bg-tactical-accent" style={{ width: `${percent}%` }}></div>
                                    </div>
                                    <div className="text-[9px] font-bold text-tactical-accent mt-1">{percent.toFixed(0)}% OF TOTAL BUDGET</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Group Total */}
                {(() => {
                    const groupTotalBudget = trip.members.reduce((sum, m) => sum + (m.budget || 0), 0);
                    const groupBurnRate = groupTotalBudget > 0 ? (groupTotalSpend / groupTotalBudget) * 100 : 0;
                    const isOverGroupBudget = groupTotalSpend > groupTotalBudget;

                    return (
                        <div className="bg-black/40 border border-tactical-muted/20 rounded-xl p-5 mb-8 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Group Spending Progress</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="font-display text-2xl font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{groupTotalSpend.toFixed(0)}</span>
                                    <span className="text-xs text-gray-600 font-bold">/ {getCurrencySymbol(trip.baseCurrency || 'USD')}{groupTotalBudget.toLocaleString()}</span>
                                </div>
                                <div className="h-1 w-24 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-700 ${isOverGroupBudget ? 'bg-red-600' : 'bg-white/30'}`}
                                        style={{ width: `${Math.min(groupBurnRate, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Group Status</div>
                                <div className={`font-bold text-sm ${isOverGroupBudget ? 'text-red-500' : 'text-green-500'}`}>
                                    {isOverGroupBudget ? 'Over Budget' : 'On Track'}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 4. Ledger / Recent Transactions */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-display font-bold text-gray-500 uppercase tracking-widest text-sm">Recent Activity</h3>
                        <button
                            onClick={onViewLedger}
                            className="flex items-center gap-1 text-[10px] font-bold text-tactical-accent uppercase hover:underline"
                        >
                            View Ledger <ArrowRightIcon className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {recentTransactions.map(item => {
                            const payer = trip.members.find(m => m.id === item.paidBy);
                            const isSettlement = item.type === ItemType.SETTLEMENT;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onItemClick(item)}
                                    className="bg-tactical-card border border-tactical-muted/20 hover:border-tactical-accent/50 transition-colors rounded-lg p-3 flex items-center gap-3 cursor-pointer active:scale-[0.98]"
                                >
                                    <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center shrink-0">
                                        {getLedgerIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-white text-xs truncate uppercase">{item.title}</h4>
                                            <span className={`font-mono text-xs font-bold ${isSettlement ? 'text-green-500' : 'text-tactical-accent'}`}>
                                                {isSettlement ? '' : '-'}{getCurrencySymbol(trip.baseCurrency || 'USD')}{item.cost?.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                                {isSettlement ? `${payer?.name.split(' ')[0]} settled debt` : `Paid by ${payer?.name.split(' ')[0]}`}
                                            </div>
                                            <div className="text-[9px] text-gray-600">
                                                {new Date(item.startDate).getDate()} {new Date(item.startDate).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {recentTransactions.length === 0 && (
                            <div className="text-center text-gray-500 text-xs py-4 border border-dashed border-gray-700 rounded-lg">
                                No activities logged yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Blood Debts (Dual Mode) */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-gray-500 uppercase tracking-widest text-sm">Balances</h3>
                        {/* Mode Toggle with Role Check */}
                        <div className="relative">
                            {!isPathfinder && (
                                <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center rounded-lg border border-gray-700 backdrop-blur-[1px]">
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                        <LockIcon className="w-3 h-3" /> Locked
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => isPathfinder && onToggleBudgetMode(useSmartSplit ? 'DIRECT' : 'SMART')}
                                disabled={!isPathfinder}
                                className={`flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-tactical-muted/30 ${!isPathfinder ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${!useSmartSplit ? 'bg-tactical-accent text-black' : 'text-gray-500'}`}>
                                    Direct View
                                </div>
                                <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${useSmartSplit ? 'bg-tactical-accent text-black' : 'text-gray-500'}`}>
                                    Smart Route
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="bg-tactical-card border border-tactical-muted/20 rounded-2xl overflow-hidden divide-y divide-white/5">
                        {trip.members
                            .filter(m => m.id !== currentUserId && m.status !== 'BLOCKED')
                            .map(member => {
                                const balance = getDisplayBalance(member.id);
                                const isOwed = balance > 0.01;
                                const doesOwe = balance < -0.01;
                                const isSettled = !isOwed && !doesOwe;

                                return (
                                    <div
                                        key={member.id}
                                        onClick={() => setSelectedMemberId(member.id)}
                                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <AtmosphericAvatar
                                                userId={member.id}
                                                avatarUrl={member.avatarUrl}
                                                name={member.name}
                                                size="md"
                                            />
                                            <div>
                                                <div className="font-bold text-white text-sm">{member.name}</div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                    {isOwed && <span className="text-tactical-accent">OWES YOU {getCurrencySymbol(trip.baseCurrency || 'USD')}{balance.toFixed(0)}</span>}
                                                    {doesOwe && <span className="text-red-500">PAY THEM {getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(balance).toFixed(0)}</span>}
                                                    {isSettled && <span className="text-gray-600">ALL SETTLED</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {isOwed && (
                                                <span className="text-white text-sm font-bold font-mono">+{getCurrencySymbol(trip.baseCurrency || 'USD')}{balance.toFixed(0)}</span>
                                            )}
                                            {doesOwe && (
                                                <span className="text-red-500 text-sm font-bold font-mono">-{getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(balance).toFixed(0)}</span>
                                            )}
                                            <ChevronLeftIcon className="w-4 h-4 text-gray-600 rotate-180" />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* GLOBAL SETTLEMENTS VIEW (Visible only in Smart Mode) */}
                    {useSmartSplit && smartTransfers.length > 0 && (
                        <div className="mt-6 border border-tactical-muted/20 rounded-xl bg-black/20 p-4">
                            <div className="flex items-center gap-2 mb-3 text-tactical-accent/80">
                                <NetworkIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Group Settlements</span>
                            </div>
                            <div className="space-y-2">
                                {smartTransfers.map((tx, idx) => {
                                    const fromUser = trip.members.find(m => m.id === tx.from);
                                    const toUser = trip.members.find(m => m.id === tx.to);
                                    const isMeInvolved = tx.from === currentUserId || tx.to === currentUserId;

                                    return (
                                        <div key={idx} className={`flex items-center justify-between p-2 rounded ${isMeInvolved ? 'bg-tactical-accent/10 border border-tactical-accent/20' : 'bg-transparent'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold uppercase ${tx.from === currentUserId ? 'text-white' : 'text-gray-400'}`}>
                                                    {fromUser?.name.split(' ')[0]}
                                                </span>
                                                <ArrowRightIcon className="w-3 h-3 text-gray-600" />
                                                <span className={`text-xs font-bold uppercase ${tx.to === currentUserId ? 'text-white' : 'text-gray-400'}`}>
                                                    {toUser?.name.split(' ')[0]}
                                                </span>
                                            </div>
                                            <div className="font-mono text-xs font-bold text-tactical-muted">
                                                {getCurrencySymbol(trip.baseCurrency || 'USD')}{tx.amount.toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Add Floating Button */}
            <div className="absolute bottom-[2rem] right-6 z-30">
                <button
                    onClick={onLogExpense}
                    className="w-14 h-14 rounded-full bg-tactical-accent text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)] border-2 border-black/10 transition-transform active:scale-95 hover:scale-105"
                >
                    <PlusIcon className="w-8 h-8" />
                </button>
            </div>

            {/* MEMBER DEBT HISTORY OVERLAY */}
            {selectedMember && (
                <div className="absolute inset-0 z-40 bg-tactical-bg animate-fade-in flex flex-col">
                    <header className="px-6 py-4 flex items-center justify-between bg-tactical-card border-b border-tactical-muted/20">
                        <button onClick={() => setSelectedMemberId(null)} className="text-white hover:text-tactical-accent">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <div className="font-display font-bold text-lg text-white uppercase tracking-wider">
                            Activity History
                        </div>
                        <div className="w-6"></div>
                    </header>

                    <div className="p-6 bg-tactical-card/50 border-b border-tactical-muted/10 text-center relative">
                        <AtmosphericAvatar
                            userId={selectedMember.id}
                            avatarUrl={selectedMember.avatarUrl}
                            name={selectedMember.name}
                            size="xl"
                            className="mb-4"
                        />
                        <h2 className="font-bold text-xl text-white uppercase mb-1">{selectedMember.name}</h2>

                        {/* Active Balance based on Toggle */}
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                            {useSmartSplit ? 'OPTIMIZED VIEW' : 'DIRECT VIEW'}
                        </div>

                        <div className="text-sm font-bold tracking-wider mb-6">
                            {selectedMemberBalance > 0.01 && <span className="text-tactical-accent">THEY OWE YOU {getCurrencySymbol(trip.baseCurrency || 'USD')}{selectedMemberBalance.toFixed(2)}</span>}
                            {selectedMemberBalance < -0.01 && <span className="text-red-500">YOU OWE {getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(selectedMemberBalance).toFixed(2)}</span>}
                            {Math.abs(selectedMemberBalance) <= 0.01 && <span className="text-gray-500">ALL SETTLED</span>}
                        </div>

                        {/* Net Intel Card - The "Why" */}
                        <div className="mx-6 mb-8 bg-black/40 border border-tactical-muted/20 rounded-xl p-4 text-left">
                            <div className="flex items-center gap-2 mb-3">
                                <SearchIcon className="w-3 h-3 text-tactical-accent" />
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Trip Summary</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <div className="text-[7px] font-bold text-gray-600 uppercase mb-1">Consumed</div>
                                    <div className="font-mono text-[11px] font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalSpend.toFixed(0)}</div>
                                </div>
                                <div>
                                    <div className="text-[7px] font-bold text-gray-600 uppercase mb-1">Paid Out</div>
                                    <div className="font-mono text-[11px] font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalPaid.toFixed(0)}</div>
                                </div>
                                <div>
                                    <div className="text-[7px] font-bold text-gray-600 uppercase mb-1">Received In</div>
                                    <div className="font-mono text-[11px] font-bold text-white">{getCurrencySymbol(trip.baseCurrency || 'USD')}{myTotalReceived.toFixed(0)}</div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                                <div className="text-[8px] font-bold text-gray-500 uppercase">My Balance</div>
                                <div className={`font-mono text-sm font-bold ${(myTotalPaid - myTotalReceived - myTotalSpend) >= -0.01 ? 'text-tactical-accent' : 'text-red-500'}`}>
                                    {getCurrencySymbol(trip.baseCurrency || 'USD')}{(myTotalPaid - myTotalReceived - myTotalSpend).toFixed(2)}
                                </div>
                            </div>

                            {useSmartSplit && Math.abs(selectedMemberBalance - (pairwiseDebt[selectedMemberId!] || 0)) > 0.01 && (
                                <div className="mt-3 bg-tactical-accent/10 p-2 rounded border border-tactical-accent/20">
                                    <p className="text-[8px] font-mono text-tactical-accent uppercase leading-tight">
                                        Note: Optimized view has simplified your transfers. Direct debt to this member: {getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(pairwiseDebt[selectedMemberId!] || 0).toFixed(0)}.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Settle Up Action */}
                        {selectedMemberBalance < -0.01 && (
                            <button
                                onClick={() => setSettleModalOpen(true)}
                                className="px-6 py-2 bg-green-700/80 hover:bg-green-600 text-white text-xs font-bold uppercase rounded-lg border border-green-500/50 shadow-lg"
                            >
                                SETTLE {getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(selectedMemberBalance).toFixed(2)}
                            </button>
                        )}

                        {/* Settle Modal Overlay */}
                        {settleModalOpen && (
                            <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
                                <div className="w-full max-w-sm bg-tactical-card border border-tactical-muted/40 rounded-xl p-6 shadow-2xl mx-auto">
                                    <div className="text-center mb-4">
                                        <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-700/50 text-green-500">
                                            <BanknoteIcon className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-display font-bold text-white uppercase text-lg">Confirm Transfer</h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Record a payment to {selectedMember.name}
                                        </p>
                                    </div>

                                    <div className="bg-black/40 rounded-lg p-4 mb-6 text-center border border-white/5">
                                        <span className="text-3xl font-display font-bold text-green-500">{getCurrencySymbol(trip.baseCurrency || 'USD')}{Math.abs(selectedMemberBalance).toFixed(2)}</span>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSettleModalOpen(false)}
                                            className="flex-1 py-3 border border-gray-600 text-gray-400 font-bold text-xs uppercase rounded-lg hover:text-white hover:border-white/30"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSettlement}
                                            className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase rounded-lg shadow-lg"
                                        >
                                            Confirm Paid
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">
                            Transaction Evidence
                        </div>
                        {sharedHistory.length === 0 && (
                            <div className="text-center text-gray-500 mt-8 text-xs font-bold uppercase tracking-widest">
                                No shared history found.
                            </div>
                        )}
                        {sharedHistory.map(item => {
                            const iPaid = item.paidBy === currentUserId;
                            const isSettlement = item.type === ItemType.SETTLEMENT;
                            const cost = item.cost || 0;

                            let transactionAmount = 0;
                            let label = '';
                            let labelColor = '';

                            if (isSettlement) {
                                transactionAmount = cost;
                                label = iPaid ? 'YOU SETTLED' : 'THEY SETTLED';
                                labelColor = 'bg-green-900/30 text-green-500';
                            } else {
                                const splitCount = (item.splitWith?.length || 1);
                                const myShare = item.splitDetails?.[currentUserId] ?? (cost / splitCount);
                                const theirShare = item.splitDetails?.[selectedMember.id] ?? (cost / splitCount);
                                transactionAmount = iPaid ? theirShare : myShare;
                                label = iPaid ? 'YOU PAID' : `${selectedMember.name.split(' ')[0].toUpperCase()} PAID`;
                                labelColor = iPaid ? 'bg-tactical-accent/20 text-tactical-accent' : 'bg-red-900/30 text-red-500';
                            }

                            return (
                                <div key={item.id} className="bg-tactical-card border border-tactical-muted/10 rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`text-xs font-bold uppercase px-2 py-1 rounded ${labelColor}`}>
                                            {label}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm">{item.title}</div>
                                            <div className="text-[10px] text-gray-500">{new Date(item.startDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold font-mono text-sm ${isSettlement ? 'text-green-500' : (iPaid ? 'text-tactical-accent' : 'text-red-500')}`}>
                                            {isSettlement ? 'PAID' : (iPaid ? 'lent' : 'borrowed')} {getCurrencySymbol(trip.baseCurrency || 'USD')}{transactionAmount.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
};

export default BudgetEngine;
