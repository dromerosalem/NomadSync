import { supabase } from "./supabaseClient";
import { ItineraryItem } from "../types";

export const analyzeReceiptWithGroq = async (base64Data: string, mimeType: string, tripStartDate?: Date, textInput?: string): Promise<{ items: Partial<ItineraryItem>[], confidence: number }> => {
    try {
        console.log("[GroqService] ⚡ Invoking 'analyze-receipt' Edge Function (Model: Maverick)...");

        const { data, error } = await supabase.functions.invoke('analyze-receipt', {
            body: { 
                base64Data, 
                mimeType, 
                tripStartDate, 
                textInput, 
                model: 'maverick' 
            }
        });

        if (error) {
            console.error("[GroqService] Edge Function Error:", error);
            throw error;
        }

        if (data?.usage) {
            console.log(`[GroqService] 📊 Token Usage:`, data.usage);
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        const items = data.items;
        const confidence = data.confidence || 0;

        // Convert string dates back to Date objects
        const processedItems: Partial<ItineraryItem>[] = items ? items.map((item: any) => ({
            ...item,
            startDate: item.startDate ? new Date(item.startDate) : undefined,
            endDate: item.endDate ? new Date(item.endDate) : undefined,
            receiptItems: Array.isArray(item.receiptItems) ? item.receiptItems.map((ri: any) => ({
                ...ri,
                // Ensure IDs are strings if not already (Edge function adds them, but good to be safe)
                id: ri.id || crypto.randomUUID(),
                assignedTo: ri.assignedTo || []
            })) : []
        })) : [];

        // Log reasoning if provided
        if (data.reasoning) {
            console.log(`[GroqService] 🧠 Model reasoning: ${data.reasoning} `);
        }

        return { items: processedItems, confidence };

    } catch (error) {
        console.error("[GroqService] Analysis Failed:", error);
        return { items: [], confidence: 0 };
    }
};
