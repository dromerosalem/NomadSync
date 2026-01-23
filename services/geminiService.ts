import { GoogleGenAI } from "@google/genai";
import { ItineraryItem, ItemType } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const DEFAULT_MODEL = "gemini-2.5-flash-lite"; // Specified version 2.5


export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date, textInput?: string): Promise<Partial<ItineraryItem>[] | null> => {
  try {
    const modelId = DEFAULT_MODEL;

    const contextPrompt = tripStartDate
      ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
      : `CONTEXT: Use the current year for any ambiguous dates.`;

    const promptInstructions = `
       TASK: Parse the travel document/receipt into a JSON ARRAY of objects.
       
       **MULTI-ITEM EXTRACTION (CRITICAL)**: 
       - If the document contains multiple distinct events (e.g. Outbound + Return Flight), extract EACH as a separate object.
       - **SAME EVENT, MULTIPLE TICKETS/ITEMS**: If the document contains multiple tickets (e.g. 2 concert tickets) or multiple guests for the SAME event, return ONE object representing the entire order. 
       - **QUANTITY VALIDATION**: Look for "Qty", "Quantity", or multiple barcodes/QR codes. If you see $24.95 listed but the order total is $49.90, the quantity MUST be 2.
       - **AGGREGATE COST**: The 'cost' field MUST be the final **TOTAL ORDER AMOUNT** (Sum of all items + fees + taxes). 
       - Detail the breakdown (e.g. "Unit Price: $24.95 x 2") in the 'details' string and 'receiptItems' array.

       MASTER DATA INVENTORY (EXTRACT EVERYTHING LISTED IF PRESENT):
       
       1. UNIVERSAL METADATA
          - documentType: "flight"|"hotel"|"event"|"receipt"|"tour"|"transport"|"other"
          - providerName: Name of airline, hotel brand, or merchant.
          - bookingReference: PNR, Order #, or Confirmation Code.
          - totalAmount: Number.
          - currency: 3-letter code.
          - paymentStatus: "paid"|"pending"|"pay-at-property".
       
       2. FLIGHT (Type: TRANSPORT)
          - airline: Operating carrier.
          - flightNumber: e.g. AA123.
          - departure: { code: "LHR", city: "London", date: "YYYY-MM-DDTHH:mm" }
          - arrival: { code: "JFK", city: "New York", date: "YYYY-MM-DDTHH:mm" }
          - ticketNumber: e.g. 125-1234567890.
          - seat: e.g. 12A.
          - baggage: e.g. "1 checked bag".
       
       3. HOTEL (Type: STAY)
          - propertyName: Full name.
          - address: Full address.
          - checkIn: "YYYY-MM-DDTHH:mm" (Default 15:00 if time missing).
          - checkOut: "YYYY-MM-DDTHH:mm" (Default 11:00 if time missing).
          - roomType: e.g. "King Ocean View".
          - policies: { cancellation: "Free before X", meals: "Breakfast included" }
       
       4. EVENT (Type: ACTIVITY)
          - eventName: Title of show/exhibition.
          - venue: Name & Location.
          - eventDate: "YYYY-MM-DDTHH:mm".
          - seat: Section/Row/Seat.
       
       5. RECEIPT / TICKETS (Type: FOOD/ESSENTIALS/ACTIVITY/TRANSPORT)
          - merchantName: Vendor (e.g. See Tickets, Ticketmaster).
          - lineItems: Array of { name, quantity, price, type: "ticket"|"food"|"drink"|"service"|"tax"|"other" }
          - taxAmount: Total tax.
          - tipAmount: Tip/Gratuity.

       CRITICAL RULES:
       1. **CROSS-REFERENCE TOTALS**: Always compare detected unit prices with the document's Final Total. If Total = 2x Unit Price, you MUST set quantity to 2 and title it accordingly.
       2. **RETURN NULL** for missing fields, do NOT guess.
       3. **IGNORE** legal disclaimers, terms & conditions text blocks.
       4. **DERIVE** 'durationMinutes' for flights/transport.
       4. **TAGGING**: Add boolean flags as tags array (e.g. ["refundable", "paid", "business-class", "breakfast-included"]).
       
       OUTPUT SCHEMA (JSON ARRAY):
       [
         {
           "type": "STAY"|"TRANSPORT"|"ACTIVITY"|"FOOD"|"ESSENTIALS"|"SETTLEMENT",
           "title": "String (Intelligent Summary, e.g. 'Flight to NYC' or 'Hilton Stay')",
           "location": "String (City/Airport/Address)",
           "endLocation": "String (Arrival City/Airport for Transport)",
           "startDate": "ISO String",
           "endDate": "ISO String",
           "cost": Number, // TOTAL amount for the entire order/object.
           "currencyCode": "String",
           "details": "String (Pedantic, rich multiline summary: include Order #, Unit Prices, specific Guest Names, Venue Address, Gate/Seat info, and any unique metadata found)",
           "tags": ["String"],
           "durationMinutes": Number,
           "receiptItems": [{ "name": "String", "quantity": Number, "price": Number, "type": "String" }]
         }
       ]
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
        // We can lower temperature to be more deterministic for data extraction
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) return null;

    let data = JSON.parse(text);

    // Ensure array
    if (!Array.isArray(data)) {
      if (typeof data === 'object' && data !== null) {
        data = [data];
      } else {
        return null;
      }
    }

    return data.map((item: any) => {
      // Post-process receipt items for each extracted item
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
  } catch (e) {
    console.error("Analysis failed", e);
    return null;
  }
};
