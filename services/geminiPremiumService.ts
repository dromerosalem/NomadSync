import { supabase } from "./supabaseClient";
import { ItineraryItem } from "../types";

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
    console.log(`[GeminiPremium] 💎 Using PREMIUM model: ${PREMIUM_MODEL} via Edge Function`);

    try {
        const { data, error } = await supabase.functions.invoke('analyze-receipt', {
            body: { 
                base64Data, 
                mimeType, 
                tripStartDate, 
                textInput, 
                model: 'premium' 
            }
        });

        if (error) {
            console.error("[GeminiPremium] Edge Function Error:", error);
            throw error;
        }

        if (data?.usage) {
            console.log(`[GeminiPremium] 📊 Token Usage:`, data.usage);
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        const items = data.items;
        const confidence = data.confidence || 0;

        // Convert string dates back to Date objects
        const processedItems: Partial<ItineraryItem>[] | null = items ? items.map((item: any) => ({
            ...item,
            startDate: item.startDate ? new Date(item.startDate) : undefined,
            endDate: item.endDate ? new Date(item.endDate) : undefined,
        })) : null;

        return { items: processedItems, confidence };

    } catch (e) {
        console.error("[GeminiPremium] ❌ Premium analysis failed", e);
        return { items: null, confidence: 0 };
    }
};
