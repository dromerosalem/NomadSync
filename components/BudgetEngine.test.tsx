import { describe, it, expect, vi } from 'vitest';
import { Money } from '../utils/money';

// Extended Mock for ItineraryItem to include dates
interface MockItineraryItem {
    id: string;
    cost: number;
    splitWith: string[];
    splitDetails?: Record<string, number>;
    startDate: string; // ISO string
    isPrivate?: boolean;
    paidBy?: string;
}

// Mock calculation logic from BudgetEngine (updated to match PIGGY BANK logic)
// We need to simulate "Today" vs "Previous Days"
const calculateDailyAndPiggyBank = (
    currentUserId: string,
    items: MockItineraryItem[],
    dailyBudgetAmount: number,
    tripStartDateStr: string,
    mockTodayDateStr: string // To simulate "Today" for testing
) => {
    const startOfToday = new Date(mockTodayDateStr);
    startOfToday.setHours(0, 0, 0, 0);

    const tripStartDate = new Date(tripStartDateStr);
    tripStartDate.setHours(0, 0, 0, 0);

    let todaySpend = new Money(0);
    let previousDaysSpend = new Money(0);

    items.forEach(item => {
        const itemDate = new Date(item.startDate);
        if (item.isPrivate) return;

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
            // Check if item is today vs previous days relative to our mock "Today"
            // Note: In real app, we check >= startOfToday. 
            // For previous, we check >= tripStartDate AND < startOfToday

            // Normalize item date to midnight for comparison
            const itemDateMidnight = new Date(itemDate);
            itemDateMidnight.setHours(0, 0, 0, 0);

            if (itemDateMidnight.getTime() === startOfToday.getTime()) {
                todaySpend = todaySpend.add(myShare);
            } else if (itemDateMidnight.getTime() >= tripStartDate.getTime() && itemDateMidnight.getTime() < startOfToday.getTime()) {
                previousDaysSpend = previousDaysSpend.add(myShare);
            }
        }
    });

    // --- PIGGY BANK CALCULATION ---
    const timeDiff = startOfToday.getTime() - tripStartDate.getTime();
    const daysElapsedPrevious = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

    const dailyBudgetMoney = new Money(dailyBudgetAmount);
    const totalBudgetEarnedPrevious = dailyBudgetMoney.multiply(daysElapsedPrevious);
    const previousBalance = totalBudgetEarnedPrevious.subtract(previousDaysSpend);

    let todayOverdraft = new Money(0);
    if (todaySpend.greaterThan(dailyBudgetMoney)) {
        todayOverdraft = todaySpend.subtract(dailyBudgetMoney);
    }

    const piggyBankBalance = previousBalance.subtract(todayOverdraft);

    return {
        dailySpent: todaySpend.toNumber(),
        piggyBankBalance: piggyBankBalance.toNumber()
    };
};

describe('BudgetEngine Logic - Daily & Piggy Bank', () => {
    const myId = 'user_1';
    const partnerId = 'user_2';
    // Test Setup:
    // Trip Started: 2024-01-01
    // "Today": 2024-01-05 (Day 5)
    // Previous Days: Jan 1, 2, 3, 4 (4 days elapsed)
    const tripStartDate = '2024-01-01T10:00:00Z';
    const mockToday = '2024-01-05T12:00:00Z';
    const dailyBudget = 100;

    it('Scenario 1: Healthy Piggy Bank (Underspent Previous, Underspent Today)', () => {
        // Previous Days (4 days * 100 = 400 Budget)
        // Spent: 50/day * 4 = 200
        // Expected Previous Balance: +200

        // Today: Spend 20 (Budget 100) -> Underspent 80
        // Expected Piggy Bank: 200 (Today's savings don't count yet) - 0 (Overdraft) = 200

        const items: MockItineraryItem[] = [
            { id: '1', cost: 50, splitWith: [myId], startDate: '2024-01-01T10:00:00Z' },
            { id: '2', cost: 50, splitWith: [myId], startDate: '2024-01-02T10:00:00Z' },
            { id: '3', cost: 50, splitWith: [myId], startDate: '2024-01-03T10:00:00Z' },
            { id: '4', cost: 50, splitWith: [myId], startDate: '2024-01-04T10:00:00Z' },
            { id: 'today', cost: 20, splitWith: [myId], startDate: '2024-01-05T15:00:00Z' }, // Today
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStartDate, mockToday);

        expect(result.dailySpent).toBe(20);
        expect(result.piggyBankBalance).toBe(200);
    });

    it('Scenario 2: Live Overdraft (Underspent Previous, Overspent Today)', () => {
        // Previous Balance: +200 (Same as above)
        // Today: Spend 150 (Budget 100) -> Overdraft 50
        // Expected Piggy Bank: 200 - 50 = 150 (Immediate Penalty)

        const items: MockItineraryItem[] = [
            { id: '1', cost: 50, splitWith: [myId], startDate: '2024-01-01T10:00:00Z' },
            { id: '2', cost: 50, splitWith: [myId], startDate: '2024-01-02T10:00:00Z' },
            { id: '3', cost: 50, splitWith: [myId], startDate: '2024-01-03T10:00:00Z' },
            { id: '4', cost: 50, splitWith: [myId], startDate: '2024-01-04T10:00:00Z' },
            { id: 'today', cost: 150, splitWith: [myId], startDate: '2024-01-05T15:00:00Z' }, // Today Overdraft
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStartDate, mockToday);

        expect(result.dailySpent).toBe(150);
        expect(result.piggyBankBalance).toBe(150);
    });

    it('Scenario 3: Broken Piggy Bank (Cumulative Debt)', () => {
        // Previous Days (400 Budget)
        // Spent: 150/day * 4 = 600
        // Expected Previous Balance: 400 - 600 = -200 (Already Broken)

        // Today: Spend 10 (Budget 100) -> Underspent 90
        // Expected Piggy Bank: -200 - 0 = -200 (Today's savings don't fix past debt yet)

        const items: MockItineraryItem[] = [
            { id: '1', cost: 150, splitWith: [myId], startDate: '2024-01-01T10:00:00Z' },
            { id: '2', cost: 150, splitWith: [myId], startDate: '2024-01-02T10:00:00Z' },
            { id: '3', cost: 150, splitWith: [myId], startDate: '2024-01-03T10:00:00Z' },
            { id: '4', cost: 150, splitWith: [myId], startDate: '2024-01-04T10:00:00Z' },
            { id: 'today', cost: 10, splitWith: [myId], startDate: '2024-01-05T15:00:00Z' },
        ];

        const result = calculateDailyAndPiggyBank(myId, items, dailyBudget, tripStartDate, mockToday);

        expect(result.dailySpent).toBe(10);
        expect(result.piggyBankBalance).toBe(-200);
    });

    it('Scenario 4: Start of Day 1 (No Previous History)', () => {
        // Trip Start: Today
        // Previous Days: 0
        // Previous Spend: 0
        // Previous Balance: 0

        // Spend Today: 0
        // Piggy Bank: 0

        const todayStart = '2024-01-01T08:00:00Z'; // Same as trip start day
        const result = calculateDailyAndPiggyBank(myId, [], dailyBudget, '2024-01-01T00:00:00Z', todayStart);

        expect(result.piggyBankBalance).toBe(0);
    });
});
