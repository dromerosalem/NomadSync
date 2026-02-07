import { describe, it, expect } from 'vitest';
import { 
    calculateBalances, 
    calculateSmartTransfers, 
    calculateMemberShare,
    Transfer 
} from '../balanceCalculator';
import { ItemType, ItineraryItem, Member } from '../../types';
import { Money } from '../money';

// Test data
const mockMembers: Member[] = [
    { id: 'user-1', name: 'David', email: 'david@test.com', role: 'PATHFINDER', status: 'ACTIVE' },
    { id: 'user-2', name: 'MR', email: 'mr@test.com', role: 'SCOUT', status: 'ACTIVE' },
    { id: 'user-3', name: 'Kolwalczyk', email: 'kol@test.com', role: 'PASSENGER', status: 'ACTIVE' }
];

const createItem = (overrides: Partial<ItineraryItem>): ItineraryItem => ({
    id: 'item-1',
    tripId: 'trip-1',
    type: ItemType.FOOD,
    title: 'Test Expense',
    location: 'Test Location',
    startDate: new Date(),
    createdBy: 'user-1',
    cost: 100,
    paidBy: 'user-1',
    splitWith: ['user-1', 'user-2', 'user-3'],
    ...overrides
});

describe('Balance Calculator', () => {
    describe('calculateMemberShare', () => {
        it('calculates equal share when no splitDetails', () => {
            const item = createItem({
                cost: 90,
                splitWith: ['user-1', 'user-2', 'user-3']
            });

            expect(calculateMemberShare(item, 'user-1')).toBe(30);
            expect(calculateMemberShare(item, 'user-2')).toBe(30);
            expect(calculateMemberShare(item, 'user-3')).toBe(30);
        });

        it('uses splitDetails when provided', () => {
            const item = createItem({
                cost: 100,
                splitWith: ['user-1', 'user-2', 'user-3'],
                splitDetails: { 'user-1': 50, 'user-2': 30, 'user-3': 20 }
            });

            expect(calculateMemberShare(item, 'user-1')).toBe(50);
            expect(calculateMemberShare(item, 'user-2')).toBe(30);
            expect(calculateMemberShare(item, 'user-3')).toBe(20);
        });

        it('returns 0 for members not in splitWith', () => {
            const item = createItem({
                cost: 100,
                splitWith: ['user-1', 'user-2']
            });

            expect(calculateMemberShare(item, 'user-3')).toBe(0);
        });
    });

    describe('calculateBalances - Equal Splits', () => {
        it('calculates pairwise debt for 3-way equal split', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 90,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // User-1 paid 90, split 3 ways (30 each)
            // User-2 owes user-1: 30
            // User-3 owes user-1: 30
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(30, 1);
            expect(result.pairwiseDebt['user-3']).toBeCloseTo(30, 1);
            expect(result.myTotalSpend).toBeCloseTo(30, 1); // User-1's share
            expect(result.myTotalPaid).toBeCloseTo(90, 1);
        });

        it('handles when someone else pays', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 60,
                    paidBy: 'user-2',
                    splitWith: ['user-1', 'user-2', 'user-3']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // User-2 paid 60, split 3 ways (20 each)
            // User-1 owes user-2: 20 (negative pairwiseDebt)
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(-20, 1);
            expect(result.myTotalSpend).toBeCloseTo(20, 1);
            expect(result.myTotalPaid).toBeCloseTo(0, 1);
        });

        it('handles multiple expenses from different payers', () => {
            const items: ItineraryItem[] = [
                createItem({
                    id: 'item-1',
                    cost: 90,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3']
                }),
                createItem({
                    id: 'item-2',
                    cost: 60,
                    paidBy: 'user-2',
                    splitWith: ['user-1', 'user-2', 'user-3']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // From item 1: user-2 owes user-1 = 30, user-3 owes user-1 = 30
            // From item 2: user-1 owes user-2 = 20
            // Net user-2 to user-1: 30 - 20 = 10
            // Net user-3 to user-1: 30 (no interaction with user-2)
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(10, 1);
            expect(result.pairwiseDebt['user-3']).toBeCloseTo(30, 1); // user-3 only in first expense
            expect(result.myTotalSpend).toBeCloseTo(50, 1); // 30 + 20
            expect(result.myTotalPaid).toBeCloseTo(90, 1);
        });

        it('handles uneven amounts with correct remainder distribution', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // 100 / 3 = 33.33... each
            // Sum of pairwise debt (user-2 + user-3) should be ~66.67
            const totalOwed = result.pairwiseDebt['user-2'] + result.pairwiseDebt['user-3'];
            expect(totalOwed).toBeCloseTo(66.67, 0);
            expect(result.myTotalSpend).toBeCloseTo(33.33, 0);
        });
    });

    describe('calculateBalances - Custom Splits', () => {
        it('uses splitDetails for custom amounts', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3'],
                    splitDetails: { 'user-1': 50, 'user-2': 30, 'user-3': 20 }
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // User-1 paid 100, consumed 50
            // User-2 owes 30
            // User-3 owes 20
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(30, 1);
            expect(result.pairwiseDebt['user-3']).toBeCloseTo(20, 1);
            expect(result.myTotalSpend).toBeCloseTo(50, 1);
        });

        it('handles itemized splits with zero shares', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2'],
                    splitDetails: { 'user-1': 0, 'user-2': 100 }
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // User-1 paid 100 but consumed 0
            // User-2 consumed all 100, owes user-1 everything
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(100, 1);
            expect(result.myTotalSpend).toBeCloseTo(0, 1);
        });
    });

    describe('calculateBalances - Settlements', () => {
        it('settlement reduces balance correctly', () => {
            const items: ItineraryItem[] = [
                // Original expense
                createItem({
                    id: 'expense-1',
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2']
                }),
                // Settlement: user-2 pays user-1 to settle
                createItem({
                    id: 'settlement-1',
                    type: ItemType.SETTLEMENT,
                    cost: 50,
                    paidBy: 'user-2',
                    splitWith: ['user-1']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // From expense: user-2 owes user-1 = 50
            // From settlement: user-2 paid user-1 = 50
            // Net: user-2 owes user-1 = 50 - 50 = 0
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(0, 1);
        });

        it('partial settlement reduces balance', () => {
            const items: ItineraryItem[] = [
                createItem({
                    id: 'expense-1',
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2']
                }),
                createItem({
                    id: 'settlement-1',
                    type: ItemType.SETTLEMENT,
                    cost: 25,
                    paidBy: 'user-2',
                    splitWith: ['user-1']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // From expense: user-2 owes user-1 = 50
            // From settlement: user-2 paid user-1 = 25
            // Net: user-2 owes user-1 = 50 - 25 = 25
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(25, 1);
        });

        it('tracks settlements received correctly', () => {
            const items: ItineraryItem[] = [
                createItem({
                    id: 'settlement-1',
                    type: ItemType.SETTLEMENT,
                    cost: 100,
                    paidBy: 'user-2',
                    splitWith: ['user-1']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            expect(result.myTotalReceived).toBeCloseTo(100, 1);
        });
    });

    describe('calculateBalances - Net Balances', () => {
        it('calculates net balance for each member', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 90,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // User-1: paid 90, consumed 30 → net +60
            // User-2: paid 0, consumed 30 → net -30
            // User-3: paid 0, consumed 30 → net -30
            expect(result.netBalances['user-1']).toBeCloseTo(60, 1);
            expect(result.netBalances['user-2']).toBeCloseTo(-30, 1);
            expect(result.netBalances['user-3']).toBeCloseTo(-30, 1);
        });

        it('net balances sum to zero', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2', 'user-3']
                }),
                createItem({
                    id: 'item-2',
                    cost: 60,
                    paidBy: 'user-2',
                    splitWith: ['user-1', 'user-2']
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            const sum = Object.values(result.netBalances).reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(0, 0);
        });
    });

    describe('calculateSmartTransfers', () => {
        it('generates minimal transfers for simple case', () => {
            const netBalances: Record<string, Money> = {
                'user-1': new Money(60),   // Creditor
                'user-2': new Money(-30),  // Debtor
                'user-3': new Money(-30)   // Debtor
            };

            const transfers = calculateSmartTransfers(netBalances);

            // Should generate 2 transfers: user-2 → user-1, user-3 → user-1
            expect(transfers.length).toBe(2);
            
            const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);
            expect(totalTransferred).toBeCloseTo(60, 1);
        });

        it('optimizes transfers for offsetting debts', () => {
            // Classic optimization case: A owes B 100, B owes C 100, C owes A 100
            // Naive: 3 transfers. Optimal: 0 (they cancel out)
            const netBalances: Record<string, Money> = {
                'user-1': new Money(0),
                'user-2': new Money(0),
                'user-3': new Money(0)
            };

            const transfers = calculateSmartTransfers(netBalances);

            expect(transfers.length).toBe(0);
        });

        it('handles complex multi-party debts', () => {
            const netBalances: Record<string, Money> = {
                'user-1': new Money(100),  // Owed 100
                'user-2': new Money(-40),  // Owes 40
                'user-3': new Money(-60)   // Owes 60
            };

            const transfers = calculateSmartTransfers(netBalances);

            // Transfers should settle all debts
            expect(transfers.length).toBe(2);
            
            // user-3 should pay user-1 first (largest debtor)
            expect(transfers[0].from).toBe('user-3');
            expect(transfers[0].to).toBe('user-1');
            expect(transfers[0].amount).toBeCloseTo(60, 1);
            
            // user-2 should pay user-1
            expect(transfers[1].from).toBe('user-2');
            expect(transfers[1].to).toBe('user-1');
            expect(transfers[1].amount).toBeCloseTo(40, 1);
        });

        it('ignores tiny balances (< 0.01)', () => {
            const netBalances: Record<string, Money> = {
                'user-1': new Money(0.005),
                'user-2': new Money(-0.005),
                'user-3': new Money(0)
            };

            const transfers = calculateSmartTransfers(netBalances);

            expect(transfers.length).toBe(0);
        });
    });

    describe('calculateBalances - Private Items', () => {
        it('ignores private items in calculations', () => {
            const items: ItineraryItem[] = [
                createItem({
                    cost: 100,
                    paidBy: 'user-1',
                    splitWith: ['user-1', 'user-2'],
                    isPrivate: true
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // Private items should not affect balances
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(0, 1);
            expect(result.myTotalSpend).toBeCloseTo(0, 1);
            expect(result.myTotalPaid).toBeCloseTo(0, 1);
        });
    });

    describe('Real-world Scenario: Screenshot Example', () => {
        it('calculates MR → David $230.94 correctly', () => {
            // Simulating the scenario from the screenshot
            // MR (user-2) owes David (user-1) $230.94
            const items: ItineraryItem[] = [
                // Example: David paid for several expenses
                createItem({
                    id: 'expense-1',
                    cost: 300,
                    paidBy: 'user-1', // David
                    splitWith: ['user-1', 'user-2'] // David and MR
                }),
                createItem({
                    id: 'expense-2',
                    cost: 161.88,
                    paidBy: 'user-1', // David
                    splitWith: ['user-1', 'user-2'] // David and MR
                })
            ];

            const result = calculateBalances(items, mockMembers, 'user-1');

            // David paid: 300 + 161.88 = 461.88
            // Each share: 461.88 / 2 = 230.94
            // MR owes David: 230.94
            expect(result.pairwiseDebt['user-2']).toBeCloseTo(230.94, 1);
        });
    });
});
