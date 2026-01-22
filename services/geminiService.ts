import { GoogleGenAI } from "@google/genai";
import { ItineraryItem, ItemType } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const DEFAULT_MODEL = "gemini-2.5-flash-lite"; // Specified version 2.5


export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date): Promise<Partial<ItineraryItem> | null> => {
  try {
    const modelId = DEFAULT_MODEL;

    const contextPrompt = tripStartDate
      ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
      : `CONTEXT: Use the current year for any ambiguous dates.`;

    const prompt = `
       ${contextPrompt}
       Analyze this image or document (invoice, receipt, ticket, or booking confirmation).
       Extract the relevant travel itinerary details into a JSON Object.
       
       MANDATORY: Return a SINGLE JSON Object.
       
       CRITICAL RULES FOR ITEM EXTRACTION:
       1. **IGNORE FISCAL SUMMARIES**: Do NOT extract lines that represent tax bases, tax groups, or subtotals (e.g., "Sprzedaż opodatkowana", "PTU", "VAT", "Taxable amount", "Net amount", "Total tax"). only extract the actual products/services scanned.
       2. **GROSS VS NET DETECTION**:
          - **Europe/Asia/LatAm**: Prices usually INCLUDE tax (Gross). If the receipt shows "Suma PTU" or "VAT" at the bottom but individual items sum up to the total, DO NOT create a separate line item for tax.
          - **USA/Canada**: Prices are usually Net (Tax added at end). If the subtotal of items < Total Paid, AND there is a distinct "Tax" line added to the subtotal, THEN extract "Tax" as a separate line item.
       3. **sanity Check**: The sum of all 'receiptItems' prices MUST equal the 'cost' (Total).
       
       For RECEIPTS/INVOICES (Food, Shopping, Services):
       1. Extract individual line items into a 'receiptItems' array.
       2. For EACH item, provide:
          - name: The item name EXACTLY as it appears on the document.
          - nameRomanized/nameEnglish: Transliterate/Translate if non-Latin/non-English.
          - quantity: Number of units.
          - price: Total price for this line item (e.g. if 2x 10.00, price is 20.00).
          - type: 'food' | 'drink' | 'service' | 'tip' | 'tax' | 'other'
       
       For TRANSPORT/TICKETS:
       ... (keep existing logic)

       1. Look for 'Travel Time' or 'Duration' text (e.g., '8 h 29 m'). Calculate total minutes and include as 'durationMinutes'.
       2. Extract distinct events if possible, but primarily return the MAIN event details.
       
       The JSON Object must have these fields:
       - type: One of "STAY", "TRANSPORT", "ACTIVITY", "FOOD", "ESSENTIALS", "SETTLEMENT".
       - title: Name of the vendor, airline, hotel, etc.
       - location: City, address, or airport code.
       - startDate: Local ISO 8601 string (YYYY-MM-DDTHH:mm).
       - cost: Total amount as a number.
       - currencyCode: 3-letter currency code (e.g. USD, EUR, JPY) inferred from symbol or text.
       - details: Notes or confirmation codes.
       - durationMinutes: (Number) for transport.
       - receiptItems: Array of { name, nameRomanized, nameEnglish, quantity, price, type } objects.
       
       Return strictly a JSON Object.
     `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);

    // Post-process receipt items to add IDs
    const receiptItems = Array.isArray(data.receiptItems)
      ? data.receiptItems.map((item: any) => ({
        ...item,
        id: crypto.randomUUID(), // Generate ID for UI handling
        assignedTo: [] // Default unassigned
      }))
      : undefined;

    return {
      type: data.type,
      title: data.title,
      location: data.location,
      endLocation: data.endLocation,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      cost: typeof data.cost === 'number' ? data.cost : (parseFloat(data.cost) || 0),
      currencyCode: data.currencyCode,
      details: typeof data.details === 'string' ? data.details : undefined,
      durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : undefined,
      receiptItems: receiptItems
    };
  } catch (e) {
    console.error("Analysis failed", e);
    return null;
  }
};
