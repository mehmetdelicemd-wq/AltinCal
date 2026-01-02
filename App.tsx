
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  TrendingUp, DollarSign, Coins, RefreshCw, Calculator as CalcIcon, 
  ExternalLink, Info, ChevronRight, Briefcase, PieChart as PieIcon, 
  MessageSquare, Newspaper, Send, ArrowUpRight, ArrowDownRight,
  Sun, Moon, Bell, BellRing, X, Trash2, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line } from 'recharts';
import { MarketSummary, PriceData, Asset, NewsItem, ChatMessage, PriceAlert } from './types';
import { fetchLivePrices, generateMockOHLC, fetchMarketNews, chatWithAI } from './services/geminiService';
import PriceCard from './components/PriceCard';
import ChartSection from './components/ChartSection';

const DEFAULT_ASSETS: Asset[] = [
  { id: 'gold', name: 'Altın', amount: '0', priceKey: 'gramPrice', changeKey: 'gramChange', color: '#d4af37', unit: 'gr' },
  { id: 'usd', name: 'Dolar', amount: '0', priceKey: 'usdTryRate', changeKey: 'usdTryChange', color: '#22c55e', unit: '$' },
  { id: 'eur', name: 'Euro', amount: '0', priceKey: 'eurTryRate', changeKey: 'eurTryChange', color: '#3b82f6', unit: '€' },
  { id: 'silver', name: 'Gümüş', amount: '0', priceKey: 'silverPrice', changeKey: 'silverChange', color: '#94a3b8', unit: 'gr' },
  { id: 'btc', name: 'Bitcoin', amount: '0', priceKey: 'btcPrice', changeKey: 'btcChange', color: '#f59e0b', unit: 'BTC' },
  { id: 'eth', name: 'Ethereum', amount: '0', priceKey: 'ethPrice', changeKey: 'ethChange', color: '#6366f1', unit: 'ETH' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'market' | 'assets' | 'ai' | 'news'>('market');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem('price_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [market, setMarket] = useState<MarketSummary>({
    current: null, history: [], loading: true, error: null,
  });
  
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('user_assets');
    return saved ? JSON.parse(saved) : DEFAULT_ASSETS;
  });

  const [news, setNews] = useState<NewsItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [manualInputs, setManualInputs] = useState({ ounce: '', usdTry: '' });
  
  const manualResult = useMemo(() => {
    const o = parseFloat(manualInputs.ounce);
    const u = parseFloat(manualInputs.usdTry);
    if (!isNaN(o) && !isNaN(u)) return (o / 31.1035) * u;
    return null;
  }, [manualInputs]);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newAlertPrice, setNewAlertPrice] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('user_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('price_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(chatMessages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const checkAlerts = useCallback((currentGram: number) => {
    let triggered = false;
    const updatedAlerts = alerts.map(alert => {
      if (alert.isActive) {
        if (alert.type === 'above' && currentGram >= alert.targetPrice) {
          alert.isActive = false;
          triggered = true;
          if (Notification.permission === "granted") {
            new Notification("Fiyat Alarmı!", { body: `Gram altın ₺${alert.targetPrice.toLocaleString()} seviyesine ulaştı!` });
          }
        }
      }
      return alert;
    });
    if (triggered) setAlerts(updatedAlerts);
  }, [alerts]);

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
        error: null,
      });
      setNews(newsData);
      setManualInputs({ ounce: liveData.ouncePrice.toFixed(2), usdTry: liveData.usdTryRate.toFixed(2) });
      checkAlerts(liveData.gramPrice);
    } catch (err) {
      setMarket(prev => ({ ...prev, loading: false, error: "Veriler alınırken bir hata oluştu." }));
    }
  }, [checkAlerts]);

  useEffect(() => { 
    loadData();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== "granted") Notification.requestPermission();
    }
  }, [loadData]);

  const portfolioData = useMemo(() => {
    if (!market.current) return [];
    return assets.map(asset => {
      const price = market.current![asset.priceKey] as number;
      const amount = parseFloat(asset.amount) || 0;
      return { 
        name: asset.name, 
        value: amount * price, 
        color: asset.color, 
        change: market.current![asset.changeKey] 
      };
    }).filter(a => a.value > 0);
  }, [assets, market.current]);

  const totalValue = useMemo(() => portfolioData.reduce((sum, item) => sum + item.value, 0), [portfolioData]);

  const handleAiSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput;
    setAiInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await chatWithAI(userMsg, history);
      setChatMessages(prev => [...prev, { role: 'model', text: response || '' }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Üzgünüm, şu an analiz gerçekleştiremiyorum." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const clearChatHistory = () => {
    if (confirm("Sohbet geçmişi tamamen silinecek. Onaylıyor musunuz?")) {
      setChatMessages([]);
      localStorage.removeItem('chat_history');
    }
  };

  const handleAssetChange = (id: string, value: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, amount: value } : a));
  };

  const addAlert = () => {
    const price = parseFloat(newAlertPrice);
    if (isNaN(price)) return;
    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      targetPrice: price,
      type: 'above',
      isActive: true
    };
    setAlerts([...alerts, newAlert]);
    setNewAlertPrice('');
    setIsAlertModalOpen(false);
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer"
              >
                <TrendingUp size={24} />
              </motion.div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white hidden sm:block tracking-tighter">GoldCalc Pro</h1>
            </div>
            <nav className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { id: 'market', label: 'Piyasa', icon: TrendingUp },
                { id: 'assets', label: 'Varlıklarım', icon: Briefcase },
                { id: 'ai', label: 'AI Analiz', icon: MessageSquare },
                { id: 'news', label: 'Haberler', icon: Newspaper }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                >
                  <tab.icon size={16} />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsAlertModalOpen(true)} className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all relative">
              {alerts.some(a => a.isActive) ? <BellRing size={20} className="text-yellow-500 animate-pulse" /> : <Bell size={20} />}
            </button>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={loadData} disabled={market.loading} className="p-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all group">
              <RefreshCw size={18} className={`${market.loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} dark:text-white`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'market' && (
            <motion.div key="market" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <PriceCard 
                  label="Gram Altın" 
                  value={market.current?.gramPrice || '...'} 
                  unit="₺" 
                  icon={<Coins size={20} />} 
                  change={market.current?.gramChange}
                  colorClass="text-yellow-600" 
                />
                <PriceCard 
                  label="Ons Altın" 
                  value={market.current?.ouncePrice || '...'} 
                  unit="$" 
                  icon={<TrendingUp size={20} />} 
                  change={market.current?.ounceChange}
                  colorClass="text-blue-600" 
                />
                <PriceCard 
                  label="Dolar/TL" 
                  value={market.current?.usdTryRate || '...'} 
                  unit="₺" 
                  icon={<DollarSign size={20} />} 
                  change={market.current?.usdTryChange}
                  colorClass="text-green-600" 
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <ChartSection data={market.history} />
                </div>
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl">
                    <h3 className="text-lg font-black mb-1 flex items-center gap-2 dark:text-white leading-none">
                      <CalcIcon size={20} className="text-yellow-500" /> Hızlı Hesapla
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-wider">Manuel Hesap Makinesi</p>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">ONS FİYATI ($)</label>
                        <input type="number" step="0.01" value={manualInputs.ounce} onChange={e => setManualInputs(p => ({ ...p, ounce: e.target.value }))} className="w-full p-4 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black border border-transparent focus:border-yellow-400 focus:outline-none transition-all" placeholder="2000.00" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">DOLAR KURU (₺)</label>
                        <input type="number" step="0.01" value={manualInputs.usdTry} onChange={e => setManualInputs(p => ({ ...p, usdTry: e.target.value }))} className="w-full p-4 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black border border-transparent focus:border-yellow-400 focus:outline-none transition-all" placeholder="32.00" />
                      </div>
                      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100/50 dark:border-yellow-900/30">
                        <p className="text-[10px] font-black text-yellow-700 dark:text-yellow-500 uppercase tracking-widest mb-1">Gram Altın Karşılığı</p>
                        <p className="text-3xl font-black text-yellow-900 dark:text-yellow-400 leading-none">
                          ₺{manualResult !== null ? manualResult.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div key="assets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-xl font-black dark:text-white leading-none">Varlık Yönetimi</h2>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Portföyünüzü Güncelleyin</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {assets.map(asset => {
                      const changeValue = market.current?.[asset.changeKey] as number;
                      const isPositive = changeValue >= 0;
                      return (
                      <div key={asset.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex flex-col gap-3 border border-slate-100 dark:border-slate-700/50 hover:border-blue-400/30 transition-all">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter">{asset.name}</span>
                          <div className={`flex items-center gap-0.5 text-[10px] font-black ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            %{Math.abs(changeValue).toFixed(2)}
                          </div>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={asset.amount} 
                            onChange={e => handleAssetChange(asset.id, e.target.value)} 
                            className="bg-white dark:bg-slate-950 w-full p-4 rounded-xl font-black text-xl border border-transparent focus:border-blue-400 focus:outline-none text-slate-900 dark:text-white shadow-inner transition-all pr-12" 
                            placeholder="0.00"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{asset.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Tahmini Değer</span>
                          <span className="text-sm font-black text-slate-900 dark:text-slate-200">
                            ₺{( (parseFloat(asset.amount) || 0) * (market.current?.[asset.priceKey] as number || 0) ).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 sticky top-24">
                  <h3 className="text-xl font-black mb-2 dark:text-white">Portföy Dağılımı</h3>
                  <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest">Genel Bakış</p>
                  <div className="h-64 relative">
                    {portfolioData.length > 0 ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie 
                            data={portfolioData} 
                            innerRadius={70} 
                            outerRadius={95} 
                            paddingAngle={8} 
                            dataKey="value"
                            stroke="none"
                            animationBegin={0}
                            animationDuration={1000}
                          >
                            {portfolioData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(v: number) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
                        <PieIcon size={64} className="opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Henüz Portföyünüzde<br/>Varlık Yok</p>
                      </div>
                    )}
                    {portfolioData.length > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPLAM</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">₺{totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-8 space-y-2">
                    {portfolioData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">%{(item.value / totalValue * 100).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto h-[75vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><MessageSquare size={20} /></div>
                  <div>
                    <h2 className="font-black text-gray-800 dark:text-white leading-none">Analiz Asistanı</h2>
                    <p className="text-[10px] font-bold text-green-500 mt-1 uppercase tracking-wider">Aktif & Çevrimiçi</p>
                  </div>
                </div>
                {chatMessages.length > 0 && (
                  <button 
                    onClick={clearChatHistory}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all rounded-xl"
                    title="Geçmişi Temizle"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-400 mt-24">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Info className="opacity-30" size={32} />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-black mb-2">Nasıl Yardımcı Olabilirim?</h3>
                    <p className="text-sm font-medium max-w-xs mx-auto text-slate-500">Altın fiyatları, kur tahminleri veya piyasa gündemi hakkında sorularınızı bekliyorum.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-md mx-auto">
                      {["Altın fiyatları ne olur?", "USD/TRY teknik analizi", "Gümüş yatırımı mantıklı mı?", "FED kararı etkileri"].map(q => (
                        <button key={q} onClick={() => { setAiInput(q); }} className="p-3 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/10' : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50 shadow-sm'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl text-slate-400 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest">Gemini Analiz Yapıyor</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleAiSend} className="p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                <input value={aiInput} onChange={e => setAiInput(e.target.value)} className="flex-1 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10 font-medium dark:bg-slate-800 dark:text-white focus:outline-none transition-all placeholder:text-slate-400" placeholder="Bir soru sorun veya analiz isteyin..." />
                <button type="submit" disabled={aiLoading || !aiInput.trim()} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
                  <Send size={24} />
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'news' && (
            <motion.div key="news" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {news.length === 0 ? (
                <div className="col-span-full text-center py-24">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <RefreshCw className="animate-spin text-blue-500" size={48} />
                      <div className="absolute inset-0 blur-lg bg-blue-500/20 animate-pulse"></div>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-[0.2em] text-sm dark:text-white mb-2">Piyasa Radar taranıyor</p>
                      <p className="text-xs text-slate-400 font-bold uppercase">Küresel haber akışı senkronize ediliyor...</p>
                    </div>
                  </div>
                </div>
              ) : news.map((item, i) => (
                <motion.a 
                  key={i} href={item.url} target="_blank" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all group shadow-sm flex flex-col h-full hover:shadow-2xl hover:shadow-blue-500/5"
                >
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest">{item.source}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{item.date}</span>
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white mb-4 group-hover:text-blue-600 transition-colors line-clamp-2 text-base leading-snug">{item.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-3 mb-8 font-medium">{item.snippet}</p>
                  <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-600 tracking-widest uppercase group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">Haber Detayı <ChevronRight size={14} /></span>
                    <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </motion.a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Alert Modal */}
      <AnimatePresence>
        {isAlertModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }} 
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-3xl overflow-hidden relative border border-slate-100 dark:border-slate-800"
            >
              <button onClick={() => setIsAlertModalOpen(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
              <div className="mb-8">
                <h2 className="text-3xl font-black mb-2 dark:text-white tracking-tighter">Akıllı Alarmlar</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Altın fiyatlarını 7/24 takip edin.</p>
              </div>
              
              <div className="space-y-4 mb-10 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="text-center py-12 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Bell className="mx-auto mb-4 text-slate-300" size={40} />
                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Henüz Kurulu Alarm Yok</p>
                  </div>
                ) : alerts.map(alert => (
                  <div key={alert.id} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${alert.isActive ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-inner opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${alert.isActive ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 shadow-lg shadow-yellow-500/10' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                        <Bell size={20} />
                      </div>
                      <div>
                        <p className={`text-lg font-black ${alert.isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>₺{alert.targetPrice.toLocaleString()}</p>
                        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${alert.isActive ? 'text-yellow-600 dark:text-yellow-500' : 'text-slate-400'}`}>{alert.isActive ? 'GÖZLEMLENİYOR' : 'TETİKLENDİ'}</p>
                      </div>
                    </div>
                    <button onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))} className="p-3 text-slate-300 hover:text-red-500 transition-colors rounded-xl">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HEDEF GRAM FİYATI</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={newAlertPrice} 
                    onChange={e => setNewAlertPrice(e.target.value)}
                    placeholder="2500" 
                    className="flex-1 p-5 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-3xl font-black text-xl border border-transparent focus:border-yellow-400 focus:outline-none transition-all shadow-inner"
                  />
                  <button onClick={addAlert} className="px-10 py-5 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black rounded-3xl transition-all shadow-xl shadow-yellow-500/20 active:scale-95 uppercase tracking-widest">KUR</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
