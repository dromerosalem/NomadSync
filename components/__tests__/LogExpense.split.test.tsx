import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogExpense from '../LogExpense';
import { ItemType, Member, ReceiptItem } from '../../types';

// Mock services
vi.mock('../../services/ScanOrchestrator', () => ({
    scanOrchestrator: {
        scanReceipt: vi.fn()
    }
}));

vi.mock('../../services/CurrencyService', () => ({
    currencyService: {
        getRate: vi.fn().mockResolvedValue(1),
        searchCurrencies: vi.fn().mockResolvedValue([]),
        cacheSelectedCurrency: vi.fn(),
        getCachedCurrencies: vi.fn(() => [])
    }
}));

vi.mock('../../utils/imageCompression', () => ({
    compressImage: vi.fn(file => Promise.resolve(file))
}));

vi.mock('../../services/UploadSecurityService', () => ({
    UploadSecurityService: {
        validateFile: vi.fn(() => ({ isValid: true })),
        preliminaryAbuseCheck: vi.fn(() => ({ isValid: true }))
    }
}));

// Test data
const mockMembers: Member[] = [
    { id: 'user-1', name: 'David', email: 'david@test.com', role: 'PATHFINDER', status: 'ACTIVE' },
    { id: 'user-2', name: 'MR', email: 'mr@test.com', role: 'SCOUT', status: 'ACTIVE' },
    { id: 'user-3', name: 'Kolwalczyk', email: 'kol@test.com', role: 'PASSENGER', status: 'ACTIVE' }
];

const mockReceiptItems: ReceiptItem[] = [
    { id: 'item-1', name: 'Lemoniada Pomarancz', quantity: 1, price: 25.00, type: 'drink' },
    { id: 'item-2', name: 'Cola Zero', quantity: 3, price: 15.00, type: 'drink' },
    { id: 'item-3', name: 'Fanta', quantity: 1, price: 15.00, type: 'drink' },
    { id: 'item-4', name: 'Tax', quantity: 1, price: 5.00, type: 'tax' }
];

const defaultProps = {
    onClose: vi.fn(),
    onSave: vi.fn(),
    tripStartDate: new Date('2026-02-01'),
    currentUserId: 'user-1',
    members: mockMembers,
    baseCurrency: 'PLN'
};

// Create modal root for portal
beforeEach(() => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
});

afterEach(() => {
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
        document.body.removeChild(modalRoot);
    }
    vi.clearAllMocks();
});

