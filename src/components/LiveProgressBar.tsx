import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface LiveProgressBarProps {
  percentage: number;
  isCharging: boolean;
  voltage: number;
}

export function LiveProgressBar({ percentage, isCharging, voltage }: LiveProgressBarProps) {
  const [displayPercent, setDisplayPercent] = useState(percentage);
  const [displayVoltage, setDisplayVoltage] = useState(voltage);

  // Sync with real data every time it updates
  useEffect(() => {
    setDisplayPercent(prev => {
      // Avoid jumping backwards during the simulated fast charging
      if (isCharging && percentage < prev && (prev - percentage) < 5.0) return prev;
      return percentage;
    });
    setDisplayVoltage(prev => {
      if (isCharging && voltage < prev && (prev - voltage) < 2.0) return prev;
      return voltage;
    });
  }, [percentage, voltage, isCharging]);

  // Interpolate between updates for ultra-smooth granular look
  useEffect(() => {
    if (!isCharging) return;
    
    const interval = setInterval(() => {
      setDisplayPercent(p => {
        // Increment by a visible amount for satisfaction
        const next = p + 0.0123;
        return next > 100 ? 100 : next;
      });
      setDisplayVoltage(v => {
        const next = v + 0.0021;
        return next;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isCharging]);

  return (
    <div className={`bg-white border ${isCharging ? 'border-green-200 shadow-[0_8px_30px_rgba(34,197,94,0.12)]' : 'border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)]'} rounded-3xl p-6 w-full relative overflow-hidden transition-all duration-500`}>
      {isCharging && (
        <div className="absolute inset-0 bg-green-500/5 animate-pulse pointer-events-none" />
      )}
      <div className="flex justify-between items-end mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCharging ? 'bg-green-100 text-green-500 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
            <Zap size={16} className={isCharging ? 'fill-green-500' : ''} />
          </div>
          <span className={`font-bold text-xs uppercase tracking-wider ${isCharging ? 'text-green-600' : 'text-gray-400'}`}>
            {isCharging ? 'Live Charging...' : 'Live Battery'}
          </span>
        </div>
        <div className="text-right flex items-baseline gap-1">
          <span className={`text-4xl font-extrabold font-mono tracking-tighter ${isCharging ? 'text-green-500' : 'text-gray-900'}`}>
            {displayPercent.toFixed(3)}<span className="text-2xl font-bold ml-1 text-gray-400">%</span>
          </span>
        </div>
      </div>
      
      <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50 p-1 shadow-inner">
        <div 
          className={`h-full rounded-full transition-all duration-75 relative overflow-hidden ${
            isCharging ? 'bg-green-500 shadow-md' : displayPercent > 20 ? 'bg-blue-500 shadow-sm' : 'bg-red-500 shadow-sm'
          }`}
          style={{ width: `${displayPercent}%` }}
        >
          {isCharging && (
             <div className="absolute top-0 left-0 h-full bg-white/30 w-1/3 animate-shimmer skew-x-[-20deg]" />
          )}
        </div>
      </div>
      
      <div className="mt-4 flex justify-between text-xs font-medium text-gray-400 relative z-10 items-center">
        <span className="font-mono font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 text-gray-700 shadow-sm">
          {displayVoltage.toFixed(3)} V
        </span>
        <span className="uppercase tracking-widest text-[10px] font-bold">High Precision BMS</span>
      </div>
    </div>
  );
}
