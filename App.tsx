
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  TrendingUp, DollarSign, Coins, RefreshCw, Calculator as CalcIcon, 
  ExternalLink, Info, ChevronRight, Briefcase, PieChart as PieIcon, 
  MessageSquare, Newspaper, Send, ArrowUpRight, ArrowDownRight,
  Sun, Moon, Bell, BellRing, X, Trash2, RotateCcw, Search, Sparkles, Loader2, Globe, Mic, MicOff, Volume2, AlertCircle, Settings, BarChart3, Database, Lightbulb, User, Bitcoin, Zap, ShieldAlert, Code, Languages, Fingerprint, Activity, Plus, Camera, Image as ImageIcon, Headphones, Filter, Scale, Check, SlidersHorizontal, ArrowRight, ShieldCheck, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { MarketSummary, PriceData, Asset, NewsItem, ChatMessage, AppLanguage } from './types';
import { 
  fetchLivePrices, generateMockOHLC, fetchMarketNews, chatWithAI, chatWithAIStream, 
  analyzePortfolio, summarizeNews, fetchBinancePrices, subscribeToLivePrices, refreshGoogleSearch 
} from './services/geminiService';
import PriceCard from './components/PriceCard';
import ChartSection from './components/ChartSection';
import { PortfolioChart } from './components/PortfolioChart';

