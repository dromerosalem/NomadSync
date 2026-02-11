import { describe, it, expect } from 'vitest';
import { Money } from '../utils/money';

interface MockItineraryItem {
    id: string;
    cost: number;
    splitWith: string[];
    splitDetails?: Record<string, number>;
    startDate: string;
    isPrivate?: boolean;
    isDailyExpense?: boolean;
}

/**
 * Simplified Piggy Bank logic (mirrors BudgetEngine):
 * - For each COMPLETED past day (tripStart → yesterday): leftover = dailyBudget - daySpend
 * - Piggy Bank = sum of all leftovers
 * - Today is NEVER included in the Piggy Bank
 */
const calculateDailyAndPiggyBank = (
    currentUserId: string,
    items: MockItineraryItem[],
    dailyBudgetAmount: number,
    tripStartDateStr: string,
    mockTodayDateStr: string,
    dailyBudgetStartedAt?: string
) => {
    const startOfToday = new Date(mockTodayDateStr);
    startOfToday.setHours(0, 0, 0, 0);

    const tripStartDate = new Date(tripStartDateStr);
    tripStartDate.setHours(0, 0, 0, 0);

    const dailyBudgetMoney = new Money(dailyBudgetAmount);
    let todaySpend = new Money(0);
    const daySpendMap: Record<string, Money> = {};

    items.forEach(item => {
        if (item.isPrivate) return;
        if (!item.isDailyExpense) return; // Only count Budget Engine expenses

        const itemDate = new Date(item.startDate);
        itemDate.setHours(0, 0, 0, 0);

        // Skip items from before daily budget was activated
        const activationMidnight = dailyBudgetStartedAt ? new Date(dailyBudgetStartedAt) : null;
        if (activationMidnight) activationMidnight.setHours(0, 0, 0, 0);
        if (activationMidnight && itemDate < activationMidnight) return;

        const cost = new Money(item.cost || 0);
        const splitWith = item.splitWith || [];
        const splitDetails = item.splitDetails || {};
        const hasCustomSplit = Object.keys(splitDetails).length > 0;

        let myShare = new Money(0);
        if (hasCustomSplit && splitDetails[currentUserId] !== undefined) {
            myShare = new Money(splitDetails[currentUserId]);
        } else if (splitWith.includes(currentUserId)) {
            myShare = cost.divide(splitWith.length || 1);
        }

        if (myShare.greaterThan(0)) {
            if (itemDate.getTime() === startOfToday.getTime()) {
                todaySpend = todaySpend.add(myShare);
            } else if (itemDate >= tripStartDate && itemDate < startOfToday) {
                const dateKey = itemDate.toDateString();
                daySpendMap[dateKey] = (daySpendMap[dateKey] || new Money(0)).add(myShare);
            }
        }
    });

    // Piggy Bank: iterate each completed day (start from activation date if set)
    let piggyBalance = new Money(0);
    const activationStart = dailyBudgetStartedAt ? new Date(dailyBudgetStartedAt) : null;
    if (activationStart) activationStart.setHours(0, 0, 0, 0);
    const piggyStart = activationStart
        ? (tripStartDate > activationStart ? tripStartDate : activationStart)
        : tripStartDate;
    const d = new Date(piggyStart);
    while (d < startOfToday) {
        const dateKey = d.toDateString();
        const daySpent = daySpendMap[dateKey] || new Money(0);
        piggyBalance = piggyBalance.add(dailyBudgetMoney.subtract(daySpent));
        d.setDate(d.getDate() + 1);
    }

    return {
        dailySpent: todaySpend.toNumber(),
        piggyBankBalance: piggyBalance.toNumber(),
        isBroken: piggyBalance.lessThan(0)
    };
};

