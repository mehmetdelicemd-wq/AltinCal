
import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { HistoricalData } from '../types';

interface ChartSectionProps {
  data: HistoricalData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-100 rounded-lg shadow-lg">
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p className="text-sm font-bold text-yellow-600">
          ₺{payload[0].value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

const ChartSection: React.FC<ChartSectionProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 card-shadow h-[400px]">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Gram Altın Fiyat Trendi (Simülasyon)</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f1c40f" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f1c40f" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              hide={true} 
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#d4af37" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartSection;
