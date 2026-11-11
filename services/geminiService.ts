import { PriceData, OHLCData, NewsItem, Asset } from '../types';

/**
 * Real-time SSE Live Price Stream subscriber
 */
export const subscribeToLivePrices = (
  onUpdate: (data: PriceData & { searchGroundedAt?: string; searchStatus?: string }) => void,
  onError?: (error: any) => void
): (() => void) => {
  let eventSource: EventSource | null = null;
  let isClosed = false;
  let retryTimeout: any = null;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/live-stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && typeof data.ouncePrice === 'number') {
            onUpdate(data);
          }
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('SSE stream error, retrying in 3s...', err);
        if (onError) onError(err);
        eventSource?.close();
        if (!isClosed) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 3000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
};

/**
 * Canlı piyasa verilerini sunucudan çeker.
 */
export const fetchLivePrices = async (forceSearch = false): Promise<PriceData> => {
  try {
    const url = forceSearch ? '/api/live-prices?forceSearch=true' : '/api/live-prices';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: PriceData = await response.json();
    return data;
  } catch (error) {
    console.error('Piyasa verileri sunucudan alınamadı:', error);
    const gramPrice = (3982.0 / 31.1035) * 50.25;
    const silverPrice = (47.85 / 31.1035) * 50.25;
    return {
      ouncePrice: 3982.0,
      ounceChange: 0.35,
      usdTryRate: 50.25,
      usdTryChange: 0.12,
      eurTryRate: 56.20,
      eurTryChange: 0.18,
      gramPrice,
      gramChange: 0.47,
      silverPrice,
      silverChange: 0.25,
      silverOuncePrice: 47.85,
      goldSilverRatio: 83.2,
      quarterGoldPrice: Math.round(gramPrice * 1.635 * 1.03),
      halfGoldPrice: Math.round(gramPrice * 3.27 * 1.03),
      fullGoldPrice: Math.round(gramPrice * 6.60 * 1.03),
      btcPrice: 74400,
      btcChange: 0.8,
      ethPrice: 2080,
      ethChange: 0.4,
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      sources: []
    };
  }
};

/**
 * Google Arama ile verileri zorla yeniler.
 */
export const refreshGoogleSearch = async (): Promise<PriceData> => {
  try {
    const response = await fetch('/api/refresh-search', { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.market;
  } catch (err) {
    console.error('Google search refresh failed:', err);
    return fetchLivePrices();
  }
};

/**
 * Kripto fiyatlarını çeker.
 */
export const fetchBinancePrices = async (): Promise<{ btc: number; eth: number }> => {
  try {
    const response = await fetch('/api/live-prices');
    if (response.ok) {
      const data = await response.json();
      if (data.btcPrice > 0) {
        return { btc: data.btcPrice, eth: data.ethPrice || 3500 };
      }
    }
  } catch {}

  // Direct Fallback
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH&tsyms=USD');
    if (res.ok) {
      const json = await res.json();
      return { btc: json.BTC?.USD || 0, eth: json.ETH?.USD || 0 };
    }
  } catch {}

  return { btc: 0, eth: 0 };
};

export const FALLBACK_NEWS_ITEMS: NewsItem[] = [
  {
    title: "Ons ve Gram Altında Rekor Seviyeler: Küresel Faizler ve Güvenli Liman Talebi",
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

/**
 * Güncel piyasa haberlerini sunucudan çeker.
 */
export const fetchMarketNews = async (): Promise<NewsItem[]> => {
  try {
    const response = await fetch('/api/market-news');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return FALLBACK_NEWS_ITEMS;
  } catch (err) {
    console.error('Haberler sunucudan alınamadı, yerel haber havuzu kullanılıyor:', err);
    return FALLBACK_NEWS_ITEMS;
  }
};

/**
 * Haberi sunucu üzerinden analiz eder ve özetler.
 */
export const summarizeNews = async (newsTitle: string, snippet: string): Promise<string> => {
  try {
    const response = await fetch('/api/summarize-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newsTitle, snippet }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.summary || 'Özet hazırlanamadı.';
  } catch (err) {
    console.error('Haber özeti alınamadı:', err);
    return 'Özet hazırlanamadı.';
  }
};

/**
 * Yapay zeka ile sohbet isteğini sunucuya iletir.
 */
export const chatWithAI = async (message: string, history: any[]): Promise<string> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.text || '';
  } catch (err) {
    console.error('AI sohbet hatası:', err);
    return 'Üzgünüm, şu an yanıt veremiyorum.';
  }
};

/**
 * Streaming chat with server-sent events.
 */
export const chatWithAIStream = async (
  message: string,
  history: any[],
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, stream: true }),
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') return;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) onChunk(parsed.text);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Streaming chat error:', err);
    throw err;
  }
};

/**
 * Varlık portföy analizini sunucu üzerinden gerçekleştirir.
 */
export const analyzePortfolio = async (assets: Asset[], marketData: PriceData): Promise<string> => {
  try {
    const response = await fetch('/api/analyze-portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets, marketData }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.analysis || 'Analiz yapılamadı.';
  } catch (err) {
    console.error('Portföy analizi hatası:', err);
    return 'Analiz yapılamadı.';
  }
};

export const generateMockOHLC = (currentPrice: number): OHLCData[] => {
  const data: OHLCData[] = [];
  const now = new Date();
  for (let i = 14; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const close = (currentPrice || 2500) + (Math.random() - 0.5) * 100;
    data.push({
      date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      open: close, high: close + 5, low: close - 5, close
    });
  }
  return data;
};
