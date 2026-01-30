// analyze-receipt Edge Function
// Handles all AI receipt analysis (Gemini Lite, Gemini Premium, Groq Maverick)
// Prompts are protected server-side from prompt injection

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ═══════════════════════════════════════════════════════════════════════
// PROTECTED PROMPT (Server-side only)
// ═══════════════════════════════════════════════════════════════════════

const buildPrompt = (tripStartDate?: string) => {
  const contextPrompt = tripStartDate
    ? `CONTEXT: The trip is scheduled to start on ${tripStartDate}. Use this year (and subsequent year if dates cross year boundary).`
    : `CONTEXT: Use the current year for any ambiguous dates.`;

  const promptInstructions = `
TASK: Parse the travel document/receipt into a JSON object with items array and confidence score.

═══════════════════════════════════════════════════════════════════════
CHAIN-OF-THOUGHT REASONING (Complete these steps internally before output):
═══════════════════════════════════════════════════════════════════════

STEP 1 - DOCUMENT IDENTIFICATION:
- What type of document is this? (receipt, ticket, invoice, booking confirmation)
- What is the vendor/merchant name?
- What currency is used? (Look for symbols: ₡=CRC, €=EUR, £=GBP, $=USD/MXN/CAD)

STEP 2 - LINE ITEM EXTRACTION:
- List EVERY line item exactly as shown on the document
- For each line, note: Quantity | Description | Price shown

STEP 3 - PRICE FORMAT DETECTION (CRITICAL):
- Examine the receipt column headers carefully
- Does the receipt show "Qty | Description | Total" format?
  → YES: The price shown IS the LINE TOTAL already. DIVIDE by quantity for unit price.
  → NO (shows Unit Price column): Use unit price directly.
- Example: "2.0 | VARIOS | 1,000.00" means 2 items costing 1,000 TOTAL (unit = 500)

STEP 4 - MATHEMATICAL VALIDATION:
- For each item: verify quantity × price = line total shown
- Sum all line totals and compare to document SUBTOTAL/TOTAL
- If sum ≠ total: Re-check Step 3

STEP 5 - CONFIDENCE ASSESSMENT:
- 0.0-0.3: Failed to extract items or major parsing errors
- 0.4-0.6: Extracted items but totals don't match
- 0.7-0.8: Items extracted, minor discrepancies
- 0.9-1.0: Perfect extraction, sum matches total within 2%

═══════════════════════════════════════════════════════════════════════
NON-CONSUMABLE EXCLUSIONS (CRITICAL - DO NOT EXTRACT THESE AS ITEMS):
═══════════════════════════════════════════════════════════════════════

NEVER extract the following as receiptItems:

1. PAYMENT/TRANSACTION REFERENCES:
   - "Anex", "Anexo", "Card ****1234", "Visa/MC/Amex"
   - Lines that REPEAT the subtotal amount
   - Payment confirmation lines, authorization codes

2. SUMMARY LINES:
   - "Sub-total", "Subtotal", "Total", "Balance", "Change"
   - "Net Amount", "Gross Amount", "Taxable Base", "# Articulos"

3. TAX BREAKDOWNS:
   - "VAT 20%", "IVA 16%", "Tax Rate A/B", "PTU"

═══════════════════════════════════════════════════════════════════════
BUSINESS RULES:
═══════════════════════════════════════════════════════════════════════

1. SERVICE CHARGES, TIPS: Type "service", shared proportionally
2. TAXES: Usually included in prices, don't extract tax breakdown lines
3. DEPOSITS: If subtracted from total, add negative line item
4. CURRENCY: Analyze symbols carefully: '₡'=CRC, '€'=EUR, '£'=GBP

═══════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA:
═══════════════════════════════════════════════════════════════════════

{
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of price format detected and validation result",
  "items": [
    {
      "type": "STAY"|"TRANSPORT"|"ACTIVITY"|"FOOD"|"ESSENTIALS"|"SETTLEMENT",
      "title": "String (Intelligent Summary)",
      "location": "String (City/Address)",
      "startDate": "ISO String",
      "cost": Number, // TOTAL amount for entire order (FINAL PAID AMOUNT)
      "currencyCode": "String", // 3-letter ISO code
      "details": "String (Rich summary with Order #, breakdown)",
      "receiptItems": [
        { 
          "name": "String", 
          "quantity": Number,
          "price": Number,  // UNIT PRICE (line total ÷ quantity)
          "type": "ticket"|"food"|"drink"|"service"|"tax"|"deposit"|"discount"|"other" 
        }
      ]
    }
  ]
}

STRICT CURRENCY RULES:
- ALWAYS extract 'currencyCode' for the total cost
- If 'currencyCode' is NOT 'USD', the 'cost' MUST be in that local currency
- Do NOT convert to USD

CRITICAL FOR DEPOSITS/DISCOUNTS:
- cost = FINAL PAID AMOUNT (what was actually charged)
- If items sum EXCEEDS cost due to deposit/discount, ADD A NEGATIVE LINE ITEM:
  { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
- Sum of (quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
`;

  return `${contextPrompt}\n${promptInstructions}`;
};

