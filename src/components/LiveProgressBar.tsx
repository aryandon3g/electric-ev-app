import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface LiveProgressBarProps {
  percentage: number;
  isCharging: boolean;
  voltage: number;
  estimatedRangeKM: number;
}

export function LiveProgressBar({ percentage, isCharging, voltage, estimatedRangeKM }: LiveProgressBarProps) {
  const [displayPercent, setDisplayPercent] = useState(percentage);
  const [displayVoltage, setDisplayVoltage] = useState(voltage);

  // When smoothing is applied at the hook level, we don't need manual interpolation here.
  useEffect(() => {
    setDisplayPercent(percentage);
    setDisplayVoltage(voltage);
  }, [percentage, voltage]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayPercent / 100) * circumference;

  return (
    <div className={`bg-white border ${isCharging ? 'border-green-200 shadow-[0_8px_30px_rgba(34,197,94,0.12)]' : 'border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)]'} rounded-[2.5rem] p-8 w-full relative flex flex-col items-center justify-center transition-all duration-500`}>
      {isCharging && (
        <div className="absolute inset-0 bg-green-500/5 animate-pulse rounded-[2.5rem] pointer-events-none" />
      )}
      
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* SVG Circular Progress */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="128"
            cy="128"
            r={radius}
            fill="transparent"
            stroke="#F3F4F6"
            strokeWidth="12"
          />
          <motion.circle
            cx="128"
            cy="128"
            r={radius}
            fill="transparent"
            stroke={isCharging ? '#22C55E' : displayPercent > 10 ? '#3B82F6' : '#EF4444'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ type: "spring", bounce: 0, duration: 1.5 }}
          />
        </svg>

        {/* Inner Content */}
        <div className="flex flex-col items-center justify-center relative z-10 text-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${isCharging ? 'bg-green-100 text-green-500 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
            <Zap size={16} className={isCharging ? 'fill-green-500' : ''} />
          </div>
          <span className={`text-5xl font-extrabold font-mono tracking-tighter ${isCharging ? 'text-green-500' : 'text-gray-900'}`}>
            {displayPercent.toFixed(1)}<span className="text-2xl font-bold ml-1 text-gray-400">%</span>
          </span>
          <span className="mt-1 font-bold text-[10px] uppercase tracking-widest text-gray-400">
            {displayVoltage.toFixed(2)}V
          </span>
        </div>
      </div>
      
      <div className="mt-6 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Est. Range</span>
        <div className="text-3xl font-extrabold text-gray-900">
          {estimatedRangeKM.toFixed(0)} <span className="text-lg text-gray-400">km</span>
        </div>
      </div>
    </div>
  );
}
