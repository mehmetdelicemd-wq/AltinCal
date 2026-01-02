
import React, { useState, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { OHLCData } from '../types';

interface ChartSectionProps {
  data: OHLCData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-50">
        <p className="text-xs font-bold text-gray-400 mb-2">{data.date}</p>
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">Fiyat:</span>
          <span className="font-bold text-slate-900 dark:text-white">₺{data.close.toFixed(2)}</span>
        </div>
      </div>
    );
  }
  return null;
};

const ChartSection: React.FC<ChartSectionProps> = ({ data }) => {
  const [interval, setInterval] = useState('1G');

  const filteredData = useMemo(() => {
    if (!data) return [];
    switch (interval) {
      case '1S': return data.slice(-5); // Show last 5 periods
      case '1H': return data; // Show all (15 periods in mock)
      case '1G': default: return data.slice(-10); // Show last 10 periods
    }
  }, [data, interval]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 card-shadow h-[480px] flex items-center justify-center">
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Grafik yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 card-shadow h-[480px] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-black text-gray-800 dark:text-white leading-none">Gram Altın Trendi</h3>
          <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Anlık Piyasa Verisi</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            {['1S', '1G', '1H'].map(int => (
              <button 
                key={int}
                onClick={() => setInterval(int)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${interval === int ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
              >
                {int}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b822" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
            />
            <YAxis 
              domain={['dataMin - 10', 'dataMax + 10']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              orientation="right"
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#d4af37', strokeWidth: 1, strokeDasharray: '5 5' }} 
            />
            <Area 
              type="monotone" 
              dataKey="close" 
              stroke="#d4af37" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorClose)" 
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center items-center gap-4 mt-4 py-2 border-t border-gray-50 dark:border-slate-800">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Canlı Veri Akışı</span>
      </div>
    </div>
  );
};

export default ChartSection;
