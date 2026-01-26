import { GoogleGenAI } from "@google/genai";
import { ItineraryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Premium model - more expensive but more accurate
const PREMIUM_MODEL = "gemini-2.5-flash";

interface ScanResult {
    items: Partial<ItineraryItem>[] | null;
    confidence: number;
}

/**
 * Premium Gemini Flash Service
 * Only used as a LAST RESORT backup when lite models fail to reach confidence threshold.
 * This model is more expensive, so it should only be called when absolutely necessary.
 */
export const analyzeReceiptPremium = async (
    base64Data: string,
    mimeType: string = "image/jpeg",
    tripStartDate?: Date,
    textInput?: string
): Promise<ScanResult> => {
    console.log(`[GeminiPremium] 💎 Using PREMIUM model: ${PREMIUM_MODEL}`);

    try {
        const contextPrompt = tripStartDate
            ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year.`
            : `CONTEXT: Use the current year for any ambiguous dates.`;

        // Enhanced Chain-of-Thought prompt for premium model
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
             "location": "City/Address",
             "startDate": "ISO String",
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
            parts.unshift({ text: `DOCUMENT CONTENT:\n${textInput}` });
        } else {
            parts.unshift({ inlineData: { mimeType: mimeType, data: base64Data } });
        }

        const response = await ai.models.generateContent({
            model: PREMIUM_MODEL,
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

        // Extract confidence
        let confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;

        // Handle response formats
        let items = data.items;
        if (!items) {
            if (Array.isArray(data)) items = data;
            else if (typeof data === 'object') items = [data];
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

        // Log reasoning
        if (data.reasoning) {
            console.log(`[GeminiPremium] 🧠 Premium reasoning: ${data.reasoning}`);
        }

        // Log success
        console.log(`[GeminiPremium] 💎 Premium scan complete: ${processedItems.length} items, confidence: ${(confidence * 100).toFixed(1)}%`);

        return { items: processedItems, confidence };

    } catch (e) {
        console.error("[GeminiPremium] ❌ Premium analysis failed", e);
        return { items: null, confidence: 0 };
    }
};
