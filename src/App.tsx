import React, { useState, useEffect, useRef } from 'react';
import { useBMS } from './hooks/useBMS';
import { motion, useMotionValue } from 'motion/react';
import { LiveProgressBar } from './components/LiveProgressBar';
import { 
  Bluetooth, BluetoothOff, Lock, Unlock, 
  Activity, Settings, Thermometer, Battery, 
  ShieldCheck, Zap, Moon, Clock, Navigation, Map, Power, FileWarning, AlertTriangle, AlertCircle, Play, Pause, FastForward, Delete
} from 'lucide-react';
import { CellData } from './types';

const SwipeAction = ({ label, icon: Icon, onAction, active }: { label: string, icon: any, onAction: () => void, active: boolean }) => {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const slideDistance = width ? width - 56 : 280; // 56 is button width + padding

  return (
    <div ref={containerRef} className="relative w-full h-16 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] rounded-full flex items-center px-1 overflow-hidden border border-gray-100">
       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <span className={`font-semibold tracking-wide text-sm uppercase ${active ? 'text-blue-500' : 'text-gray-400'}`}>{label}</span>
       </div>
       <motion.div
         style={{ x }}
         drag="x"
         dragConstraints={{ left: 0, right: slideDistance }}
         dragSnapToOrigin={true}
         onDragEnd={(e, info) => {
           if (info.offset.x > slideDistance * 0.7) {
              onAction();
           }
         }}
         className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-10 cursor-grab active:cursor-grabbing ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
       >
         <Icon size={24} />
       </motion.div>
    </div>
  )
};

const MiniGraph = ({ power }: { power: number }) => {
  const bars = Array.from({ length: 16 });
  return (
    <div className="flex items-end justify-center h-10 gap-1.5 opacity-80">
      {bars.map((_, i) => {
        const height = Math.max(10, Math.min(100, Math.random() * 30 + (Math.abs(power) / 10)));
        return (
          <motion.div
            key={i}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.3 + Math.random() * 0.5, repeat: Infinity, repeatType: 'mirror' }}
            className="w-1.5 bg-blue-500 rounded-full"
          />
        );
      })}
    </div>
  )
};

