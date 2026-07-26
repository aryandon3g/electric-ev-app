import React from 'react';

interface GaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
}

export function Gauge({ value, size = 200, strokeWidth = 16 }: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  let color = 'text-green-500';
  if (value < 20) color = 'text-red-500';
  else if (value < 50) color = 'text-yellow-500';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          className="text-gray-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Circle */}
        <circle
          className={`${color} transition-all duration-1000 ease-in-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Text in the middle */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tracking-tighter text-white">{value.toFixed(2)}%</span>
        <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mt-1">Capacity</span>
      </div>
    </div>
  );
}
