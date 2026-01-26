import { analyzeReceipt as analyzeWithGemini } from './geminiService';
import { analyzeReceiptWithGroq } from './GroqService';
import { analyzeReceiptPremium } from './geminiPremiumService';
import { ItineraryItem } from '../types';
import { UploadSecurityService } from './UploadSecurityService';

const STORAGE_KEY_SCAN_COUNT = 'nomadsync_scan_count';
const CONFIDENCE_THRESHOLD = 0.90; // High threshold for financial accuracy
const MAX_RETRIES = 3;

type ModelType = 'GEMINI' | 'GROQ' | 'GEMINI_PREMIUM';

interface ScanResult {
    items: Partial<ItineraryItem>[] | null;
    usedModel: ModelType;
    confidence: number;
}

export const scanOrchestrator = {
    async scanReceipt(base64Data: string, mimeType: string, tripStartDate?: Date, onStatusChange?: (status: string) => void): Promise<Partial<ItineraryItem>[] | null> {
        // 1. Determine Initial Model (Round Robin)
        const currentCount = parseInt(localStorage.getItem(STORAGE_KEY_SCAN_COUNT) || '0', 10);
        let currentModel: ModelType = currentCount % 2 === 0 ? 'GEMINI' : 'GROQ';

        let extractedText: string | undefined = undefined;

        // PDF OPTIMIZATION: Extract text client-side
        if (mimeType === 'application/pdf') {
            console.log('[ScanOrchestrator] PDF detected. Extracting text for optimization...');
            try {
                const { extractTextFromPdf } = await import('./PdfService');
                extractedText = await extractTextFromPdf(base64Data);
                console.log(`[ScanOrchestrator] Extracted ${extractedText.length} chars from PDF.`);
            } catch (err) {
                console.error('[ScanOrchestrator] PDF Text extraction failed, falling back to Gemini', err);
                currentModel = 'GEMINI';
            }
        }

        // SECURITY CHECK: Token Budget
        const tokenCheck = UploadSecurityService.checkTokenBudget(extractedText?.length || 0, mimeType.startsWith('image/'));
        if (!tokenCheck.isValid) {
            console.warn('[ScanOrchestrator] Token Budget Exceeded:', tokenCheck.error);
            alert(tokenCheck.error || "Document is too complex for AI processing.");
            return null;
        }

        console.log(`[ScanOrchestrator] Scan #${currentCount}. Primary model: ${currentModel}`);
        console.log(`[ScanOrchestrator] 🎯 Confidence threshold: ${CONFIDENCE_THRESHOLD}, Max retries: ${MAX_RETRIES}`);

        // 2. Retry Loop with Alternating Models (Lite models only)
        let bestResult: ScanResult = { items: null, usedModel: currentModel, confidence: 0 };

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`[ScanOrchestrator] 🔄 Attempt ${attempt}/${MAX_RETRIES} using ${currentModel}...`);

            const result = await this.executeScan(currentModel, base64Data, mimeType, tripStartDate, extractedText);

            // Log confidence for tracking
            console.log(`[ScanOrchestrator] 📊 Confidence: ${(result.confidence * 100).toFixed(1)}% (Model: ${result.usedModel})`);

            // Keep track of best result
            if (result.confidence > bestResult.confidence) {
                bestResult = result;
                console.log(`[ScanOrchestrator] ✅ New best result: ${(bestResult.confidence * 100).toFixed(1)}%`);
            }

            // Check if we've met the threshold
            if (bestResult.confidence >= CONFIDENCE_THRESHOLD) {
                console.log(`[ScanOrchestrator] 🎉 Confidence threshold met! Using ${bestResult.usedModel} result.`);
                break;
            }

            // Prepare for next attempt with alternate model
            if (attempt < MAX_RETRIES) {
                // Skip Groq for PDF if no extracted text (Groq can't handle binary PDFs)
                const nextModel: ModelType = currentModel === 'GEMINI' ? 'GROQ' : 'GEMINI';
                if (mimeType === 'application/pdf' && !extractedText && nextModel === 'GROQ') {
                    console.warn('[ScanOrchestrator] ⚠️ Skipping Groq retry - PDF binary not supported without text extraction');
                    // Stay on Gemini for another attempt
                } else {
                    currentModel = nextModel;
                }
                console.log(`[ScanOrchestrator] ⏳ Below threshold (${(bestResult.confidence * 100).toFixed(1)}% < ${CONFIDENCE_THRESHOLD * 100}%). Retrying with ${currentModel}...`);
            }
        }

        // 3. PREMIUM FALLBACK: If after 3 attempts we still haven't met threshold
        if (bestResult.confidence < CONFIDENCE_THRESHOLD) {
            console.warn(`[ScanOrchestrator] ⚠️ All ${MAX_RETRIES} lite model attempts failed (best: ${(bestResult.confidence * 100).toFixed(1)}%).`);
            console.log(`[ScanOrchestrator] 💎 Activating PREMIUM backup model (Gemini 2.5 Flash)...`);

            if (onStatusChange) {
                onStatusChange('PREMIUM_FALLBACK');
            }

            const premiumResult = await this.executeScan('GEMINI_PREMIUM', base64Data, mimeType, tripStartDate, extractedText);

            console.log(`[ScanOrchestrator] 💎 Premium result: ${(premiumResult.confidence * 100).toFixed(1)}% confidence`);

            if (premiumResult.confidence > bestResult.confidence) {
                bestResult = premiumResult;
                console.log(`[ScanOrchestrator] 💎 Premium model provided better result! Using it.`);
            } else {
                console.log(`[ScanOrchestrator] 💎 Premium model did not improve. Keeping best lite result.`);
            }
        }

        // 4. Final result logging
        if (bestResult.confidence < CONFIDENCE_THRESHOLD) {
            console.warn(`[ScanOrchestrator] ⚠️ Final confidence ${(bestResult.confidence * 100).toFixed(1)}% still below threshold. Using best available result.`);
        } else {
            console.log(`[ScanOrchestrator] ✅ Final result: ${(bestResult.confidence * 100).toFixed(1)}% confidence from ${bestResult.usedModel}`);
        }

        // 5. Increment Counter & Return
        localStorage.setItem(STORAGE_KEY_SCAN_COUNT, (currentCount + 1).toString());
        return bestResult.items;
    },

    async executeScan(model: ModelType, base64Data: string, mimeType: string, tripStartDate?: Date, extractedText?: string): Promise<ScanResult> {
        try {
            if (model === 'GEMINI') {
                const { items, confidence } = await analyzeWithGemini(base64Data, mimeType, tripStartDate, extractedText);
                console.log(`[ScanOrchestrator] 🔮 Gemini Lite returned: ${items?.length || 0} items, confidence: ${(confidence * 100).toFixed(1)}%`);
                return { items, usedModel: 'GEMINI', confidence };
            } else if (model === 'GEMINI_PREMIUM') {
                const { items, confidence } = await analyzeReceiptPremium(base64Data, mimeType, tripStartDate, extractedText);
                console.log(`[ScanOrchestrator] 💎 Gemini Premium returned: ${items?.length || 0} items, confidence: ${(confidence * 100).toFixed(1)}%`);
                return { items, usedModel: 'GEMINI_PREMIUM', confidence };
            } else {
                const { items, confidence } = await analyzeReceiptWithGroq(base64Data, mimeType, tripStartDate, extractedText);
                console.log(`[ScanOrchestrator] 🦙 Groq/Maverick returned: ${items?.length || 0} items, confidence: ${(confidence * 100).toFixed(1)}%`);
                return { items, usedModel: 'GROQ', confidence };
            }
        } catch (e) {
            console.error(`[ScanOrchestrator] ❌ Error scanning with ${model}`, e);
            return { items: null, usedModel: model, confidence: 0 };
        }
    }
};
