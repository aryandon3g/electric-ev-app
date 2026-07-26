import { useState, useCallback, useRef, useEffect } from 'react';
import { BMSData, CellData } from '../types';

// Default mock data for a 60V scooter battery (20S)
const generateMockCells = (baseVoltage = 3.15, addWeakCell = false): CellData[] => {
  return Array.from({ length: 20 }).map((_, i) => {
    let variance = (Math.random() - 0.5) * 0.05;
    let healthStatus: 'Good' | 'Warning' | 'Critical' = 'Good';
    
    // Simulate a weak cell on cell index 3 (Cell 4) for early warning feature
    if (addWeakCell && i === 3) {
       variance -= 0.3; // significantly lower voltage
       healthStatus = 'Warning';
    }

    return {
      id: i + 1,
      voltage: Number((baseVoltage + variance).toFixed(3)),
      isBalancing: Math.random() > 0.8,
      healthStatus
    };
  });
};

// --- CORE ALGORITHMS ---

// 1. True Zero Mapping (Reserve Buffer Logic)
export const calculateTrueZeroSoC = (voltage: number, reserveBuffer: number = 0): number => {
  const MIN_V = 55.0;
  const MAX_V = 64.0;
  
  if (voltage <= MIN_V) return 0;
  if (voltage >= MAX_V) return 100;
  
  const rawSoC = ((voltage - MIN_V) / (MAX_V - MIN_V)) * 100;
  
  if (rawSoC <= reserveBuffer) {
    return 0;
  }
  
  return ((rawSoC - reserveBuffer) / (100 - reserveBuffer)) * 100;
};

// 2. The "Weakest Cell" Fallback Logic
export const applyWeakCellFallback = (cells: CellData[], currentSoC: number): number => {
  if (!cells || cells.length === 0) return currentSoC;
  const lowestCellVoltage = Math.min(...cells.map(c => c.voltage));
  
  if (lowestCellVoltage < 2.9) {
    return Math.min(currentSoC, 5); // Drop to 5% to warn user of impending cut-off
  }
  return currentSoC;
};

// 3. Moving Average Filter (Anti-Voltage Sag)
export class VoltageSmoother {
  private history: { value: number; timestamp: number }[] = [];
  private windowMs: number;

  constructor(windowSeconds = 5) {
    this.windowMs = windowSeconds * 1000;
  }

  getSmoothedVoltage(newVoltage: number): number {
    const now = Date.now();
    this.history.push({ value: newVoltage, timestamp: now });
    
    // Remove values older than windowMs
    this.history = this.history.filter(item => now - item.timestamp <= this.windowMs);
    
    const sum = this.history.reduce((acc, item) => acc + item.value, 0);
    return sum / this.history.length;
  }
}

const INITIAL_DATA: BMSData = {
  voltage: 61.2,
  current: 0.0,
  capacityPercent: 85,
  temperature: 28,
  status: 'Normal',
  power: 0,
  remainingCapacityAH: 25.5,
  nominalCapacityAH: 30.0,
  cells: generateMockCells(3.82),
  cycleCount: 42,
  estimatedRangeKM: 65,
  efficiencyWhPerKm: 25,
  thermalState: 'Normal',
  isLocked: false,
  alerts: [],
  timeToFullChargeMinutes: null,
  chargeLimit: 100,
  reserveBuffer: 5,
  tripEnergyWh: 0,
  maxRangeKM: 70,
  errorLogs: []
};

