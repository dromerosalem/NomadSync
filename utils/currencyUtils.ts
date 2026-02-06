
export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    HKD: 'HK$',
    NZD: 'NZ$',
    SGD: 'S$',
    MXN: 'Mex$',
    BRL: 'R$',
    COP: 'COL$',
    ARS: 'AR$',
    PEN: 'S/.',
    CLP: 'CLP$',
    UYU: '$U',
    CRC: '₡',
    PLN: 'zł',
};

export const getCurrencySymbol = (code: string): string => {
    return CURRENCY_SYMBOLS[code] || code;
};

export const formatAmount = (amount: number | undefined | null): string => {
    const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatAmountWhole = (amount: number | undefined | null): string => {
    const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

export const formatCurrency = (amount: number, code: string): string => {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${formatAmount(amount)}`;
};

