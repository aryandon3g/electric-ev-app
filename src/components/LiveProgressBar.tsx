import React, { useEffect } from 'react';
import { Zap } from 'lucide-react';
import { motion, useSpring, useTransform } from 'motion/react';

interface LiveProgressBarProps {
  percentage: number;
  isCharging: boolean;
  voltage: number;
  estimatedRangeKM: number;
}

export function LiveProgressBar({ percentage, isCharging, voltage, estimatedRangeKM }: LiveProgressBarProps) {
  // Smoothly animate the percentage value
  const animatedPercent = useSpring(percentage, { bounce: 0, duration: 1500 });
  const displayPercentCharging = useTransform(animatedPercent, (v) => v.toFixed(3));
  const displayPercentNormal = useTransform(animatedPercent, (v) => Math.round(v).toString());
  
  useEffect(() => {
    animatedPercent.set(percentage);
  }, [percentage, animatedPercent]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Animate the stroke using the same spring value for perfect sync
  const strokeDashoffset = useTransform(animatedPercent, (v) => circumference - (v / 100) * circumference);

  return (
    <div className={`bg-white border ${isCharging ? 'border-green-200 shadow-[0_8px_30px_rgba(34,197,94,0.12)]' : 'border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.06)]'} rounded-[2.5rem] p-8 w-full relative flex flex-col items-center justify-center transition-all duration-500`}>
      {isCharging && (
        <div className="absolute inset-0 bg-green-500/5 animate-pulse rounded-[2.5rem] pointer-events-none" />
      )}
      
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* SVG Circular Progress */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#F3F4F6"
            strokeWidth="6"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={isCharging ? '#22C55E' : percentage > 20 ? '#3B82F6' : '#EF4444'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset }}
          />
        </svg>

        {/* Inner Content */}
        <div className="flex flex-col items-center justify-center relative z-10 text-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${isCharging ? 'bg-green-100 text-green-500 animate-pulse shadow-md' : 'bg-blue-50 text-blue-500 shadow-sm'}`}>
            <Zap size={20} className={isCharging ? 'fill-green-500' : 'fill-blue-500'} />
          </div>
          <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tighter flex items-baseline ${isCharging ? 'text-green-500' : 'text-gray-900'}`}>
            {isCharging ? (
              <motion.span>{displayPercentCharging}</motion.span>
            ) : (
              <motion.span>{displayPercentNormal}</motion.span>
            )}
            <span className="text-3xl font-bold ml-1 text-gray-400">%</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col items-center justify-center text-center bg-gray-50/80 px-8 py-4 rounded-3xl border border-gray-100 w-full">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
          Estimated Range
        </span>
        <div className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
          {estimatedRangeKM.toFixed(0)} <span className="text-xl sm:text-2xl font-bold text-gray-400 ml-1">km</span>
        </div>
      </div>
    </div>
  );
}
