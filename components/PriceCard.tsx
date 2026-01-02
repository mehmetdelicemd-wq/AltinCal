
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PriceCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  colorClass?: string;
  delay?: number;
}

const PriceCard: React.FC<PriceCardProps> = ({ label, value, unit, icon, colorClass = "text-gray-700", delay = 0 }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (value !== '...') {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`bg-white p-6 rounded-2xl border ${isUpdating ? 'border-yellow-300' : 'border-gray-100'} card-shadow transition-colors duration-500 hover:scale-[1.02] relative overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg bg-gray-50 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1 relative z-10">
        <AnimatePresence mode="wait">
          <motion.span 
            key={value}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="text-2xl font-bold text-gray-900"
          >
            {typeof value === 'number' ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm font-semibold text-gray-400">{unit}</span>
      </div>
      {isUpdating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          className="absolute inset-0 bg-yellow-400"
        />
      )}
    </motion.div>
  );
};

export default PriceCard;
