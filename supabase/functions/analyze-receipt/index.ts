// analyze-receipt Edge Function
// Handles all AI receipt analysis (Gemini Lite, Gemini Premium, Groq Maverick)
// Prompts are protected server-side from prompt injection

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ═══════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS (Model-Specific)
// ═══════════════════════════════════════════════════════════════════════

const buildContextPrompt = (tripStartDate?: string) => {
  return tripStartDate
    ? `CONTEXT: The trip is scheduled to start on ${tripStartDate}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
    : `CONTEXT: Use the current year for any ambiguous dates.`;
};

// 1. GEMINI LITE PROMPT (Standard)
const buildGeminiLitePrompt = (tripStartDate?: string) => {
  const contextPrompt = buildContextPrompt(tripStartDate);
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
         → YES: The price shown IS the LINE TOTAL already. DO NOT multiply by quantity.
         → NO (shows Unit Price column): Multiply unit price × quantity for line total.
       - Example: "2.0 | VARIOS | 1,000.00" means 2 items costing 1,000 TOTAL (unit = 500)
       
       STEP 4 - MATHEMATICAL VALIDATION:
       - Sum all extracted line totals
       - Compare to document's SUBTOTAL or TOTAL
       - If sum ≠ total: Re-check Step 3. You likely misidentified unit vs line prices.
       
       STEP 5 - CONFIDENCE ASSESSMENT:
       - 0.0-0.3: Failed to extract items or major parsing errors
       - 0.4-0.6: Extracted items but totals don't match
       - 0.7-0.8: Items extracted, minor discrepancies
       - 0.9-1.0: Perfect extraction, sum matches total within 2%
       
       ═══════════════════════════════════════════════════════════════════════
       NON-CONSUMABLE EXCLUSIONS (CRITICAL - DO NOT EXTRACT THESE AS ITEMS):
       ═══════════════════════════════════════════════════════════════════════
       
       NEVER extract the following as receiptItems - they are NOT consumable goods:
       
       1. PAYMENT/TRANSACTION REFERENCES:
          - "Anex", "Anexo", "Card ****1234", "Visa/MC/Amex ending in..."
          - "Transaction ID", "Auth Code", "Reference #"
          - Lines that REPEAT the subtotal amount (e.g., "Anex N81004 $425.00")
          - Payment confirmation lines
       
       2. SUMMARY LINES:
          - "Sub-total", "Subtotal", "Total", "Balance", "Change", "Peso"
          - "Net Amount", "Gross Amount", "Taxable Base"
          - "Paid", "Amount Due", "Amount Paid", "# Articulos"
       
       3. TAX BREAKDOWNS:
          - "VAT 20%", "IVA 16%", "Tax Rate A/B", "PTU"
          - Percentages or tax calculation lines
       
       4. QUANTITY NOTATION:
          - Pattern "(2 $38.00) = 76" means: qty=2, unit=$38, line total=$76
          - Extract as: { name: "Item", quantity: 2, price: 38 }
       
       ═══════════════════════════════════════════════════════════════════════
       BUSINESS RULES (RAG Context):
       ═══════════════════════════════════════════════════════════════════════
       
       1. SERVICE CHARGES, TIPS, GRATUITIES:
          - Type: "service"
          - These are ALWAYS shared proportionally among all participants
          
       2. TAXES:
          - In most regions, displayed prices ALREADY INCLUDE TAX
          - DO NOT extract "VAT", "PTU", "Tax Summary", "Taxable Base" as line items
          - Only extract explicit "Tax" or "VAT" line if it appears as a separate charge line
          
       3. RECEIPT FORMATS BY REGION:
          - European/Latin American: Often show LINE TOTALS (Qty × Price already calculated)
          - US/UK Retail: Often show UNIT PRICES that need multiplication
          
       4. QUANTITY VALIDATION:
          - If a "×" or "x" appears (e.g., "3 × 15.00"), the second number is unit price
          - If just one number after quantity, CHECK if it matches subtotal math

        5. TRANSPORT LOCATION RULES (CRITICAL):
           - For TRANSPORT (flights, trains, etc.), ALWAYS separate Origin and Destination.
           - DO NOT put "Origin to Destination" in a single field.
           - 'location' = Origin (City/Airport/Station)
           - 'endLocation' = Destination (City/Airport/Station)
       
       ═══════════════════════════════════════════════════════════════════════
       DATA EXTRACTION RULES:
       ═══════════════════════════════════════════════════════════════════════

        **MULTI-ITEM EXTRACTION (CRITICAL)**: 
        - **ROUND TRIP PARSING**: If the document is a Round Trip (Outbound + Return), extract as **TWO** separate 'TRANSPORT' items (split cost 50/50).
        - **SAME EVENT MERGING**: If multiple tickets/pages refer to the **SAME EVENT** (e.g. Concert, Tour) on the same date/time, merge them into a **SINGLE** 'ACTIVITY' item.
            - **SUM THE COSTS**: The item 'cost' must be the SUM of all ticket prices.
            - **LINE ITEMS**: List each ticket as a separate entry in 'receiptItems'.
        - **DISTINCT EVENTS**: Only create separate items if the events are truly different (different dates, valid round trips, or different venues).
        - **AGGREGATE COST**: The 'cost' field MUST be the final **TOTAL ORDER AMOUNT**.

        **LAYOVER / CONNECTION PARSING (CRITICAL)**:
         - **EVERY TRANSPORT LEG IS A SEPARATE ITEM**: If a journey has layovers/connections, extract EACH flight/train/bus segment as its own 'TRANSPORT' item.
         - Do NOT combine multiple legs into a single item.
         - Each leg must have its own departure time, arrival time, origin, and destination.
         - **IDENTIFICATION RULES**:
             - A "Transfer" or "Layover" notation indicates a connection point.
             - Different flight/train/bus numbers = different legs.
             - A departure from the same location where you just arrived = start of new leg.
         - **EXAMPLE - Outbound with 1 Connection**:
             Document shows: "London 10:10 → Porto 12:35, Transfer 1h15m, Porto 13:50 → Sao Paulo 21:40"
             Extract as TWO items:
             1. { type: "TRANSPORT", location: "London", endLocation: "Porto", startDate: "...T10:10", endDate: "...T12:35", ... }
             2. { type: "TRANSPORT", location: "Porto", endLocation: "Sao Paulo", startDate: "...T13:50", endDate: "...T21:40", ... }
         - **COST DISTRIBUTION FOR LAYOVERS**:
             - If the document shows a single total price for all legs, SPLIT EVENLY across all leg items.
             - If individual leg prices are shown, use those.
             - Example: Round trip with 4 legs at €500 total → Each leg costs €125.

       **CURRENCY NORMALIZATION (CRITICAL)**:
       - If line items are listed in a different currency (e.g. GBP) than the Final Total (e.g. USD), you MUST convert the line item prices to the Final Total's currency.
       - Use the ratio (Total / Sum of original items) to convert each item.
       - The Sum of (quantity × price) MUST equal 'cost'.

       **FUTURE/CONDITIONAL CHARGES**:
       - Do NOT extract "Damage Deposits" or fees "due on arrival" as line items if they are not part of the current payment total.
       - Only extract charges that are INCLUDED in the 'cost'.

       **CURRENCY EXTRACTION (STRICT)**:
       - **ISO 4217 CODES ONLY**: Return 3-letter codes (e.g. "USD", "EUR", "CRC").
       - **SYMBOL MAPPING**: ₡→CRC, €→EUR, £→GBP, $→USD (unless context says otherwise)
       - **MAGNITUDE CHECK**: High amounts (6000+) for a meal suggest non-USD currency.

       **TAX HANDLING (CRITICAL)**:
       - DO NOT EXTRACT: "VAT 20%", "PTU A 23%", "Taxable Base", "Gross Amount", "Net Amount", "Subtotal"
       - ONLY BILLABLE ITEMS: Physical goods (food, drink, tickets) or valid surcharges (Service Charge)
       
       ═══════════════════════════════════════════════════════════════════════
       OUTPUT SCHEMA:
       ═══════════════════════════════════════════════════════════════════════
       
       {
         "confidence": 0.0-1.0,  // Your confidence score based on Step 5
         "reasoning": "Brief explanation of price format detected and validation result",
         "items": [
           {
             "type": "STAY"|"TRANSPORT"|"ACTIVITY"|"FOOD"|"ESSENTIALS"|"SETTLEMENT",
             "title": "String (Intelligent Summary)",
             "location": "String (Origin for Transport, else Merchant Address)",
              "endLocation": "String (Destination for Transport only)",
             "startDate": "ISO String",
             "endDate": "ISO String", // Arrival time
             "durationMinutes": Number, 
             "cost": Number, // TOTAL amount for entire order (FINAL PAID AMOUNT)
             "currencyCode": "String", // 3-letter ISO code
             "details": "String (Rich summary with Order #, breakdown)",
             "receiptItems": [
               { 
                 "name": "String", 
                 "quantity": Number,  // How many units
                 "price": Number,     // UNIT PRICE (line total ÷ quantity)
                 "type": "ticket"|"food"|"drink"|"service"|"tax"|"deposit"|"discount"|"other" 
               }
             ]
           }
         ]
       }
       
        STRICT CURRENCY RULES (APPENDED):
        - ALWAYS extract 'currencyCode' for the total cost.
        - Analyze symbols carefully: '₡' is CRC (Costa Rica), 'R$' is BRL, 'S/' is PEN.
        - If 'currencyCode' is NOT 'USD', the 'cost' field MUST be the amount in that local currency.
        - Do NOT convert to USD. Return the original receipt amount and the correct 3-letter currency code.

       
       CRITICAL FOR DEPOSITS / DISCOUNTS:
    - cost = FINAL PAID AMOUNT(what was actually charged)
      - If items sum EXCEEDS cost due to deposit / discount, ADD A NEGATIVE LINE ITEM:
    { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
    - Sum of(quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
      - Example: Items = €287.50, Deposit = -€40.00, Total = €247.50 ✓
    `;
    return `${contextPrompt}\n${promptInstructions}`;
};