// PCM Audio Utilities
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const DEFAULT_ASSETS: Asset[] = [
  { id: 'gold', name: 'Altın', amount: '0', priceKey: 'gramPrice', changeKey: 'gramChange', color: '#d4af37', unit: 'gr' },
  { id: 'usd', name: 'Dolar', amount: '0', priceKey: 'usdTryRate', changeKey: 'usdTryChange', color: '#22c55e', unit: '$' },
  { id: 'silver', name: 'Gümüş', amount: '0', priceKey: 'silverPrice', changeKey: 'silverChange', color: '#94a3b8', unit: 'gr' },
  { id: 'btc', name: 'Bitcoin', amount: '0', priceKey: 'btcPrice', changeKey: 'btcChange', color: '#f59e0b', unit: 'BTC' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'market' | 'silver_calc' | 'assets' | 'ai_hub' | 'insights' | 'tradingview' | 'kripto'>('market');
  const [isGlass, setIsGlass] = useState<boolean>(() => localStorage.getItem('isGlass') === 'true');
  const [language, setLanguage] = useState<AppLanguage>(() => (localStorage.getItem('language') as AppLanguage) || 'tr');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState('FX_IDC:XAUUSD');
  
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || 'Yatırımcı');
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem('profileImage') || '');
  
  const [customAssets, setCustomAssets] = useState<any[]>(() => {
    const saved = localStorage.getItem('custom_assets');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', amount: '', price: '', unit: 'Adet' });

  const [market, setMarket] = useState<MarketSummary>({
    current: null, history: [], loading: true, error: null,
  });

  const [liveCrypto, setLiveCrypto] = useState<{ btc: number; eth: number }>({ btc: 0, eth: 0 });
  
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('user_assets');
    return saved ? JSON.parse(saved) : DEFAULT_ASSETS;
  });

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsSummaries, setNewsSummaries] = useState<Record<string, string>>({});
  const [newsLoadingStates, setNewsLoadingStates] = useState<Record<string, boolean>>({});
  const [newsCategory, setNewsCategory] = useState<'all' | 'altin' | 'gumus' | 'doviz' | 'kripto' | 'makro'>('all');
  const [newsSearch, setNewsSearch] = useState('');
  const [newsRefreshing, setNewsRefreshing] = useState(false);

  // Silver Tab advanced state
  const [silverPurity, setSilverPurity] = useState<'999' | '925' | '800'>('999');
  const [silverAmount, setSilverAmount] = useState('100');
  const [silverUnit, setSilverUnit] = useState<'gram' | 'ounce' | 'kg'>('gram');
  const [silverViewMode, setSilverViewMode] = useState<'calc' | 'chart'>('calc');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'chat' | 'voice'>('chat');
  
  const [manualInputs, setManualInputs] = useState({ ounce: '', usdTry: '' });
  const [silverManualInputs, setSilverManualInputs] = useState({ silverOunce: '', usdTry: '' });

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const sessionRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isSearchScanning, setIsSearchScanning] = useState(false);
  const [searchGroundedAt, setSearchGroundedAt] = useState<string>('');
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  // REAL-TIME SSE STREAM SUBSCRIPTION
  useEffect(() => {
    const unsubscribe = subscribeToLivePrices((data) => {
      setMarket(prev => ({
        ...prev,
        current: data,
        history: prev.history.length > 0 ? prev.history : generateMockOHLC(data.gramPrice),
        loading: false,
        error: null,
      }));

      if (data.btcPrice > 0) {
        setLiveCrypto({ btc: data.btcPrice, eth: data.ethPrice || 3500 });
      }

      if ((data as any).searchGroundedAt) {
        setSearchGroundedAt((data as any).searchGroundedAt);
      }

      // Populate manual inputs if not already filled
      setManualInputs(prev => {
        if (!prev.ounce || !prev.usdTry) {
          return { ounce: data.ouncePrice.toFixed(2), usdTry: data.usdTryRate.toFixed(2) };
        }
        return prev;
      });

      setSilverManualInputs(prev => {
        if (!prev.silverOunce || !prev.usdTry) {
          const sOunce = (data.silverOuncePrice || (data.silverPrice ? (data.silverPrice / data.usdTryRate * 31.1035) : 47.85)).toFixed(2);
          return { silverOunce: sOunce, usdTry: data.usdTryRate.toFixed(2) };
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, []);

  // Initial News loading
  useEffect(() => {
    fetchMarketNews().then(setNews).catch(() => {});
  }, []);

  const handleRefreshNews = async () => {
    setNewsRefreshing(true);
    try {
      const data = await fetchMarketNews();
      setNews(data);
    } catch (e) {
      console.error('Haber yenileme hatası:', e);
    } finally {
      setNewsRefreshing(false);
    }
  };

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      const matchCat = newsCategory === 'all' || item.category === newsCategory;
      const matchSearch = !newsSearch.trim() || 
        item.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
        item.snippet.toLowerCase().includes(newsSearch.toLowerCase()) ||
        item.source.toLowerCase().includes(newsSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [news, newsCategory, newsSearch]);

  const silverCalculatedValue = useMemo(() => {
    const rawAmt = parseFloat(silverAmount) || 0;
    const purityMultiplier = silverPurity === '999' ? 1.0 : silverPurity === '925' ? 0.925 : 0.800;
    
    let grams = rawAmt;
    if (silverUnit === 'ounce') grams = rawAmt * 31.1035;
    else if (silverUnit === 'kg') grams = rawAmt * 1000;

    const baseGramPrice = market.current?.silverPrice || 
      ((parseFloat(silverManualInputs.silverOunce) || 47.85) / 31.1035) * (parseFloat(silverManualInputs.usdTry) || 50.25);
    const pureGrams = grams * purityMultiplier;
    const totalTry = pureGrams * baseGramPrice;
    const currentUsdRate = market.current?.usdTryRate || parseFloat(silverManualInputs.usdTry) || 50.25;
    const totalUsd = currentUsdRate > 0 ? totalTry / currentUsdRate : 0;

    return {
      pureGrams,
      totalTry,
      totalUsd,
      baseGramPrice
    };
  }, [silverAmount, silverPurity, silverUnit, market.current, silverManualInputs]);

  const manualResult = useMemo(() => {
    const ounce = parseFloat(manualInputs.ounce);
    const usdTry = parseFloat(manualInputs.usdTry);
    if (isNaN(ounce) || isNaN(usdTry)) return null;
    return (ounce / 31.1035) * usdTry;
  }, [manualInputs]);

  const silverManualResult = useMemo(() => {
    const silverOunce = parseFloat(silverManualInputs.silverOunce);
    const usdTry = parseFloat(silverManualInputs.usdTry);
    if (isNaN(silverOunce) || isNaN(usdTry)) return null;
    return (silverOunce / 31.1035) * usdTry;
  }, [silverManualInputs]);

  useEffect(() => {
    localStorage.setItem('userName', userName);
    localStorage.setItem('profileImage', profileImage);
    localStorage.setItem('custom_assets', JSON.stringify(customAssets));
    localStorage.setItem('isGlass', String(isGlass));
    localStorage.setItem('language', language);
    localStorage.setItem('user_assets', JSON.stringify(assets));
    localStorage.setItem('chat_history', JSON.stringify(chatMessages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [userName, profileImage, customAssets, isGlass, language, assets, chatMessages]);

  const handleTriggerGoogleSearch = async () => {
    setIsSearchScanning(true);
    try {
      const updated = await refreshGoogleSearch();
      setMarket(prev => ({
        ...prev,
        current: updated,
        history: generateMockOHLC(updated.gramPrice),
        loading: false,
      }));
      if (updated.btcPrice > 0) {
        setLiveCrypto({ btc: updated.btcPrice, eth: updated.ethPrice });
      }
      if ((updated as any).searchGroundedAt) {
        setSearchGroundedAt((updated as any).searchGroundedAt);
      }
    } catch (e) {
      console.error('Google search refresh failed:', e);
    } finally {
      setIsSearchScanning(false);
    }
  };

  const loadData = useCallback(async () => {
    setMarket(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [liveData, newsData] = await Promise.all([
        fetchLivePrices(),
        fetchMarketNews()
      ]);
      setMarket({
        current: liveData,
        history: generateMockOHLC(liveData.gramPrice),
        loading: false,
        error: liveData.ouncePrice === 0 ? "Veri hatası." : null,
      });
      setNews(newsData);
      if (liveData.btcPrice > 0) {
        setLiveCrypto({ btc: liveData.btcPrice, eth: liveData.ethPrice });
      }
      if ((liveData as any).searchGroundedAt) {
        setSearchGroundedAt((liveData as any).searchGroundedAt);
      }
    } catch (err: any) {
      setMarket(prev => ({ ...prev, loading: false, error: "Veri yüklenemedi." }));
    }
  }, []);

  const portfolioData = useMemo(() => {
    if (!market.current) return [];
    const standard = assets.map(asset => {
      let price = 0;
      if (asset.id === 'btc') price = (liveCrypto.btc || market.current!.btcPrice) * market.current!.usdTryRate;
      else price = market.current![asset.priceKey] as number;
      
      const amount = parseFloat(asset.amount) || 0;
      return { name: asset.name, value: amount * price, color: asset.color };
    });
    const custom = customAssets.map(asset => ({
      name: asset.name,
      value: (parseFloat(asset.amount) || 0) * (parseFloat(asset.price) || 0),
      color: '#6366f1'
    }));
    return [...standard, ...custom].filter(a => a.value > 0);
  }, [assets, customAssets, market.current, liveCrypto]);

  const totalValue = useMemo(() => portfolioData.reduce((sum, item) => sum + item.value, 0), [portfolioData]);

  const handleAiSend = async (msg?: string) => {
    const input = msg || aiInput;
    if (!input.trim() || aiLoading) return;
    setAiInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: input }]);
    setAiLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      let responseText = '';
      setChatMessages(prev => [...prev, { role: 'model', text: '' }]);
      await chatWithAIStream(input, history, (chunk) => {
        responseText += chunk;
        setChatMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'model', text: responseText };
          return next;
        });
      });
    } catch (err: any) {
      setChatMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'model' && next[next.length - 1].text === '') {
          next[next.length - 1] = { role: 'model', text: "Üzgünüm, şu an yanıt veremiyorum." };
          return next;
        }
        return [...next, { role: 'model', text: "Üzgünüm, şu an yanıt veremiyorum." }];
      });
    } finally { setAiLoading(false); }
  };

  const handleSummarize = async (item: NewsItem) => {
    if (newsLoadingStates[item.title]) return;
    setNewsLoadingStates(p => ({ ...p, [item.title]: true }));
    try {
      const summary = await summarizeNews(item.title, item.snippet);
      setNewsSummaries(p => ({ ...p, [item.title]: summary }));
    } catch (err) { setNewsSummaries(p => ({ ...p, [item.title]: "Hata oluştu." })); }
    finally { setNewsLoadingStates(p => ({ ...p, [item.title]: false })); }
  };

  const handleAnalyzePortfolio = async () => {
    if (!market.current) return;
    setAnalysisLoading(true);
    setShowAnalysisModal(true);
    try {
      const result = await analyzePortfolio(assets, market.current);
      setPortfolioAnalysis(result);
    } catch (err) { setPortfolioAnalysis("Analiz yapılamadı."); }
    finally { setAnalysisLoading(false); }
  };

  const handleAssetChange = (id: string, amount: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, amount } : a));
  };

  const handleAddCustomAsset = () => {
    if (!newAsset.name || !newAsset.amount || !newAsset.price) return;
    const id = Math.random().toString(36).substr(2, 9);
    setCustomAssets(prev => [...prev, { ...newAsset, id }]);
    setNewAsset({ name: '', amount: '', price: '', unit: 'Adet' });
    setIsAddingAsset(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startVoiceSession = useCallback(async () => {
    if (isVoiceActive) {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (inputCtxRef.current) {
        inputCtxRef.current.close().catch(() => {});
        inputCtxRef.current = null;
      }
      if (outputCtxRef.current) {
        outputCtxRef.current.close().catch(() => {});
        outputCtxRef.current = null;
      }
      setIsVoiceActive(false);
      setIsModelSpeaking(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputCtxRef.current = inputCtx;
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputCtxRef.current = outputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsVoiceActive(true);
        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            ws.send(JSON.stringify({ audio: encode(new Uint8Array(int16.buffer)) }));
          }
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            setIsModelSpeaking(true);
            const audioBuffer = await decodeAudioData(decode(msg.audio), outputCtx, 24000, 1);
            const node = outputCtx.createBufferSource();
            node.buffer = audioBuffer;
            node.connect(outputCtx.destination);
            node.onended = () => setIsModelSpeaking(false);
            node.start();
          }
          if (msg.interrupted) {
            setIsModelSpeaking(false);
          }
        } catch (e) {
          console.error("Error handling WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setIsVoiceActive(false);
        setIsModelSpeaking(false);
      };

      ws.onerror = (err) => {
        console.error("Live WebSocket error:", err);
        setIsVoiceActive(false);
        setIsModelSpeaking(false);
      };

      sessionRef.current = ws;
    } catch (err) {
      console.error("Microphone or Live connection error:", err);
      setIsVoiceActive(false);
    }
  }, [isVoiceActive]);

  const cardClass = `rounded-2xl border transition-all duration-300 ${isGlass ? 'glass-effect' : 'bg-slate-900 border-slate-800 shadow-sm'}`;

  const t = (tr: string, en: string) => language === 'tr' ? tr : en;

  return (
    <div className="min-h-screen pb-12 bg-slate-950 transition-colors duration-300 overflow-x-hidden text-slate-200">
      {/* INSTITUTIONAL FINANCIAL TICKER TAPE */}
      <div className="bg-slate-950 border-b border-slate-800/90 px-4 py-2 text-xs font-mono select-none overflow-x-auto no-scrollbar shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center gap-6 whitespace-nowrap">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-800 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">CANLI SPOT BİST / FX</span>
          </div>
          
          <div className="flex items-center gap-7 text-xs">
            {/* Gram Gold */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('market')}>
              <span className="text-yellow-500 font-bold">GRAM ALTIN</span>
              <span className="text-white font-black">₺{market.current?.gramPrice ? market.current.gramPrice.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '...'}</span>
              <span className={`text-[10px] font-bold ${(market.current?.gramChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(market.current?.gramChange || 0) >= 0 ? '+' : ''}{(market.current?.gramChange || 0).toFixed(2)}%
              </span>
            </div>

            {/* Ounce Gold */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setActiveSymbol('FX_IDC:XAUUSD'); setActiveTab('tradingview'); }}>
              <span className="text-yellow-500/80 font-bold">ONS ALTIN</span>
              <span className="text-white font-black">${market.current?.ouncePrice ? market.current.ouncePrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '...'}</span>
              <span className={`text-[10px] font-bold ${(market.current?.ounceChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(market.current?.ounceChange || 0) >= 0 ? '+' : ''}{(market.current?.ounceChange || 0).toFixed(2)}%
              </span>
            </div>

            {/* Çeyrek Altın */}
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">ÇEYREK ALTIN</span>
              <span className="text-white font-black">₺{market.current?.quarterGoldPrice ? market.current.quarterGoldPrice.toLocaleString('tr-TR') : market.current?.gramPrice ? Math.round(market.current.gramPrice * 1.635 * 1.03).toLocaleString('tr-TR') : '...'}</span>
            </div>

            {/* Gram Silver */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('silver_calc')}>
              <span className="text-slate-400 font-bold">GRAM GÜMÜŞ</span>
              <span className="text-slate-200 font-black">₺{market.current?.silverPrice ? market.current.silverPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}</span>
              <span className={`text-[10px] font-bold ${(market.current?.silverChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(market.current?.silverChange || 0) >= 0 ? '+' : ''}{(market.current?.silverChange || 0).toFixed(2)}%
              </span>
            </div>

            {/* Ounce Silver */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('silver_calc')}>
              <span className="text-slate-400/80 font-bold">ONS GÜMÜŞ</span>
              <span className="text-slate-200 font-black">${(market.current?.silverOuncePrice || (market.current ? (market.current.silverPrice / market.current.usdTryRate * 31.1035) : 47.85)).toFixed(2)}</span>
            </div>

            {/* Gold / Silver Ratio */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('silver_calc')}>
              <span className="text-purple-400 font-bold">ALTIN/GÜMÜŞ RASYOSU</span>
              <span className="text-purple-300 font-black">{(market.current?.goldSilverRatio || (market.current ? (market.current.ouncePrice / (market.current.silverOuncePrice || 47.85)) : 83.2)).toFixed(1)}</span>
            </div>

            {/* USD / TRY */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setActiveSymbol('FX_IDC:USDTRY'); setActiveTab('tradingview'); }}>
              <span className="text-green-500 font-bold">USD/TRY</span>
              <span className="text-white font-black">₺{market.current?.usdTryRate ? market.current.usdTryRate.toFixed(2) : '...'}</span>
              <span className={`text-[10px] font-bold ${(market.current?.usdTryChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(market.current?.usdTryChange || 0) >= 0 ? '+' : ''}{(market.current?.usdTryChange || 0).toFixed(2)}%
              </span>
            </div>

            {/* EUR / TRY */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setActiveSymbol('FX_IDC:EURTRY'); setActiveTab('tradingview'); }}>
              <span className="text-blue-400 font-bold">EUR/TRY</span>
              <span className="text-white font-black">₺{market.current?.eurTryRate ? market.current.eurTryRate.toFixed(2) : '...'}</span>
            </div>

            {/* Bitcoin */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('kripto')}>
              <span className="text-orange-400 font-bold">BTC/USD</span>
              <span className="text-white font-black">${(liveCrypto.btc || market.current?.btcPrice || 0).toLocaleString()}</span>
              <span className="text-[10px] font-bold text-emerald-400">+{(market.current?.btcChange || 0.8).toFixed(2)}%</span>
            </div>

            {/* Ethereum */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('kripto')}>
              <span className="text-indigo-400 font-bold">ETH/USD</span>
              <span className="text-white font-black">${(liveCrypto.eth || market.current?.ethPrice || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <header className={`border-b sticky top-0 z-50 transition-all duration-300 ${isGlass ? 'glass-effect' : 'bg-slate-900 border-slate-800 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x py-2 flex-1">
            {[
              { id: 'market', label: t('Altın', 'Gold'), icon: TrendingUp },
              { id: 'silver_calc', label: t('Gümüş', 'Silver'), icon: Database },
              { id: 'kripto', label: t('Kripto', 'Crypto'), icon: Bitcoin },
              { id: 'assets', label: t('Varlıklar', 'Assets'), icon: Briefcase },
              { id: 'tradingview', label: t('Grafik', 'Charts'), icon: BarChart3 },
              { id: 'ai_hub', label: t('AI Hub', 'AI Hub'), icon: Sparkles },
              { id: 'insights', label: t('Haberler', 'News'), icon: Newspaper }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`snap-center flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <tab.icon size={14} /><span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all"><Settings size={22} /></button>
            <button onClick={loadData} disabled={market.loading} className="p-2.5 bg-slate-800 rounded-xl text-white hover:bg-slate-700 transition-all"><RefreshCw size={18} className={market.loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'market' && (
            <motion.div key="market" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Real-time streaming & Google Search Grounding Control Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-wide">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("CANLI VERİ AKIŞI AKTİF", "REAL-TIME STREAM ACTIVE")}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {t("Son Akış:", "Last Stream:")} <span className="text-white font-mono font-bold">{market.current?.timestamp || '--:--:--'}</span>
                  </div>
                  {market.current?.searchStatus === 'rate_limited' ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                      <AlertCircle size={13} />
                      <span>{t("Google Arama Kotası Dinleniyor (Canlı Veriler Aktif)", "Search Quota Cooling Down (Live Feeds Active)")}</span>
                    </div>
                  ) : searchGroundedAt ? (
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      <Sparkles size={13} />
                      <span>{t("Google Arama:", "Google Search:")} {searchGroundedAt}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleTriggerGoogleSearch}
                    disabled={isSearchScanning}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    <Search size={14} className={isSearchScanning ? 'animate-spin' : ''} />
                    <span>{isSearchScanning ? t("Google Aranıyor...", "Scanning Google...") : t("Google Arama ile Oku", "Read from Google Search")}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <PriceCard label={t("Gram Altın", "Gram Gold")} value={market.current?.gramPrice || '...'} unit="₺" icon={<Coins size={20} />} change={market.current?.gramChange} colorClass="text-yellow-600" />
                <PriceCard label={t("Ons Altın", "Gold Ounce")} value={market.current?.ouncePrice || '...'} unit="$" icon={<TrendingUp size={20} />} change={market.current?.ounceChange} colorClass="text-blue-600" onClick={() => { setActiveSymbol('FX_IDC:XAUUSD'); setActiveTab('tradingview'); }} />
                <PriceCard label={t("Dolar/TL", "USD/TRY")} value={market.current?.usdTryRate || '...'} unit="₺" icon={<DollarSign size={20} />} change={market.current?.usdTryChange} colorClass="text-green-600" onClick={() => { setActiveSymbol('FX_IDC:USDTRY'); setActiveTab('tradingview'); }} />
              </div>

              {/* Google Search Grounding Sources Verification Section */}
              {market.current?.sources && market.current.sources.length > 0 && (
                <div className="mb-8 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                      <Globe size={15} className="text-blue-400" />
                      <span>{t("Google Arama Grounding ile Doğrulanan Kaynaklar", "Sources Verified via Google Search Grounding")}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        {market.current.sources.length} {t("Kaynak", "Sources")}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      gemini-3.8-flash (googleSearch)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {market.current.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 hover:border-blue-500/50 text-xs transition-all group"
                      >
                        <span className="truncate font-medium">{src.title}</span>
                        <ExternalLink size={13} className="flex-shrink-0 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 relative">
                  <ChartSection data={market.history} />
                  <div className="absolute top-4 right-16 z-10">
                    <button onClick={() => setActiveTab('ai_hub')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"><Sparkles size={14} /> {t("AI ANALİZ", "AI ANALYZE")}</button>
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <div className={cardClass + " p-6 h-full flex flex-col justify-between"}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black flex items-center gap-2"><CalcIcon size={20} className="text-yellow-500" /> {t("Gram Hesapla", "Gold Calc")}</h3>
                        {market.current && (
                          <button
                            type="button"
                            onClick={() => {
                              if (market.current) {
                                setManualInputs({
                                  ounce: market.current.ouncePrice.toFixed(2),
                                  usdTry: market.current.usdTryRate.toFixed(2),
                                });
                              }
                            }}
                            className="px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all"
                          >
                            <RefreshCw size={10} /> {t("Canlıyı Al", "Use Live")}
                          </button>
                        )}
                      </div>
                      <div className="space-y-4 mt-6">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">ONS ($)</label>
                          <input type="number" step="0.01" value={manualInputs.ounce} onChange={e => setManualInputs(p => ({ ...p, ounce: e.target.value }))} className="w-full p-4 bg-slate-800 text-white rounded-2xl font-black outline-none border border-transparent focus:border-yellow-500 transition-all" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">DOLAR (₺)</label>
                          <input type="number" step="0.01" value={manualInputs.usdTry} onChange={e => setManualInputs(p => ({ ...p, usdTry: e.target.value }))} className="w-full p-4 bg-slate-800 text-white rounded-2xl font-black outline-none border border-transparent focus:border-yellow-500 transition-all" />
                        </div>
                        <div className="p-6 bg-yellow-900/20 rounded-2xl border border-yellow-900/30 mt-6 text-center">
                          <p className="text-[10px] font-black text-yellow-500 uppercase mb-1">{t("Hesaplanan Gram", "Calculated Gram")}</p>
                          <p className="text-4xl font-black text-yellow-400">₺{manualResult !== null ? manualResult.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'kripto' && (
            <motion.div key="kripto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* BTC/USD HIGH IMPACT CARD */}
                <div className="p-12 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900 border border-yellow-500/30 rounded-[3rem] relative group hover:border-yellow-500 transition-all duration-700 shadow-2xl">
                  <div className="absolute top-8 right-8 text-[10px] font-black text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-xl animate-pulse border border-yellow-500/20 uppercase tracking-widest">Canlı Veri Motoru</div>
                  <div className="flex items-center gap-8 mb-16">
                    <div className="p-6 bg-yellow-500 text-white rounded-[2rem] shadow-2xl shadow-yellow-500/30 group-hover:scale-110 transition-transform duration-500"><Bitcoin size={56} /></div>
                    <div><h2 className="text-5xl font-black tracking-tighter">Bitcoin</h2><p className="text-sm font-black text-slate-500 tracking-[0.3em] uppercase mt-1">BTC / USD</p></div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <AnimatePresence mode="wait">
                      <motion.span key={liveCrypto.btc} initial={{ opacity: 0.7, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-7xl font-black text-white tabular-nums tracking-tighter">
                        {(liveCrypto.btc || market.current?.btcPrice || 65000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-3xl font-black text-slate-700">$</span>
                  </div>
                </div>

                {/* ETH/USD HIGH IMPACT CARD */}
                <div className="p-12 bg-gradient-to-br from-blue-500/10 via-slate-900 to-slate-900 border border-blue-500/30 rounded-[3rem] relative group hover:border-blue-500 transition-all duration-700 shadow-2xl">
                  <div className="absolute top-8 right-8 text-[10px] font-black text-blue-500 bg-blue-500/10 px-4 py-2 rounded-xl animate-pulse border border-blue-500/20 uppercase tracking-widest">Canlı Veri Motoru</div>
                  <div className="flex items-center gap-8 mb-16">
                    <div className="p-6 bg-blue-500 text-white rounded-[2rem] shadow-2xl shadow-blue-500/30 group-hover:scale-110 transition-transform duration-500"><Coins size={56} /></div>
                    <div><h2 className="text-5xl font-black tracking-tighter">Ethereum</h2><p className="text-sm font-black text-slate-500 tracking-[0.3em] uppercase mt-1">ETH / USD</p></div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <AnimatePresence mode="wait">
                      <motion.span key={liveCrypto.eth} initial={{ opacity: 0.7, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-7xl font-black text-white tabular-nums tracking-tighter">
                        {(liveCrypto.eth || market.current?.ethPrice || 3500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-3xl font-black text-slate-700">$</span>
                  </div>
                </div>
              </div>

              {/* TRADINGVIEW FOR CRYPTO - PINNED VERSION */}
              <div className={cardClass + " h-[650px] overflow-hidden shadow-2xl relative rounded-[3rem] group"}>
                <div className="absolute top-6 left-6 z-20 flex gap-3">
                  <div className="px-6 py-2.5 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700 text-[11px] font-black uppercase text-white tracking-[0.2em] shadow-2xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Global Market Analytics
                  </div>
                </div>
                <iframe 
                  src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT&interval=D&theme=dark&style=1&timezone=Europe%2FIstanbul&withdateranges=1&locale=tr`} 
                  style={{ width: '100%', height: '100%', border: 'none' }} 
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'ai_hub' && (
            <motion.div key="ai_hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto flex flex-col h-[75vh] gap-6">
              <div className="flex bg-slate-900/50 p-2 rounded-2xl border border-slate-800 self-center">
                <button onClick={() => setAiMode('chat')} className={`px-8 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${aiMode === 'chat' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-200'}`}><MessageSquare size={16} /> {t("SOHBET", "CHAT")}</button>
                <button onClick={() => setAiMode('voice')} className={`px-8 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${aiMode === 'voice' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-200'}`}><Headphones size={16} /> {t("SESLİ ASİSTAN", "VOICE AI")}</button>
              </div>

              <div className={cardClass + " flex-1 flex flex-col overflow-hidden shadow-2xl"}>
                {aiMode === 'chat' ? (
                  <>
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                      <div className="flex items-center gap-3"><Sparkles className="text-blue-500" size={24} /><h2 className="text-xl font-black">{t("Finansal Asistan", "Financial Assistant")}</h2></div>
                      <div className="flex items-center gap-2 text-[10px] text-green-500 font-black"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> {t("GEMINI PRO AKTİF", "GEMINI PRO ACTIVE")}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-950/20">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                          <MessageSquare size={64} />
                          <p className="text-lg font-black uppercase tracking-widest">{t("Merhaba! Size nasıl yardımcı olabilirim?", "Hello! How can I help you today?")}</p>
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-5 rounded-3xl shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>{m.text}</div>
                        </motion.div>
                      ))}
                      {aiLoading && <div className="p-4 bg-slate-800 rounded-2xl w-24 animate-pulse flex justify-center"><Loader2 size={16} className="animate-spin text-blue-500" /></div>}
                      <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleAiSend(); }} className="p-6 border-t border-slate-800 flex gap-3 bg-slate-900/50">
                      <input value={aiInput} onChange={e => setAiInput(e.target.value)} className="flex-1 p-5 rounded-2xl bg-slate-800 outline-none border border-transparent focus:border-blue-500 transition-all font-medium" placeholder={t("Piyasalar hakkında bir soru sorun...", "Ask anything about markets...")} />
                      <button type="submit" className="p-5 bg-blue-600 rounded-2xl text-white shadow-xl hover:scale-105 active:scale-95 transition-all"><Send size={24} /></button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-12">
                    <div className="relative">
                      <AnimatePresence>
                        {isVoiceActive && (
                          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.2, opacity: 0.2 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-blue-600 rounded-full blur-3xl" />
                        )}
                      </AnimatePresence>
                      <motion.div animate={isVoiceActive ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }} className={`w-48 h-48 rounded-full flex items-center justify-center text-white transition-all duration-700 relative z-10 ${isVoiceActive ? 'bg-blue-600 shadow-[0_0_80px_rgba(37,99,235,0.4)]' : 'bg-slate-800 shadow-2xl'}`}>
                        {isModelSpeaking ? <Volume2 size={84} className="animate-pulse" /> : <Mic size={84} />}
                      </motion.div>
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-4xl font-black tracking-tighter">{isVoiceActive ? t("Sizi Dinliyorum...", "Listening...") : t("Sesli Mod", "Voice Mode")}</h2>
                      <p className="text-slate-500 max-w-sm font-medium">{t("Piyasa verilerini ve stratejileri Gemini ile sesli olarak konuşun.", "Discuss market data and strategies with Gemini via voice.")}</p>
                    </div>
                    <button onClick={startVoiceSession} className={`px-16 py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl active:scale-95 flex items-center gap-4 ${isVoiceActive ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:scale-105'}`}>
                      {isVoiceActive ? <X size={24} /> : <Mic size={24} />}
                      {isVoiceActive ? t("OTURUMU KAPAT", "CLOSE SESSION") : t("SOHBETE BAŞLA", "START SOHBET")}
                    </button>
                    {isVoiceActive && (
                      <div className="flex gap-1 h-8 items-end">
                        {[...Array(12)].map((_, i) => (
                          <motion.div key={i} animate={{ height: [10, 32, 10] }} transition={{ repeat: Infinity, duration: 0.5 + Math.random(), delay: i * 0.1 }} className="w-1.5 bg-blue-500 rounded-full" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div key="assets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {/* 30-Day Historical Portfolio Value Performance Chart */}
              <PortfolioChart
                assets={assets}
                customAssets={customAssets}
                currentMarket={market.current}
                liveCrypto={liveCrypto}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className={cardClass + " p-6 sm:p-8"}>
                    <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                          <Briefcase className="text-blue-500" size={22} /> {t("Varlık Portföyüm", "My Asset Portfolio")}
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          {t("Portföy adetlerinizi güncelleyin, toplam piyasa değeriniz otomatik hesaplansın", "Update quantities to track live portfolio valuation")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setIsAddingAsset(true)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all">
                          <Plus size={15} /> {t("MANUEL EKLE", "ADD MANUAL")}
                        </button>
                        <button onClick={handleAnalyzePortfolio} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black flex items-center gap-2 border border-slate-700 hover:border-slate-600 transition-all">
                          <Sparkles size={14} className="text-yellow-400" /> {t("AI ANALİZ", "AI ANALYZE")}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {assets.map(a => {
                        let livePrice = 0;
                        if (a.id === 'btc') livePrice = (liveCrypto.btc || market.current?.btcPrice || 0) * (market.current?.usdTryRate || 1);
                        else livePrice = (market.current ? (market.current[a.priceKey] as number) : 0);
                        const amt = parseFloat(a.amount) || 0;
                        const itemVal = amt * livePrice;

                        return (
                          <div key={a.id} className="p-5 bg-slate-800/40 rounded-2xl border border-slate-700/70 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-3 group">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                                {a.name}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 font-mono">
                                ₺{livePrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} / {a.unit}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={a.amount} 
                                onChange={e => handleAssetChange(a.id, e.target.value)} 
                                className="w-full bg-slate-900/90 p-3.5 rounded-xl font-mono font-black text-xl text-white outline-none border border-slate-700/80 focus:border-blue-500 transition-all" 
                                placeholder="0"
                              />
                              <span className="text-xs font-bold text-slate-400 min-w-8">{a.unit}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs font-mono">
                              <span className="text-slate-500">{t("Toplam Değer:", "Total Value:")}</span>
                              <span className="text-white font-bold">₺{Math.round(itemVal).toLocaleString('tr-TR')}</span>
                            </div>
                          </div>
                        );
                      })}

                      {customAssets.map(a => {
                        const amt = parseFloat(a.amount) || 0;
                        const prc = parseFloat(a.price) || 0;
                        const itemVal = amt * prc;

                        return (
                          <div key={a.id} className="p-5 bg-blue-950/20 rounded-2xl border border-blue-900/40 relative group hover:border-blue-500/50 transition-all flex flex-col justify-between">
                            <button onClick={() => setCustomAssets(prev => prev.filter(x => x.id !== a.id))} className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-1 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={16} />
                            </button>
                            <div>
                              <span className="text-xs font-black text-blue-400 uppercase tracking-wider">{a.name}</span>
                              <p className="text-2xl font-mono font-black mt-2 text-white">{a.amount} <span className="text-xs text-slate-400 font-normal">{a.unit}</span></p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-blue-900/30 text-xs font-mono mt-3">
                              <span className="text-slate-500">Birim: ₺{parseFloat(a.price).toLocaleString('tr-TR')}</span>
                              <span className="text-blue-300 font-bold">₺{Math.round(itemVal).toLocaleString('tr-TR')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className={cardClass + " p-6 sm:p-8 sticky top-24"}>
                    <h3 className="text-sm font-black mb-6 uppercase tracking-widest text-slate-400 flex items-center justify-between">
                      <span>{t("Varlık Dağılımı", "Asset Allocation")}</span>
                      <PieIcon size={16} className="text-blue-400" />
                    </h3>
                    <div className="h-64 relative mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolioData} innerRadius={65} outerRadius={92} paddingAngle={4} dataKey="value" stroke="none">
                            {portfolioData.map((e: any, i: any) => <Cell key={i} fill={e.color || '#3b82f6'} />)}
                          </Pie>
                          <RechartsTooltip formatter={(v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`} contentStyle={{ background: '#0b0f17', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t("Toplam Net Değer", "Total Net Worth")}</span>
                        <span className="text-2xl font-black text-white font-mono">₺{Math.round(totalValue).toLocaleString('tr-TR')}</span>
                        {market.current?.usdTryRate && (
                          <span className="text-xs text-emerald-400 font-mono mt-0.5">
                            ${Math.round(totalValue / market.current.usdTryRate).toLocaleString('en-US')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Breakdown Percentages List */}
                    <div className="space-y-2.5 font-mono text-xs border-t border-slate-800 pt-4">
                      {portfolioData.map((item, idx) => {
                        const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0';
                        return (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-slate-300 font-medium">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">%{pct}</span>
                              <span className="text-white font-bold">₺{Math.round(item.value).toLocaleString('tr-TR')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tradingview' && (
            <motion.div key="tradingview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[80vh] flex flex-col gap-4">
              <div className={cardClass + " flex-1 overflow-hidden shadow-2xl"}><iframe src={`https://s.tradingview.com/widgetembed/?symbol=${activeSymbol}&interval=D&theme=dark&style=1&timezone=Europe%2FIstanbul&withdateranges=1&locale=tr`} style={{ width: '100%', height: '100%', border: 'none' }} /></div>
            </motion.div>
          )}

          {activeTab === 'silver_calc' && (
            <motion.div key="silver_calc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              {/* Silver Spot Live Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <PriceCard 
                  label={t("Gram Gümüş (Has 999)", "Gram Silver (999)")} 
                  value={market.current?.silverPrice || '...'} 
                  unit="₺" 
                  icon={<Database size={20} />} 
                  change={market.current?.silverChange} 
                  colorClass="text-slate-300" 
                />
                <PriceCard 
                  label={t("Ons Gümüş (XAG/USD)", "Silver Ounce (XAG/USD)")} 
                  value={market.current?.silverOuncePrice || (market.current ? (market.current.silverPrice / market.current.usdTryRate * 31.1035) : 47.85)} 
                  unit="$" 
                  icon={<TrendingUp size={20} />} 
                  change={market.current?.silverChange} 
                  colorClass="text-blue-400" 
                  onClick={() => setSilverViewMode('chart')}
                />
                <div className={cardClass + " p-6 flex flex-col justify-between"}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t("Altın / Gümüş Rasyosu", "Gold/Silver Ratio")}</span>
                    <Activity size={18} className="text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">
                      {(market.current?.goldSilverRatio || (market.current ? (market.current.ouncePrice / (market.current.silverOuncePrice || 47.85)) : 83.2)).toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                      {t("Rasyo", "Ratio")}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-bold">1 Ons Altın = {Math.round(market.current?.goldSilverRatio || 83)} Ons Gümüş</span>
                  </div>
                </div>

                <PriceCard 
                  label={t("1 Kg Külçe Gümüş", "1 Kg Silver Bar")} 
                  value={market.current ? Math.round(market.current.silverPrice * 1000) : '...'} 
                  unit="₺" 
                  icon={<Coins size={20} />} 
                  colorClass="text-emerald-400" 
                />
              </div>

              {/* View Selector: Calculator vs Chart */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSilverViewMode('calc')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                      silverViewMode === 'calc'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <CalcIcon size={15} />
                    <span>{t("Gümüş Hesaplama Motoru", "Silver Calculator")}</span>
                  </button>
                  <button
                    onClick={() => setSilverViewMode('chart')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                      silverViewMode === 'chart'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <BarChart3 size={15} />
                    <span>{t("XAG/USD Canlı Teknik Grafik", "Live XAG/USD Chart")}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-mono flex items-center gap-2 px-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t("Canlı Ons:", "Live Ounce:")} <strong className="text-white">${(market.current?.silverOuncePrice || 47.85).toFixed(2)}</strong></span>
                  <span className="text-slate-600">|</span>
                  <span>{t("Gram:", "Gram:")} <strong className="text-white">₺{(market.current?.silverPrice || 77.25).toFixed(2)}</strong></span>
                </div>
              </div>

              {silverViewMode === 'chart' ? (
                <div className={cardClass + " h-[650px] overflow-hidden shadow-2xl relative rounded-3xl"}>
                  <div className="absolute top-4 left-4 z-20 px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 text-xs font-black text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    OANDA:XAGUSD Spot Silver / US Dollar
                  </div>
                  <iframe 
                    src={`https://s.tradingview.com/widgetembed/?symbol=OANDA:XAGUSD&interval=D&theme=dark&style=1&timezone=Europe%2FIstanbul&withdateranges=1&locale=tr`} 
                    style={{ width: '100%', height: '100%', border: 'none' }} 
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left: Input & Purity Configuration */}
                  <div className="lg:col-span-7">
                    <div className={cardClass + " p-6 sm:p-8 space-y-6"}>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Scale className="text-blue-500" size={20} />
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {t("Gümüş Saflık ve Miktar Seçimi", "Silver Purity & Amount")}
                          </h3>
                        </div>
                        {market.current && (
                          <button
                            type="button"
                            onClick={() => {
                              if (market.current) {
                                const sOunce = (market.current.silverOuncePrice || (market.current.silverPrice / market.current.usdTryRate * 31.1035)).toFixed(2);
                                setSilverManualInputs({
                                  silverOunce: sOunce,
                                  usdTry: market.current.usdTryRate.toFixed(2),
                                });
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                          >
                            <RefreshCw size={12} /> {t("Canlı Kuru Doldur", "Fill Live Rates")}
                          </button>
                        )}
                      </div>

                      {/* Purity (Ayar) Selection */}
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                          {t("GÜMÜŞ AYARI (SAFLIK ORANI)", "SILVER PURITY GRADE")}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: '999', label: '999 Has Gümüş', desc: '%100 Saf Külçe', sub: '999.9/1000' },
                            { id: '925', label: '925 Ayar Sterlin', desc: '%92.5 Takı & Külçe', sub: '925/1000' },
                            { id: '800', label: '800 Ayar Eşya', desc: '%80.0 Hurda/Antika', sub: '800/1000' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSilverPurity(opt.id as any)}
                              className={`p-3.5 rounded-2xl border text-left transition-all ${
                                silverPurity === opt.id
                                  ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg'
                                  : 'bg-slate-800/40 border-slate-700/70 text-slate-400 hover:border-slate-600 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-black text-xs">{opt.label}</span>
                                {silverPurity === opt.id && <Check size={14} className="text-blue-400" />}
                              </div>
                              <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                              <span className="text-[9px] font-mono text-slate-500 mt-1 block">{opt.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Amount and Unit Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                            {t("MİKTAR", "AMOUNT")}
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={silverAmount}
                            onChange={e => setSilverAmount(e.target.value)}
                            placeholder="100"
                            className="w-full p-4 bg-slate-900 text-white font-mono font-black text-2xl rounded-2xl border border-slate-700/80 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                            {t("BİRİM", "UNIT")}
                          </label>
                          <select
                            value={silverUnit}
                            onChange={e => setSilverUnit(e.target.value as any)}
                            className="w-full p-4 bg-slate-900 text-white font-black text-sm rounded-2xl border border-slate-700/80 focus:border-blue-500 outline-none transition-all"
                          >
                            <option value="gram">Gram (gr)</option>
                            <option value="ounce">Ons (31.1 gr)</option>
                            <option value="kg">Kilogram (kg)</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Amount Chips */}
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          {t("Hızlı Seçim", "Quick Presets")}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '50 gr', val: '50', unit: 'gram' },
                            { label: '100 gr', val: '100', unit: 'gram' },
                            { label: '250 gr', val: '250', unit: 'gram' },
                            { label: '500 gr', val: '500', unit: 'gram' },
                            { label: '1 Kg Külçe', val: '1', unit: 'kg' },
                            { label: '5 Kg Külçe', val: '5', unit: 'kg' },
                            { label: '100 Ons', val: '100', unit: 'ounce' },
                          ].map(chip => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => {
                                setSilverAmount(chip.val);
                                setSilverUnit(chip.unit as any);
                              }}
                              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all"
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Manual Rate Adjuster Inputs */}
                      <div className="pt-4 border-t border-slate-800/80">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {t("Spot Kur Parametreleri (İsteğe Bağlı Manuel Düzenleme)", "Spot Parameters (Optional Override)")}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">GÜMÜŞ ONS ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={silverManualInputs.silverOunce}
                              onChange={e => setSilverManualInputs(p => ({ ...p, silverOunce: e.target.value }))}
                              className="w-full p-3 bg-slate-900/90 text-white font-mono font-bold text-sm rounded-xl border border-slate-800 focus:border-slate-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">DOLAR/TL (₺)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={silverManualInputs.usdTry}
                              onChange={e => setSilverManualInputs(p => ({ ...p, usdTry: e.target.value }))}
                              className="w-full p-3 bg-slate-900/90 text-white font-mono font-bold text-sm rounded-xl border border-slate-800 focus:border-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Valuation Results Card */}
                  <div className="lg:col-span-5">
                    <div className={cardClass + " p-6 sm:p-8 flex flex-col justify-between h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden"}>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={14} /> {t("HESAPLAMA SONUCU", "VALUATION RESULT")}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                            {silverPurity} Ayar
                          </span>
                        </div>

                        {/* Big Total ₺ Value */}
                        <div className="mb-6 p-6 rounded-2xl bg-slate-950/70 border border-slate-800/90 text-center">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            {t("TOPLAM PİYASA DEĞERİ (TL)", "TOTAL MARKET VALUE (TRY)")}
                          </span>
                          <p className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                            ₺{silverCalculatedValue.totalTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-base font-black text-emerald-400 font-mono mt-2">
                            ≈ ${silverCalculatedValue.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Breakdown Specifications */}
                        <div className="space-y-3 font-mono text-xs">
                          <div className="flex justify-between items-center py-2 border-b border-slate-800/70">
                            <span className="text-slate-400">{t("Saf Has Gümüş Ağırlığı:", "Pure Silver Weight:")}</span>
                            <span className="text-white font-bold">{silverCalculatedValue.pureGrams.toFixed(2)} gr</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-800/70">
                            <span className="text-slate-400">{t("Birim Has Gram Fiyatı:", "Base Gram Price:")}</span>
                            <span className="text-white font-bold">₺{silverCalculatedValue.baseGramPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-800/70">
                            <span className="text-slate-400">{t("Saflık Çarpanı:", "Purity Multiplier:")}</span>
                            <span className="text-blue-400 font-bold">%{silverPurity === '999' ? '100' : silverPurity === '925' ? '92.5' : '80.0'}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-slate-400">{t("1 Kg Has Gümüş Değeri:", "1 Kg Fine Silver Bar:")}</span>
                            <span className="text-slate-300 font-bold">₺{Math.round(silverCalculatedValue.baseGramPrice * 1000).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-4 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            const id = 'custom_silver_' + Date.now();
                            const item = {
                              id,
                              name: `${silverAmount} ${silverUnit} Gümüş (${silverPurity} Ayar)`,
                              amount: silverAmount,
                              price: (silverCalculatedValue.totalTry / (parseFloat(silverAmount) || 1)).toFixed(2),
                              unit: silverUnit,
                            };
                            setCustomAssets(prev => [...prev, item]);
                            setActiveTab('assets');
                          }}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          <span>{t("Portföyüme Varlık Olarak Ekle", "Add to My Portfolio")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8">
              {/* Header and Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Newspaper size={12} /> {t("FİNANSAL İSTİHBARAT & GÜNDEM", "FINANCIAL INTELLIGENCE")}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {filteredNews.length} {t("Haber Listeleniyor", "Articles Available")}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
                    {t("Piyasa Gündemi & Haberler", "Market News & Intelligence")}
                  </h2>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search Input */}
                  <div className="relative min-w-[240px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={newsSearch}
                      onChange={e => setNewsSearch(e.target.value)}
                      placeholder={t("Haberlerde ara...", "Search articles...")}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all font-medium"
                    />
                    {newsSearch && (
                      <button 
                        onClick={() => setNewsSearch('')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Refresh News Button */}
                  <button
                    onClick={handleRefreshNews}
                    disabled={newsRefreshing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={newsRefreshing ? 'animate-spin text-blue-400' : ''} />
                    <span>{newsRefreshing ? t("Yenileniyor...", "Refreshing...") : t("Yenile", "Refresh")}</span>
                  </button>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                {[
                  { id: 'all', label: t('Tümü', 'All'), count: news.length },
                  { id: 'altin', label: t('Altın Piyasası', 'Gold Market'), count: news.filter(n => n.category === 'altin').length },
                  { id: 'gumus', label: t('Gümüş & Emtia', 'Silver & Metals'), count: news.filter(n => n.category === 'gumus').length },
                  { id: 'doviz', label: t('Döviz & Kurlar', 'FX & Currencies'), count: news.filter(n => n.category === 'doviz').length },
                  { id: 'kripto', label: t('Kripto Varlıklar', 'Crypto Assets'), count: news.filter(n => n.category === 'kripto').length },
                  { id: 'makro', label: t('Makro Ekonomi', 'Macro Economy'), count: news.filter(n => n.category === 'makro').length },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setNewsCategory(cat.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                      newsCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {cat.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                        newsCategory === cat.id ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* News Cards Grid */}
              {filteredNews.length === 0 ? (
                <div className="p-16 rounded-3xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center gap-4">
                  <div className="p-4 rounded-2xl bg-slate-800/80 text-slate-500">
                    <Search size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{t("Aramanıza Uygun Haber Bulunamadı", "No News Articles Match Your Search")}</h3>
                    <p className="text-xs text-slate-400 mt-1">{t("Arama filtrenizi temizleyerek tüm piyasa bültenlerine göz atabilirsiniz.", "Clear your search filter to browse all financial news.")}</p>
                  </div>
                  <button
                    onClick={() => { setNewsSearch(''); setNewsCategory('all'); }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all"
                  >
                    {t("Filtreleri Temizle", "Clear Filters")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {filteredNews.map((item, i) => {
                    const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
                      altin: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
                      gumus: { bg: 'bg-slate-400/10', text: 'text-slate-300', border: 'border-slate-500/30' },
                      doviz: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
                      kripto: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
                      makro: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
                    };
                    const catStyle = (item.category && categoryColors[item.category]) || { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' };

                    return (
                      <div key={i} className={cardClass + " flex flex-col group overflow-hidden shadow-xl hover:border-slate-700 transition-all duration-300"}>
                        <div className="h-48 bg-slate-900 relative overflow-hidden">
                          <img 
                            src={item.imageUrl || `https://images.unsplash.com/photo-1611974717525-58da5489708a?q=80&w=600`} 
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75 group-hover:opacity-100" 
                            onError={(e) => {
                              // Replace broken image with high quality financial fallback
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=600";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                          <div className="absolute top-4 left-4 flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-950/90 backdrop-blur-md text-white text-[10px] font-black rounded-lg border border-slate-700/80 shadow-md">
                              {item.source}
                            </span>
                            {item.category && (
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.readTime && (
                            <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[10px] text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                              <Clock size={11} />
                              <span>{item.readTime}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-6 sm:p-7 flex-1 flex flex-col">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-3">
                            <span>{item.date}</span>
                            <span>FINANS BULTENI</span>
                          </div>

                          <h3 className="text-base sm:text-lg font-black text-white mb-3 leading-snug group-hover:text-blue-400 transition-colors">
                            {item.title}
                          </h3>

                          <p className="text-xs text-slate-400 leading-relaxed font-medium line-clamp-3 mb-6">
                            {item.snippet}
                          </p>

                          {newsSummaries[item.title] && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-2xl mb-6">
                              <div className="flex items-center gap-1.5 text-blue-400 font-black text-[10px] uppercase tracking-wider mb-2">
                                <Sparkles size={13} />
                                <span>GEMINI PRO STRATEJİK DEĞERLENDİRME</span>
                              </div>
                              <p className="text-xs text-blue-100 leading-relaxed font-mono">
                                {newsSummaries[item.title]}
                              </p>
                            </motion.div>
                          )}

                          <div className="mt-auto pt-4 border-t border-slate-800/80 flex justify-between items-center">
                            <button 
                              onClick={() => handleSummarize(item)} 
                              className="text-xs font-black text-blue-400 flex items-center gap-1.5 uppercase tracking-wider hover:text-blue-300 disabled:opacity-50 transition-all"
                            >
                              {newsLoadingStates[item.title] ? <Loader2 size={13} className="animate-spin text-blue-400" /> : <Sparkles size={13} />}
                              <span>{newsLoadingStates[item.title] ? t("Analiz...", "Analyzing...") : t("AI Analiz", "AI Summary")}</span>
                            </button>

                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/60"
                            >
                              <span>{t("Kaynağa Git", "Read")}</span>
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Manual Asset Add Modal */}
      <AnimatePresence>
        {isAddingAsset && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingAsset(false)} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-[0_0_100px_rgba(37,99,235,0.1)]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black tracking-tighter">{t("Yeni Varlık", "New Asset")}</h2>
                <button onClick={() => setIsAddingAsset(false)} className="p-2 hover:bg-slate-800 rounded-full transition-all"><X size={24} /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2"><label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">{t("Varlık İsmi", "Asset Name")}</label><input value={newAsset.name} onChange={e => setNewAsset(p => ({ ...p, name: e.target.value }))} className="w-full p-5 bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold transition-all" placeholder="Örn: Arsa" /></div>
                <div className="space-y-2"><label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">{t("Miktar", "Amount")}</label><input type="number" value={newAsset.amount} onChange={e => setNewAsset(p => ({ ...p, amount: e.target.value }))} className="w-full p-5 bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold transition-all" placeholder="10" /></div>
                <div className="space-y-2"><label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">{t("Birim Fiyat (₺)", "Unit Price (₺)")}</label><input type="number" value={newAsset.price} onChange={e => setNewAsset(p => ({ ...p, price: e.target.value }))} className="w-full p-5 bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold transition-all" placeholder="2500" /></div>
                <div className="space-y-2"><label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">{t("Birim", "Unit")}</label><input value={newAsset.unit} onChange={e => setNewAsset(p => ({ ...p, unit: e.target.value }))} className="w-full p-5 bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold transition-all" placeholder="Adet, gr" /></div>
              </div>
              <button onClick={handleAddCustomAsset} className="w-full py-6 bg-blue-600 text-white font-black rounded-2xl mt-10 shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em]">{t("Varlığı Kaydet", "Save Asset")}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 z-[120] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col border-l border-slate-800">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Settings className="text-blue-500" /> {t("Ayarlar", "Settings")}</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white"><X size={24} /></button>
              </div>
              
              <div className="p-10 space-y-12 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-600 p-1 flex items-center justify-center bg-slate-800 shadow-2xl group-hover:scale-105 transition-transform duration-500">
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
                        {profileImage ? <img src={profileImage} className="w-full h-full object-cover" /> : <User size={56} className="text-slate-500" />}
                      </div>
                    </div>
                    <label className="absolute bottom-1 right-1 p-3 bg-blue-600 rounded-2xl cursor-pointer shadow-xl hover:scale-110 active:scale-90 transition-all border border-blue-400/50">
                      <Camera size={18} />
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{t("Görünen İsim", "Display Name")}</label>
                    <input value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center font-black text-lg focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-all shadow-inner" />
                  </div>
                </div>

                <section className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase px-2 tracking-[0.3em] flex items-center gap-2"><Sun size={12} /> {t("GÖRÜNÜM", "APPEARANCE")}</h3>
                  <div className="space-y-3">
                    <button onClick={() => setIsGlass(!isGlass)} className="w-full p-5 rounded-3xl bg-slate-800/40 border border-slate-700 flex items-center justify-between hover:bg-slate-800 transition-all group shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-700 rounded-xl group-hover:bg-blue-600/20 transition-all"><Fingerprint size={20} className="text-slate-400 group-hover:text-blue-500" /></div>
                        <span className="text-sm font-bold">{t("Cam (Glass) Efekti", "Glassmorphism Effect")}</span>
                      </div>
                      <div className={`w-12 h-7 rounded-full relative transition-all duration-300 ${isGlass ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${isGlass ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase px-2 tracking-[0.3em] flex items-center gap-2"><Languages size={12} /> {t("DİL SEÇENEĞİ", "LANGUAGE")}</h3>
                  <div className="flex gap-3">
                    {[
                      { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
                      { code: 'en', label: 'English', flag: '🇺🇸' }
                    ].map(l => (
                      <button 
                        key={l.code} 
                        onClick={() => setLanguage(l.code as AppLanguage)}
                        className={`flex-1 p-5 rounded-3xl border transition-all flex flex-col items-center gap-2 ${language === l.code ? 'bg-blue-600/10 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                      >
                        <span className="text-2xl">{l.flag}</span>
                        <span className="text-xs font-black uppercase tracking-widest">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="p-8 bg-red-950/10 border border-red-900/20 rounded-[2rem] space-y-4">
                  <div className="flex items-center gap-3 text-red-500 font-black text-[10px] uppercase tracking-widest">
                    <div className="p-2 bg-red-500/20 rounded-lg"><ShieldAlert size={16} /></div>
                    {t("ÖNEMLİ YASAL UYARI", "IMPORTANT LEGAL DISCLAIMER")}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 font-medium italic">
                    {t("Bu uygulamada sunulan tüm veriler ve AI yorumları bilgilendirme amaçlıdır. Kesinlikle yatırım tavsiyesi değildir.", "All data and AI interpretations in this app are for informational purposes only. This is strictly not investment advice.")}
                  </p>
                </div>

                <div className="text-center space-y-2">
                  <div className="text-[10px] text-slate-700 font-black uppercase tracking-[0.5em]">Pure Dark 2.7.0</div>
                  <div className="text-[9px] text-slate-800 font-bold uppercase tracking-widest">© 2026 GoldCalc AI Professional</div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAnalysisModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 relative border border-slate-800 shadow-[0_0_150px_rgba(37,99,235,0.15)]">
              <button onClick={() => setShowAnalysisModal(false)} className="absolute top-10 right-10 p-3 hover:text-red-500 transition-all text-slate-500"><X size={28} /></button>
              <div className="flex items-center gap-6 mb-10">
                <div className="p-5 bg-blue-600 text-white rounded-[1.5rem] shadow-2xl"><Sparkles size={40} /></div>
                <div>
                  <h2 className="text-4xl font-black tracking-tighter">{t("AI Stratejik Analiz", "AI Strategic Analysis")}</h2>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">GEMINI PRO FİNANSAL MODELİ</p>
                </div>
              </div>
              <div className="max-h-[55vh] overflow-y-auto custom-scrollbar leading-relaxed text-base pr-4 text-slate-300 font-medium italic">
                {analysisLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <Loader2 size={64} className="animate-spin text-blue-500" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-500/50">{t("Piyasa Verileri Analiz Ediliyor...", "Analyzing Market Data...")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {portfolioAnalysis?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                )}
              </div>
              <div className="mt-12 flex justify-end">
                <button onClick={() => setShowAnalysisModal(false)} className="px-14 py-5 bg-white text-slate-900 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl tracking-widest uppercase text-xs">{t("ANLADIM", "I UNDERSTAND")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
