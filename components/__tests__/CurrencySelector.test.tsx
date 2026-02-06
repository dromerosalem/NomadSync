import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CurrencySelector, { SUPPORTED_CURRENCIES } from '../CurrencySelector';

// Mock CurrencyService
vi.mock('../../services/CurrencyService', () => ({
    currencyService: {
        searchCurrencies: vi.fn(),
        cacheSelectedCurrency: vi.fn(),
        getCachedCurrencies: vi.fn(() => [])
    }
}));

import { currencyService } from '../../services/CurrencyService';

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

describe('CurrencySelector', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(currencyService.getCachedCurrencies).mockReturnValue([]);
    });

    describe('Predefined Currency Search', () => {
        it('renders with selected currency', () => {
            render(<CurrencySelector value="USD" onChange={mockOnChange} />);
            expect(screen.getByText('USD')).toBeInTheDocument();
            expect(screen.getByText('US Dollar')).toBeInTheDocument();
        });

        it('opens modal on click', async () => {
            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            const button = screen.getByRole('button');
            await userEvent.click(button);

            expect(screen.getByText('Select Currency')).toBeInTheDocument();
        });

        it('filters predefined currencies by code', async () => {
            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'USD');

            expect(screen.getAllByText('US Dollar').length).toBeGreaterThan(0);
        });

        it('filters predefined currencies by name (Peso)', async () => {
            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'Peso');

            // Should show MXN, CLP, PHP, COP (all peso currencies)
            await waitFor(() => {
                expect(screen.getByText('Mexican Peso')).toBeInTheDocument();
                expect(screen.getByText('Chilean Peso')).toBeInTheDocument();
                expect(screen.getByText('Philippine Peso')).toBeInTheDocument();
                expect(screen.getByText('Colombian Peso')).toBeInTheDocument();
            });
        });
    });

    describe('Extended Currency Search', () => {
        it('searches API for currencies not in predefined list', async () => {
            vi.mocked(currencyService.searchCurrencies).mockResolvedValue([
                { code: 'VND', name: 'Vietnamese Dong' }
            ]);

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'VND');

            // Wait for debounce and API call
            await waitFor(() => {
                expect(currencyService.searchCurrencies).toHaveBeenCalledWith('VND');
            }, { timeout: 500 });
        });

        it('searches API by currency name (Vietnam)', async () => {
            vi.mocked(currencyService.searchCurrencies).mockResolvedValue([
                { code: 'VND', name: 'Vietnamese Dong' }
            ]);

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'Vietnam');

            await waitFor(() => {
                expect(currencyService.searchCurrencies).toHaveBeenCalledWith('Vietnam');
            }, { timeout: 500 });
        });

        it('displays extended currencies section', async () => {
            vi.mocked(currencyService.searchCurrencies).mockResolvedValue([
                { code: 'VND', name: 'Vietnamese Dong' }
            ]);

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'VND');

            await waitFor(() => {
                expect(screen.getByText(/Extended Currencies/i)).toBeInTheDocument();
                expect(screen.getByText('Vietnamese Dong')).toBeInTheDocument();
            }, { timeout: 1000 });
        });
    });

    describe('Currency Selection & Caching', () => {
        it('caches extended currency on selection', async () => {
            vi.mocked(currencyService.searchCurrencies).mockResolvedValue([
                { code: 'VND', name: 'Vietnamese Dong' }
            ]);

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'VND');

            await waitFor(() => {
                expect(screen.getByText('Vietnamese Dong')).toBeInTheDocument();
            }, { timeout: 1000 });

            // Click on VND option
            const vndButton = screen.getByText('Vietnamese Dong').closest('button');
            if (vndButton) {
                await userEvent.click(vndButton);
            }

            expect(currencyService.cacheSelectedCurrency).toHaveBeenCalledWith({
                code: 'VND',
                name: 'Vietnamese Dong'
            });
            expect(mockOnChange).toHaveBeenCalledWith('VND');
        });

        it('does not cache predefined currencies on selection', async () => {
            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            // Find and click EUR in Quick Assets
            const eurButton = screen.getAllByText('EUR')[0].closest('button');
            if (eurButton) {
                await userEvent.click(eurButton);
            }

            expect(currencyService.cacheSelectedCurrency).not.toHaveBeenCalled();
            expect(mockOnChange).toHaveBeenCalledWith('EUR');
        });

        it('uses cached currencies in search', async () => {
            vi.mocked(currencyService.getCachedCurrencies).mockReturnValue([
                { code: 'VND', name: 'Vietnamese Dong' }
            ]);

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'VND');

            // Cached currency should appear without API call
            await waitFor(() => {
                expect(screen.getByText('Vietnamese Dong')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('shows loading indicator during API search', async () => {
            // Delay the mock response
            vi.mocked(currencyService.searchCurrencies).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve([]), 500))
            );

            render(<CurrencySelector value="USD" onChange={mockOnChange} />);

            await userEvent.click(screen.getByRole('button'));

            const searchInput = screen.getByPlaceholderText(/SEARCH BY CODE OR NAME/i);
            await userEvent.type(searchInput, 'XYZ');

            await waitFor(() => {
                expect(screen.getByText(/Searching extended currencies/i)).toBeInTheDocument();
            }, { timeout: 1000 });
        });
    });
});
