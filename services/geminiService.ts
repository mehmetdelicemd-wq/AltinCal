
import { GoogleGenAI } from "@google/genai";
import { PriceData, HistoricalData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const fetchLivePrices = async (): Promise<PriceData> => {
  try {
    const prompt = `
      Şu anki güncel Ons Altın (XAU/USD) fiyatını ve Dolar/TL (USD/TRY) kurunu bul. 
      Lütfen sadece sayısal değerleri ver. 
      Yanıtını şu JSON formatında ver: {"ounce": 0.0, "usdTry": 0.0}.
      Güncel verileri bulmak için Google Search kullan.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    // Clean JSON string from potential markdown backticks
    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("Veri formatı anlaşılamadı.");
    
    const parsed = JSON.parse(jsonMatch[0]);
    const ounce = parseFloat(parsed.ounce);
    const usdTry = parseFloat(parsed.usdTry);
    
    // Gram Gold calculation: (Ounce / 31.1035) * USD/TRY
    const gram = (ounce / 31.1035) * usdTry;

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Kaynak",
      uri: chunk.web?.uri || "#"
    })) || [];

    return {
      ouncePrice: ounce,
      usdTryRate: usdTry,
      gramPrice: gram,
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      sources
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    throw error;
  }
};

export const generateMockHistory = (currentPrice: number): HistoricalData[] => {
  const data: HistoricalData[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    // Add some random volatility for visualization
    const variance = (Math.random() - 0.5) * 50; 
    data.push({
      date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      price: currentPrice + variance
    });
  }
  return data;
};
