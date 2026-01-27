import Groq from 'groq-sdk';
import { ItineraryItem } from '../types';

const MODEL_ID = "meta-llama/llama-4-maverick-17b-128e-instruct";

let groqClient: Groq | null = null;

const getGroqClient = () => {
    if (groqClient) return groqClient;

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
        console.warn("Missing VITE_GROQ_API_KEY. Groq service will not work.");
        return null;
    }

    groqClient = new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
    return groqClient;
};

export const analyzeReceiptWithGroq = async (base64Data: string, mimeType: string, tripStartDate?: Date, textInput?: string): Promise<{ items: Partial<ItineraryItem>[], confidence: number }> => {
    try {
        const groq = getGroqClient();
        if (!groq) return { items: [], confidence: 0 };

        const contextPrompt = tripStartDate
            ? `CONTEXT: The trip starts on ${tripStartDate.toISOString().split('T')[0]}. Use this year.`
            : `CONTEXT: Use current year.`;

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
        - If sum ≠ total: Re-examine Step 3
        
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
              "location": "City/Address",
              "startDate": "YYYY-MM-DDTHH:mm",
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

        
        CRITICAL FOR DEPOSITS / DISCOUNTS:
        - cost = FINAL PAID AMOUNT(what was actually charged)
            - If items sum EXCEEDS cost due to deposit / discount, ADD A NEGATIVE LINE ITEM:
        { "name": "Deposit Applied", "quantity": 1, "price": -40.00, "type": "deposit" }
        - Sum of(quantity × price) for ALL items INCLUDING deposits MUST EQUAL cost
            - Example: Items = €287.50, Deposit = -€40.00, Total = €247.50 ✓
        `;

        const prompt = `${contextPrompt} \n${promptInstructions} `;

        const messageContent: any[] = [{ type: 'text', text: prompt }];

        if (textInput) {
            console.log("[GroqService] Using extracted text for analysis");
            messageContent.push({ type: 'text', text: `\n\nDOCUMENT CONTENT: \n${textInput} ` });
        } else {
            messageContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                }
            });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: messageContent as any
                }
            ],
            model: MODEL_ID,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) return { items: [], confidence: 0 };

        let data = JSON.parse(content);

        // Extract confidence from response
        let confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;

        // Handle different response formats
        let itemsArray = data.items;
        if (itemsArray && Array.isArray(itemsArray)) {
            // Good - already has items array
        } else if (Array.isArray(data)) {
            itemsArray = data;
        } else if (!itemsArray) {
            itemsArray = [data];
        }

        const items: Partial<ItineraryItem>[] = itemsArray.map((d: any) => ({
            type: d.type,
            title: d.title,
            location: d.location || d.title,
            cost: d.cost,
            originalAmount: d.cost,
            currencyCode: d.currencyCode,
            details: d.details,
            startDate: d.startDate ? new Date(d.startDate) : undefined,
            receiptItems: Array.isArray(d.receiptItems) ? d.receiptItems.map((ri: any) => ({
                ...ri,
                id: crypto.randomUUID(),
                assignedTo: []
            })) : []
        }));

        // Mathematical validation for confidence adjustment
        if (items.length > 0 && items[0].receiptItems?.length) {
            const itemSum = items[0].receiptItems.reduce(
                (sum: number, ri: any) => sum + (ri.price * ri.quantity), 0
            );
            const totalCost = items[0].cost || 0;
            const tolerance = totalCost * 0.02; // 2% tolerance

            if (Math.abs(itemSum - totalCost) > tolerance && totalCost > 0) {
                console.warn(`[GroqService] ⚠️ Math validation failed: items sum ${itemSum.toFixed(2)} ≠ total ${totalCost.toFixed(2)} `);
                confidence = Math.min(confidence, 0.80);
            } else if (totalCost > 0) {
                console.log(`[GroqService] ✅ Math validated: items sum ${itemSum.toFixed(2)} ≈ total ${totalCost.toFixed(2)} `);
            }
        }

        // Fallback confidence calculation if model didn't provide one
        if (typeof data.confidence !== 'number') {
            confidence = 0.0;
            if (items.length > 0) confidence += 0.3;
            if (items[0]?.title && items[0]?.cost) confidence += 0.2;
            if (items[0]?.currencyCode) confidence += 0.1;
            if (items[0]?.receiptItems && items[0].receiptItems.length > 0) {
                confidence += 0.2;
                // Check if math adds up
                const itemSum = items[0].receiptItems.reduce(
                    (sum: number, ri: any) => sum + (ri.price * ri.quantity), 0
                );
                const totalCost = items[0].cost || 0;
                const tolerance = totalCost * 0.02;
                if (totalCost > 0 && Math.abs(itemSum - totalCost) <= tolerance) {
                    confidence += 0.2; // Math validation bonus
                }
            }
        }

        // Log reasoning if provided
        if (data.reasoning) {
            console.log(`[GroqService] 🧠 Model reasoning: ${data.reasoning} `);
        }

        return { items, confidence };

    } catch (error) {
        console.error("[GroqService] Analysis Failed:", error);
        return { items: [], confidence: 0 };
    }
};
