import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to CDN or local file. 
// For Vite, it's often easiest to point to a CDN to avoid complex build config, 
// or import the worker entry point if configured. 
// We'll use the CDN matching the installed version for simplicity in this setup.
// Use unpkg which is generally more reliable for specific package versions matching npm
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_PAGES = 5;
const BOOK_DENSITY_THRESHOLD = 3000; // Characters per page threshold for "dense text"

export interface PdfSecurityCheck {
    isSafe: boolean;
    error?: string;
    pageCount: number;
    textDensity: number;
}

export const analyzePdfSecurity = async (base64Data: string): Promise<PdfSecurityCheck> => {
    try {
        const cleanBase64 = base64Data.replace(/[\n\r]/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (pdf.numPages > MAX_PAGES) {
            return {
                isSafe: false,
                error: `PDF has ${pdf.numPages} pages. Maximum allowed is ${MAX_PAGES}. Please split the document.`,
                pageCount: pdf.numPages,
                textDensity: 0
            };
        }

        // Density Check on first page
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        const charCount = pageText.length;

        if (charCount > BOOK_DENSITY_THRESHOLD) {
            return {
                isSafe: false,
                error: `Document is too dense (${charCount} chars/page). Looks like a book/manual. Please upload a receipt.`,
                pageCount: pdf.numPages,
                textDensity: charCount
            };
        }

        return { isSafe: true, pageCount: pdf.numPages, textDensity: charCount };

    } catch (error) {
        console.error("PDF Security Check Failed:", error);
        // If we can't read it, it might be encrypted or corrupted -> Default to Safe but Empty?? 
        // No, fail safe.
        return { isSafe: false, error: "Could not read PDF structure.", pageCount: 0, textDensity: 0 };
    }
}

export const extractTextFromPdf = async (base64Data: string): Promise<string> => {
    try {
        const cleanBase64 = base64Data.replace(/[\n\r]/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        let fullText = '';
        const limit = Math.min(pdf.numPages, MAX_PAGES); // We enforce limit in security check, but clamp here too

        for (let i = 1; i <= limit; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n`;
        }

        return fullText;
    } catch (error) {
        console.error("PDF Text Extraction Failed:", error);
        return "";
    }
};
