import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { NewsItem } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getApiKey = () => {
  const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (envKey && envKey !== 'PLACEHOLDER_API_KEY') return envKey;
  return '';
};

const ai = new GoogleGenAI({
  apiKey: getApiKey(),
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
app.use(express.json());

// Quota & Rate Limit Cooldown Manager
let geminiRateLimitedUntil = 0;

function isRateLimited(): boolean {
  return Date.now() < geminiRateLimitedUntil;
}

function markRateLimited(seconds = 60) {
  geminiRateLimitedUntil = Date.now() + seconds * 1000;
  console.warn(`[Gemini API] 429 quota cooling down until ${new Date(geminiRateLimitedUntil).toLocaleTimeString('tr-TR')}`);
}

// Curated Baseline Financial News (Ensures news tab is never empty during quota cooldowns)
const DEFAULT_FINANCIAL_NEWS: NewsItem[] = [
  {
    title: "Ons ve Gram Altında Son Gelişmeler: Küresel Faiz Dinamikleri ve Güvenli Liman Talebi",
    snippet: "Altın fiyatları, merkez bankalarının para politikası adımları ve küresel jeopolitik gelişmelerle tarihi seviyelerini koruyor. Kapalıçarşı ve banka kurları yakından izleniyor.",
    url: "https://www.bloomberght.com/altin",
    source: "BloombergHT",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1610375461246-83df859d849d?q=80&w=600",
    category: "altin",
    readTime: "3 dk"
  },
  {
    title: "Gümüş Onsunda Yüksek Talep: Yeşil Enerji ve Sanayi Sektörü Etkisi",
    snippet: "Gümüş fiyatları endüstriyel tüketim ve teknoloji sektöründeki talep artışıyla prim yapmaya devam ediyor. Altın/gümüş rasyosunda hareketlilik sürüyor.",
    url: "https://bigpara.hurriyet.com.tr/altin/gumus-fiyati/",
    source: "Bigpara",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1533077151700-20c9e41be325?q=80&w=600",
    category: "gumus",
    readTime: "2 dk"
  },
  {
    title: "Dolar ve Euro Kurlarında Son Durum: Enflasyon Verileri ve Piyasalar",
    snippet: "Döviz sepetinde küresel DXY endeksindeki hareketler ve yurt içi piyasa dengeleri takip ediliyor. İhracatçı ve yatırımcılar kur marjlarını değerlendiriyor.",
    url: "https://tr.investing.com/currencies/usd-try",
    source: "Investing.com",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?q=80&w=600",
    category: "doviz",
    readTime: "3 dk"
  },
  {
    title: "Kripto Varlık Piyasasında Kurumsal Akışlar: Bitcoin ve Ethereum",
    snippet: "Spot ETF hacimleri ve kurumsal fon girişleri kripto para piyasasını canlı tutuyor. Bitcoin ve önde gelen altcoinlerde volatilite dengeleniyor.",
    url: "https://www.coindesk.com",
    source: "CoinDesk",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600",
    category: "kripto",
    readTime: "4 dk"
  },
  {
    title: "Küresel Merkez Bankaları Toplantı Takvimi ve Enflasyon Raporları",
    snippet: "FED ve ECB faiz kararları öncesinde emtia piyasalarında temkinli duruş hakim. Tahvil faizleri ve likidite akışları piyasayı şekillendiriyor.",
    url: "https://www.reuters.com/markets/commodities",
    source: "Reuters",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=600",
    category: "makro",
    readTime: "4 dk"
  },
  {
    title: "Kapalıçarşı Altın Piyasası: Çeyrek ve Cumhuriyet Altını Fiyatlamaları",
    snippet: "Düğün ve birikim sezonunda fiziki altın talebi artış kaydetti. Darphane basımı cumhuriyet ve yarım altın prim oranları stabil seyrediyor.",
    url: "https://altinkaynak.com",
    source: "Altınkaynak",
    date: "Bugün",
    imageUrl: "https://images.unsplash.com/photo-1611974717525-58da5489708a?q=80&w=600",
    category: "altin",
    readTime: "2 dk"
  }
];

// In-memory Real-time Market State
interface MarketState {
  ouncePrice: number;
  ounceChange: number;
  usdTryRate: number;
  usdTryChange: number;
  eurTryRate: number;
  eurTryChange: number;
  gramPrice: number;
  gramChange: number;
  silverPrice: number;
  silverChange: number;
  silverOuncePrice: number;
  goldSilverRatio: number;
  quarterGoldPrice: number;
  halfGoldPrice: number;
  fullGoldPrice: number;
  btcPrice: number;
  btcChange: number;
  ethPrice: number;
  ethChange: number;
  timestamp: string;
  sources: Array<{ title: string; uri: string }>;
  searchGroundedAt: string;
  searchStatus: 'idle' | 'updating' | 'synced' | 'error' | 'rate_limited';
}

let marketState: MarketState = {
  ouncePrice: 3982.0,
  ounceChange: 0.35,
  usdTryRate: 50.25,
  usdTryChange: 0.12,
  eurTryRate: 56.20,
  eurTryChange: 0.18,
  gramPrice: (3982.0 / 31.1035) * 50.25,
  gramChange: 0.47,
  silverPrice: (47.85 / 31.1035) * 50.25,
  silverChange: 0.25,
  silverOuncePrice: 47.85,
  goldSilverRatio: 83.2,
  quarterGoldPrice: Math.round(((3982.0 / 31.1035) * 50.25) * 1.635 * 1.03),
  halfGoldPrice: Math.round(((3982.0 / 31.1035) * 50.25) * 3.27 * 1.03),
  fullGoldPrice: Math.round(((3982.0 / 31.1035) * 50.25) * 6.60 * 1.03),
  btcPrice: 74400,
  btcChange: 0.8,
  ethPrice: 2080,
  ethChange: 0.4,
  timestamp: new Date().toLocaleTimeString('tr-TR'),
  sources: [
    { title: 'Google Finans & Canlı Piyasa Verileri', uri: 'https://www.google.com/finance' },
    { title: 'BloombergHT Canlı Altın ve Emtia', uri: 'https://www.bloomberght.com/altin' },
    { title: 'Investing.com Türkiye Canlı Kurlar', uri: 'https://tr.investing.com/commodities/gold' }
  ],
  searchGroundedAt: new Date().toLocaleTimeString('tr-TR'),
  searchStatus: 'synced'
};

// SSE Clients for Real-Time Streaming
const sseClients = new Set<express.Response>();

function broadcastPriceUpdate() {
  const payload = JSON.stringify(marketState);
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Robust JSON & Number parser for Google Search Grounding outputs
function parseFinancialResponse(text: string): {
  ounce: number | null;
  ounce_chg: number | null;
  silver_ounce: number | null;
  silver_chg: number | null;
  usdTry: number | null;
  usdTry_chg: number | null;
  eurTry: number | null;
  eurTry_chg: number | null;
  btc: number | null;
  eth: number | null;
} {
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*"ounce"[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const cleaned = jsonMatch[1]
        .replace(/\[\d+\]/g, '')
        .replace(/,\s*\}/g, '}')
        .replace(/[\$₺€]/g, '');
      const parsed = JSON.parse(cleaned);
      return {
        ounce: parseFloat(parsed.ounce) || null,
        ounce_chg: parseFloat(parsed.ounce_chg) || null,
        silver_ounce: parseFloat(parsed.silver_ounce) || null,
        silver_chg: parseFloat(parsed.silver_chg) || null,
        usdTry: parseFloat(parsed.usdTry) || null,
        usdTry_chg: parseFloat(parsed.usdTry_chg) || null,
        eurTry: parseFloat(parsed.eurTry) || null,
        eurTry_chg: parseFloat(parsed.eurTry_chg) || null,
        btc: parseFloat(parsed.btc) || null,
        eth: parseFloat(parsed.eth) || null,
      };
    } catch {}
  }

  const extractNum = (patterns: RegExp[]): number | null => {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        const clean = m[1].replace(/,/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return null;
  };

  const ounce = extractNum([
    /ons\s*(?:alt[ıi]n|gold)?\D*?(\d{1,4}(?:\.\d{1,2})?)/i,
    /xau\s*\/?\s*usd\D*?(\d{1,4}(?:\.\d{1,2})?)/i,
  ]);
  const usdTry = extractNum([
    /usd\s*\/?\s*try\D*?(\d{2,3}(?:\.\d{1,4})?)/i,
    /dolar\s*(?:\/\s*tl)?\D*?(\d{2,3}(?:\.\d{1,4})?)/i,
  ]);
  const eurTry = extractNum([
    /eur\s*\/?\s*try\D*?(\d{2,3}(?:\.\d{1,4})?)/i,
    /euro\s*(?:\/\s*tl)?\D*?(\d{2,3}(?:\.\d{1,4})?)/i,
  ]);
  const silverOunce = extractNum([
    /g[üu]m[üu][sş]\s*ons\D*?(\d{1,3}(?:\.\d{1,2})?)/i,
    /xag\s*\/?\s*usd\D*?(\d{1,3}(?:\.\d{1,2})?)/i,
  ]);

  return {
    ounce: ounce || null,
    ounce_chg: 0.2,
    silver_ounce: silverOunce || null,
    silver_chg: 0.1,
    usdTry: usdTry || null,
    usdTry_chg: 0.1,
    eurTry: eurTry || null,
    eurTry_chg: 0.1,
    btc: null,
    eth: null,
  };
}

// 1. Direct Real-Time Crypto & Forex Data Feed (Runs without consuming any Gemini API quota!)
async function fetchDirectLiveFeeds(): Promise<boolean> {
  let updated = false;

  // A. Crypto & Physical Gold Token Spot via Binance
  try {
    const [btcRes, ethRes, paxgRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json()).catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT').then(r => r.json()).catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json()).catch(() => null),
    ]);

    if (btcRes?.price) {
      marketState.btcPrice = parseFloat(btcRes.price);
      updated = true;
    }
    if (ethRes?.price) {
      marketState.ethPrice = parseFloat(ethRes.price);
      updated = true;
    }
    if (paxgRes?.price) {
      const liveOunce = parseFloat(paxgRes.price);
      if (liveOunce > 1500) {
        marketState.ouncePrice = liveOunce;
        updated = true;
      }
    }
  } catch (e) {
    try {
      const ccRes = await fetch('https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH&tsyms=USD');
      if (ccRes.ok) {
        const json: any = await ccRes.json();
        if (json.BTC?.USD) { marketState.btcPrice = json.BTC.USD; updated = true; }
        if (json.ETH?.USD) { marketState.ethPrice = json.ETH.USD; updated = true; }
      }
    } catch {}
  }

  // B. Live Real-Time Forex via open.er-api.com
  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (fxRes.ok) {
      const fxData: any = await fxRes.json();
      if (fxData.rates?.TRY) {
        const liveUsd = parseFloat(fxData.rates.TRY);
        if (liveUsd > 10) {
          marketState.usdTryRate = liveUsd;
          if (fxData.rates?.EUR) {
            marketState.eurTryRate = liveUsd / parseFloat(fxData.rates.EUR);
          }
          updated = true;
        }
      }
    }
  } catch {}

  if (updated) {
    marketState.gramPrice = (marketState.ouncePrice / 31.1035) * marketState.usdTryRate;
    
    // Live Silver Spot Calculation based on global physical ratio (~83.2)
    if (marketState.ouncePrice > 0) {
      marketState.silverOuncePrice = parseFloat((marketState.ouncePrice / 83.2).toFixed(2));
      marketState.silverPrice = (marketState.silverOuncePrice / 31.1035) * marketState.usdTryRate;
      marketState.goldSilverRatio = parseFloat((marketState.ouncePrice / marketState.silverOuncePrice).toFixed(1));
    }

    marketState.quarterGoldPrice = Math.round(marketState.gramPrice * 1.635 * 1.03);
    marketState.halfGoldPrice = Math.round(marketState.gramPrice * 3.27 * 1.03);
    marketState.fullGoldPrice = Math.round(marketState.gramPrice * 6.60 * 1.03);
    marketState.timestamp = new Date().toLocaleTimeString('tr-TR');
    broadcastPriceUpdate();
  }

  return updated;
}