// 2. GEMINI PREMIUM PROMPT (High Accuracy)
const buildGeminiPremiumPrompt = (tripStartDate?: string) => {
    const contextPrompt = buildContextPrompt(tripStartDate);
    const promptInstructions = `
       TASK: Parse the receipt/document into a JSON object with items array and confidence score.
       
       ═══════════════════════════════════════════════════════════════════════
       CHAIN-OF-THOUGHT REASONING (You MUST complete these steps):
       ═══════════════════════════════════════════════════════════════════════
       
       STEP 1 - DOCUMENT ANALYSIS:
       - Identify merchant name, date, and currency
       - Note any special charges (deposits, discounts, refunds)
       
       STEP 2 - LINE ITEM EXTRACTION:
       - Extract EVERY consumable item (food, drink, services)
       - Note quantity and price for each
       
       STEP 3 - PRICE FORMAT DETECTION (CRITICAL):
       - Examine if prices shown are UNIT PRICES or LINE TOTALS
       - Pattern: "Item × Qty = Price" → Price is LINE TOTAL
       - Pattern: "Qty | Item | Price" with large quantity → likely LINE TOTAL
       - If receipt shows "Total" column → those ARE line totals, divide by qty for unit price
       
       STEP 4 - SPECIAL CHARGES HANDLING:
       - Look for DEPOSITS (often shown as negative or "deposit" text)
       - Look for DISCOUNTS or VOUCHERS being applied
       - Look for TIPS or SERVICE CHARGES
       - These adjustments explain why item sum may differ from final total
       
       STEP 5 - MATHEMATICAL VALIDATION:
       - Sum all (unit price × quantity) for regular items
       - Add service charges, tips
       - Subtract any deposits, discounts, vouchers
       - Result should ≈ Final Total (±2%)
       
       STEP 6 - CONFIDENCE SCORE:
       - 0.9-1.0: Perfect match after accounting for adjustments
       - 0.7-0.8: Minor discrepancy (<5%)
       - 0.5-0.6: Items extracted but math unclear
       - 0.0-0.4: Major issues
       
       ═══════════════════════════════════════════════════════════════════════
       NON-CONSUMABLE EXCLUSIONS (CRITICAL - DO NOT EXTRACT THESE AS ITEMS):
       ═══════════════════════════════════════════════════════════════════════
       
       NEVER extract the following as receiptItems - they are NOT consumable goods:
       
       1. PAYMENT/TRANSACTION REFERENCES:
          - "Anex", "Anexo", "Card ****1234", "Visa/MC/Amex"
          - Lines that REPEAT the subtotal amount (e.g., "Anex N81004 $425.00")
          - Payment confirmation lines, authorization codes
       
       2. SUMMARY LINES:
          - "Sub-total", "Subtotal", "Total", "Balance", "Change", "Peso"
          - "Net Amount", "Gross Amount", "Taxable Base", "# Articulos"
       
       3. TAX BREAKDOWNS:
          - "VAT 20%", "IVA 16%", "Tax Rate A/B", "PTU"
       
       4. QUANTITY NOTATION:
          - Pattern "(2 $38.00) = 76" means: qty=2, unit=$38, total=$76
          - Extract as: { name: "Item", quantity: 2, price: 38 }
       
       ═══════════════════════════════════════════════════════════════════════
       BUSINESS RULES:
       ═══════════════════════════════════════════════════════════════════════
       
       1. SERVICE CHARGES & TIPS: Type "service", always shared proportionally
       2. DEPOSITS: If a deposit is SUBTRACTED from the total, note it in details
          but the 'cost' should be the FINAL PAID AMOUNT (after deposit deduction)
       3. TAXES: Usually included in prices, don't extract tax breakdown lines
       4. DISCOUNTS/VOUCHERS: Account for these when validating totals
        
        **MULTI-ITEM vs SINGLE ITEM (CRITICAL)**:
        - **ROUND TRIP**: Split into TWO separate 'TRANSPORT' items (Outbound / Return).
        - **SAME EVENT (e.g. Concert)**: Merge multiple tickets for the SAME event into ONE 'ACTIVITY' item.
            - Sum all ticket costs into the final 'cost'.
            - List individual tickets in 'receiptItems'.

        **LAYOVER / CONNECTION PARSING (CRITICAL)**:
         - **EVERY TRANSPORT LEG IS A SEPARATE ITEM**: If a journey has layovers/connections, extract EACH flight/train/bus segment as its own 'TRANSPORT' item.
         - Do NOT combine multiple legs into a single item.
         - Each leg must have its own departure time, arrival time, origin, and destination.
         - **IDENTIFICATION RULES**:
             - A "Transfer" or "Layover" notation indicates a connection point.
             - Different flight/train/bus numbers = different legs.
             - A departure from the same location where you just arrived = start of new leg.
         - **EXAMPLE - Outbound with 1 Connection**:
             Document shows: "London 10:10 → Porto 12:35, Transfer 1h15m, Porto 13:50 → Sao Paulo 21:40"
             Extract as TWO items:
             1. { type: "TRANSPORT", location: "London", endLocation: "Porto", startDate: "...T10:10", endDate: "...T12:35", ... }
             2. { type: "TRANSPORT", location: "Porto", endLocation: "Sao Paulo", startDate: "...T13:50", endDate: "...T21:40", ... }
         - **COST DISTRIBUTION FOR LAYOVERS**:
             - If the document shows a single total price for all legs, SPLIT EVENLY across all leg items.
             - If individual leg prices are shown, use those.
             - Example: Round trip with 4 legs at €500 total → Each leg costs €125.

        5. TRANSPORT LOCATION RULES (CRITICAL):
           - For TRANSPORT (flights, trains, etc.), ALWAYS separate Origin and Destination.
           - 'location' = Origin (City/Airport/Station)
           - 'endLocation' = Destination (City/Airport/Station)
       
       ═══════════════════════════════════════════════════════════════════════
       OUTPUT SCHEMA:
       ═══════════════════════════════════════════════════════════════════════
       
       {
         "confidence": 0.0-1.0,
         "reasoning": "Explain price format, any adjustments (deposits/discounts), and validation",
         "items": [
           {
             "type": "STAY"|"TRANSPORT"|"ACTIVITY"|"FOOD"|"ESSENTIALS",
             "title": "Merchant Name",
             "location": "String (Origin for Transport, else Merchant Address)",
              "endLocation": "String (Destination for Transport only)",
             "startDate": "ISO String",
             "endDate": "ISO String", // Arrival time
             "durationMinutes": Number,
             "cost": Number,  // FINAL PAID AMOUNT (after deposits/discounts)
             "currencyCode": "EUR",
             "details": "Include deposit info, vouchers, any adjustments",
             "receiptItems": [
               { 
                 "name": "Item Name", 
                 "quantity": Number,
                 "price": Number,  // UNIT PRICE (line total ÷ quantity)
                 "type": "food"|"drink"|"service"|"deposit"|"discount"|"other" 
               }
             ]
           }
         ]
        }
        
        STRICT CURRENCY RULES (APPENDED):
        - ALWAYS extract 'currencyCode' for the total cost.
        - If 'currencyCode' is NOT 'USD', the 'cost' field MUST be the amount in that local currency.
        - Do NOT convert to USD. Return the original receipt amount and the correct 3-letter currency code.
       
        CRITICAL FOR DEPOSITS / DISCOUNTS:
         - cost = FINAL PAID AMOUNT(what was actually charged)
             - If items sum EXCEEDS cost due to deposit / discount, ADD A NEGATIVE LINE ITEM:
         { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
         - Sum of(quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
             - Example: Items = €287.50, Deposit = -€40.00, Total = €247.50 ✓
    `;
    return `${contextPrompt}\n${promptInstructions}`;
};