export function useBMS() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [bmsData, setBmsData] = useState<BMSData>(INITIAL_DATA);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoState, setDemoState] = useState<'charging' | 'discharging' | 'idle'>('idle');
  
  const demoIntervalRef = useRef<number | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const smootherRef = useRef(new VoltageSmoother(5));

  const toggleAntiTheft = useCallback(() => {
    setBmsData(prev => ({ ...prev, isLocked: !prev.isLocked }));
  }, []);

  const setChargeLimit = useCallback((limit: number) => {
    setBmsData(prev => ({ ...prev, chargeLimit: limit }));
  }, []);

  const setReserveBuffer = useCallback((buffer: number) => {
    setBmsData(prev => ({ ...prev, reserveBuffer: buffer }));
  }, []);

  const setMaxRange = useCallback((range: number) => {
    setBmsData(prev => ({ ...prev, maxRangeKM: range }));
  }, []);

  const toggleDemoCharging = useCallback(() => {
    setDemoState(prev => prev === 'charging' ? 'idle' : 'charging');
  }, []);

  const toggleDemoDischarging = useCallback(() => {
    setDemoState(prev => prev === 'discharging' ? 'idle' : 'discharging');
  }, []);

  const startDemo = useCallback(() => {
    setIsDemoMode(true);
    setIsConnected(true);
    setDeviceName('Demo Scooter BMS (60V)');
    setDemoState('discharging');
  }, []);

  useEffect(() => {
    if (!isDemoMode) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      return;
    }

    demoIntervalRef.current = window.setInterval(() => {
      setBmsData(prev => {
        const isCharging = demoState === 'charging';
        let newCurrent = prev.current;
        let isLocked = prev.isLocked;

        if (isLocked) {
           newCurrent = 0; // Anti-theft engaged
        } else if (isCharging) {
          newCurrent = 5.0 + Math.random() * 5; 
        } else if (demoState === 'discharging') {
          // Dynamic riding: sometimes eco, sometimes aggressive
          const isAggressive = Math.random() > 0.7;
          newCurrent = isAggressive ? -(15 + Math.random() * 15) : -(2 + Math.random() * 8);
        } else {
          newCurrent = 0;
        }

        // Thermal Management
        let newTemp = prev.temperature;
        if (newCurrent < -15) newTemp += 0.8;
        else if (newTemp > 28) newTemp -= 0.5;
        
        let thermalState: 'Normal' | 'Throttled' | 'Critical' = 'Normal';
        let actualCurrent = newCurrent;
        
        if (newTemp > 45) {
           thermalState = 'Throttled';
           // Throttle power by 50% for dynamic thermal management
           if (actualCurrent < 0) actualCurrent = actualCurrent * 0.5;
        }

        // Smart Charge Limiter
        let isChargingAllowed = true;
        const projectedCapacityPercent = (prev.remainingCapacityAH / prev.nominalCapacityAH) * 100;
        if (projectedCapacityPercent >= prev.chargeLimit) {
            isChargingAllowed = false;
        }

        if (!isChargingAllowed && actualCurrent > 0) {
            actualCurrent = 0; // Cut off charge MOSFET
        }

        // Predictive Range Estimation
        let efficiencyWhPerKm = prev.efficiencyWhPerKm;
        if (actualCurrent < -10) {
            efficiencyWhPerKm = 38; // Aggressive riding
        } else if (actualCurrent < 0) {
            efficiencyWhPerKm = 18; // Eco mode
        } else if (actualCurrent === 0 && !isCharging) {
            efficiencyWhPerKm = 25; // idle baseline
        }
        
        const totalEnergyWh = prev.voltage * prev.remainingCapacityAH;
        
        // Cell Health Warning (Early warning simulation)
        // Show the weak cell randomly more often if we are discharging heavily
        const showWeakCell = Math.random() > (actualCurrent < -15 ? 0.2 : 0.8);
        const cells = generateMockCells(3.82 + (actualCurrent > 0 ? 0.02 : -0.02), showWeakCell);
        
        // Update capacity based on current over time (simulated AH integration)
        // 2000ms = 2 seconds = 2/3600 hours (multiplied by 50 for demo speed)
        let newCapacityAH = prev.remainingCapacityAH + (actualCurrent * (100 / 3600));
        newCapacityAH = Math.max(0, Math.min(prev.nominalCapacityAH, newCapacityAH));
        const newCapacityPercent = Number(((newCapacityAH / prev.nominalCapacityAH) * 100).toFixed(4));

        // The user wants range proportional to SOC based on configured Max Range
        // 1. True Zero Mapping (Reserve Buffer Logic)
        const baseVoltage = 55 + ((newCapacityPercent / 100) * (64 - 55));
        const voltageSag = actualCurrent * 0.05; // 50mV per amp
        const rawVoltage = Number((baseVoltage + voltageSag).toFixed(2));
        
        // 3. Moving Average Filter (Anti-Voltage Sag)
        const smoothedVoltage = Number(smootherRef.current.getSmoothedVoltage(rawVoltage).toFixed(2));

        let displaySoC = calculateTrueZeroSoC(smoothedVoltage, prev.reserveBuffer);
        displaySoC = applyWeakCellFallback(cells, displaySoC);

        const estimatedRangeKM = (displaySoC / 100) * prev.maxRangeKM;

        const power = Number((smoothedVoltage * actualCurrent).toFixed(1));

        // Trip Energy Analytics
        let newTripEnergyWh = prev.tripEnergyWh;
        if (actualCurrent < 0) {
           newTripEnergyWh += Math.abs(power) * (2 / 3600); // W * hours = Wh
        }

        // Error Logs Simulation & Overload Warning
        const newLogs = [...prev.errorLogs];
        const alerts: string[] = [];
        
        if (actualCurrent < -25 && actualCurrent >= -30) {
            alerts.push("⚠️ Overload Warning: High current draw detected. Reduce speed to prevent power cut-off!");
        }

        if (actualCurrent < -30 && Math.random() > 0.8) {
           newLogs.unshift({ timestamp: new Date().toLocaleTimeString(), code: 'ERR_OVERCURRENT', message: 'Over-Current Protection triggered due to excessive load.' });
           actualCurrent = 0; // Cut-off
           alerts.push("🛑 BMS CUT-OFF: Over-Current Protection.");
        }

        // Predictive Charge Time calculation
        let timeToFullChargeMinutes: number | null = null;
        if (actualCurrent > 0) {
           const remainingAH = prev.nominalCapacityAH - newCapacityAH;
           timeToFullChargeMinutes = (remainingAH / actualCurrent) * 60;
        }

        if (newTemp >= 45) alerts.push("🌡️ बैटरी गर्म हो रही है, कृपया स्कूटी छांव में रोकें। (High Temp 45°C+: Power reduced by 50%)");
        if (cells.some(c => c.healthStatus === 'Warning')) alerts.push("⚠️ Cell Health Alert: Cell 4 discharging abnormally fast (High Delta). Service required soon.");
        if (isLocked) alerts.push("🔒 Anti-Theft Active: Power output disabled. Unlock to start.");
        if (!isChargingAllowed && isCharging) alerts.push(`⚡ Smart Charge Limit reached (${prev.chargeLimit}%). Charging paused.`);

        return {
          ...prev,
          voltage: smoothedVoltage,
          current: Number(actualCurrent.toFixed(1)),
          power: power,
          status: actualCurrent > 0 ? 'Charging' : (actualCurrent < 0 ? 'Discharging' : 'Normal'),
          capacityPercent: Number(displaySoC.toFixed(1)),
          remainingCapacityAH: newCapacityAH,
          cells,
          temperature: Number(newTemp.toFixed(1)),
          thermalState,
          efficiencyWhPerKm,
          estimatedRangeKM: Number(estimatedRangeKM.toFixed(1)),
          timeToFullChargeMinutes,
          alerts,
          tripEnergyWh: newTripEnergyWh,
          errorLogs: newLogs
        };
      });
    }, 2000);

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [isDemoMode, demoState]);

  const stopDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
    }
    setIsDemoMode(false);
    setIsConnected(false);
    setDeviceName(null);
    setBmsData(INITIAL_DATA);
  }, []);

  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth API is not supported in this browser. Please use Chrome on Android or Desktop.");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'Unknown BMS Device');
      
      const server = await device.gatt?.connect();
      
      if (server) {
        setIsConnected(true);
        try {
          const batteryService = await server.getPrimaryService('battery_service');
          const levelCharacteristic = await batteryService.getCharacteristic('battery_level');
          const level = await levelCharacteristic.readValue();
          setBmsData(prev => ({ ...prev, capacityPercent: level.getUint8(0) }));
          
          await levelCharacteristic.startNotifications();
          levelCharacteristic.addEventListener('characteristicvaluechanged', (e: any) => {
            const newLevel = e.target.value.getUint8(0);
            setBmsData(prev => ({ ...prev, capacityPercent: newLevel }));
          });
        } catch (e) {
          console.warn("Standard battery service not found, falling back to simulated telemetry for UI demo", e);
          startDemo();
        }
      }

      device.addEventListener('gattserverdisconnected', () => {
         // Auto engage anti-theft on disconnect
         setBmsData(prev => ({ ...prev, isLocked: true }));
         disconnect();
      });
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message.includes('cancelled')) {
        console.log("Bluetooth connection cancelled by user.");
      } else {
        console.error("Bluetooth connection error:", err);
        setError(err.message || "Failed to connect to Bluetooth device");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = useCallback(() => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    stopDemo();
    setIsConnected(false);
    setDeviceName(null);
  }, [stopDemo]);

  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    deviceName,
    bmsData,
    isDemoMode,
    demoState,
    connectBluetooth,
    disconnect,
    startDemo,
    stopDemo,
    toggleAntiTheft,
    setChargeLimit,
    setReserveBuffer,
    setMaxRange,
    toggleDemoCharging,
    toggleDemoDischarging
  };
}
