import { GoogleGenAI } from "@google/genai";
import { ItineraryItem, ItemType } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateMissionSuggestions = async (
  destination: string
): Promise<{ items: Partial<ItineraryItem>[], rawText: string }> => {
  try {
    const modelId = "gemini-2.5-flash"; // Required for Maps grounding

    // We ask for a structured-like text response because responseSchema 
    // is not supported with googleMaps tool.
    const prompt = `
      I am planning a trip to ${destination}. 
      Identify 3 top-rated, specific places to visit or stay (hotels, landmarks, or restaurants).
      
      For each place, provide:
      1. Name
      2. Type (Accommodation, Transport, Activity, or Food)
      3. A short one-sentence description.
      
      Make sure the places are real and use Google Maps to verify.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text || "";

    // Process Grounding Metadata to get map links
    // The structure returned by the SDK for grounding chunks varies, we try to extract useful info
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const suggestedItems: Partial<ItineraryItem>[] = [];

    // Simple heuristic parser since we can't use JSON schema with Maps tool yet
    // We rely on the grounding chunks to be the source of truth for "Real" places

    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri) return; // Skip web search results, we want maps

      const mapData = chunk.web?.uri ? null : (chunk.map || chunk.maps); // SDK structure variation handling

      // If we found a map entity
      if (chunk.source?.title || (mapData && mapData.title)) {
        const title = chunk.source?.title || mapData?.title || "Unknown Location";
        const uri = chunk.source?.uri || mapData?.uri || "";

        // Heuristic to guess type based on title (very basic, but sufficient for demo)
        let type = ItemType.ACTIVITY;
        if (title.toLowerCase().includes('hotel') || title.toLowerCase().includes('resort')) type = ItemType.STAY;
        else if (title.toLowerCase().includes('restaurant') || title.toLowerCase().includes('cafe')) type = ItemType.FOOD;

        suggestedItems.push({
          title: title,
          location: title, // Use title as location for now
          type: type,
          mapUri: uri,
          details: "Intelligence retrieved via satellite scan.",
          startDate: new Date() // Default to today, user assigns later
        });
      }
    });

    return {
      items: suggestedItems,
      rawText: text
    };

  } catch (error) {
    console.error("Gemini Mission Intel Error:", error);
    return { items: [], rawText: "Communication disrupted." };
  }
};

export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date): Promise<Partial<ItineraryItem> | null> => {
  try {
    const modelId = "gemini-2.5-flash";

    const contextPrompt = tripStartDate
      ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
      : `CONTEXT: Use the current year for any ambiguous dates.`;

    const prompt = `
       ${contextPrompt}
       Analyze this image or document (invoice, receipt, ticket, or booking confirmation).
       Extract the relevant travel itinerary details into a JSON Object.
       
       MANDATORY: Return a SINGLE JSON Object.
       
       For RECEIPTS/INVOICES (Food, Shopping, Services):
       1. Extract individual line items into a 'receiptItems' array.
       2. For EACH item, provide:
          - name: The item name EXACTLY as it appears on the document (e.g. in Chinese, Cyrillic, etc).
          - nameRomanized: If the 'name' is in a non-latin script (Chinese, Japanese, Russian, etc.), provide the phonetic transliteration in Latin characters (e.g. Pinyin for Chinese). Leave null if already in Latin script.
          - nameEnglish: If the 'name' is not in English, provide an accurate English translation.
          - quantity: Number of units (default to 1)
          - price: Total price for this line item
          - type: 'food' | 'drink' | 'service' | 'tip' | 'tax' | 'other'
       3. If taxes are included in item prices, DO NOT extract them as separate items. Only extract 'tax' if it is a separate line item added to the subtotal.
       4. Extract the 'total' amount.
       
       For TRANSPORT/TICKETS:
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
