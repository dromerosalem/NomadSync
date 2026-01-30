import { supabase } from "./supabaseClient";
import { ItineraryItem } from "../types";

interface ScanResult {
  items: Partial<ItineraryItem>[] | null;
  confidence: number;
}

export const analyzeReceipt = async (base64Data: string, mimeType: string = "image/jpeg", tripStartDate?: Date, textInput?: string): Promise<ScanResult> => {
  try {
    console.log("[GeminiService] ⚡ Invoking 'analyze-receipt' Edge Function (Model: Lite)...");

    const { data, error } = await supabase.functions.invoke('analyze-receipt', {
      body: { 
        base64Data, 
        mimeType, 
        tripStartDate, 
        textInput, 
        model: 'lite' 
      }
    });

    if (error) {
      console.error("[GeminiService] Edge Function Error:", error);
      throw error;
    }

    if (data?.usage) {
        console.log(`[GeminiService] 📊 Token Usage:`, data.usage);
    }
    
    if (data?.error) {
        throw new Error(data.error);
    }

    const items = data.items;
    const confidence = data.confidence || 0;

    // Convert string dates back to Date objects if needed
    const processedItems: Partial<ItineraryItem>[] | null = items ? items.map((item: any) => ({
        ...item,
        startDate: item.startDate ? new Date(item.startDate) : undefined,
        endDate: item.endDate ? new Date(item.endDate) : undefined,
    })) : null;

    return { items: processedItems, confidence };

  } catch (e) {
    console.error("[GeminiService] Analysis failed", e);
    return { items: null, confidence: 0 };
  }
};