// 3. GROQ MAVERICK PROMPT (Generic Llama Tuning)
const buildGroqMaverickPrompt = (tripStartDate?: string) => {
    const contextPrompt = buildContextPrompt(tripStartDate);
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
        - Many receipts show "Qty | Description | Total" format where:
          → The price shown IS the LINE TOTAL already (quantity × unit price)
          → In this case, DIVIDE by quantity to get unit price for the output
        - Example: "2.0 | VARIOS | 1,000.00" 
          → This means 2 items for 1,000 TOTAL
          → Unit price = 1,000 ÷ 2 = 500
          → Output: { "name": "VARIOS", "quantity": 2, "price": 500 }
        
        STEP 4 - MATHEMATICAL VALIDATION:
        - For each item: verify quantity × price = line total shown
        - Sum all line totals and compare to document SUBTOTAL/TOTAL
        - If sum ≠ total: Re-examine Step 3. 
        - If currencies differ, convert items to match Total.
        
        STEP 5 - CONFIDENCE ASSESSMENT:
        - 0.0-0.3: Failed to extract items or major parsing errors
        - 0.4-0.6: Extracted items but totals don't match
        - 0.7-0.8: Items extracted, minor discrepancies
        - 0.9-1.0: Perfect extraction, sum matches total within 2%
        
        ═══════════════════════════════════════════════════════════════════════
        NON-CONSUMABLE EXCLUSIONS (CRITICAL - DO NOT EXTRACT THESE AS ITEMS):
        ═══════════════════════════════════════════════════════════════════════
        
        NEVER extract the following as receiptItems - they are NOT consumable goods:
        
        1. PAYMENT/TRANSACTION REFERENCES:
           - "Anex", "Anexo", "Card ****1234", "Visa/MC/Amex"
           - Lines that REPEAT the subtotal amount (e.g., "Anex N81004 $425.00")
           - Payment confirmation lines, authorization codes
        
        2. SUMMARY LINES:
           - "Sub-total", "Subtotal", "Total", "Balance", "Change", "Peso"
           - "Net Amount", "Gross Amount", "Taxable Base", "# Articulos"
        
        3. TAX BREAKDOWNS:
           - "VAT 20%", "IVA 16%", "Tax Rate A/B", "PTU"
        
        4. QUANTITY NOTATION:
           - Pattern "(2 $38.00) = 76" means: qty=2, unit=$38, total=$76
           - Extract as: { name: "Item", quantity: 2, price: 38 }
        
        ═══════════════════════════════════════════════════════════════════════
        BUSINESS RULES (RAG Context):
        ═══════════════════════════════════════════════════════════════════════
        
        1. SERVICE CHARGES, TIPS, GRATUITIES:
           - Type: "service"
           - These are ALWAYS shared proportionally among all participants
           
        2. TAXES:
           - In most regions, displayed prices ALREADY INCLUDE TAX
           - DO NOT extract "VAT", "PTU", "Tax Summary", "Taxable Base" as line items
           - Only extract explicit "Tax" or "VAT" line if it appears as a separate charge
           
        3. RECEIPT FORMATS BY REGION:
           - European/Latin American: Often show LINE TOTALS (already multiplied)
           - US/UK Retail: Often show UNIT PRICES
           
        4. TRANSCRIPTION RULES:
           - Do NOT divide values by 100 or 10
           - For CRC, JPY, KRW: 6000 means 6000, NOT 60

        5. TRANSPORT LOCATION RULES (CRITICAL):
           - For TRANSPORT (flights, trains, etc.), ALWAYS separate Origin and Destination.
           - 'location' = Origin (City/Airport/Station)
           - 'endLocation' = Destination (City/Airport/Station)

        **MULTI-ITEM LOGIC**:
            - **ROUND TRIP**: Split into TWO items (start/end logic applies to each).
            - **SAME EVENT**: Merge multiple tickets into ONE item. Sum the costs.

        **LAYOVER / CONNECTION PARSING (CRITICAL)**:
         - **EVERY TRANSPORT LEG IS A SEPARATE ITEM**: If a journey has layovers/connections, extract EACH flight/train/bus segment as its own 'TRANSPORT' item.
         - Do NOT combine multiple legs into a single item.
         - Each leg must have its own departure time, arrival time, origin, and destination.
         - **IDENTIFICATION RULES**:
             - A "Transfer" or "Layover" notation indicates a connection point.
             - Different flight/train/bus numbers = different legs.
             - A departure from the same location where you just arrived = start of new leg.
         - **EXAMPLE - Outbound with 1 Connection**:
             Document shows: "London 10:10 → Porto 12:35, Transfer 1h15m, Porto 13:50 → Sao Paulo 21:40"
             Extract as TWO items:
             1. { type: "TRANSPORT", location: "London", endLocation: "Porto", startDate: "...T10:10", endDate: "...T12:35", ... }
             2. { type: "TRANSPORT", location: "Porto", endLocation: "Sao Paulo", startDate: "...T13:50", endDate: "...T21:40", ... }
         - **COST DISTRIBUTION FOR LAYOVERS**:
             - If the document shows a single total price for all legs, SPLIT EVENLY across all leg items.
             - If individual leg prices are shown, use those.
             - Example: Round trip with 4 legs at €500 total → Each leg costs €125.
        
        ═══════════════════════════════════════════════════════════════════════
        TAX HANDLING (CRITICAL):
        ═══════════════════════════════════════════════════════════════════════
        
        - **DO NOT EXTRACT TAX SUMMARIES AS ITEMS**: 
          Lines like "VAT 20%", "PTU A 23%", "Taxable Base", "Gross Amount", 
          "Net Amount", "Subtotal" MUST NOT be in 'receiptItems'
        - **ONLY BILLABLE ITEMS**: Food, drink, tickets, service charges
        - **TAX IS NOT AN ITEM**: Taxes are part of cost, not a separate line item
        
        ═══════════════════════════════════════════════════════════════════════
        OUTPUT SCHEMA (JSON):
        ═══════════════════════════════════════════════════════════════════════
        
        {
          "confidence": 0.0-1.0,
          "reasoning": "Brief explanation of price format detected and validation",
          "items": [
            {
              "type": "STAY" | "TRANSPORT" | "ACTIVITY" | "FOOD" | "ESSENTIALS",
              "title": "Vendor/Event Name",
              "location": "String (Origin for Transport, else Merchant Address)",
              "endLocation": "String (Destination for Transport only)",
              "startDate": "YYYY-MM-DDTHH:mm",
              "endDate": "YYYY-MM-DDTHH:mm", // Arrival time for transport
              "cost": 0.0,  // FINAL PAID AMOUNT (after deposits/discounts)
              "currencyCode": "String",  // 3-letter ISO code
              "details": "Rich summary with Order #, breakdown, metadata",
              "durationMinutes": 0,
              "receiptItems": [
                { 
                  "name": "String", 
                  "quantity": 1,      // How many units
                  "price": 0.0,       // UNIT PRICE (NOT line total)
                  "type": "ticket" | "food" | "drink" | "service" | "tax" | "deposit" | "discount"
                }
              ]
            }
          ]
        }
        
        STRICT CURRENCY RULES (APPENDED):
        - ALWAYS extract 'currencyCode' for the total cost.
        - Analyze symbols carefully: '₡' is CRC, '€' is EUR.
        - If 'currencyCode' is NOT 'USD', the 'cost' MUST be the amount in that local currency.

        **CURRENCY NORMALIZATION (CRITICAL)**:
        - If items are in Currency A but Total is in Currency B, CONVERT items to Currency B.
        - The cost matches the currencyCode. The sum of items MUST match cost.

        
        CRITICAL FOR DEPOSITS / DISCOUNTS:
        - cost = FINAL PAID AMOUNT(what was actually charged)
            - If items sum EXCEEDS cost due to deposit / discount, ADD A NEGATIVE LINE ITEM:
        { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
        - Sum of(quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
            - Example: Items = €287.50, Deposit = -€40.00, Total = €247.50 ✓
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
): Promise<{ items: any[], confidence: number, reasoning?: string, usage?: any }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const modelId = model === 'premium' ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';
  console.log(`[analyze-receipt] Using Gemini model: ${modelId}`);

  // SELECT THE CORRECT PROMPT BASED ON MODEL
  const prompt = model === 'premium' 
    ? buildGeminiPremiumPrompt(tripStartDate) 
    : buildGeminiLitePrompt(tripStartDate);

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
  const usageMetadata = result.usageMetadata; // CAPTURE USAGE
  
  if (!text) return { items: [], confidence: 0, usage: usageMetadata };

  const data = JSON.parse(text);
  return {
    items: data.items || (Array.isArray(data) ? data : [data]),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    reasoning: data.reasoning,
    usage: usageMetadata
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
): Promise<{ items: any[], confidence: number, reasoning?: string, usage?: any }> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const modelId = 'meta-llama/llama-4-maverick-17b-128e-instruct';
  console.log(`[analyze-receipt] Using Groq model: ${modelId}`);

  // USE GROQ-SPECIFIC PROMPT
  const prompt = buildGroqMaverickPrompt(tripStartDate);

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
  const usage = result.usage; // CAPTURE USAGE
  
  if (!content) return { items: [], confidence: 0, usage };

  const data = JSON.parse(content);
  return {
    items: data.items || (Array.isArray(data) ? data : [data]),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    reasoning: data.reasoning,
    usage: usage
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

    let result: { items: any[], confidence: number, reasoning?: string, usage?: any };

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
    if (result.usage) {
        console.log(`[analyze-receipt] Usage: ${JSON.stringify(result.usage)}`);
    }

    return new Response(
      JSON.stringify({ 
        items: processedItems, 
        confidence, 
        usage: result.usage 
      }),
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
