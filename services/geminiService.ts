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

export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date): Promise<Partial<ItineraryItem>[] | null> => {
  try {
    const modelId = "gemini-2.5-flash";

    const contextPrompt = tripStartDate
      ? `CONTEXT: The trip is scheduled to start on ${tripStartDate.toISOString().split('T')[0]}. Use this year (and subsequent year if dates cross year boundary) to correctly infer the year of any dates found in the document.`
      : `CONTEXT: Use the current year for any ambiguous dates.`;

    const prompt = `
       ${contextPrompt}
       Analyze this image or document (invoice, receipt, ticket, or booking confirmation).
       Extract the relevant travel itinerary details into a JSON Array of objects.
       
       If the document contains multiple distinct events (e.g., a round-trip flight with two legs, a hotel booking plus a flight, or multiple train tickets), create a separate object for each event.
       
       For TRANSPORT (Flights/Trains):
       1. Look for 'Travel Time' or 'Duration' text (e.g., '8 h 29 m'). Calculate total minutes and include as 'durationMinutes'. This is critical for accurate timelines.
       2. Extract the LOCAL dates and times as printed on the ticket. Return them in ISO 8601 format (YYYY-MM-DDTHH:mm) WITHOUT timezone offsets (e.g. do not use 'Z' or '-06:00'). We want the "Wall Clock" time at the location.
       
       Each object in the array should have these fields:
       - type: One of "STAY", "TRANSPORT", "ACTIVITY", "FOOD", "ESSENTIALS". Use "ESSENTIALS" for groceries, pharmacy, or general supplies.
       - title: Name of the hotel, airline, restaurant, store or activity provider.
       - location: City, address, or airport code (Origin for transport).
       - endLocation: (Optional) Destination city/airport for TRANSPORT types.
       - startDate: Local ISO 8601 string (YYYY-MM-DDTHH:mm) with NO offset.
       - endDate: (Optional) Local ISO 8601 string with NO offset.
       - cost: Total amount as a number. Split total across items if appropriate (e.g. divide by 2) or assign to first item.
       - details: Notes, seat number, confirmation code, ticket number, or list of items purchased.
       - durationMinutes: (Number) Explicit duration in minutes if stated on document.
       
       Return strictly a JSON Array.
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

    const parsed = JSON.parse(text);

    // Ensure result is an array
    const dataArray = Array.isArray(parsed) ? parsed : [parsed];

    return dataArray.map((data: any) => ({
      type: data.type,
      title: data.title,
      location: data.location,
      endLocation: data.endLocation,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      cost: typeof data.cost === 'number' ? data.cost : (parseFloat(data.cost) || 0),
      details: typeof data.details === 'string' ? data.details : undefined,
      durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : undefined
    }));
  } catch (e) {
    console.error("Analysis failed", e);
    return null;
  }
};
