
import { GoogleGenAI } from "@google/genai";
import { PriceData, OHLCData, NewsItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const fetchLivePrices = async (): Promise<PriceData> => {
  try {
    const prompt = `
      Şu anki güncel finansal verileri ve son 24 saatlik değişim yüzdelerini (%) bul:
      1. Ons Altın (XAU/USD) ($) ve 24s Değişim %
      2. Ons Gümüş (XAG/USD) ($) ve 24s Değişim %
      3. Dolar/TL (USD/TRY) ve 24s Değişim %
      4. Euro/TL (EUR/TRY) ve 24s Değişim %
      5. Bitcoin (BTC/USD) ($) ve 24s Değişim %
      6. Ethereum (ETH/USD) ($) ve 24s Değişim %
      
      Yanıtını şu JSON formatında ver: 
      {
        "ounce": 0.0, "ounce_chg": 0.0,
        "silver_ounce": 0.0, "silver_chg": 0.0,
        "usdTry": 0.0, "usdTry_chg": 0.0,
        "eurTry": 0.0, "eurTry_chg": 0.0,
        "btc": 0.0, "btc_chg": 0.0,
        "eth": 0.0, "eth_chg": 0.0
      }.
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
    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("Veri formatı anlaşılamadı.");
    
    const parsed = JSON.parse(jsonMatch[0]);
    const usdTry = parseFloat(parsed.usdTry);
    
    const gramGold = (parseFloat(parsed.ounce) / 31.1035) * usdTry;
    const gramSilver = (parseFloat(parsed.silver_ounce) / 31.1035) * usdTry;

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Kaynak",
      uri: chunk.web?.uri || "#"
    })) || [];

    return {
      ouncePrice: parseFloat(parsed.ounce),
      ounceChange: parseFloat(parsed.ounce_chg),
      usdTryRate: usdTry,
      usdTryChange: parseFloat(parsed.usdTry_chg),
      eurTryRate: parseFloat(parsed.eurTry),
      eurTryChange: parseFloat(parsed.eurTry_chg),
      gramPrice: gramGold,
      gramChange: parseFloat(parsed.ounce_chg) + parseFloat(parsed.usdTry_chg),
      silverPrice: gramSilver,
      silverChange: parseFloat(parsed.silver_chg) + parseFloat(parsed.usdTry_chg),
      btcPrice: parseFloat(parsed.btc) * usdTry,
      btcChange: parseFloat(parsed.btc_chg),
      ethPrice: parseFloat(parsed.eth) * usdTry,
      ethChange: parseFloat(parsed.eth_chg),
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      sources
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    throw error;
  }
};

export const fetchMarketNews = async (): Promise<NewsItem[]> => {
  try {
    const prompt = `Dünya piyasaları ile ilgili son 24 saatteki en önemli haberleri bul. JSON: [{"title": "...", "snippet": "...", "url": "...", "source": "...", "date": "..."}]`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const jsonMatch = response.text?.match(/\[.*\]/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (err) {
    return [];
  }
};

export const chatWithAI = async (message: string, history: any[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: "Sen profesyonel bir finans analizcisisin. Yatırım tavsiyesi vermediğini her zaman hatırlat.",
      tools: [{ googleSearch: {} }]
    }
  });
  return response.text;
};

export const generateMockOHLC = (currentPrice: number): OHLCData[] => {
  const data: OHLCData[] = [];
  const now = new Date();
  for (let i = 14; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const base = currentPrice + (Math.random() - 0.5) * 100;
    const open = base + (Math.random() - 0.5) * 20;
    const close = base + (Math.random() - 0.5) * 20;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    data.push({
      date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      open, high, low, close
    });
  }
  return data;
};