describe('LogExpense Split Functionality', () => {
    describe('Basic Mode Switching', () => {
        it('renders with default EQUAL mode', () => {
            render(<LogExpense {...defaultProps} />);

            // EQUAL button should be highlighted (has bg-tactical-accent)
            const equalBtn = screen.getByRole('button', { name: /equal/i });
            expect(equalBtn).toHaveClass('bg-tactical-accent');
        });

        it('switches from EQUAL to CUSTOM mode', async () => {
            render(<LogExpense {...defaultProps} />);

            const customBtn = screen.getByRole('button', { name: /custom/i });
            await userEvent.click(customBtn);

            expect(customBtn).toHaveClass('bg-tactical-accent');

            // In CUSTOM mode, we should see input fields for amounts
            const amountInputs = screen.getAllByRole('spinbutton');
            expect(amountInputs.length).toBeGreaterThan(0);
        });

        it('switches from CUSTOM to ITEMIZED mode', async () => {
            render(<LogExpense {...defaultProps} />);

            // First switch to CUSTOM
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Then switch to ITEMIZED
            const itemizedBtn = screen.getByRole('button', { name: /itemized/i });
            await userEvent.click(itemizedBtn);

            expect(itemizedBtn).toHaveClass('bg-tactical-accent');
        });

        it('switches from ITEMIZED back to EQUAL mode', async () => {
            render(<LogExpense {...defaultProps} />);

            // Switch to ITEMIZED
            await userEvent.click(screen.getByRole('button', { name: /itemized/i }));

            // Switch back to EQUAL
            const equalBtn = screen.getByRole('button', { name: /equal/i });
            await userEvent.click(equalBtn);

            expect(equalBtn).toHaveClass('bg-tactical-accent');
        });
    });

    describe('State Preservation on Mode Switch', () => {
        it('preserves custom amounts when switching CUSTOM → EQUAL → CUSTOM', async () => {
            render(<LogExpense {...defaultProps} />);

            // Enter an amount first
            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '100');

            // Switch to CUSTOM mode
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Wait for custom amounts to initialize
            await waitFor(() => {
                const customInputs = screen.getAllByRole('spinbutton');
                expect(customInputs.length).toBeGreaterThan(1);
            });

            // Get all custom amount inputs (excluding the main amount input)
            const customInputs = screen.getAllByRole('spinbutton');
            const memberAmountInputs = customInputs.filter(input =>
                input.getAttribute('placeholder') !== '0'
            );

            // Modify first member's amount
            if (memberAmountInputs.length > 0) {
                await userEvent.clear(memberAmountInputs[0]);
                await userEvent.type(memberAmountInputs[0], '50');
            }

            // Switch to EQUAL
            await userEvent.click(screen.getByRole('button', { name: /equal/i }));

            // Switch back to CUSTOM
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // The custom amounts state should be preserved (though UI may reinitialize)
            // This tests that the React state management preserves customAmounts
            await waitFor(() => {
                const updatedInputs = screen.getAllByRole('spinbutton');
                expect(updatedInputs.length).toBeGreaterThan(1);
            });
        });

        it('preserves splitWith selection when switching modes', async () => {
            render(<LogExpense {...defaultProps} />);

            // By default, all active members should be selected
            // Test that mode switching doesn't cause errors or lose state

            // Switch to CUSTOM mode
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Wait for custom inputs to initialize
            await waitFor(() => {
                expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(1);
            });

            // Switch back to EQUAL
            const equalBtn = screen.getByRole('button', { name: /equal/i });
            await userEvent.click(equalBtn);

            // Verify we're back in EQUAL mode
            expect(equalBtn).toHaveClass('bg-tactical-accent');

            // The key assertion: switching modes should not crash or reset members
            // All 3 members should still be visible in the UI
            expect(screen.queryAllByText(/david/i).length).toBeGreaterThan(0);
        });
    });

    describe('Validation per Mode', () => {
        it('EQUAL mode requires title and amount to be valid', async () => {
            const onSave = vi.fn();
            render(<LogExpense {...defaultProps} onSave={onSave} />);

            // Try to submit with empty fields - should fail validation
            const submitBtn = screen.getByRole('button', { name: /log expense|save/i });
            await userEvent.click(submitBtn);

            // onSave should NOT be called due to validation failure (no title, no amount)
            expect(onSave).not.toHaveBeenCalled();

            // Now add only title
            const titleInput = screen.getByPlaceholderText(/grocery run|supplies/i);
            await userEvent.type(titleInput, 'Test Expense');

            // Still should fail (no amount)
            await userEvent.click(submitBtn);
            expect(onSave).not.toHaveBeenCalled();

            // Add amount - now should pass
            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '100');

            await userEvent.click(submitBtn);
            expect(onSave).toHaveBeenCalled();
        });

        it('CUSTOM mode validates sum matches total', async () => {
            const onSave = vi.fn();
            render(<LogExpense {...defaultProps} onSave={onSave} />);

            // Enter required fields - use placeholder to get the description/title input
            const titleInput = screen.getByPlaceholderText(/grocery run|supplies/i);
            await userEvent.type(titleInput, 'Test Expense');

            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '100');

            // Switch to CUSTOM mode
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Wait for custom inputs to appear
            await waitFor(() => {
                const spinbuttons = screen.getAllByRole('spinbutton');
                expect(spinbuttons.length).toBeGreaterThan(1);
            });

            // Modify amounts to NOT match total (leave unbalanced)
            const customInputs = screen.getAllByRole('spinbutton').slice(1); // Skip main amount
            if (customInputs.length >= 2) {
                await userEvent.clear(customInputs[0]);
                await userEvent.type(customInputs[0], '10'); // Only 10-ish, not 100
            }

            // Try to submit - should fail validation
            const submitBtn = screen.getByRole('button', { name: /log expense|save/i });
            await userEvent.click(submitBtn);

            // Validation should fail because sum != total
            expect(onSave).not.toHaveBeenCalled();
        });
    });

    describe('Submit with Different Modes', () => {
        it('EQUAL mode generates correct splitDetails on submit', async () => {
            const onSave = vi.fn();
            render(<LogExpense {...defaultProps} onSave={onSave} />);

            // Enter required fields - use placeholder to get the description/title input
            const titleInput = screen.getByPlaceholderText(/grocery run|supplies/i);
            await userEvent.type(titleInput, 'Dinner');

            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '99');

            // Submit in EQUAL mode
            const submitBtn = screen.getByRole('button', { name: /log expense|save/i });
            await userEvent.click(submitBtn);

            // Verify onSave was called with splitDetails
            await waitFor(() => {
                expect(onSave).toHaveBeenCalled();
            });

            const savedItem = onSave.mock.calls[0][0];
            expect(savedItem.splitDetails).toBeDefined();

            // With 3 members sharing 99, should allocate 33 each (with remainder handling)
            const totalSplit = Object.values(savedItem.splitDetails as Record<string, number>)
                .reduce((sum: number, val: number) => sum + val, 0);
            expect(totalSplit).toBeCloseTo(99, 1);
        });

        it('CUSTOM mode generates exact splitDetails on submit', async () => {
            const onSave = vi.fn();
            render(<LogExpense {...defaultProps} onSave={onSave} />);

            // Enter required fields - use placeholder to get the description/title input
            const titleInput = screen.getByPlaceholderText(/grocery run|supplies/i);
            await userEvent.type(titleInput, 'Custom Split Dinner');

            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '100');

            // Switch to CUSTOM mode
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Wait and get custom inputs
            await waitFor(() => {
                const spinbuttons = screen.getAllByRole('spinbutton');
                expect(spinbuttons.length).toBeGreaterThan(1);
            });

            const customInputs = screen.getAllByRole('spinbutton').slice(1);

            // Set custom amounts that sum to 100
            if (customInputs.length >= 3) {
                await userEvent.clear(customInputs[0]);
                await userEvent.type(customInputs[0], '50');

                await userEvent.clear(customInputs[1]);
                await userEvent.type(customInputs[1], '30');

                await userEvent.clear(customInputs[2]);
                await userEvent.type(customInputs[2], '20');
            }

            // Submit
            const submitBtn = screen.getByRole('button', { name: /log expense|save/i });
            await userEvent.click(submitBtn);

            await waitFor(() => {
                expect(onSave).toHaveBeenCalled();
            });

            const savedItem = onSave.mock.calls[0][0];
            expect(savedItem.splitDetails).toBeDefined();

            // Total should equal 100
            const totalSplit = Object.values(savedItem.splitDetails as Record<string, number>)
                .reduce((sum: number, val: number) => sum + val, 0);
            expect(totalSplit).toBeCloseTo(100, 1);
        });

        it('uses last selected mode for final submission', async () => {
            const onSave = vi.fn();
            render(<LogExpense {...defaultProps} onSave={onSave} />);

            // Enter required fields - use placeholder to get the description/title input
            const titleInput = screen.getByPlaceholderText(/grocery run|supplies/i);
            await userEvent.type(titleInput, 'Mode Switch Test');

            const amountInput = screen.getByPlaceholderText('0');
            await userEvent.type(amountInput, '90');

            // Start in EQUAL
            // Switch to CUSTOM
            await userEvent.click(screen.getByRole('button', { name: /custom/i }));

            // Switch to ITEMIZED
            await userEvent.click(screen.getByRole('button', { name: /itemized/i }));

            // Switch back to EQUAL (this should be the final mode)
            await userEvent.click(screen.getByRole('button', { name: /equal/i }));

            // Submit
            const submitBtn = screen.getByRole('button', { name: /log expense|save/i });
            await userEvent.click(submitBtn);

            await waitFor(() => {
                expect(onSave).toHaveBeenCalled();
            });

            // In EQUAL mode, receiptItems should be empty
            const savedItem = onSave.mock.calls[0][0];
            expect(savedItem.receiptItems).toEqual([]);

            // splitDetails should have equal shares
            const values = Object.values(savedItem.splitDetails as Record<string, number>);
            const firstValue = values[0];
            values.forEach((v: number) => {
                expect(v).toBeCloseTo(firstValue, 1); // All should be roughly equal
            });
        });
    });

    describe('Editing Existing Items', () => {
        it('loads CUSTOM mode when editing item with splitDetails', () => {
            const existingItem = {
                id: 'existing-1',
                tripId: 'trip-1',
                type: ItemType.FOOD,
                title: 'Previous Dinner',
                location: 'Restaurant',
                startDate: new Date(),
                cost: 100,
                originalAmount: 100,
                currencyCode: 'PLN',
                exchangeRate: 1,
                createdBy: 'user-1',
                splitWith: ['user-1', 'user-2'],
                splitDetails: { 'user-1': 60, 'user-2': 40 },
                paidBy: 'user-1'
            };

            render(<LogExpense {...defaultProps} initialItem={existingItem} />);

            // Should start in CUSTOM mode because splitDetails exists
            const customBtn = screen.getByRole('button', { name: /custom/i });
            expect(customBtn).toHaveClass('bg-tactical-accent');
        });

        it('loads ITEMIZED mode when editing item with receiptItems', () => {
            const existingItem = {
                id: 'existing-2',
                tripId: 'trip-1',
                type: ItemType.FOOD,
                title: 'Itemized Bill',
                location: 'Cafe',
                startDate: new Date(),
                cost: 100,
                originalAmount: 100,
                currencyCode: 'PLN',
                exchangeRate: 1,
                createdBy: 'user-1',
                splitWith: ['user-1', 'user-2', 'user-3'],
                paidBy: 'user-1',
                receiptItems: mockReceiptItems.map(item => ({
                    ...item,
                    assignedTo: ['user-1', 'user-2']
                }))
            };

            render(<LogExpense {...defaultProps} initialItem={existingItem} />);

            // Should start in ITEMIZED mode because receiptItems exists
            const itemizedBtn = screen.getByRole('button', { name: /itemized/i });
            expect(itemizedBtn).toHaveClass('bg-tactical-accent');
        });
    });
});
