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
        // 1. Determine Model (Round Robin)
        // Even = Gemini, Odd = Groq
        const currentCount = parseInt(localStorage.getItem(STORAGE_KEY_SCAN_COUNT) || '0', 10);
        let primaryModel: ModelType = currentCount % 2 === 0 ? 'GEMINI' : 'GROQ';

        let extractedText: string | undefined = undefined;

        // PDF OPTIMIZATION: Extract text client-side
        if (mimeType === 'application/pdf') {
            console.log('[ScanOrchestrator] PDF detected. Extracting text for optimization...');
            try {
                const { extractTextFromPdf } = await import('./PdfService');
                extractedText = await extractTextFromPdf(base64Data);
                console.log(`[ScanOrchestrator] Extracted ${extractedText.length} chars from PDF.`);
            } catch (err) {
                console.error('[ScanOrchestrator] PDF Text extraction failed, falling back to binary/vision', err);
                // If extraction fails, we MUST fallback to Gemini for PDFs as Groq can't handle PDF binary
                primaryModel = 'GEMINI';
            }
        }

        console.log(`[ScanOrchestrator] Scan #${currentCount}. Selected Primary: ${primaryModel}`);

        let result: ScanResult = await this.executeScan(primaryModel, base64Data, mimeType, tripStartDate, extractedText);


        // 2. Check Confidence & Retry if needed
        if (result.confidence < CONFIDENCE_THRESHOLD || !result.item) {
            const secondaryModel: ModelType = primaryModel === 'GEMINI' ? 'GROQ' : 'GEMINI';
            console.warn(`[ScanOrchestrator] Low confidence (${result.confidence}). Retrying with ${secondaryModel}...`);

            // If primary was PDF and we failed, secondary (Groq) can ONLY work if we have text.
            // If we don't have text, Groq will fail on PDF binary.
            if (mimeType === 'application/pdf' && !extractedText && secondaryModel === 'GROQ') {
                console.warn('[ScanOrchestrator] Skipping retry on Groq because PDF binary is not supported without text extraction.');
            } else {
                const retryResult = await this.executeScan(secondaryModel, base64Data, mimeType, tripStartDate, extractedText);
                if (retryResult.confidence > result.confidence) {
                    result = retryResult;
                }
            }
        }

        // 3. Increment Counter & Return
        localStorage.setItem(STORAGE_KEY_SCAN_COUNT, (currentCount + 1).toString());
        return result.item;
    },

    async executeScan(model: ModelType, base64Data: string, mimeType: string, tripStartDate?: Date, extractedText?: string): Promise<ScanResult> {
        try {
            if (model === 'GEMINI') {
                const item = await analyzeWithGemini(base64Data, mimeType, tripStartDate, extractedText);
                // Gemini service doesn't return explicit confidence yet, so we infer high confidence if parsing succeeded
                const confidence = item ? 0.9 : 0;
                return { item, usedModel: 'GEMINI', confidence };
            } else {
                const { item, confidence } = await analyzeReceiptWithGroq(base64Data, mimeType, tripStartDate, extractedText);
                return { item, usedModel: 'GROQ', confidence };
            }
        } catch (e) {
            console.error(`[ScanOrchestrator] Error scanning with ${model}`, e);
            return { item: null, usedModel: model, confidence: 0 };
        }
    }
};
