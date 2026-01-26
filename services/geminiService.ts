import { GoogleGenAI } from "@google/genai";
import { ItineraryItem, ItemType } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

interface ScanResult {
  items: Partial<ItineraryItem>[] | null;
  confidence: number;
}

export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date, textInput?: string): Promise<ScanResult> => {
  try {
    const modelId = DEFAULT_MODEL;

    const contextPrompt = tripStartDate
      ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
      : `CONTEXT: Use the current year for any ambiguous dates.`;

    // Chain-of-Thought + RAG Enhanced Prompt
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
       
       ═══════════════════════════════════════════════════════════════════════
       DATA EXTRACTION RULES:
       ═══════════════════════════════════════════════════════════════════════

       **MULTI-ITEM EXTRACTION**: 
       - If the document contains multiple distinct events (e.g. Outbound + Return Flight), extract EACH as a separate object.
       - **SAME EVENT, MULTIPLE TICKETS/ITEMS**: Return ONE object with quantity in receiptItems.
       - **AGGREGATE COST**: The 'cost' field MUST be the final **TOTAL ORDER AMOUNT**.

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
             "location": "String (City/Address)",
             "startDate": "ISO String",
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
       
       CRITICAL FOR DEPOSITS/DISCOUNTS:
       - cost = FINAL PAID AMOUNT (what was actually charged)
       - If items sum EXCEEDS cost due to deposit/discount, ADD A NEGATIVE LINE ITEM:
         { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
       - Sum of (quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
       - Example: Items = €287.50, Deposit = -€40.00, Total = €247.50 ✓
    `;

    const prompt = `${contextPrompt}\n${promptInstructions}`;

    const parts: any[] = [{ text: prompt }];

    if (textInput) {
      parts.unshift({ text: `DOCUMENT CONTENT (Parsed Text):\n${textInput}` });
    } else {
      parts.unshift({ inlineData: { mimeType: mimeType, data: base64Data } });
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) return { items: null, confidence: 0 };

    let data = JSON.parse(text);

    // Extract confidence from response
    let confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;

    // Handle different response formats
    let items = data.items;
    if (!items) {
      if (Array.isArray(data)) {
        items = data;
      } else if (typeof data === 'object' && data !== null) {
        items = [data];
      }
    }

    if (!Array.isArray(items)) {
      return { items: null, confidence: 0 };
    }

    const processedItems: Partial<ItineraryItem>[] = items.map((item: any) => {
      const receiptItems = Array.isArray(item.receiptItems)
        ? item.receiptItems.map((ri: any) => ({
          ...ri,
          id: crypto.randomUUID(),
          assignedTo: []
        }))
        : undefined;

      return {
        type: item.type,
        title: item.title,
        location: item.location,
        endLocation: item.endLocation,
        startDate: item.startDate ? new Date(item.startDate) : undefined,
        endDate: item.endDate ? new Date(item.endDate) : undefined,
        cost: typeof item.cost === 'number' ? item.cost : (parseFloat(item.cost) || 0),
        currencyCode: item.currencyCode,
        details: typeof item.details === 'string' ? item.details : undefined,
        tags: Array.isArray(item.tags) ? item.tags : [],
        durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined,
        receiptItems: receiptItems
      };
    });

    // Additional confidence validation based on math check
    if (processedItems.length > 0 && processedItems[0].receiptItems?.length) {
      const itemSum = processedItems[0].receiptItems.reduce(
        (sum: number, ri: any) => sum + (ri.price * ri.quantity), 0
      );
      const totalCost = processedItems[0].cost || 0;
      const tolerance = totalCost * 0.02; // 2% tolerance

      if (Math.abs(itemSum - totalCost) > tolerance && totalCost > 0) {
        // Math doesn't add up - cap confidence
        console.warn(`[GeminiService] ⚠️ Math validation failed: items sum ${itemSum.toFixed(2)} ≠ total ${totalCost.toFixed(2)}`);
        confidence = Math.min(confidence, 0.80);
      } else if (totalCost > 0) {
        console.log(`[GeminiService] ✅ Math validated: items sum ${itemSum.toFixed(2)} ≈ total ${totalCost.toFixed(2)}`);
      }
    }

    // Log reasoning if provided
    if (data.reasoning) {
      console.log(`[GeminiService] 🧠 Model reasoning: ${data.reasoning}`);
    }

    return { items: processedItems, confidence };

  } catch (e) {
    console.error("[GeminiService] Analysis failed", e);
    return { items: null, confidence: 0 };
  }
};
