// convert-currency Edge Function
// Proxies currency conversion requests to ExchangeRate API and Frankfurter
// API key is protected server-side

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FRANKFURTER_API = 'https://api.frankfurter.app';

// List of currencies supported by Frankfurter (Free & Unlimited)
const FRANKFURTER_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
]);

async function fetchFrankfurter(from: string, to: string, date: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const endpoint = date === today ? 'latest' : date;

  const response = await fetch(`${FRANKFURTER_API}/${endpoint}?from=${from}&to=${to}`);
  if (!response.ok) throw new Error('Frankfurter API Error');

  const data = await response.json();
  return data.rates[to];
}

async function fetchExchangeRateAPI(from: string, to: string, date: string, apiKey: string): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  const isTodayOrFuture = date >= todayStr;

  if (isTodayOrFuture) {
    // Use latest endpoint
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${from}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ExchangeRate-API Error: ${res.status}`);
    const data = await res.json();
    return data.conversion_rates[to];
  }

  // Try historical
  const [year, month, day] = date.split('-');
  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/history/${from}/${year}/${month}/${day}`;
  
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.conversion_rates?.[to]) {
        return data.conversion_rates[to];
      }
    }
  } catch (e) {
    console.warn(`[convert-currency] Historical fetch failed:`, e);
  }

  // Fallback to latest
  console.warn(`[convert-currency] Historical data unavailable for ${from} on ${date}. Using latest.`);
  const latestUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${from}`;
  const latestRes = await fetch(latestUrl);
  if (!latestRes.ok) throw new Error(`ExchangeRate-API Error: ${latestRes.status}`);
  const latestData = await latestRes.json();
  return latestData.conversion_rates[to];
}

Deno.serve(async (req) => {
  console.log('[convert-currency] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, from, to, date } = await req.json();

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: 'Missing from/to currency codes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Same currency = no conversion needed
    if (from === to) {
      return new Response(
        JSON.stringify({ amount, rate: 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize date
    const dateStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];

    let rate: number;

    // Try Frankfurter first if both currencies supported (free, unlimited)
    if (FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to)) {
      try {
        rate = await fetchFrankfurter(from, to, dateStr);
        console.log(`[convert-currency] Frankfurter: ${from}->${to} = ${rate}`);
      } catch (err) {
        console.warn('[convert-currency] Frankfurter failed, trying ExchangeRate-API');
        const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');
        if (!apiKey) throw new Error('EXCHANGE_RATE_API_KEY not configured');
        rate = await fetchExchangeRateAPI(from, to, dateStr, apiKey);
      }
    } else {
      // Use ExchangeRate-API for exotic currencies
      const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');
      if (!apiKey) throw new Error('EXCHANGE_RATE_API_KEY not configured');
      rate = await fetchExchangeRateAPI(from, to, dateStr, apiKey);
      console.log(`[convert-currency] ExchangeRate-API: ${from}->${to} = ${rate}`);
    }

    const convertedAmount = parseFloat((amount * rate).toFixed(2));

    return new Response(
      JSON.stringify({ amount: convertedAmount, rate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[convert-currency] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
