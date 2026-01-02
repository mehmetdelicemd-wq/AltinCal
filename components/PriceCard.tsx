
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface PriceCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  change?: number;
  colorClass?: string;
  delay?: number;
}

const generateSparkData = () => Array.from({ length: 8 }, () => ({ v: 40 + Math.random() * 20 }));

const PriceCard: React.FC<PriceCardProps> = ({ label, value, unit, icon, change, colorClass = "text-gray-700", delay = 0 }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const sparkData = useMemo(() => generateSparkData(), []);

  useEffect(() => {
    if (value !== '...') {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const isPositive = change !== undefined ? change >= 0 : true;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border ${isUpdating ? 'border-yellow-300' : 'border-gray-100 dark:border-slate-800'} card-shadow transition-colors duration-500 hover:scale-[1.02] relative overflow-hidden h-full flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
          {change !== undefined && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black mt-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              %{Math.abs(change).toFixed(2)}
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 ${colorClass} shadow-sm`}>
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div className="flex items-baseline gap-1">
          <AnimatePresence mode="wait">
            <motion.span 
              key={value}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-black text-gray-900 dark:text-white"
            >
              {typeof value === 'number' ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
            </motion.span>
          </AnimatePresence>
          <span className="text-xs font-bold text-gray-400 dark:text-slate-500">{unit}</span>
        </div>

        <div className="w-16 h-8 opacity-50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line 
                type="monotone" 
                dataKey="v" 
                stroke={isPositive ? '#22c55e' : '#ef4444'} 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isUpdating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          className="absolute inset-0 bg-yellow-400 pointer-events-none"
        />
      )}
    </motion.div>
  );
};

export default PriceCard;
