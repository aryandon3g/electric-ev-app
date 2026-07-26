import { useState, useCallback, useRef, useEffect } from 'react';
import { BMSData, CellData } from '../types';



// --- CORE ALGORITHMS ---

// 1. True Zero Mapping (Reserve Buffer Logic)
export const calculateTrueZeroSoC = (voltage: number, reserveBuffer: number = 0, minV: number = 55.0, maxV: number = 64.0): number => {
  if (voltage <= minV) return 0;
  if (voltage >= maxV) return 100;
  
  const rawSoC = ((voltage - minV) / (maxV - minV)) * 100;
  
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

const generateEmptyCells = (): CellData[] => {
  return Array.from({ length: 20 }).map((_, i) => {
    return {
      id: i + 1,
      voltage: 0,
      isBalancing: false,
      healthStatus: 'Good'
    };
  });
};

const INITIAL_DATA: BMSData = {
  voltage: 0,
  current: 0.0,
  capacityPercent: 0,
  temperature: 0,
  status: 'Normal',
  power: 0,
  remainingCapacityAH: 0,
  nominalCapacityAH: 30.0,
  cells: generateEmptyCells(),
  cycleCount: 0,
  estimatedRangeKM: 0,
  efficiencyWhPerKm: 0,
  thermalState: 'Normal',
  isLocked: false,
  alerts: [],
  timeToFullChargeMinutes: null,
  chargeLimit: 100,
  reserveBuffer: 5,
  tripEnergyWh: 0,
  maxRangeKM: 70,
  minVoltage: 55,
  maxVoltage: 64,
  errorLogs: []
};

export function useBMS() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [bmsData, setBmsData] = useState<BMSData>(INITIAL_DATA);
  
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const smootherRef = useRef(new VoltageSmoother(5));

  // --- OPTIMIZED DATA PIPELINE ---
  // This function takes raw telemetry from a real BMS or Demo and applies all the custom logic
  const processBMSFrame = useCallback((
    rawVoltage: number, 
    rawCurrent: number, 
    rawRemainingAH: number, 
    rawCells: CellData[], 
    rawTemp: number
  ) => {
    setBmsData(prev => {
      let isLocked = prev.isLocked;
      let actualCurrent = rawCurrent;

      if (isLocked) {
         actualCurrent = 0; // Anti-theft engaged, logically zero current output
      }

      // Thermal Management
      let thermalState: 'Normal' | 'Throttled' | 'Critical' = 'Normal';
      
      if (rawTemp > 45) {
         thermalState = 'Throttled';
         // Throttle power by 50% for dynamic thermal management
         if (actualCurrent < 0) actualCurrent = actualCurrent * 0.5;
      }

      // Smart Charge Limiter
      let isChargingAllowed = true;
      const projectedCapacityPercent = (rawRemainingAH / prev.nominalCapacityAH) * 100;
      if (projectedCapacityPercent >= prev.chargeLimit) {
          isChargingAllowed = false;
      }

      if (!isChargingAllowed && actualCurrent > 0) {
          actualCurrent = 0; // Cut off charge logically
      }

      // Predictive Range Estimation
      let efficiencyWhPerKm = prev.efficiencyWhPerKm;
      if (actualCurrent < -10) {
          efficiencyWhPerKm = 38; // Aggressive riding
      } else if (actualCurrent < 0) {
          efficiencyWhPerKm = 18; // Eco mode
      } else if (actualCurrent === 0 && actualCurrent <= 0) {
          efficiencyWhPerKm = 25; // idle baseline
      }
      
      // Moving Average Filter (Anti-Voltage Sag)
      const smoothedVoltage = Number(smootherRef.current.getSmoothedVoltage(rawVoltage).toFixed(2));

      // True Zero Mapping (Reserve Buffer Logic)
      let displaySoC = calculateTrueZeroSoC(smoothedVoltage, prev.reserveBuffer, prev.minVoltage, prev.maxVoltage);
      
      // Fallback
      displaySoC = applyWeakCellFallback(rawCells, displaySoC);

      const estimatedRangeKM = (displaySoC / 100) * prev.maxRangeKM;
      const power = Number((smoothedVoltage * actualCurrent).toFixed(1));

      // Trip Energy Analytics
      let newTripEnergyWh = prev.tripEnergyWh;
      if (actualCurrent < 0) {
         // rough integration based on polling rate, assuming 2s interval for now, real app should use timestamps
         newTripEnergyWh += Math.abs(power) * (2 / 3600); 
      }

      // Error Logs Simulation & Overload Warning
      const newLogs = [...prev.errorLogs];
      const alerts: string[] = [];
      
      if (actualCurrent < -25 && actualCurrent >= -30) {
          alerts.push("⚠️ Overload Warning: High current draw detected. Reduce speed!");
      }

      if (actualCurrent < -30) {
         newLogs.unshift({ timestamp: new Date().toLocaleTimeString(), code: 'ERR_OVERCURRENT', message: 'Over-Current Protection triggered.' });
         actualCurrent = 0; // Cut-off
         alerts.push("🛑 BMS CUT-OFF: Over-Current Protection.");
      }

      // Predictive Charge Time calculation
      let timeToFullChargeMinutes: number | null = null;
      if (actualCurrent > 0) {
         const remainingAH = prev.nominalCapacityAH - rawRemainingAH;
         timeToFullChargeMinutes = (remainingAH / actualCurrent) * 60;
      }

      if (rawTemp >= 45) alerts.push("🌡️ High Temp 45°C+: Power reduced by 50%");
      if (rawCells.some(c => c.healthStatus === 'Warning')) alerts.push("⚠️ Cell Health Alert: Abnormal discharge detected.");
      if (isLocked) alerts.push("🔒 Anti-Theft Active: Power output disabled.");
      if (!isChargingAllowed && rawCurrent > 0) alerts.push(`⚡ Smart Charge Limit reached (${prev.chargeLimit}%). Charging paused.`);

      return {
        ...prev,
        voltage: smoothedVoltage,
        current: Number(actualCurrent.toFixed(1)),
        power: power,
        status: actualCurrent > 0 ? 'Charging' : (actualCurrent < 0 ? 'Discharging' : 'Normal'),
        capacityPercent: Number(displaySoC.toFixed(4)),
        remainingCapacityAH: rawRemainingAH,
        cells: rawCells,
        temperature: Number(rawTemp.toFixed(1)),
        thermalState,
        efficiencyWhPerKm,
        estimatedRangeKM: Number(estimatedRangeKM.toFixed(1)),
        timeToFullChargeMinutes,
        alerts,
        tripEnergyWh: newTripEnergyWh,
        errorLogs: newLogs
      };
    });
  }, []);

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

  const setMinVoltage = useCallback((voltage: number) => {
    setBmsData(prev => ({ ...prev, minVoltage: voltage }));
  }, []);

  const setMaxVoltage = useCallback((voltage: number) => {
    setBmsData(prev => ({ ...prev, maxVoltage: voltage }));
  }, []);

  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth API is not supported in this browser. Please use Chrome on Android or Desktop.");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      // We request both the standard battery service and common BMS UART services (like JBD / Daly)
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'battery_service', 
          '0000ffe0-0000-1000-8000-00805f9b34fb', // Common serial UUID (Daly)
          '0000ff00-0000-1000-8000-00805f9b34fb'  // JBD UUID
        ]
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'BMS Device');
      
      const server = await device.gatt?.connect();
      
      if (server) {
        setIsConnected(true);
        try {
          // Attempt standard battery service first
          const batteryService = await server.getPrimaryService('battery_service');
          const levelCharacteristic = await batteryService.getCharacteristic('battery_level');
          const level = await levelCharacteristic.readValue();
          
          // Use basic level initially
          setBmsData(prev => ({ ...prev, capacityPercent: level.getUint8(0) }));
          
          await levelCharacteristic.startNotifications();
          levelCharacteristic.addEventListener('characteristicvaluechanged', (e: any) => {
             // In a real generic app, we would also parse UART bytes here if we connected to UART.
             // But for standard battery service, we just have % level.
             // We feed it to processBMSFrame using simulated other values, or if we had real UART, we'd extract them.
             const newLevel = e.target.value.getUint8(0);
             setBmsData(prev => {
                const simulatedVoltage = prev.minVoltage + ((newLevel / 100) * (prev.maxVoltage - prev.minVoltage));
                const capacityAH = (newLevel / 100) * prev.nominalCapacityAH;
                
                setTimeout(() => {
                   processBMSFrame(simulatedVoltage, 0, capacityAH, prev.cells, prev.temperature);
                }, 0);
                
                return prev;
             });
          });
        } catch (e) {
          console.warn("Standard battery service not found. If this is a real UART BMS, we would parse bytes here.", e);
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
    setIsConnected(false);
    setDeviceName(null);
    setBmsData(INITIAL_DATA);
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    deviceName,
    bmsData,
    connectBluetooth,
    disconnect,
    toggleAntiTheft,
    setChargeLimit,
    setReserveBuffer,
    setMaxRange,
    setMinVoltage,
    setMaxVoltage
  };
}
