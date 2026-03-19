import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export interface OrderItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface OrderData {
  orderNumber: string;
  clientName: string;
  orderDate: string;
  deliveryDate: string;
  seller: string;
  manufacturingDays: number;
  printDate?: string;
  items: OrderItem[];
}

export async function extractOrderData(base64Pdf: string): Promise<OrderData | null> {
  if (!apiKey) {
    console.error("ERRO: GEMINI_API_KEY não encontrada. Configure a variável de ambiente.");
    return null;
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              text: "Extract the following information from this Purchase Order (Pedido) PDF in JSON format:\n- orderNumber (Pedido Nº)\n- clientName (Informações do Cliente -> Name)\n- orderDate (Pedido - incluído em)\n- deliveryDate (Previsão de Faturamento)\n- seller (Vendedor)\n- printDate: Look for 'Gerado em' in the footer of the page (e.g., 'Gerado em 06/03/2026'). Extract only the date part.\n- manufacturingDays: Look for 'PRAZO PREVISTO DE FABRICAÇÃO' in 'Outras Informações'. Extract the maximum number of business days mentioned (e.g., if it says '20 A 25 DIAS UTEIS', return 25).\n- items: This is a list of products. For each product, extract:\n    * code: The first part of the 'Produto' column (usually a numeric or alphanumeric code like '1001', 'ARM-01', etc.).\n    * description: The rest of the 'Produto' column (the full name/description of the product).\n    * quantity: The numeric value in the 'Quant.' column.\n    * unit: The value in the 'Unit.' column (e.g., 'PC', 'UN', 'M').\n\nIMPORTANT: You MUST capture EVERY item listed in the products table. If there are 10 items, the 'items' array MUST have 10 objects. Return ONLY the JSON object.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            orderNumber: { type: Type.STRING },
            clientName: { type: Type.STRING },
            orderDate: { type: Type.STRING },
            deliveryDate: { type: Type.STRING },
            seller: { type: Type.STRING },
            printDate: { type: Type.STRING },
            manufacturingDays: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                },
                required: ["code", "description", "quantity"],
              },
            },
          },
          required: ["orderNumber", "clientName", "items", "manufacturingDays"],
        },
      },
    });

    if (!response.text) return null;
    console.log("Raw Gemini Response:", response.text);
    return JSON.parse(response.text) as OrderData;
  } catch (error) {
    console.error("Error extracting order data:", error);
    return null;
  }
}
