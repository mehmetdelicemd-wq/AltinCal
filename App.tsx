
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Coins, 
  RefreshCw, 
  Calculator as CalcIcon, 
  ExternalLink,
  Info,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketSummary, PriceData } from './types';
import { fetchLivePrices, generateMockHistory } from './services/geminiService';
import PriceCard from './components/PriceCard';
import ChartSection from './components/ChartSection';

const App: React.FC = () => {
  const [market, setMarket] = useState<MarketSummary>({
    current: null,
    history: [],
    loading: true,
    error: null,
  });

  const [manualInputs, setManualInputs] = useState({
    ounce: '',
    usdTry: ''
  });

  const [manualResult, setManualResult] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setMarket(prev => ({ ...prev, loading: true, error: null }));
    try {
      const liveData = await fetchLivePrices();
      const mockHistory = generateMockHistory(liveData.gramPrice);
      setMarket({
        current: liveData,
        history: mockHistory,
        loading: false,
        error: null,
      });
      // Initial manual inputs sync
      setManualInputs({
        ounce: liveData.ouncePrice.toFixed(2),
        usdTry: liveData.usdTryRate.toFixed(2)
      });
      setManualResult(liveData.gramPrice);
    } catch (err) {
      setMarket(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Veriler alınırken bir hata oluştu. Lütfen tekrar deneyin." 
      }));
    }
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const ounce = parseFloat(manualInputs.ounce);
    const usdTry = parseFloat(manualInputs.usdTry);
    if (!isNaN(ounce) && !isNaN(usdTry)) {
      const result = (ounce / 31.1035) * usdTry;
      setManualResult(result);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer"
            >
              <TrendingUp size={24} />
            </motion.div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              GoldCalc Pro
            </h1>
          </div>
          <button 
            onClick={loadData}
            disabled={market.loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-600 transition-all disabled:opacity-50 group"
          >
            <RefreshCw size={18} className={`${market.loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Güncelle
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <AnimatePresence>
          {market.error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3"
            >
              <Info size={20} />
              <p className="text-sm font-medium">{market.error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Market Dashboard */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-bold text-gray-800">Canlı Piyasa Verileri</h2>
            <AnimatePresence mode="wait">
              {market.current && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={market.current.timestamp}
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold"
                >
                  Canlı: {market.current.timestamp}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PriceCard 
              label="Gram Altın" 
              value={market.current?.gramPrice || '...'} 
              unit="₺" 
              icon={<Coins size={20} />} 
              colorClass="text-yellow-600"
              delay={0.1}
            />
            <PriceCard 
              label="Ons Altın" 
              value={market.current?.ouncePrice || '...'} 
              unit="$" 
              icon={<TrendingUp size={20} />} 
              colorClass="text-blue-600"
              delay={0.2}
            />
            <PriceCard 
              label="Dolar/TL" 
              value={market.current?.usdTryRate || '...'} 
              unit="₺" 
              icon={<DollarSign size={20} />} 
              colorClass="text-green-600"
              delay={0.3}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Area */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 space-y-8"
          >
            <ChartSection data={market.history} />
            
            {/* Sources */}
            <AnimatePresence>
              {market.current?.sources && market.current.sources.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-6 rounded-2xl border border-gray-100 card-shadow"
                >
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Veri Kaynakları</h3>
                  <div className="flex flex-wrap gap-3">
                    {market.current.sources.map((source, idx) => (
                      <motion.a 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={idx}
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-600 border border-gray-100 transition-colors"
                      >
                        <ExternalLink size={14} />
                        {source.title.slice(0, 30)}...
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Calculator Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="bg-white p-6 rounded-2xl border border-gray-100 card-shadow h-fit sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <CalcIcon size={20} className="text-yellow-600" />
                <h3 className="text-lg font-bold text-gray-800">Hesap Makinesi</h3>
              </div>
              
              <form onSubmit={handleManualCalculate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Ons Altın ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={manualInputs.ounce}
                    onChange={(e) => setManualInputs(prev => ({ ...prev, ounce: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:outline-none font-bold text-gray-900 placeholder-gray-400"
                    placeholder="Örn: 2045.50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Dolar/TL Kuru (₺)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={manualInputs.usdTry}
                    onChange={(e) => setManualInputs(prev => ({ ...prev, usdTry: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:outline-none font-bold text-gray-900 placeholder-gray-400"
                    placeholder="Örn: 30.50"
                  />
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  Hesapla
                  <ChevronRight size={18} />
                </motion.button>
              </form>

              <AnimatePresence>
                {manualResult !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 pt-8 border-t border-gray-100"
                  >
                    <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Tahmini Gram Fiyatı</p>
                    <div className="flex items-baseline gap-2">
                      <motion.span 
                        key={manualResult}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-black text-gray-900"
                      >
                        {manualResult.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </motion.span>
                      <span className="text-xl font-bold text-gray-400">₺</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400 leading-relaxed italic">
                      * Hesaplama (Ons / 31.1035) × Kur formülü ile yapılmıştır.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>
      
      {/* Footer Branding */}
      <footer className="mt-12 text-center text-gray-400 text-sm">
        <p>© 2024 GoldCalc Pro • Canlı Veriler Gemini Tarafından Sağlanmaktadır</p>
      </footer>
    </div>
  );
};

export default App;
