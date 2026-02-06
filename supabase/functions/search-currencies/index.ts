// search-currencies Edge Function
// Fetches and searches all supported currencies from ExchangeRate-API
// Supports search by code OR name

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Currency {
  code: string;
  name: string;
}

Deno.serve(async (req) => {
  console.log('[search-currencies] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ currencies: [], error: 'Query must be at least 2 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');
    if (!apiKey) {
      throw new Error('EXCHANGE_RATE_API_KEY not configured');
    }

    // Fetch all supported currency codes from ExchangeRate-API
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/codes`;
    console.log(`[search-currencies] Fetching currency codes from API`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ExchangeRate-API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result !== 'success' || !data.supported_codes) {
      throw new Error('Invalid response from ExchangeRate-API');
    }

    // data.supported_codes is array of [code, name] pairs
    // e.g., [["USD", "United States Dollar"], ["VND", "Vietnamese Dong"]]
    const allCurrencies: Currency[] = data.supported_codes.map(([code, name]: [string, string]) => ({
      code,
      name
    }));

    // Search by code OR name (case-insensitive)
    const searchTerm = query.toLowerCase();
    const matchingCurrencies = allCurrencies.filter((currency: Currency) =>
      currency.code.toLowerCase().includes(searchTerm) ||
      currency.name.toLowerCase().includes(searchTerm)
    );

    console.log(`[search-currencies] Found ${matchingCurrencies.length} currencies matching "${query}"`);

    return new Response(
      JSON.stringify({ currencies: matchingCurrencies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-currencies] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, currencies: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