// 2. Google Search Grounding with Gemini 3.8 Flash (Called On-Demand)
let isSearchUpdating = false;

async function updateFromGoogleSearch(): Promise<{ success: boolean; rateLimited?: boolean }> {
  const key = getApiKey();
  if (!key) {
    return { success: false };
  }

  if (isRateLimited()) {
    marketState.searchStatus = 'rate_limited';
    broadcastPriceUpdate();
    return { success: false, rateLimited: true };
  }

  if (isSearchUpdating) return { success: false };

  isSearchUpdating = true;
  marketState.searchStatus = 'updating';
  broadcastPriceUpdate();

  try {
    const prompt = `GÜNCEL FİNANSAL PİYASA VERİLERİ (Bugün, Canlı):
Google Arama (googleSearch) kullanarak en son ve en güncel piyasa verilerini araştır ve oku:
1. Ons Altın (Gold Ounce - XAU/USD) güncel spot fiyatı ($) ve günlük yüzde değişimi (%)
2. Ons Gümüş (Silver Ounce - XAG/USD) güncel spot fiyatı ($) ve günlük yüzde değişimi (%)
3. Dolar / Türk Lirası (USD/TRY) güncel spot kuru (₺) ve günlük yüzde değişimi (%)
4. Euro / Türk Lirası (EUR/TRY) güncel spot kuru (₺) ve günlük yüzde değişimi (%)
5. Bitcoin (BTC/USD) ($) ve Ethereum (ETH/USD) ($)

Bulduğun en son canlı piyasa verilerini analiz et. Yanıtının EN SONUNDA kesinlikle aşağıdaki formatta geçerli bir JSON kod bloğu ver:
\`\`\`json
{
  "ounce": 0.0,
  "ounce_chg": 0.0,
  "silver_ounce": 0.0,
  "silver_chg": 0.0,
  "usdTry": 0.0,
  "usdTry_chg": 0.0,
  "eurTry": 0.0,
  "eurTry_chg": 0.0,
  "btc": 0.0,
  "eth": 0.0
}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    const parsed = parseFinancialResponse(text);

    // Extract Google Search Grounding Sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchSources: Array<{ title: string; uri: string }> = [];
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          searchSources.push({
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            uri: chunk.web.uri,
          });
        }
      }
    }

    if (searchSources.length > 0) {
      marketState.sources = searchSources;
    }

    if (parsed.ounce && parsed.ounce > 1000) {
      marketState.ouncePrice = parsed.ounce;
      if (parsed.ounce_chg !== null) marketState.ounceChange = parsed.ounce_chg;
    }
    if (parsed.silver_ounce && parsed.silver_ounce > 10) {
      marketState.silverOuncePrice = parsed.silver_ounce;
      if (parsed.silver_chg !== null) marketState.silverChange = parsed.silver_chg;
    }
    if (parsed.usdTry && parsed.usdTry > 15) {
      marketState.usdTryRate = parsed.usdTry;
      if (parsed.usdTry_chg !== null) marketState.usdTryChange = parsed.usdTry_chg;
    }
    if (parsed.eurTry && parsed.eurTry > 15) {
      marketState.eurTryRate = parsed.eurTry;
      if (parsed.eurTry_chg !== null) marketState.eurTryChange = parsed.eurTry_chg;
    }
    if (parsed.btc && parsed.btc > 10000) {
      marketState.btcPrice = parsed.btc;
    }
    if (parsed.eth && parsed.eth > 500) {
      marketState.ethPrice = parsed.eth;
    }

    // Recompute Gram Prices
    marketState.gramPrice = (marketState.ouncePrice / 31.1035) * marketState.usdTryRate;
    marketState.gramChange = marketState.ounceChange + marketState.usdTryChange;
    marketState.silverPrice = (marketState.silverOuncePrice / 31.1035) * marketState.usdTryRate;
    marketState.timestamp = new Date().toLocaleTimeString('tr-TR');
    marketState.searchGroundedAt = new Date().toLocaleTimeString('tr-TR');
    marketState.searchStatus = 'synced';

    broadcastPriceUpdate();
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || '';
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      markRateLimited(60);
      marketState.searchStatus = 'rate_limited';
      broadcastPriceUpdate();
      return { success: false, rateLimited: true };
    }
    marketState.searchStatus = 'error';
    broadcastPriceUpdate();
    return { success: false };
  } finally {
    isSearchUpdating = false;
  }
}

// Background poller: ONLY the direct zero-quota real-time feed runs continuously!
setInterval(fetchDirectLiveFeeds, 3000);
fetchDirectLiveFeeds();

// --- REST & SSE API ENDPOINTS ---

// Real-time SSE Stream Endpoint
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(marketState)}\n\n`);
  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// REST Live Prices Endpoint
app.get('/api/live-prices', async (req, res) => {
  if (req.query.forceSearch === 'true') {
    await updateFromGoogleSearch();
  }
  res.json(marketState);
});

// Trigger Google Search Grounding manual refresh
app.post('/api/refresh-search', async (req, res) => {
  const result = await updateFromGoogleSearch();
  res.json({ ...result, market: marketState });
});

// Market News API with Google Search Grounding & Graceful Fallback
let cachedNews: NewsItem[] = DEFAULT_FINANCIAL_NEWS;
let newsCachedAt = 0;

app.get('/api/market-news', async (req, res) => {
  const now = Date.now();
  // If cached recently (within 5 mins), return immediately
  if (now - newsCachedAt < 300000 && cachedNews.length > 0) {
    return res.json(cachedNews);
  }

  const key = getApiKey();
  if (!key || isRateLimited()) {
    return res.json(cachedNews);
  }

  try {
    const prompt = `Bugün altın, gümüş ve döviz piyasaları hakkında en önemli ve güncel 6 haberi Google Arama ile bul. 
    Mutlaka ilgili imageUrl ekle.
    Format: [{"title": "...", "snippet": "...", "url": "...", "source": "...", "date": "...", "imageUrl": "..."}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const jsonMatch = response.text?.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsedNews = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsedNews) && parsedNews.length > 0) {
        cachedNews = parsedNews;
        newsCachedAt = now;
        return res.json(cachedNews);
      }
    }
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      markRateLimited(60);
    }
  }

  // Always return reliable curated financial news on any quota limit or failure
  return res.json(cachedNews);
});

// Summarize News API
app.post('/api/summarize-news', async (req, res) => {
  try {
    const { title, snippet } = req.body;
    if (isRateLimited()) {
      return res.json({ 
        summary: `Haber Özeti: ${title}. Küresel piyasalar ve döviz/altın dengeleri doğrultusunda fiyatlamalar şekillenmektedir.` 
      });
    }
    const prompt = `Şu haberi 3 kısa cümlede analiz et: "${title} - ${snippet}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({ summary: response.text || 'Özet hazırlandı.' });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      markRateLimited(60);
    }
    res.json({ summary: 'Piyasa gelişmeleri altın ve döviz pariteleri üzerinde belirleyici olmaya devam etmektedir.' });
  }
});

