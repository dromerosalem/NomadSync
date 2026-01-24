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

export const analyzeReceiptWithGroq = async (base64Data: string, mimeType: string, tripStartDate?: Date, textInput?: string): Promise<{ items: Partial<ItineraryItem>[], confidence: number }> => {
    try {
        const groq = getGroqClient();
        if (!groq) return { items: [], confidence: 0 };

        const contextPrompt = tripStartDate
            ? `CONTEXT: The trip starts on ${tripStartDate.toISOString().split('T')[0]}. Use this year.`
            : `CONTEXT: Use current year.`;

        const promptInstructions = `
        TASK: Parse the travel document into a JSON ARRAY of objects.
        
        **MULTI-ITEM EXTRACTION**: 
        - If the document contains multiple distinct events (e.g. Outbound + Return Flight), extract EACH as a separate object.
        - **SAME EVENT, MULTIPLE TICKETS**: If the document contains multiple tickets/guests for the SAME event (e.g. 2 concert tickets, 2 passengers), return ONE object representing the entire order. 
        - The 'cost' field must represent the **TOTAL ORDER AMOUNT** (Sum of all tickets + fees).
        - Detail the breakdown (unit price x quantity) in the 'details' string and 'receiptItems' array.

        **CRITICAL RULES FOR NUMBERS & CURRENCY**:
        1. **TRANSCRIBE EXACTLY**: Do NOT divide values by 100 or 10.
        2. **CURRENCY**: For CRC, JPY, KRW, numbers are large. 6000 is 6000, NOT 60.
        3. **SANITY CHECK**: Sum of item prices MUST ≈ Total Cost.

        **TAX HANDLING (CRITICAL)**:
        - **DO NOT EXTRACT TAX SUMMARIES AS ITEMS**: Lines like "VAT 20%", "PTU A 23%", "Taxable Base", "Gross Amount", "Net Amount", "Subtotal" MUST NOT be included in the 'receiptItems' array.
        - **ONLY BILLABLE ITEMS**: 'receiptItems' should only contain physical goods (food, drink, tickets) or valid surcharges (Service Charge, Delivery Fee).
        - **TAX IS NOT AN ITEM**: Taxes are part of the cost, not a separate line item to be split.

        required JSON Structure:
        [
            {
                "type": "STAY" | "TRANSPORT" | "ACTIVITY" | "FOOD" | "ESSENTIALS",
                "title": "Vendor/Event Name",
                "location": "City/Address",
                "startDate": "YYYY-MM-DDTHH:mm",
                "cost": 0.0, // TOTAL order amount.
                "currencyCode": "String",
                "details": "Pedantic, rich multiline summary: include Order #, Unit Prices, specific Guest Names, Venue Address, Gate/Seat info, and any unique metadata found.",
                "durationMinutes": 0,
                "receiptItems": [
                    { "name": "String", "quantity": 1, "price": 0.0, "type": "ticket" | "food" | "drink" | "service" | "tax" }
                ]
            }
        ]
        `;

        const prompt = `${contextPrompt}\n${promptInstructions}`;

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
        if (!content) return { items: [], confidence: 0 };

        let data = JSON.parse(content);

        // Handle if API returns wrapped object { "items": [...] } or just [...] or just {...}
        if (data.items && Array.isArray(data.items)) {
            data = data.items;
        } else if (!Array.isArray(data)) {
            data = [data];
        }

        const items: Partial<ItineraryItem>[] = data.map((d: any) => ({
            type: d.type,
            title: d.title,
            location: d.location || d.title,
            cost: d.cost,
            currencyCode: d.currencyCode,
            details: d.details,
            startDate: d.startDate ? new Date(d.startDate) : undefined,
            receiptItems: Array.isArray(d.receiptItems) ? d.receiptItems.map((ri: any) => ({
                ...ri,
                id: crypto.randomUUID(),
                assignedTo: []
            })) : []
        }));

        // Basic confidence heuristic: Did we get a title and cost on the first item?
        let confidence = 0.5;
        if (items.length > 0) {
            if (items[0].title && items[0].cost) confidence += 0.3;
            if (items[0].receiptItems && items[0].receiptItems.length > 0) confidence += 0.15;
        }

        return { items, confidence };

    } catch (error) {
        console.error("Groq Analysis Failed:", error);
        return { items: [], confidence: 0 };
    }
};