// ═══════════════════════════════════════════════════════════════════════
// GEMINI API HANDLER
// ═══════════════════════════════════════════════════════════════════════

async function analyzeWithGemini(
  base64Data: string,
  mimeType: string,
  textInput: string | undefined,
  tripStartDate: string | undefined,
  model: 'lite' | 'premium'
): Promise<{ items: any[], confidence: number, reasoning?: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const modelId = model === 'premium' ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';
  console.log(`[analyze-receipt] Using Gemini model: ${modelId}`);

  const prompt = buildPrompt(tripStartDate);

  const parts: any[] = [];
  
  if (textInput) {
    parts.push({ text: `DOCUMENT CONTENT (Parsed Text):\n${textInput}` });
  } else if (base64Data) {
    parts.push({ inlineData: { mimeType, data: base64Data } });
  }
  
  parts.push({ text: prompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) return { items: [], confidence: 0 };

  const data = JSON.parse(text);
  return {
    items: data.items || (Array.isArray(data) ? data : [data]),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    reasoning: data.reasoning
  };
}

// ═══════════════════════════════════════════════════════════════════════
// GROQ/MAVERICK API HANDLER
// ═══════════════════════════════════════════════════════════════════════

async function analyzeWithGroq(
  base64Data: string,
  mimeType: string,
  textInput: string | undefined,
  tripStartDate: string | undefined
): Promise<{ items: any[], confidence: number, reasoning?: string }> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const modelId = 'meta-llama/llama-4-maverick-17b-128e-instruct';
  console.log(`[analyze-receipt] Using Groq model: ${modelId}`);

  const prompt = buildPrompt(tripStartDate);

  const messageContent: any[] = [{ type: 'text', text: prompt }];
  
  if (textInput) {
    messageContent.push({ type: 'text', text: `\n\nDOCUMENT CONTENT:\n${textInput}` });
  } else if (base64Data) {
    messageContent.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${base64Data}` }
    });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: messageContent }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) return { items: [], confidence: 0 };

  const data = JSON.parse(content);
  return {
    items: data.items || (Array.isArray(data) ? data : [data]),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    reasoning: data.reasoning
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  console.log('[analyze-receipt] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Data, mimeType = 'image/jpeg', tripStartDate, textInput, model = 'lite' } = await req.json();

    if (!base64Data && !textInput) {
      return new Response(
        JSON.stringify({ error: 'Either base64Data or textInput is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { items: any[], confidence: number, reasoning?: string };

    if (model === 'maverick') {
      result = await analyzeWithGroq(base64Data, mimeType, textInput, tripStartDate);
    } else {
      result = await analyzeWithGemini(base64Data, mimeType, textInput, tripStartDate, model as 'lite' | 'premium');
    }

    // Process items to add IDs
    const processedItems = result.items.map((item: any) => ({
      ...item,
      id: crypto.randomUUID(),
      receiptItems: Array.isArray(item.receiptItems) 
        ? item.receiptItems.map((ri: any) => ({
            ...ri,
            id: crypto.randomUUID(),
            assignedTo: []
          }))
        : []
    }));

    // Mathematical validation
    let confidence = result.confidence;
    if (processedItems.length > 0 && processedItems[0].receiptItems?.length) {
      const itemSum = processedItems[0].receiptItems.reduce(
        (sum: number, ri: any) => sum + ((ri.price || 0) * (ri.quantity || 1)), 0
      );
      const totalCost = processedItems[0].cost || 0;
      const tolerance = totalCost * 0.02;

      if (Math.abs(itemSum - totalCost) > tolerance && totalCost > 0) {
        console.warn(`[analyze-receipt] Math validation failed: ${itemSum.toFixed(2)} ≠ ${totalCost.toFixed(2)}`);
        confidence = Math.min(confidence, 0.80);
      } else if (totalCost > 0) {
        console.log(`[analyze-receipt] Math validated: ${itemSum.toFixed(2)} ≈ ${totalCost.toFixed(2)}`);
      }
    }

    if (result.reasoning) {
      console.log(`[analyze-receipt] Reasoning: ${result.reasoning}`);
    }

    console.log(`[analyze-receipt] Complete: ${processedItems.length} items, confidence: ${(confidence * 100).toFixed(1)}%`);

    return new Response(
      JSON.stringify({ items: processedItems, confidence }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-receipt] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, items: null, confidence: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
