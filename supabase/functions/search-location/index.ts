// search-location Edge Function
// Proxies location search requests to Geoapify API
// API key is protected server-side

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LocationResult {
  name: string;
  city?: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  formatted: string;
}

Deno.serve(async (req) => {
  console.log('[search-location] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
    if (!apiKey) {
      throw new Error('GEOAPIFY_API_KEY not configured');
    }

    console.log(`[search-location] Searching: ${query}`);

    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=10&apiKey=${apiKey}&lang=en`
    );

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();

    const results: LocationResult[] = data.features.map((f: any) => ({
      name: f.properties.name || f.properties.city || f.properties.country,
      city: f.properties.city,
      country: f.properties.country,
      countryCode: f.properties.country_code?.toUpperCase(),
      lat: f.properties.lat,
      lon: f.properties.lon,
      formatted: f.properties.formatted
    }));

    console.log(`[search-location] Found ${results.length} results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-location] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
