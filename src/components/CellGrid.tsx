import React from 'react';
import { CellData } from '../types';
import { AlertCircle } from 'lucide-react';

interface CellGridProps {
  cells: CellData[];
}

export function CellGrid({ cells }: CellGridProps) {
  // Find min and max for highlighting imbalances
  const voltages = cells.map(c => c.voltage);
  const maxV = Math.max(...voltages);
  const minV = Math.min(...voltages);
  const delta = (maxV - minV).toFixed(3);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white tracking-wide">Cell Voltages (16S)</h3>
        <div className="bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
          <span className="text-xs text-gray-400 uppercase tracking-wider mr-2">Delta</span>
          <span className="text-sm font-mono font-bold text-blue-400">{delta}V</span>
        </div>
      </div>
      
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {cells.map((cell) => {
          const isMax = cell.voltage === maxV;
          const isMin = cell.voltage === minV;
          const isWarning = cell.healthStatus === 'Warning';
          
          let borderColor = 'border-zinc-800';
          let textColor = 'text-gray-200';
          let bgColor = 'bg-zinc-950';
          let fillBgColor = 'bg-zinc-800/50';
          
          if (isWarning) {
            borderColor = 'border-red-500/50';
            textColor = 'text-red-400';
            bgColor = 'bg-red-950/20';
            fillBgColor = 'bg-red-500/20';
          } else if (isMax) {
            borderColor = 'border-blue-500/50';
            textColor = 'text-blue-400';
          } else if (isMin) {
            borderColor = 'border-red-500/50';
            textColor = 'text-red-400';
          }

          // Calculate fill percentage (assuming 3.0V empty, 4.2V full for Li-ion)
          const fillPercent = Math.max(0, Math.min(100, ((cell.voltage - 3.0) / (4.2 - 3.0)) * 100));

          return (
            <div 
              key={cell.id} 
              className={`relative ${bgColor} rounded-xl p-2 border ${borderColor} flex flex-col items-center justify-center overflow-hidden transition-all`}
            >
              <div 
                className={`absolute bottom-0 left-0 right-0 ${fillBgColor} -z-10 transition-all duration-500`} 
                style={{ height: `${fillPercent}%` }}
              />
              <span className="text-[10px] text-gray-500 mb-1 font-bold tracking-wider flex items-center gap-1">
                C{cell.id} {isWarning && <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />}
              </span>
              <span className={`font-mono text-sm font-bold ${textColor}`}>
                {cell.voltage.toFixed(3)}
              </span>
              {cell.isBalancing && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-5 flex gap-4 text-xs font-medium text-gray-500 justify-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Max Voltage
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" /> Min Voltage
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> Balancing
        </div>
        <div className="flex items-center gap-1.5 text-red-400">
          <AlertCircle className="w-3 h-3 animate-pulse" /> Cell Failure Alert
        </div>
      </div>
    </div>
  );
}