describe('BudgetEngine Logic - Daily & Piggy Bank', () => {
    const myId = 'user_1';
    // Trip: Jan 1–10, Daily Budget: 100
    // "Today": Jan 5 (Day 5). Completed days: Jan 1, 2, 3, 4.
    const tripStart = '2024-01-01T10:00:00Z';
    const mockToday = '2024-01-05T12:00:00Z';
    const dailyBudget = 100;

    it('Scenario 1: Healthy Piggy Bank — underspent previous days', () => {
        // 4 completed days × 100 budget = 400 earned
        // Spent 50/day × 4 = 200
        // Piggy Bank = (100-50)*4 = +200
        const items: MockItineraryItem[] = [
            { id: '1', cost: 50, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true },
            { id: '2', cost: 50, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true },
            { id: '3', cost: 50, splitWith: [myId], startDate: '2024-01-03T10:00:00Z', isDailyExpense: true },
            { id: '4', cost: 50, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: true },
            { id: 'today', cost: 20, splitWith: [myId], startDate: '2024-01-05T15:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday);
        expect(result.dailySpent).toBe(20);
        expect(result.piggyBankBalance).toBe(200); // Today not included
        expect(result.isBroken).toBe(false);
    });

    it('Scenario 2: Today overdraft does NOT affect Piggy Bank', () => {
        // Same 4 past days: +200 saved
        // Today: spent 250 (massive overdraft) — irrelevant to Piggy Bank
        // Piggy Bank still = +200
        const items: MockItineraryItem[] = [
            { id: '1', cost: 50, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true },
            { id: '2', cost: 50, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true },
            { id: '3', cost: 50, splitWith: [myId], startDate: '2024-01-03T10:00:00Z', isDailyExpense: true },
            { id: '4', cost: 50, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: true },
            { id: 'today', cost: 250, splitWith: [myId], startDate: '2024-01-05T15:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday);
        expect(result.dailySpent).toBe(250);
        expect(result.piggyBankBalance).toBe(200); // Today excluded entirely
        expect(result.isBroken).toBe(false);
    });

    it('Scenario 3: Broken Piggy Bank — cumulative overspend on past days', () => {
        // 4 days × 150 spent = 600 total, budget was 400
        // Day-by-day: (100-150)*4 = -200
        const items: MockItineraryItem[] = [
            { id: '1', cost: 150, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true },
            { id: '2', cost: 150, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true },
            { id: '3', cost: 150, splitWith: [myId], startDate: '2024-01-03T10:00:00Z', isDailyExpense: true },
            { id: '4', cost: 150, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday);
        expect(result.piggyBankBalance).toBe(-200);
        expect(result.isBroken).toBe(true);
    });

    it('Scenario 4: Day 1 — no completed days, Piggy Bank is 0', () => {
        const result = calculateDailyAndPiggyBank(myId, [], dailyBudget, '2024-01-01T00:00:00Z', '2024-01-01T08:00:00Z');
        expect(result.piggyBankBalance).toBe(0);
        expect(result.isBroken).toBe(false);
    });

    it('Scenario 5: Mixed days — some over, some under', () => {
        // Day 1: spent 30 → leftover +70
        // Day 2: spent 180 → leftover -80
        // Day 3: spent 0 → leftover +100
        // Day 4: spent 100 → leftover 0
        // Piggy Bank = 70 + (-80) + 100 + 0 = +90
        const items: MockItineraryItem[] = [
            { id: '1', cost: 30, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true },
            { id: '2', cost: 180, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true },
            // Day 3: no items (leftover = full daily budget)
            { id: '4', cost: 100, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday);
        expect(result.piggyBankBalance).toBe(90);
        expect(result.isBroken).toBe(false);
    });

    it('Scenario 6: Items without isDailyExpense are excluded', () => {
        // Mix: 2 daily expenses (flagged) + 2 trip items (not flagged)
        // Only the flagged ones should count
        // Day 1: flagged 50 → leftover +50
        // Day 2: NOT flagged 200 → ignored → leftover +100
        // Day 3: flagged 80 → leftover +20
        // Day 4: NOT flagged 300 → ignored → leftover +100
        // Piggy Bank = 50 + 100 + 20 + 100 = +270
        const items: MockItineraryItem[] = [
            { id: '1', cost: 50, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true },
            { id: '2', cost: 200, splitWith: [myId], startDate: '2024-01-02T10:00:00Z' }, // NOT flagged — trip item
            { id: '3', cost: 80, splitWith: [myId], startDate: '2024-01-03T10:00:00Z', isDailyExpense: true },
            { id: '4', cost: 300, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: false }, // Explicitly false
            { id: 'today-trip', cost: 500, splitWith: [myId], startDate: '2024-01-05T15:00:00Z' }, // Today, NOT flagged
            { id: 'today-daily', cost: 25, splitWith: [myId], startDate: '2024-01-05T15:00:00Z', isDailyExpense: true }, // Today, flagged
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday);
        expect(result.dailySpent).toBe(25); // Only today's flagged item
        expect(result.piggyBankBalance).toBe(270); // Only past flagged items
        expect(result.isBroken).toBe(false);
    });
    it('Scenario 7: Mid-trip activation — expenses before activation are excluded', () => {
        // Trip starts Jan 1. Daily budget activated on Jan 3.
        // Expenses on Day 1, 2 (before activation) should be IGNORED.
        // Only Day 3, Day 4 count for Piggy Bank.
        // Day 3: spent 60 → leftover +40
        // Day 4: spent 0 → leftover +100
        // Piggy Bank = 40 + 100 = +140
        const activatedAt = '2024-01-03T14:00:00Z'; // Mid-day Jan 3
        const items: MockItineraryItem[] = [
            { id: '1', cost: 90, splitWith: [myId], startDate: '2024-01-01T10:00:00Z', isDailyExpense: true }, // BEFORE activation
            { id: '2', cost: 120, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true }, // BEFORE activation
            { id: '3', cost: 60, splitWith: [myId], startDate: '2024-01-03T16:00:00Z', isDailyExpense: true }, // AFTER activation (same day)
            // Day 4: no items → full leftover
            { id: 'today', cost: 30, splitWith: [myId], startDate: '2024-01-05T15:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, mockToday, activatedAt);
        expect(result.dailySpent).toBe(30); // Today's spend still counts
        expect(result.piggyBankBalance).toBe(140); // Only days 3-4 counted
        expect(result.isBroken).toBe(false);
    });

    it('Scenario 8: Deactivate then reactivate — full reset, old expenses ignored', () => {
        // Trip: Jan 1–10. User activated daily budget on Jan 2.
        // Logged expenses Jan 2–4 via Log Expense.
        // User REMOVED daily budget on Jan 5 (dailyBudgetStartedAt cleared).
        // User RE-ACTIVATED on Jan 7 → new dailyBudgetStartedAt = Jan 7.
        // All expenses from Jan 2–4 must be EXCLUDED (before new activation).
        // Only Jan 7 and Jan 8 count in Piggy Bank. Today is Jan 9.
        // Jan 7: spent 40 → leftover +60
        // Jan 8: spent 0 → leftover +100
        // Piggy Bank = 60 + 100 = +160
        const reactivatedAt = '2024-01-07T10:00:00Z';
        const laterToday = '2024-01-09T12:00:00Z';
        const items: MockItineraryItem[] = [
            { id: '1', cost: 80, splitWith: [myId], startDate: '2024-01-02T10:00:00Z', isDailyExpense: true },  // OLD cycle
            { id: '2', cost: 60, splitWith: [myId], startDate: '2024-01-03T10:00:00Z', isDailyExpense: true },  // OLD cycle
            { id: '3', cost: 90, splitWith: [myId], startDate: '2024-01-04T10:00:00Z', isDailyExpense: true },  // OLD cycle
            { id: '4', cost: 40, splitWith: [myId], startDate: '2024-01-07T14:00:00Z', isDailyExpense: true },  // NEW cycle
            // Jan 8: no items → full leftover
            { id: 'today', cost: 15, splitWith: [myId], startDate: '2024-01-09T15:00:00Z', isDailyExpense: true },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStart, laterToday, reactivatedAt);
        expect(result.dailySpent).toBe(15);          // Only today
        expect(result.piggyBankBalance).toBe(160);    // Only Jan 7-8 counted
        expect(result.isBroken).toBe(false);
    });
});
