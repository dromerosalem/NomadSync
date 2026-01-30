// Edge Function AI Service
// Proxies AI analysis requests to Supabase Edge Function
// All prompts and API keys are protected server-side

import { supabase } from './supabaseClient';
import { ItineraryItem } from '../types';

export type AIModel = 'lite' | 'premium' | 'maverick';

interface AnalysisResult {
    items: Partial<ItineraryItem>[] | null;
    confidence: number;
}

/**
 * Analyzes a receipt/document using server-side AI (Edge Function)
 * 
 * @param base64Data - Base64 encoded image/PDF data
 * @param mimeType - MIME type of the file
 * @param model - AI model to use: 'lite' (Gemini Lite), 'premium' (Gemini Flash), 'maverick' (Groq)
 * @param tripStartDate - Optional trip start date for context
 * @param textInput - Optional extracted text (for PDF optimization)
 */
export async function analyzeReceiptViaEdge(
    base64Data: string,
    mimeType: string,
    model: AIModel = 'lite',
    tripStartDate?: Date,
    textInput?: string
): Promise<AnalysisResult> {
    try {
        console.log(`[EdgeAIService] 🚀 Calling analyze-receipt Edge Function (model: ${model})`);

        const { data, error } = await supabase.functions.invoke('analyze-receipt', {
            body: {
                base64Data,
                mimeType,
                model,
                tripStartDate: tripStartDate?.toISOString().split('T')[0],
                textInput
            }
        });

        if (error) {
            console.error('[EdgeAIService] ❌ Edge Function error:', error);
            throw error;
        }

        if (!data) {
            console.warn('[EdgeAIService] ⚠️ No data returned from Edge Function');
            return { items: null, confidence: 0 };
        }

        // Process dates from ISO strings to Date objects
        // AND generate unique IDs for receiptItems (matching original service behavior)
        const processedItems = data.items?.map((item: any) => ({
            ...item,
            startDate: item.startDate ? new Date(item.startDate) : undefined,
            endDate: item.endDate ? new Date(item.endDate) : undefined,
            originalAmount: item.cost, // Ensure originalAmount is set
            // Generate unique IDs for each receiptItem (critical for React rendering)
            receiptItems: Array.isArray(item.receiptItems)
                ? item.receiptItems.map((ri: any) => ({
                    ...ri,
                    id: crypto.randomUUID(),  // Unique ID for React key prop
                    assignedTo: []            // Initialize empty assignment array
                }))
                : undefined
        })) || null;

        console.log(`[EdgeAIService] ✅ Received ${processedItems?.length || 0} items, confidence: ${(data.confidence * 100).toFixed(1)}%`);

        return {
            items: processedItems,
            confidence: data.confidence || 0
        };
    } catch (error) {
        console.error('[EdgeAIService] ❌ Analysis failed:', error);
        return { items: null, confidence: 0 };
    }
}

// Backward-compatible exports for existing code
export const analyzeReceipt = (
    base64Data: string,
    mimeType: string = 'image/jpeg',
    tripStartDate?: Date,
    textInput?: string
) => analyzeReceiptViaEdge(base64Data, mimeType, 'lite', tripStartDate, textInput);

export const analyzeReceiptWithGroq = (
    base64Data: string,
    mimeType: string,
    tripStartDate?: Date,
    textInput?: string
) => analyzeReceiptViaEdge(base64Data, mimeType, 'maverick', tripStartDate, textInput);

export const analyzeReceiptPremium = (
    base64Data: string,
    mimeType: string = 'image/jpeg',
    tripStartDate?: Date,
    textInput?: string
) => analyzeReceiptViaEdge(base64Data, mimeType, 'premium', tripStartDate, textInput);
