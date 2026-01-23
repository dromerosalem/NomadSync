
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    isBook?: boolean;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;  // 10 MB

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/heic',
    'application/pdf'
]);

const BLOCKED_EXTENSIONS = [
    '.doc', '.docx', '.epub', '.txt', '.rtf', '.zip', '.rar'
];

export class UploadSecurityService {

    /**
     * Validates a file against hard limits (Size, Type, Extension).
     * Does NOT perform deep content analysis (PDF text density, etc.) - that happens later.
     */
    static validateFile(file: File): ValidationResult {
        // 1. MIME Type Check
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            // Check if it's a specifically blocked type for a specific error
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (BLOCKED_EXTENSIONS.includes(ext)) {
                return { isValid: false, error: "Documents like Word, Text, or Archives are not supported. Please upload a PDF or Image." };
            }
            return { isValid: false, error: `Unsupported file type: ${file.type}. Please use JPG, PNG, HEIC, or PDF.` };
        }

        // 2. Size Checks
        if (file.type === 'application/pdf') {
            if (file.size > MAX_PDF_SIZE_BYTES) {
                return { isValid: false, error: "PDF is too large (Max 10MB). Please compress it or split it." };
            }
        } else {
            // Images
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                return { isValid: false, error: "Image is too large (Max 8MB). Try taking a lower resolution photo." };
            }
        }

        return { isValid: true };
    }

    /**
     * Checks if a user is trying to upload a book or manual based on file metadata.
     * Deep inspection happens in PdfService, this is a preliminary check.
     */
    static preliminaryAbuseCheck(file: File): ValidationResult {
        const name = file.name.toLowerCase();

        // Obvious keywords in filename
        if (name.includes('manual') || name.includes('handbook') || name.includes('textbook')) {
            return { isValid: false, error: "It looks like you're trying to upload a manual. We only support travel receipts and tickets.", isBook: true };
        }

        return { isValid: true };
    }

    /**
     * Estimates the token count for a given input.
     * Heuristics:
     * - Text: ~1 token per 4 chars
     * - Image: ~258 tokens (Gemini standard) or ~1000 (Safe buffer for others)
     */
    static estimateTokens(textLength: number, hasImage: boolean): number {
        const textTokens = Math.ceil(textLength / 4);
        const imageTokens = hasImage ? 300 : 0; // Gemnini uses ~258. Be conservative.
        return textTokens + imageTokens;
    }

    /**
     * Checks if the estimated cost exceeds our safety budget.
     * Max Budget: 25,000 Input Tokens (Soft Limit)
     */
    static checkTokenBudget(textLength: number, hasImage: boolean): ValidationResult {
        const MAX_TOKEN_BUDGET = 25000;
        const estimated = this.estimateTokens(textLength, hasImage);

        if (estimated > MAX_TOKEN_BUDGET) {
            return {
                isValid: false,
                error: `Upload is too large (Est. ${estimated} tokens). Please upload a smaller document.`,
                isBook: true // Effectively treating massive text as a "book"
            };
        }
        return { isValid: true };
    }
}
