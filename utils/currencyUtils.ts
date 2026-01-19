
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
};

export const getCurrencySymbol = (code: string): string => {
    return CURRENCY_SYMBOLS[code] || code;
};

export const formatCurrency = (amount: number, code: string): string => {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