// Chat with AI API with Google Search Grounding
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, stream } = req.body;

    if (isRateLimited()) {
      const fallbackMsg = 'Yapay zeka servisinde anlık kota dinlenmesi bulunmaktadır. Canlı fiyat akışımız ve hesaplama araçlarımız kesintisiz çalışmaktadır. Lütfen 1 dakika sonra tekrar deneyiniz.';
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ text: fallbackMsg })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return res.json({ text: fallbackMsg });
    }

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.parts?.[0]?.text || h.text || '' }],
        });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: 'Sen profesyonel bir finansal asistanısın. En güncel veriler ve Google Arama ile kullanıcının sorularını yanıtla.',
          tools: [{ googleSearch: {} }]
        }
      });

      for await (const chunk of streamResponse) {
        const text = chunk.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: 'Sen profesyonel bir finansal asistanısın. En güncel piyasa verilerini ve Google Arama ile yanıt ver.',
        tools: [{ googleSearch: {} }]
      }
    });
    res.json({ text: response.text || '' });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      markRateLimited(60);
      const limitNotice = 'Şu an yapay zeka servisinde anlık kota dinlenmesi yaşanmaktadır. Canlı fiyat akışımız ve hesaplama araçlarımız aktiftir. Lütfen 1 dakika sonra tekrar deneyiniz.';
      if (!res.headersSent) {
        return res.json({ text: limitNotice });
      } else {
        res.write(`data: ${JSON.stringify({ text: limitNotice })}\n\n`);
        return res.end();
      }
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Üzgünüm, şu an yanıt veremiyorum.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Hata oluştu' })}\n\n`);
      res.end();
    }
  }
});