const CellVoltageGraph = ({ cells }: { cells: CellData[] }) => {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  const maxV = Math.max(...cells.map(c => c.voltage));
  const minV = Math.min(...cells.map(c => c.voltage));

  return (
    <div className="flex flex-col gap-6 mt-2">
      <div className="flex items-end justify-between h-32 gap-1.5 px-1">
        {cells.map((cell) => {
          const isMax = cell.voltage === maxV;
          const isMin = cell.voltage === minV;
          const isWarning = cell.healthStatus === 'Warning';
          
          let color = 'bg-gray-200';
          if (isWarning) color = 'bg-red-500';
          else if (isMax) color = 'bg-blue-500';
          else if (isMin) color = 'bg-orange-500';

          const basePercent = Math.max(15, Math.min(100, ((cell.voltage - 3.0) / (4.2 - 3.0)) * 100));
          
          return (
             <motion.div
               key={cell.id}
               onClick={() => setSelectedCell(cell)}
               animate={{ height: [`${Math.max(10, basePercent - 8)}%`, `${Math.min(100, basePercent + 8)}%`, `${Math.max(10, basePercent - 8)}%`] }}
               transition={{ duration: 1 + Math.random() * 1.5, repeat: Infinity, ease: 'easeInOut' }}
               className={`w-full rounded-t-full cursor-pointer hover:opacity-80 transition-all ${color} relative ${selectedCell?.id === cell.id ? 'ring-2 ring-offset-2 ring-gray-400 shadow-md scale-110 z-10' : ''}`}
             >
               {cell.isBalancing && (
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse shadow-sm" />
               )}
               {isWarning && (
                 <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-red-500">
                   <AlertCircle size={12} className="animate-pulse" />
                 </div>
               )}
             </motion.div>
          );
        })}
      </div>
      
      <div className="h-24">
        {selectedCell ? (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between h-full shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                Cell {selectedCell.id}
                {selectedCell.healthStatus === 'Warning' && <AlertCircle className="w-3 h-3 text-red-500" />}
              </div>
              <div className="text-2xl font-mono font-extrabold text-gray-900">
                {selectedCell.voltage.toFixed(3)}<span className="text-sm text-gray-400 ml-1">V</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${selectedCell.healthStatus === 'Warning' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {selectedCell.healthStatus || 'Good'}
              </div>
              {selectedCell.isBalancing && (
                <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span> Balancing
                </div>
              )}
              {selectedCell.voltage === maxV && (
                <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider px-2 py-0.5 bg-blue-50 rounded-full">Max Voltage</div>
              )}
              {selectedCell.voltage === minV && (
                <div className="text-[9px] font-bold text-orange-600 uppercase tracking-wider px-2 py-0.5 bg-orange-50 rounded-full">Min Voltage</div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 h-full flex flex-col items-center justify-center text-xs font-bold text-gray-400 uppercase tracking-wider text-center gap-2">
            <Activity size={20} className="text-gray-300" />
            Tap a dancing bar<br/>to view cell diagnostic
          </div>
        )}
      </div>
    </div>
  );
};

const Keypad = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === '8931') {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 500);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center justify-center h-full pt-8">
      <div className="text-center mb-8">
        <Lock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900">Enter PIN</h2>
        <p className="text-sm text-gray-400 mt-1">Controls are locked</p>
      </div>

      <div className="flex gap-4 mb-10">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${pin.length > i ? 'bg-blue-500' : 'bg-gray-200'} ${error ? 'bg-red-500' : ''}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handlePress(num.toString())}
            className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-100 text-2xl font-semibold text-gray-900 active:bg-gray-50 transition-colors flex items-center justify-center"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePress('0')}
          className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-100 text-2xl font-semibold text-gray-900 active:bg-gray-50 transition-colors flex items-center justify-center"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-gray-400 active:text-gray-600 transition-colors bg-white shadow-sm border border-gray-100"
        >
          <Delete className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const { 
    bmsData, connectBluetooth, disconnect, isConnected, 
    startDemo, isDemoMode, demoState, toggleDemoCharging, toggleDemoDischarging, 
    toggleAntiTheft, setChargeLimit, setReserveBuffer, setMaxRange
  } = useBMS();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'diagnostics' | 'controls'>('dashboard');
  const [controlsUnlocked, setControlsUnlocked] = useState(false);
  const [kidMode, setKidMode] = useState(false);
  const [deepSleep, setDeepSleep] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#333333] font-sans selection:bg-blue-100 flex justify-center">
      {/* Mobile Constraint Container */}
      <div className="w-full max-w-md bg-[#F8F9FA] min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <header className="px-6 pt-8 pb-2 flex items-center justify-end z-10">
          <div className="flex gap-2">
            {!isConnected && !isDemoMode && (
              <button 
                onClick={startDemo}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
              >
                Demo
              </button>
            )}
            <button 
              onClick={isConnected || isDemoMode ? disconnect : connectBluetooth}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${isConnected || isDemoMode ? 'bg-blue-50 text-blue-500' : 'bg-white text-gray-400 border border-gray-100'}`}
            >
              {isConnected || isDemoMode ? <Bluetooth size={18} /> : <BluetoothOff size={18} />}
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center h-full">
              
              <div className="w-full mb-4">
                <LiveProgressBar 
                  percentage={bmsData.capacityPercent} 
                  isCharging={bmsData.status === 'Charging'} 
                  voltage={bmsData.voltage}
                  estimatedRangeKM={bmsData.estimatedRangeKM} 
                />
              </div>

              {isDemoMode && (
                <div className="w-full bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-4 flex flex-col gap-2.5">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Demo Tools</span>
                     <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase">Simulation</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                     <button 
                       onClick={toggleDemoCharging}
                       className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl font-bold text-xs transition-colors ${demoState === 'charging' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                     >
                       <Zap size={14} /> {demoState === 'charging' ? 'Charging...' : 'Start Charge'}
                     </button>
                     <button 
                       onClick={toggleDemoDischarging}
                       className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl font-bold text-xs transition-colors ${demoState === 'discharging' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                     >
                       <FastForward size={14} /> {demoState === 'discharging' ? 'Driving...' : 'Start Drive'}
                     </button>
                   </div>
                </div>
              )}

              <div className="w-full mb-4">
                {bmsData.status === 'Charging' && bmsData.timeToFullChargeMinutes !== null ? (
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-3xl p-4 shadow-sm flex items-center justify-between">
                     <div className="flex items-center gap-3 text-blue-600">
                       <Clock size={20} />
                       <div>
                         <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Time to Full Charge</div>
                         <div className="text-lg font-black">
                           {Math.floor(bmsData.timeToFullChargeMinutes / 60)}<span className="text-xs font-medium mx-1">h</span>
                           {Math.floor(bmsData.timeToFullChargeMinutes % 60)}<span className="text-xs font-medium ml-1">m</span>
                         </div>
                       </div>
                     </div>
                     <span className="bg-blue-600 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">Charging</span>
                  </div>
                ) : null}
              </div>

              <div className="w-full bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Live Power Usage</span>
                  <MiniGraph power={bmsData.power} />
                  <div className="mt-1.5 text-xs font-medium text-gray-600">{Math.abs(bmsData.power).toFixed(0)}W</div>
                </div>
              </div>

              <div className="w-full mt-auto">
                <SwipeAction 
                  label={bmsData.isLocked ? "Swipe to Unlock" : "Swipe to Lock"}
                  icon={bmsData.isLocked ? Lock : Unlock}
                  active={bmsData.isLocked}
                  onAction={toggleAntiTheft}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'diagnostics' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bmsData.temperature > 40 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    <Thermometer size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Temperature</h3>
                    <p className="text-2xl font-extrabold text-gray-900">{bmsData.temperature.toFixed(1)}°C</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${bmsData.thermalState === 'Normal' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                  {bmsData.thermalState}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex justify-between items-center">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                       <Map size={20} />
                     </div>
                     <div>
                       <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Trip Energy</div>
                       <div className="text-xl font-extrabold text-gray-900">
                         {bmsData.tripEnergyWh.toFixed(0)}<span className="text-sm text-gray-400 ml-1">Wh</span>
                       </div>
                     </div>
                   </div>
                   <div className="text-right">
                       <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Efficiency</div>
                       <div className="text-sm font-bold text-gray-700">
                         {bmsData.efficiencyWhPerKm} <span className="text-xs text-gray-400">Wh/km</span>
                       </div>
                   </div>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                   <div className="flex items-center gap-2 text-gray-400 mb-2">
                     <Zap size={18} className="text-yellow-500" />
                     <span className="text-[10px] font-bold uppercase tracking-wider">Voltage</span>
                   </div>
                   <div className="text-2xl font-extrabold text-gray-900">
                     {bmsData.voltage.toFixed(2)}<span className="text-sm text-gray-400 ml-1">V</span>
                   </div>
                </div>
                
                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                   <div className="flex items-center gap-2 text-gray-400 mb-2">
                     <Activity size={18} className="text-blue-500" />
                     <span className="text-[10px] font-bold uppercase tracking-wider">Current</span>
                   </div>
                   <div className="text-2xl font-extrabold text-gray-900">
                     {Math.abs(bmsData.current).toFixed(1)}<span className="text-sm text-gray-400 ml-1">A</span>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Cell Voltages (16S)</h3>
                  <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delta</span>
                    <span className="text-sm font-mono font-bold text-blue-600">{(Math.max(...bmsData.cells.map(c => c.voltage)) - Math.min(...bmsData.cells.map(c => c.voltage))).toFixed(3)}V</span>
                  </div>
                </div>
                
                <CellVoltageGraph cells={bmsData.cells} />
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">State of Health</h3>
                  <p className="text-2xl font-extrabold text-gray-900">98.5%</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Charge Cycles</h3>
                  <p className="text-2xl font-extrabold text-gray-900">{bmsData.cycleCount}</p>
                </div>
              </div>

              {bmsData.errorLogs.length > 0 && (
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2 mb-4">
                    <FileWarning size={20} className="text-red-500" />
                    <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Diagnostic Logs</span>
                  </div>
                  <div className="space-y-3">
                    {bmsData.errorLogs.slice(0, 3).map((log, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                            {log.code}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{log.timestamp}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-600">{log.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {activeTab === 'controls' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              
              {!controlsUnlocked ? (
                <Keypad onUnlock={() => setControlsUnlocked(true)} />
              ) : (
                <>
                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                          <ShieldCheck size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Kid Mode</h3>
                          <p className="text-xs font-medium text-gray-400">Limit output to 15A</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setKidMode(!kidMode)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${kidMode ? 'bg-orange-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${kidMode ? 'translate-x-7' : 'translate-x-1 shadow-sm'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                          <Moon size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Deep Sleep</h3>
                          <p className="text-xs font-medium text-gray-400">Minimal battery drain</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setDeepSleep(!deepSleep)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${deepSleep ? 'bg-indigo-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${deepSleep ? 'translate-x-7' : 'translate-x-1 shadow-sm'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Smart Charge Limit</h3>
                        <p className="text-xs font-medium text-gray-400">Preserve battery lifespan</p>
                      </div>
                    </div>

                    <div className="px-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-900">
                          Target (%)
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={bmsData.chargeLimit}
                          onChange={(e) => setChargeLimit(Number(e.target.value))}
                          className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-right"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Battery size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Reserve Buffer Logic</h3>
                        <p className="text-xs font-medium text-gray-400">Set hidden capacity</p>
                      </div>
                    </div>

                    <div className="px-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-900">
                          Buffer (%)
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={bmsData.reserveBuffer}
                          onChange={(e) => setReserveBuffer(Number(e.target.value))}
                          className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center">
                        <Navigation size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">EV Model Max Range</h3>
                        <p className="text-xs font-medium text-gray-400">Set 100% SoC range estimate</p>
                      </div>
                    </div>

                    <div className="px-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-900">
                          Max Range (km)
                        </label>
                        <input 
                          type="number" 
                          min="1" 
                          value={bmsData.maxRangeKM}
                          onChange={(e) => setMaxRange(Number(e.target.value))}
                          className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          )}

        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.06)] rounded-t-[2.5rem] flex justify-around items-center px-6 z-50 pb-2">
          <NavItem 
            icon={Battery} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={Activity} 
            label="Diagnostics" 
            active={activeTab === 'diagnostics'} 
            onClick={() => setActiveTab('diagnostics')} 
          />
          <NavItem 
            icon={Settings} 
            label="Controls" 
            active={activeTab === 'controls'} 
            onClick={() => setActiveTab('controls')} 
          />
        </nav>
      </div>
    </div>
  );
}

const NavItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center w-16 h-12 gap-1"
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={`text-[9px] font-bold tracking-wide transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
};
