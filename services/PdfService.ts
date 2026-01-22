import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to CDN or local file. 
// For Vite, it's often easiest to point to a CDN to avoid complex build config, 
// or import the worker entry point if configured. 
// We'll use the CDN matching the installed version for simplicity in this setup.
// Use unpkg which is generally more reliable for specific package versions matching npm
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const extractTextFromPdf = async (base64Data: string): Promise<string> => {
    try {
        // Fix: atob might fail if there are newlines/spaces in base64 string
        const cleanBase64 = base64Data.replace(/[\n\r]/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        let fullText = '';

        // Limit to first 2 pages to save time/tokens if multi-page
        const maxPages = Math.min(pdf.numPages, 2);

        for (let i = 1; i <= maxPages; i++) {
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
        return ""; // Fallback to empty string (Orchestrator can fallback to Vision if empty)
    }
};