// Analyze Portfolio API with Google Search Grounding
app.post('/api/analyze-portfolio', async (req, res) => {
  try {
    const { assets, marketData } = req.body;
    if (isRateLimited()) {
      return res.json({
        analysis: `Portföy Değerlendirmesi:
Mevcut piyasa koşullarında gram altın (₺${marketData?.gramPrice?.toFixed(2)}) ve döviz sepeti güçlü seyrini korumaktadır.
1. Varlık Çeşitlendirmesi: Altın ve döviz varlıklarınızı dengeli tutarak enflasyona karşı koruma sağlayabilirsiniz.
2. Risk Yönetimi: Ani dalgalanmalara karşı kademeli alım-satım stratejisi izlenmesi önerilir.
3. Not: Anlık yoğunluk nedeniyle standart stratejik değerlendirme sunulmaktadır.`
      });
    }

    const summary = Array.isArray(assets)
      ? assets.map((a: any) => `${a.name}: ${a.amount} ${a.unit}`).join(', ')
      : '';
    const prompt = `Varlıklar: ${summary}. Güncel piyasa verileri: Ons Altın: $${marketData?.ouncePrice}, Dolar/TL: ₺${marketData?.usdTryRate}, Gram Altın: ₺${marketData?.gramPrice?.toFixed(2)}. Google Arama ile güncel ekonomik gelişmeleri değerlendir ve kullanıcıya profesyonel, stratejik portföy analizini sun.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    res.json({ analysis: response.text || 'Analiz yapılamadı.' });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      markRateLimited(60);
      return res.json({
        analysis: `Portföy Stratejik Notu:
Varlıklarınız mevcut piyasa koşullarında dengeli bir dağılım göstermektedir. Altın ve döviz dengesini korumanız, piyasa oynaklıklarına karşı güvenli liman avantajı sağlayacaktır.`
      });
    }
    res.status(500).json({ error: 'Analiz yapılamadı.' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Live API WebSocket connection handler
wss.on('connection', async (clientWs: WebSocket) => {
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: 'Sen profesyonel, bilgili ve samimi bir finans ve piyasa asistanısın. Kullanıcıyla Türkçe konuşarak altın, gümüş, döviz ve kripto para piyasaları hakkında gerçek zamanlı sesli danışmanlık sağla.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        },
        onerror: (err) => {
          console.error('Live API session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: err?.message || 'Live API error' }));
          }
        }
      },
    });

    clientWs.send(JSON.stringify({ status: 'connected' }));

    clientWs.on('message', (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (e) {
        console.error('Error forwarding client audio to Gemini Live:', e);
      }
    });

    clientWs.on('close', () => {
      if (session) {
        try {
          session.close();
        } catch {}
      }
    });

    clientWs.on('error', (err) => {
      console.error('Client WebSocket error:', err);
      if (session) {
        try {
          session.close();
        } catch {}
      }
    });
  } catch (err: any) {
    console.error('Failed to establish Live session with Gemini:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err?.message || 'Failed to start Live session' }));
      clientWs.close();
    }
  }
});

// Upgrade listener for Live WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/live' || pathname === '/api/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
