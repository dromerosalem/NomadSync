import Groq from 'groq-sdk';
import { ItineraryItem } from '../types';

const MODEL_ID = "meta-llama/llama-4-maverick-17b-128e-instruct";

let groqClient: Groq | null = null;

const getGroqClient = () => {
    if (groqClient) return groqClient;

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
        console.warn("Missing VITE_GROQ_API_KEY. Groq service will not work.");
        return null;
    }

    groqClient = new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
    return groqClient;
};

export const analyzeReceiptWithGroq = async (base64Data: string, mimeType: string, tripStartDate?: Date, textInput?: string): Promise<{ item: Partial<ItineraryItem> | null, confidence: number }> => {
    try {
        const groq = getGroqClient();
        if (!groq) return { item: null, confidence: 0 };

        const contextPrompt = tripStartDate
            ? `CONTEXT: The trip starts on ${tripStartDate.toISOString().split('T')[0]}. Use this year.`
            : `CONTEXT: Use current year.`;

        const prompt = `
        ${contextPrompt}
        Analyze this receipt image. Extract data into a VALID JSON Object. 
        CRITICAL: Do NOT return markdown formatting (no \`\`\`json). Just the raw JSON string.
        
        Rules:
        1. Ignore tax summaries/subtotals. Items include tax (Gross) unless it's clearly US style Net + Tax.
        2. Extract line items strictly.
        
        Required JSON Structure:
        {
            "type": "FOOD" | "TRANSPORT" | etc,
            "title": "Vendor Name",
            "cost": 0.00,
            "currencyCode": "USD",
            "startDate": "YYYY-MM-DDTHH:mm",
            "receiptItems": [
                { "name": "Item Name", "quantity": 1, "price": 0.00, "type": "food" }
            ]
        }
        `;

        const messageContent: any[] = [{ type: 'text', text: prompt }];

        if (textInput) {
            console.log("Using extracted text for Groq analysis");
            messageContent.push({ type: 'text', text: `\n\nRECEIPT TEXT_CONTENT:\n${textInput}` });
        } else {
            messageContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                }
            });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: messageContent as any
                }
            ],
            model: MODEL_ID,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) return { item: null, confidence: 0 };

        const data = JSON.parse(content);

        // Map to ItineraryItem
        const item: Partial<ItineraryItem> = {
            type: data.type,
            title: data.title,
            location: data.location || data.title,
            cost: data.cost,
            currencyCode: data.currencyCode,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            receiptItems: Array.isArray(data.receiptItems) ? data.receiptItems.map((ri: any) => ({
                ...ri,
                id: crypto.randomUUID(),
                assignedTo: []
            })) : []
        };

        // Basic confidence heuristic: Did we get a title and cost?
        let confidence = 0.5;
        if (item.title && item.cost) confidence += 0.3;
        if (item.receiptItems && item.receiptItems.length > 0) confidence += 0.15;

        return { item, confidence };

    } catch (error) {
        console.error("Groq Analysis Failed:", error);
        return { item: null, confidence: 0 };
    }
};
