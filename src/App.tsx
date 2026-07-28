import React, { useState, useEffect, useRef } from 'react';
import { useBMS, BMS_PRESET_COMMANDS, BATTERY_PRESETS } from './hooks/useBMS';
import { motion, useMotionValue } from 'motion/react';
import { LiveProgressBar } from './components/LiveProgressBar';
import { 
  Bluetooth, BluetoothOff, Lock, Unlock, 
  Activity, Settings, Thermometer, Battery, 
  ShieldCheck, Zap, Moon, Clock, Map, FileWarning, AlertCircle,
  Delete, Terminal, Send, RefreshCw, Trash2, Cpu, Radio, CheckCircle2, Power
} from 'lucide-react';
import { CellData, BLEHexLog } from './types';

const SwipeAction = ({ label, icon: Icon, onAction, active }: { label: string, icon: any, onAction: () => void, active: boolean }) => {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const slideDistance = width ? width - 56 : 280;

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

const MiniGraph = ({ power, isConnected }: { power: number, isConnected: boolean }) => {
  const bars = Array.from({ length: 16 });
  const absPower = Math.abs(power);
  const maxScale = 1500; // 1.5kW full scale
  const fillRatio = Math.min(1, absPower / maxScale);

  return (
    <div className="flex items-end justify-center h-10 gap-1.5 opacity-80">
      {bars.map((_, i) => {
        const factor = Math.sin((i / 15) * Math.PI);
        const height = isConnected && absPower > 0 ? Math.max(10, fillRatio * 90 * (0.6 + 0.4 * factor)) : 10;
        return (
          <div
            key={i}
            style={{ height: `${height}%` }}
            className={`w-1.5 rounded-full transition-all duration-300 ${isConnected && absPower > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
          />
        );
      })}
    </div>
  );
};

const CellVoltageGraph = ({ cells, isConnected }: { cells: CellData[], isConnected: boolean }) => {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  if (!isConnected) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col items-center justify-center text-center gap-2 text-gray-400 my-2">
        <Activity size={24} className="text-gray-300" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">No BMS Connected</span>
        <p className="text-[11px] text-gray-400 max-w-xs">
          Connect your battery over Bluetooth. Cell count and individual cell voltages will be automatically detected.
        </p>
      </div>
    );
  }

  if (cells.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col items-center justify-center text-center gap-2 text-gray-400 my-2">
        <RefreshCw size={24} className="text-blue-500 animate-spin mb-1" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Auto-Detecting Battery Cells...</span>
        <p className="text-[11px] text-gray-400 max-w-xs">
          Listening for cell telemetry frames from BMS hardware...
        </p>
      </div>
    );
  }

  const validVoltages = cells.map(c => c.voltage).filter(v => v > 0);
  const maxV = validVoltages.length > 0 ? Math.max(...validVoltages) : 4.2;
  const minV = validVoltages.length > 0 ? Math.min(...validVoltages) : 3.0;

  return (
    <div className="flex flex-col gap-6 mt-2">
      <div className="flex items-end justify-between h-36 gap-1.5 px-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {cells.map((cell) => {
          const isMax = validVoltages.length > 0 && cell.voltage === maxV && cell.voltage > 0;
          const isMin = validVoltages.length > 0 && cell.voltage === minV && cell.voltage > 0;
          const isWarning = cell.healthStatus === 'Warning';
          
          let color = 'bg-blue-500';
          if (isWarning) color = 'bg-red-500';
          else if (isMax) color = 'bg-blue-600';
          else if (isMin) color = 'bg-orange-500';
          if (cell.voltage === 0) color = 'bg-gray-200';

          // Strictly calculate cell bar height based on measured voltage (2.5V -> 10%, 4.25V -> 100%)
          const heightPercent = cell.voltage > 0 ? Math.max(12, Math.min(100, ((cell.voltage - 2.5) / (4.25 - 2.5)) * 100)) : 8;
          
          return (
            <div
              key={cell.id}
              onClick={() => setSelectedCell(cell)}
              style={{ height: `${heightPercent}%` }}
              className={`flex-1 min-w-[12px] rounded-t-lg cursor-pointer hover:opacity-80 transition-all duration-300 ${color} relative ${selectedCell?.id === cell.id ? 'ring-2 ring-offset-2 ring-blue-500 shadow-md scale-105 z-10' : ''}`}
            >
              {cell.isBalancing && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-sm" />
              )}
              {isWarning && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-red-500">
                  <AlertCircle size={12} className="animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="min-h-24">
        {selectedCell ? (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between h-full shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                Cell #{selectedCell.id}
                {selectedCell.healthStatus === 'Warning' && <AlertCircle className="w-3 h-3 text-red-500" />}
              </div>
              <div className="text-2xl font-mono font-extrabold text-gray-900">
                {selectedCell.voltage > 0 ? selectedCell.voltage.toFixed(3) : '---'}<span className="text-sm text-gray-400 ml-1">V</span>
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
              {selectedCell.voltage === maxV && selectedCell.voltage > 0 && (
                <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider px-2 py-0.5 bg-blue-50 rounded-full">Max Voltage</div>
              )}
              {selectedCell.voltage === minV && selectedCell.voltage > 0 && (
                <div className="text-[9px] font-bold text-orange-600 uppercase tracking-wider px-2 py-0.5 bg-orange-50 rounded-full">Min Voltage</div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 h-full flex flex-col items-center justify-center text-xs font-bold text-gray-400 uppercase tracking-wider text-center gap-2">
            <Activity size={20} className="text-gray-300" />
            Tap any cell bar above to inspect details
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
        <h2 className="text-xl font-bold text-gray-900">Enter Security PIN</h2>
        <p className="text-sm text-gray-400 mt-1">Controls are password protected</p>
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
    bmsData, connectBluetooth, disconnect, isConnected, isConnecting, error, deviceName,
    toggleAntiTheft, setChargeLimit, setReserveBuffer, setMinVoltage, setMaxVoltage,
    setRangeCalcMode, setRangeOffsetKM, setRangePerVolt, setMaxRange,
    setManualProtocol, triggerPollNow, simulateIncomingPacket, clearHexLogs, applyBatteryPreset
  } = useBMS();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'diagnostics' | 'controls'>('dashboard');
  const [controlsUnlocked, setControlsUnlocked] = useState(false);
  const [kidMode, setKidMode] = useState(false);
  const [deepSleep, setDeepSleep] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  const openStandaloneTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#333333] font-sans selection:bg-blue-100 flex justify-center">
      {/* Mobile Constraint Container */}
      <div className="w-full max-w-md bg-[#F8F9FA] min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <header className="px-5 pt-5 pb-2 flex items-center justify-between z-10 bg-[#F8F9FA]/80 backdrop-blur-md sticky top-0 border-b border-gray-100">
          <div>
            <h1 className="text-base font-black tracking-tight text-gray-900 flex items-center gap-1.5">
              <span>E-Scooter BMS</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">JK & Okinawa</span>
            </h1>
            <p className="text-[11px] font-medium text-gray-400">
              {isConnected ? `Connected: ${deviceName || 'BMS Device'} (${bmsData.connectionType || 'BLE'})` : 'BLE / Serial Disconnected'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={openStandaloneTab}
              title="Open in New Tab for full Web Bluetooth modal permissions"
              className="p-2 rounded-full bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shadow-xs text-xs font-bold"
            >
              <Zap size={14} className="text-amber-500" />
            </button>
            <button 
              onClick={isConnected ? disconnect : connectBluetooth}
              disabled={isConnecting}
              className={`px-3 py-2 rounded-full flex items-center gap-1.5 shadow-sm text-xs font-bold transition-all ${
                isConnected 
                  ? 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100' 
                  : isConnecting
                  ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isConnecting ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-white" />
                  <span>Connecting...</span>
                </>
              ) : isConnected ? (
                <>
                  <Bluetooth size={14} className="text-blue-500" />
                  <span>Disconnect</span>
                </>
              ) : (
                <>
                  <Bluetooth size={14} className="text-white" />
                  <span>Connect BLE</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-5 mt-2 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 shadow-sm">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Connection Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-5 pb-28 pt-2 space-y-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center h-full space-y-4">
              
              <div className="w-full">
                <LiveProgressBar 
                  percentage={bmsData.capacityPercent} 
                  isCharging={bmsData.status === 'Charging'} 
                  voltage={bmsData.voltage}
                  estimatedRangeKM={bmsData.estimatedRangeKM} 
                  isConnected={isConnected}
                />
              </div>

              {/* Status Banner when Disconnected or Connected */}
              {!isConnected ? (
                <div className="w-full bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col items-center text-center space-y-2">
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                    <Radio size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">BLE Disconnected</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Tap the top-right <span className="font-bold text-blue-600">Connect BLE</span> button to pair with your BMS.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  {!bmsData.chargeDischargeActive && (
                    <div className="w-full bg-red-50 border-2 border-red-200 rounded-3xl p-4 flex items-center justify-between text-red-700 shadow-sm animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
                          <Lock size={20} />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider block">KILL SWITCH ACTIVATED</span>
                          <span className="text-[11px] font-medium text-red-600">MOSFET Cutoff: Charge & Discharge are turned OFF (0.0A)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Pack Voltage</span>
                      <span className="text-xl font-mono font-black text-gray-900">{bmsData.voltage.toFixed(2)}<span className="text-xs font-normal text-gray-400 ml-0.5">V</span></span>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Live Current</span>
                      <span className="text-xl font-mono font-black text-gray-900">{bmsData.current.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">A</span></span>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Protocol</span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block">{bmsData.detectedProtocol || 'Listening...'}</span>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Temperature</span>
                      <span className="text-xl font-mono font-black text-gray-900">{bmsData.temperature.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">°C</span></span>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full">
                {bmsData.status === 'Charging' && bmsData.timeToFullChargeMinutes !== null ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-3xl p-4 shadow-sm flex items-center justify-between">
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

              {/* Charge & Discharge Control (Linked to Swipe Lock) */}
              <div className="w-full mt-auto pt-2 space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MOSFET State:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs border ${
                    bmsData.chargeDischargeActive 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {bmsData.chargeDischargeActive ? (
                      <>
                        <Zap size={12} className="text-emerald-600 fill-emerald-600" />
                        <span>Charge & Discharge: ON</span>
                      </>
                    ) : (
                      <>
                        <Lock size={12} className="text-red-600" />
                        <span>Charge & Discharge: OFF</span>
                      </>
                    )}
                  </span>
                </div>

                <SwipeAction 
                  label={bmsData.chargeDischargeActive ? "Swipe to turn Charge/Discharge OFF" : "Swipe to turn Charge/Discharge ON"}
                  icon={bmsData.chargeDischargeActive ? Lock : Unlock}
                  active={!bmsData.chargeDischargeActive}
                  onAction={toggleAntiTheft}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'diagnostics' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              
              {/* Temperature Card */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bmsData.temperature > 40 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    <Thermometer size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Battery Temperature</h3>
                    <p className="text-2xl font-extrabold text-gray-900">
                      {isConnected ? `${bmsData.temperature.toFixed(1)}°C` : '0.0°C'}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${bmsData.thermalState === 'Normal' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                  {isConnected ? bmsData.thermalState : 'Disconnected'}
                </div>
              </div>

              {/* Charge Cycles Completed (BMS Telemetry Data) */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Battery Charge Cycles</h3>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-extrabold text-gray-900">{isConnected ? bmsData.cycleCount : 0}</span>
                      <span className="text-xs font-bold text-gray-500">Completed Cycles</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Gaadi abhi tak kitni baar charge cycle complete ki (BMS Hardware Read)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-emerald-100">
                    {isConnected ? (bmsData.detectedProtocol || 'BMS Telemetry') : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Live Power Usage</span>
                  <MiniGraph power={bmsData.power} isConnected={isConnected} />
                  <div className="mt-1.5 text-xs font-medium text-gray-600">{Math.abs(bmsData.power).toFixed(0)}W</div>
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
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                    {bmsData.cells.length > 0 ? `Cell Voltages (${bmsData.cells.length}S Auto-Detected)` : 'Cell Voltages'}
                  </h3>
                  {bmsData.cells.length > 0 && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delta</span>
                      <span className="text-sm font-mono font-bold text-blue-600">
                        {(Math.max(...bmsData.cells.map(c => c.voltage)) - Math.min(...bmsData.cells.map(c => c.voltage))).toFixed(3)}V
                      </span>
                    </div>
                  )}
                </div>
                
                <CellVoltageGraph cells={bmsData.cells} isConnected={isConnected} />
              </div>

            </motion.div>
          )}

          {activeTab === 'controls' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              
              {!controlsUnlocked ? (
                <Keypad onUnlock={() => setControlsUnlocked(true)} />
              ) : (
                <>
                  {/* Battery Kill Switch / MOSFET Cutoff Control */}
                  <div className={`rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border transition-all ${
                    bmsData.chargeDischargeActive 
                      ? 'bg-white border-gray-100' 
                      : 'bg-red-50/80 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          bmsData.chargeDischargeActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-600 text-white animate-pulse'
                        }`}>
                          <Power size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Battery Kill Switch</h3>
                          <p className="text-xs font-medium text-gray-500">
                            {bmsData.chargeDischargeActive 
                              ? 'Charge & Discharge MOSFET Active' 
                              : '⚠️ CUTOFF: Current & Power Stopped (0.0A)'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={toggleAntiTheft}
                        className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                          bmsData.chargeDischargeActive
                            ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                        }`}
                      >
                        {bmsData.chargeDischargeActive ? 'KILL SWITCH (OFF)' : 'RESTORE POWER (ON)'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <SwipeAction 
                        label={bmsData.chargeDischargeActive ? "Swipe to Cutoff Battery Power" : "Swipe to Enable Charge & Discharge"}
                        icon={bmsData.chargeDischargeActive ? Lock : Unlock}
                        active={!bmsData.chargeDischargeActive}
                        onAction={toggleAntiTheft}
                      />
                    </div>
                  </div>
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
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Map size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Range Calculation Settings</h3>
                        <p className="text-xs font-medium text-gray-400">Volt aur offset ke according range configure karein</p>
                      </div>
                    </div>

                    <div className="px-2 pt-2 space-y-4">
                      {/* Mode Selection */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-bold text-gray-900 block">Calculation Method</label>
                          <span className="text-[11px] text-gray-400">Select range calculation basis</span>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                          <button
                            onClick={() => setRangeCalcMode('voltage')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              bmsData.rangeCalcMode === 'voltage' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
                            }`}
                          >
                            By Voltage
                          </button>
                          <button
                            onClick={() => setRangeCalcMode('soc')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              bmsData.rangeCalcMode === 'soc' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
                            }`}
                          >
                            By SOC %
                          </button>
                        </div>
                      </div>

                      {/* Plus/Minus Range Offset (+/- KM) */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <label className="text-sm font-bold text-gray-900 block">Range Plus/Minus (+/- km)</label>
                          <span className="text-[11px] text-gray-400">Voltage range me km add/subtract karein</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => setRangeOffsetKM(bmsData.rangeOffsetKM - 1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 font-bold text-gray-700 active:bg-gray-200 flex items-center justify-center"
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            value={bmsData.rangeOffsetKM}
                            onChange={(e) => setRangeOffsetKM(Number(e.target.value))}
                            className="w-16 px-1 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button 
                            onClick={() => setRangeOffsetKM(bmsData.rangeOffsetKM + 1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 font-bold text-gray-700 active:bg-gray-200 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Km per Volt multiplier */}
                      {bmsData.rangeCalcMode === 'voltage' && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div>
                            <label className="text-sm font-bold text-gray-900 block">Km per Volt Multiplier</label>
                            <span className="text-[11px] text-gray-400">Volts above cutoff x multiplier</span>
                          </div>
                          <input 
                            type="number" 
                            step="0.1"
                            min="0.1"
                            max="10"
                            value={bmsData.rangePerVolt}
                            onChange={(e) => setRangePerVolt(Number(e.target.value))}
                            className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      )}

                      {/* Full charge max range */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <label className="text-sm font-bold text-gray-900 block">Max Range @ 100% (km)</label>
                          <span className="text-[11px] text-gray-400">Base full charge distance</span>
                        </div>
                        <input 
                          type="number" 
                          step="1"
                          value={bmsData.maxRangeKM}
                          onChange={(e) => setMaxRange(Number(e.target.value))}
                          className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Battery size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Battery Pack Profiles</h3>
                        <p className="text-xs font-medium text-gray-400">1-tap calibration for scooter model</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2">
                      {Object.entries(BATTERY_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => applyBatteryPreset(key as any)}
                          className={`p-3 rounded-2xl text-left border transition-all flex items-center justify-between ${
                            bmsData.minVoltage === preset.minVoltage && bmsData.maxVoltage === preset.maxVoltage
                              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-gray-900">{preset.name}</div>
                            <div className="text-[11px] font-medium text-gray-500">
                              Range: {preset.minVoltage}V - {preset.maxVoltage}V | Max {preset.maxRangeKM}km
                            </div>
                          </div>
                          <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-200 text-amber-700">
                            Apply
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-500 flex items-center justify-center">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Voltage Calibration</h3>
                        <p className="text-xs font-medium text-gray-400">Map 0-100% to actual pack volts</p>
                      </div>
                    </div>

                    <div className="px-2 pt-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-900">
                          Min Voltage Cutoff (0%)
                        </label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={bmsData.minVoltage}
                          onChange={(e) => setMinVoltage(Number(e.target.value))}
                          className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-right"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-900">
                          Max Voltage Full (100%)
                        </label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={bmsData.maxVoltage}
                          onChange={(e) => setMaxVoltage(Number(e.target.value))}
                          className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-right"
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
