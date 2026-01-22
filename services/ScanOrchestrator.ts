import { analyzeReceipt as analyzeWithGemini } from './geminiService';
import { analyzeReceiptWithGroq } from './GroqService';
import { ItineraryItem } from '../types';

const STORAGE_KEY_SCAN_COUNT = 'nomadsync_scan_count';
const CONFIDENCE_THRESHOLD = 0.7;

type ModelType = 'GEMINI' | 'GROQ';

interface ScanResult {
    item: Partial<ItineraryItem> | null;
    usedModel: ModelType;
    confidence: number;
}

export const scanOrchestrator = {
    async scanReceipt(base64Data: string, mimeType: string, tripStartDate?: Date): Promise<Partial<ItineraryItem> | null> {
        // 1. Determine Model (Round Robin)
        // Even = Gemini, Odd = Groq
        const currentCount = parseInt(localStorage.getItem(STORAGE_KEY_SCAN_COUNT) || '0', 10);
        const primaryModel: ModelType = currentCount % 2 === 0 ? 'GEMINI' : 'GROQ';

        console.log(`[ScanOrchestrator] Scan #${currentCount}. Selected Primary: ${primaryModel}`);

        let result: ScanResult = await this.executeScan(primaryModel, base64Data, mimeType, tripStartDate);

        // 2. Check Confidence & Retry if needed
        if (result.confidence < CONFIDENCE_THRESHOLD || !result.item) {
            const secondaryModel: ModelType = primaryModel === 'GEMINI' ? 'GROQ' : 'GEMINI';
            console.warn(`[ScanOrchestrator] Low confidence (${result.confidence}). Retrying with ${secondaryModel}...`);

            const retryResult = await this.executeScan(secondaryModel, base64Data, mimeType, tripStartDate);

            // If retry is better, use it
            if (retryResult.confidence > result.confidence) {
                result = retryResult;
            }
        }

        // 3. Increment Counter & Return
        localStorage.setItem(STORAGE_KEY_SCAN_COUNT, (currentCount + 1).toString());
        return result.item;
    },

    async executeScan(model: ModelType, base64Data: string, mimeType: string, tripStartDate?: Date): Promise<ScanResult> {
        try {
            if (model === 'GEMINI') {
                const item = await analyzeWithGemini(base64Data, mimeType, tripStartDate);
                // Gemini service doesn't return explicit confidence yet, so we infer high confidence if parsing succeeded
                const confidence = item ? 0.9 : 0;
                return { item, usedModel: 'GEMINI', confidence };
            } else {
                const { item, confidence } = await analyzeReceiptWithGroq(base64Data, tripStartDate);
                return { item, usedModel: 'GROQ', confidence };
            }
        } catch (e) {
            console.error(`[ScanOrchestrator] Error scanning with ${model}`, e);
            return { item: null, usedModel: model, confidence: 0 };
        }
    }
};
