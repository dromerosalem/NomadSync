import { Money } from './money';
import { ItemType, ItineraryItem, Member } from '../types';

/**
 * Balance Calculator Utility
 * 
 * Extracts the core balance calculation logic from BudgetEngine for testability.
 * Handles equal splits, custom splits, settlements, and Smart Route optimization.
 */

export interface BalanceResult {
    pairwiseDebt: Record<string, number>;  // Positive = they owe me, Negative = I owe them
    netBalances: Record<string, number>;   // Net position for each member
    smartTransfers: Transfer[];            // Optimized transfer list
    myTotalSpend: number;
    myTotalPaid: number;
    myTotalReceived: number;
}

export interface Transfer {
    from: string;
    to: string;
    amount: number;
}

/**
 * Calculate all balances for a given user based on trip items
 */
export function calculateBalances(
    items: ItineraryItem[],
    members: Member[],
    currentUserId: string
): BalanceResult {
    let myTotal = new Money(0);
    let myPaid = new Money(0);
    let myReceived = new Money(0);

    // Pairwise: From current user's perspective
    const pDebt: Record<string, Money> = {};
    // Net: Overall balance for each member
    const netBalances: Record<string, Money> = {};

    // Initialize
    members.forEach(m => {
        pDebt[m.id] = new Money(0);
        netBalances[m.id] = new Money(0);
    });

    items.forEach(item => {
        if (item.isPrivate) return;

        const cost = new Money(item.cost || 0);
        const isSettlement = item.type === ItemType.SETTLEMENT;

        const splitWith = item.splitWith || [];
        const splitDetails = item.splitDetails || {};
        const hasCustomSplit = Object.keys(splitDetails).length > 0;
        const payerId = item.paidBy;
        const involvedIds = hasCustomSplit ? Object.keys(splitDetails) : splitWith;

        if (!isSettlement) {
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
            }
        } else {
            // Settlement tracking
            if (payerId === currentUserId) myPaid = myPaid.add(cost);
            if (involvedIds.includes(currentUserId)) myReceived = myReceived.add(cost);
        }

        // --- CALCULATE DEBTS & BALANCES ---
        if (payerId && netBalances[payerId] !== undefined) {
            netBalances[payerId] = netBalances[payerId].add(cost);
        }

        involvedIds.forEach(consumerId => {
            let share = new Money(0);
            if (hasCustomSplit) {
                share = new Money(splitDetails[consumerId] || 0);
            } else {
                share = cost.divide(involvedIds.length || 1);
            }

            if (netBalances[consumerId] !== undefined) {
                netBalances[consumerId] = netBalances[consumerId].subtract(share);
            }

            if (consumerId !== payerId) {
                if (payerId === currentUserId) {
                    if (pDebt[consumerId] !== undefined) {
                        pDebt[consumerId] = pDebt[consumerId].add(share);
                    }
                } else if (consumerId === currentUserId && pDebt[payerId] !== undefined) {
                    pDebt[payerId] = pDebt[payerId].subtract(share);
                }
            }
        });
    });

    // Convert to numbers for output
    const pDebtNumbers: Record<string, number> = {};
    Object.keys(pDebt).forEach(id => pDebtNumbers[id] = pDebt[id].toNumber());

    const netBalanceNumbers: Record<string, number> = {};
    Object.keys(netBalances).forEach(id => netBalanceNumbers[id] = netBalances[id].toNumber());

    // Calculate smart transfers
    const smartTransfers = calculateSmartTransfers(netBalances);

    return {
        pairwiseDebt: pDebtNumbers,
        netBalances: netBalanceNumbers,
        smartTransfers,
        myTotalSpend: myTotal.toNumber(),
        myTotalPaid: myPaid.toNumber(),
        myTotalReceived: myReceived.toNumber()
    };
}

/**
 * Smart Split Algorithm - Minimize number of transfers
 * Uses a greedy approach to settle debts with minimal transactions
 */
export function calculateSmartTransfers(netBalances: Record<string, Money>): Transfer[] {
    let debtors = Object.keys(netBalances)
        .filter(id => netBalances[id].lessThan(-0.01))
        .map(id => ({ id, amount: netBalances[id].toNumber() }))
        .sort((a, b) => a.amount - b.amount);

    let creditors = Object.keys(netBalances)
        .filter(id => netBalances[id].greaterThan(0.01))
        .map(id => ({ id, amount: netBalances[id].toNumber() }))
        .sort((a, b) => b.amount - a.amount);

    const transfers: Transfer[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const debtAbs = Math.abs(debtor.amount);
        const creditAbs = Math.abs(creditor.amount);
        const settleAmount = Math.min(debtAbs, creditAbs);

        const roundedAmount = Math.round(settleAmount * 100) / 100;

        if (roundedAmount > 0) {
            transfers.push({ from: debtor.id, to: creditor.id, amount: roundedAmount });
        }

        debtor.amount += settleAmount;
        creditor.amount -= settleAmount;

        if (Math.abs(debtor.amount) < 0.01) i++;
        if (Math.abs(creditor.amount) < 0.01) j++;
    }

    return transfers;
}

/**
 * Calculate share for a member in an expense
 */
export function calculateMemberShare(
    item: ItineraryItem,
    memberId: string
): number {
    const cost = item.cost || 0;
    const splitWith = item.splitWith || [];
    const splitDetails = item.splitDetails || {};
    const hasCustomSplit = Object.keys(splitDetails).length > 0;

    if (hasCustomSplit && splitDetails[memberId] !== undefined) {
        return splitDetails[memberId];
    } else if (splitWith.includes(memberId)) {
        return cost / (splitWith.length || 1);
    }
    return 0;
}
