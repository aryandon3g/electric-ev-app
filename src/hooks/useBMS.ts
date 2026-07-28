import { useState, useCallback, useRef, useEffect } from 'react';
import { BMSData, CellData, BLEHexLog } from '../types';

// --- COMMON BMS & UART SERVICE UUIDS ---
export const BMS_UUIDS = {
  DALY: {
    SERVICE: '0000ffe0-0000-1000-8000-00805f9b34fb',
    NOTIFY_1: '0000ffe4-0000-1000-8000-00805f9b34fb',
    NOTIFY_2: '0000ffe1-0000-1000-8000-00805f9b34fb',
    WRITE: '0000ffe2-0000-1000-8000-00805f9b34fb',
  },
  JBD: {
    SERVICE: '0000ff00-0000-1000-8000-00805f9b34fb',
    NOTIFY: '0000ff01-0000-1000-8000-00805f9b34fb',
    WRITE: '0000ff02-0000-1000-8000-00805f9b34fb',
  },
  JK: {
    SERVICE: '0000e7e0-0000-1000-8000-00805f9b34fb',
    NOTIFY: '0000e7e1-0000-1000-8000-00805f9b34fb',
    WRITE: '0000e7e2-0000-1000-8000-00805f9b34fb',
  },
  NUS: {
    SERVICE: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    NOTIFY: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    WRITE: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  },
  HM10: {
    SERVICE: '0000ffe0-0000-1000-8000-00805f9b34fb',
    NOTIFY: '0000ffe1-0000-1000-8000-00805f9b34fb',
    WRITE: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
  ANT: {
    SERVICE: '0000ffe5-0000-1000-8000-00805f9b34fb',
    NOTIFY: '0000ffe4-0000-1000-8000-00805f9b34fb',
    WRITE: '0000ffe3-0000-1000-8000-00805f9b34fb',
  },
  STANDARD_BATTERY: {
    SERVICE: 'battery_service',
    NOTIFY: 'battery_level',
  }
};

// Comprehensive list of optional service UUIDs for Bluetooth requestDevice (Includes 16-bit short numbers and 128-bit strings)
const ALL_OPTIONAL_SERVICES = [
  'battery_service',
  'device_information',
  'generic_access',
  'generic_attribute',
  // Short 16-bit numbers for Chrome compatibility
  0xffe0, 0xffe1, 0xffe2, 0xffe3, 0xffe4, 0xffe5,
  0xff00, 0xff01, 0xff02,
  0xfee0, 0xfee1,
  0xe7e0, 0xe7e1, 0xe7e2,
  0x180f, 0x1800, 0x1801, 0x180a,
  // 128-bit full UUID strings
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ffe2-0000-1000-8000-00805f9b34fb',
  '0000ffe3-0000-1000-8000-00805f9b34fb',
  '0000ffe4-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fee1-0000-1000-8000-00805f9b34fb',
  '0000e7e0-0000-1000-8000-00805f9b34fb',
  '0000e7e1-0000-1000-8000-00805f9b34fb',
  '0000e7e2-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  '00001000-0000-1000-8000-00805f9b34fb',
  '0000a002-0000-1000-8000-00805f9b34fb',
  '00000001-0000-1000-8000-00805f9b34fb',
  '0000f00d-0000-1000-8000-00805f9b34fb',
  '0000180f-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb'
];

// Preset Hex Commands
export const BMS_PRESET_COMMANDS = {
  // Daly BMS Commands
  DALY_READ_SOC_VOLTS: {
    name: 'Daly Poll SOC/Volts/Current (0x90)',
    hex: 'A5 40 90 08 00 00 00 00 00 00 00 00 75',
    bytes: [0xA5, 0x40, 0x90, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x75]
  },
  DALY_READ_MIN_MAX_CELL: {
    name: 'Daly Poll Min/Max Cell (0x91)',
    hex: 'A5 40 91 08 00 00 00 00 00 00 00 00 76',
    bytes: [0xA5, 0x40, 0x91, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x76]
  },
  DALY_READ_TEMP: {
    name: 'Daly Poll Temperatures (0x92)',
    hex: 'A5 40 92 08 00 00 00 00 00 00 00 00 77',
    bytes: [0xA5, 0x40, 0x92, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x77]
  },
  DALY_READ_MOS_STATUS: {
    name: 'Daly Poll MOS Status (0x93)',
    hex: 'A5 40 93 08 00 00 00 00 00 00 00 00 78',
    bytes: [0xA5, 0x40, 0x93, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78]
  },
  DALY_READ_CELL_VOLTAGES: {
    name: 'Daly Poll Cell Voltages (0x95)',
    hex: 'A5 40 95 08 00 00 00 00 00 00 00 00 7A',
    bytes: [0xA5, 0x40, 0x95, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7A]
  },

  // JBD / Xiaoxiang Commands
  JBD_READ_BASIC_INFO: {
    name: 'JBD Read Basic Info (Pack Volts, Current, Temp)',
    hex: 'DD A5 03 00 FF FD 77',
    bytes: [0xDD, 0xA5, 0x03, 0x00, 0xFF, 0xFD, 0x77]
  },
  JBD_READ_CELL_VOLTAGES: {
    name: 'JBD Read Individual Cell Voltages',
    hex: 'DD A5 04 00 FF FC 77',
    bytes: [0xDD, 0xA5, 0x04, 0x00, 0xFF, 0xFC, 0x77]
  },

  // JK BMS Commands (Classic NW + JK02/JK04 jkbms.com + Bike Handshake + Wake)
  JK_WAKE_PULSE: {
    name: 'JK BMS Wake Pulse (0x00)',
    hex: '00',
    bytes: [0x00]
  },
  JK_READ_ALL_INFO: {
    name: 'JK BMS Read Telemetry (Classic 0x4E 0x57)',
    hex: '4E 57 00 13 00 00 00 00 06 03 00 00 00 00 00 00 68 00 00 01 29',
    bytes: [0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x01, 0x29]
  },
  JK_READ_DEVICE_INFO: {
    name: 'JK BMS Read Device Status (Classic 0x03 0x03)',
    hex: '4E 57 00 13 00 00 00 00 03 03 00 00 00 00 00 00 68 00 00 01 26',
    bytes: [0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x01, 0x26]
  },
  JK_HANDSHAKE: {
    name: 'JK BMS Handshake / Wake',
    hex: '4E 57 00 13 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 01 1D',
    bytes: [0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x1D]
  },
  JK02_READ_INFO: {
    name: 'JK02 / JK04 / jkbms.com Read Telemetry',
    hex: 'AA 55 90 EB 96 00 00 00 00 00 00 00 00 00 00 00 00 00 00 10',
    bytes: [0xAA, 0x55, 0x90, 0xEB, 0x96, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10]
  },
  JK02_DEVICE_INFO: {
    name: 'JK02 / JK04 Read Device Info',
    hex: 'AA 55 90 EB 97 00 00 00 00 00 00 00 00 00 00 00 00 00 00 11',
    bytes: [0xAA, 0x55, 0x90, 0xEB, 0x97, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11]
  },
  JK02_WAKE_INFO: {
    name: 'JK02 / JK04 Poll Request',
    hex: '55 AA EB 90 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 7A',
    bytes: [0x55, 0xAA, 0xEB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7A]
  },

  // ANT BMS Command
  ANT_READ_TELEMETRY: {
    name: 'ANT BMS Poll Status',
    hex: 'DB DB 00 00 00 00',
    bytes: [0xDB, 0xDB, 0x00, 0x00, 0x00, 0x00]
  }
};

// Helper: Convert DataView to space-separated Hex string
export const dataViewToHexString = (dataView: DataView): string => {
  const bytes: string[] = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    bytes.push(dataView.getUint8(i).toString(16).padStart(2, '0').toUpperCase());
  }
  return bytes.join(' ');
};

// Helper: Convert Hex String ("A5 40 90...") to Uint8Array
export const hexStringToUint8Array = (hexString: string): Uint8Array => {
  const cleanHex = hexString.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid Hex string length. Must have an even number of characters.');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
};

export class VoltageSmoother {
  private history: { value: number; timestamp: number }[] = [];
  private windowMs: number;

  constructor(windowSeconds = 3) {
    this.windowMs = windowSeconds * 1000;
  }

  reset() {
    this.history = [];
  }

  getSmoothedVoltage(newVoltage: number): number {
    if (newVoltage <= 0) return 0;
    const now = Date.now();
    this.history.push({ value: newVoltage, timestamp: now });
    this.history = this.history.filter(item => now - item.timestamp <= this.windowMs);
    const sum = this.history.reduce((acc, item) => acc + item.value, 0);
    return sum / this.history.length;
  }
}

// Range Calculation Engine (Voltage / SOC based + Plus/Minus Modifier)
export const computeDynamicRange = (
  voltage: number,
  soc: number,
  mode: 'voltage' | 'soc',
  maxRangeKM: number,
  offsetKM: number,
  perVolt: number,
  minV: number,
  maxV: number
): number => {
  let baseKM = 0;
  if (mode === 'voltage') {
    if (voltage > 0) {
      baseKM = Math.max(0, (voltage - minV) * perVolt);
    } else {
      baseKM = 0;
    }
  } else {
    baseKM = (soc / 100) * maxRangeKM;
  }
  const total = Math.max(0, baseKM + offsetKM);
  return Number(total.toFixed(1));
};

export const BATTERY_PRESETS = {
  '60V_16S_NMC': {
    name: '60V 16S Li-ion / NMC (Okinawa Praise / Ampere)',
    minVoltage: 48.0,
    maxVoltage: 67.2,
    maxRangeKM: 80,
    rangePerVolt: 2.0
  },
  '72V_20S_NMC': {
    name: '72V 20S Li-ion / NMC (Okinawa i-Praise / High Speed)',
    minVoltage: 58.0,
    maxVoltage: 84.0,
    maxRangeKM: 100,
    rangePerVolt: 1.8
  },
  '48V_13S_NMC': {
    name: '48V 13S Li-ion / NMC (Standard E-Scooter / Bicycle)',
    minVoltage: 39.0,
    maxVoltage: 54.6,
    maxRangeKM: 55,
    rangePerVolt: 2.5
  },
  '60V_20S_LFP': {
    name: '60V 20S LiFePO4 (LFP Smart Pack)',
    minVoltage: 52.0,
    maxVoltage: 73.0,
    maxRangeKM: 75,
    rangePerVolt: 2.2
  },
  '72V_24S_LFP': {
    name: '72V 24S LiFePO4 (LFP High Capacity)',
    minVoltage: 62.4,
    maxVoltage: 87.6,
    maxRangeKM: 110,
    rangePerVolt: 2.0
  }
};

const INITIAL_DATA: BMSData = {
  voltage: 0.0,
  current: 0.0,
  capacityPercent: 0,
  temperature: 0.0,
  status: 'Disconnected',
  power: 0,
  remainingCapacityAH: 0.0,
  nominalCapacityAH: 0.0,
  cells: [],
  cycleCount: 0,
  estimatedRangeKM: 0.0,
  efficiencyWhPerKm: 22,
  thermalState: 'Normal',
  isLocked: false,
  chargeDischargeActive: true,
  alerts: [],
  timeToFullChargeMinutes: null,
  chargeLimit: 100,
  reserveBuffer: 5,
  tripEnergyWh: 0,
  maxRangeKM: 70,
  minVoltage: 40,
  maxVoltage: 84,
  rangeCalcMode: 'voltage',
  rangeOffsetKM: 0,
  rangePerVolt: 1.6,
  errorLogs: [],
  rawHexLogs: [],
  autoPollEnabled: true,
  pollingIntervalMs: 2000,
  totalPacketsReceived: 0,
  lastPacketTime: undefined
};

export function useBMS() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [bmsData, setBmsData] = useState<BMSData>(INITIAL_DATA);
  
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const gattServerRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const pollingTimerRef = useRef<any>(null);
  const smootherRef = useRef(new VoltageSmoother(3));

  // --- STREAM REASSEMBLY BUFFER REF ---
  // Accumulates incoming BLE chunks across 20-byte MTU boundaries to reassemble complete BMS frames
  const rxBufferRef = useRef<number[]>([]);

  // Logger helper to store raw hex packets in UI and console
  const addHexLog = useCallback((type: 'RX' | 'TX' | 'SYS', hex: string, decodedInfo?: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const logItem: BLEHexLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      type,
      hex,
      decodedInfo
    };

    console.log(`[BLE ${type}] ${timestamp}: ${hex} ${decodedInfo ? `(${decodedInfo})` : ''}`);

    setBmsData(prev => ({
      ...prev,
      rawHexLogs: [logItem, ...prev.rawHexLogs.slice(0, 99)],
      totalPacketsReceived: type === 'RX' ? (prev.totalPacketsReceived || 0) + 1 : prev.totalPacketsReceived,
      lastPacketTime: type === 'RX' ? timestamp : prev.lastPacketTime
    }));
  }, []);

  // --- SPECIFIC BMS PROTOCOL PARSERS ---

  // 1. DALY BMS FRAME PARSER (13-byte frames starting with 0xA5)
  const parseDalyFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    const command = dataView.getUint8(2); // e.g. 0x90, 0x91, 0x92, 0x93, 0x94, 0x95

    if (command === 0x90) { // SOC / Voltage / Current Packet
      const rawVolts = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 10;
      const rawCurr = (((dataView.getUint8(8) << 8) | dataView.getUint8(9)) - 30000) / 10;
      const rawSoc = ((dataView.getUint8(10) << 8) | dataView.getUint8(11)) / 10;
      
      addHexLog('RX', rawHex, `Daly 0x90 -> Volts: ${rawVolts}V, Curr: ${rawCurr}A, SOC: ${rawSoc}%`);
      
      setBmsData(prev => {
        const smoothedV = Number(smootherRef.current.getSmoothedVoltage(rawVolts).toFixed(2));
        const capacityAH = (rawSoc / 100) * prev.nominalCapacityAH;
        const estRange = computeDynamicRange(
          smoothedV,
          rawSoc,
          prev.rangeCalcMode,
          prev.maxRangeKM,
          prev.rangeOffsetKM,
          prev.rangePerVolt,
          prev.minVoltage,
          prev.maxVoltage
        );

        const isMosfetActive = prev.chargeDischargeActive;
        const current = isMosfetActive ? rawCurr : 0.0;
        const power = isMosfetActive ? Number((smoothedV * rawCurr).toFixed(1)) : 0.0;

        let status: BMSData['status'] = 'MOSFET Off';
        if (isMosfetActive) {
          if (rawCurr > 0.5) status = 'Charging';
          else if (rawCurr < -0.5) status = 'Discharging';
          else status = 'Normal';
        }

        return {
          ...prev,
          voltage: smoothedV,
          current,
          capacityPercent: rawSoc,
          remainingCapacityAH: capacityAH,
          power,
          status,
          estimatedRangeKM: estRange,
          detectedProtocol: 'Daly'
        };
      });
    } else if (command === 0x91) { // Cell Min/Max Packet
      const maxV = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 1000;
      const maxCellNum = dataView.getUint8(6);
      const minV = ((dataView.getUint8(7) << 8) | dataView.getUint8(8)) / 1000;
      const minCellNum = dataView.getUint8(9);

      addHexLog('RX', rawHex, `Daly 0x91 -> Max Cell #${maxCellNum}: ${maxV}V, Min Cell #${minCellNum}: ${minV}V`);
    } else if (command === 0x92) { // Temp Packet
      const temp = dataView.getUint8(4) - 40;
      addHexLog('RX', rawHex, `Daly 0x92 -> Temp: ${temp}°C`);
      setBmsData(prev => ({
        ...prev,
        temperature: temp,
        thermalState: temp > 55 ? 'Critical' : temp > 42 ? 'Throttled' : 'Normal',
        detectedProtocol: 'Daly'
      }));
    } else if (command === 0x93) { // MOS Status & Rem Ah
      const remCapAh = ((dataView.getUint8(7) << 24) | (dataView.getUint8(8) << 16) | (dataView.getUint8(9) << 8) | dataView.getUint8(10)) / 1000;
      addHexLog('RX', rawHex, `Daly 0x93 -> Rem Cap: ${remCapAh.toFixed(1)}Ah`);
      setBmsData(prev => ({
        ...prev,
        remainingCapacityAH: remCapAh > 0 ? remCapAh : prev.remainingCapacityAH,
        detectedProtocol: 'Daly'
      }));
    } else if (command === 0x94) { // Cycles & Cell Count
      const cellCount = dataView.getUint8(4);
      const cycles = (dataView.getUint8(9) << 8) | dataView.getUint8(10);
      addHexLog('RX', rawHex, `Daly 0x94 -> Detected Cell Count: ${cellCount}S, Cycles: ${cycles}`);
      setBmsData(prev => {
        let updatedCells = [...prev.cells];
        if (cellCount > 0 && updatedCells.length !== cellCount) {
          if (updatedCells.length < cellCount) {
            while (updatedCells.length < cellCount) {
              updatedCells.push({
                id: updatedCells.length + 1,
                voltage: 0,
                isBalancing: false,
                healthStatus: 'Good'
              });
            }
          } else {
            updatedCells = updatedCells.slice(0, cellCount);
          }
        }
        return {
          ...prev,
          cells: updatedCells,
          cycleCount: cycles,
          detectedProtocol: 'Daly'
        };
      });
    } else if (command === 0x95) { // Cell Voltages Frame (Daly packs 3 cell voltages into each 0x95 frame)
      const frameNo = dataView.getUint8(4);
      const c1V = ((dataView.getUint8(5) << 8) | dataView.getUint8(6)) / 1000;
      const c2V = ((dataView.getUint8(7) << 8) | dataView.getUint8(8)) / 1000;
      const c3V = ((dataView.getUint8(9) << 8) | dataView.getUint8(10)) / 1000;

      addHexLog('RX', rawHex, `Daly 0x95 (Frame ${frameNo}) -> C1: ${c1V}V, C2: ${c2V}V, C3: ${c3V}V`);

      setBmsData(prev => {
        const updatedCells = [...prev.cells];
        const startIndex = (frameNo - 1) * 3;

        // Ensure updatedCells array is expanded as needed for incoming frame
        const neededLength = startIndex + (c3V > 0 ? 3 : c2V > 0 ? 2 : c1V > 0 ? 1 : 0);
        while (updatedCells.length < neededLength) {
          updatedCells.push({
            id: updatedCells.length + 1,
            voltage: 0,
            isBalancing: false,
            healthStatus: 'Good'
          });
        }

        if (c1V > 0 && startIndex < updatedCells.length) {
          updatedCells[startIndex] = { id: startIndex + 1, voltage: c1V, isBalancing: false, healthStatus: c1V < 2.9 || c1V > 4.25 ? 'Warning' : 'Good' };
        }
        if (c2V > 0 && startIndex + 1 < updatedCells.length) {
          updatedCells[startIndex + 1] = { id: startIndex + 2, voltage: c2V, isBalancing: false, healthStatus: c2V < 2.9 || c2V > 4.25 ? 'Warning' : 'Good' };
        }
        if (c3V > 0 && startIndex + 2 < updatedCells.length) {
          updatedCells[startIndex + 2] = { id: startIndex + 3, voltage: c3V, isBalancing: false, healthStatus: c3V < 2.9 || c3V > 4.25 ? 'Warning' : 'Good' };
        }

        return {
          ...prev,
          cells: updatedCells,
          detectedProtocol: 'Daly'
        };
      });
    } else {
      addHexLog('RX', rawHex, `Daly Cmd 0x${command.toString(16)}`);
    }
  }, [addHexLog]);

  // 2. JBD / XIAOXIANG FRAME PARSER (Starts with 0xDD, ends with 0x77)
  const parseJbdFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    const command = dataView.getUint8(1);
    const status = dataView.getUint8(2);

    if (status !== 0x00) {
      addHexLog('RX', rawHex, `JBD Error Response (Status: 0x${status.toString(16)})`);
      return;
    }

    if (command === 0x03) { // Basic Info Packet
      const rawVolts = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 100;
      const currentInt = (dataView.getUint8(6) << 8) | dataView.getUint8(7);
      const rawCurr = (currentInt > 32767 ? currentInt - 65536 : currentInt) / 100;
      const remainingAH = ((dataView.getUint8(8) << 8) | dataView.getUint8(9)) / 100;
      const nominalAH = ((dataView.getUint8(10) << 8) | dataView.getUint8(11)) / 100;
      const cycles = (dataView.getUint8(12) << 8) | dataView.getUint8(13);
      
      // JBD byte 23 (offset 19 in payload) provides actual direct SOC percentage (0-100%)
      let rawSoc = 0;
      if (dataView.byteLength >= 24) {
        rawSoc = dataView.getUint8(23);
      } else if (dataView.byteLength >= 22) {
        rawSoc = dataView.getUint8(21);
      }

      // Safeguard: if rawSoc is invalid (>100 or 0 while having remainingAH), calculate accurately from remainingAH/nominalAH
      if ((rawSoc > 100 || rawSoc === 0) && nominalAH > 0 && remainingAH > 0) {
        rawSoc = Math.min(100, Math.max(0, Math.round((remainingAH / nominalAH) * 100)));
      }

      // Temperature sensor (NTC 1 in 0.1K, offset 23 in payload / byte 27-28 in frame)
      let parsedTempC: number | null = null;
      if (dataView.byteLength >= 29) {
        const rawK = (dataView.getUint8(27) << 8) | dataView.getUint8(28);
        if (rawK > 0) {
          parsedTempC = Number(((rawK - 2731) / 10).toFixed(1));
        }
      } else if (dataView.byteLength >= 28) {
        const rawK = (dataView.getUint8(26) << 8) | dataView.getUint8(27);
        if (rawK > 0) {
          parsedTempC = Number(((rawK - 2731) / 10).toFixed(1));
        }
      }

      // Balance status bitmask at offset 16-17
      const balanceMask = (dataView.getUint8(16) << 8) | dataView.getUint8(17);

      addHexLog('RX', rawHex, `JBD Basic Info -> Volts: ${rawVolts}V, Curr: ${rawCurr}A, SOC: ${rawSoc}%, Rem: ${remainingAH}Ah, Temp: ${parsedTempC !== null ? parsedTempC + '°C' : 'N/A'}, Cycles: ${cycles}`);

      setBmsData(prev => {
        const smoothedV = Number(smootherRef.current.getSmoothedVoltage(rawVolts).toFixed(2));
        const estRange = computeDynamicRange(
          smoothedV,
          rawSoc,
          prev.rangeCalcMode,
          prev.maxRangeKM,
          prev.rangeOffsetKM,
          prev.rangePerVolt,
          prev.minVoltage,
          prev.maxVoltage
        );

        const isMosfetActive = prev.chargeDischargeActive;
        const current = isMosfetActive ? rawCurr : 0.0;
        const power = isMosfetActive ? Number((smoothedV * rawCurr).toFixed(1)) : 0.0;

        let currentStatus: BMSData['status'] = 'MOSFET Off';
        if (isMosfetActive) {
          if (rawCurr > 0.5) currentStatus = 'Charging';
          else if (rawCurr < -0.5) currentStatus = 'Discharging';
          else currentStatus = 'Normal';
        }

        // Update balancing state on cells if balance mask present
        const updatedCells = prev.cells.map((cell, idx) => ({
          ...cell,
          isBalancing: Boolean(balanceMask & (1 << idx))
        }));

        const finalTemp = parsedTempC !== null ? parsedTempC : prev.temperature;

        return {
          ...prev,
          voltage: smoothedV,
          current,
          capacityPercent: rawSoc,
          remainingCapacityAH: remainingAH,
          nominalCapacityAH: nominalAH > 0 ? nominalAH : prev.nominalCapacityAH,
          cycleCount: cycles,
          temperature: finalTemp,
          thermalState: finalTemp > 55 ? 'Critical' : finalTemp > 42 ? 'Throttled' : 'Normal',
          power,
          status: currentStatus,
          estimatedRangeKM: estRange,
          cells: updatedCells,
          detectedProtocol: 'JBD/Xiaoxiang'
        };
      });
    } else if (command === 0x04) { // Individual Cell Voltages
      const dataLength = dataView.getUint8(3);
      const cellCount = Math.floor(dataLength / 2);
      const newCells: CellData[] = [];

      for (let i = 0; i < cellCount; i++) {
        const cellV = ((dataView.getUint8(4 + i * 2) << 8) | dataView.getUint8(5 + i * 2)) / 1000;
        newCells.push({
          id: i + 1,
          voltage: cellV,
          isBalancing: false,
          healthStatus: cellV < 2.9 || cellV > 4.25 ? 'Warning' : 'Good'
        });
      }

      addHexLog('RX', rawHex, `JBD Cell Voltages -> ${cellCount} cells parsed (${newCells.map(c => c.voltage.toFixed(2)).join(', ')})`);
      setBmsData(prev => ({ ...prev, cells: newCells, detectedProtocol: 'JBD/Xiaoxiang' }));
    } else {
      addHexLog('RX', rawHex, `JBD Cmd 0x${command.toString(16)}`);
    }
  }, [addHexLog]);

  // 3. JK BMS FRAME PARSER (Header 0x4E 0x57 "NW" or 0xAA 0x55 / 0x55 0xAA for JK02/JK04 jkbms.com)
  const parseJkFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    addHexLog('RX', rawHex, 'JK BMS Telemetry Frame Received');

    let parsedV = 0;
    let parsedI = 0;
    let parsedSoc = 0;
    let parsedTemp = 0;
    let parsedCycles = 0;
    const parsedCells: CellData[] = [];

    // Header inspection
    const h0 = dataView.byteLength >= 1 ? dataView.getUint8(0) : 0;
    const h1 = dataView.byteLength >= 2 ? dataView.getUint8(1) : 0;

    if (h0 === 0x4E && h1 === 0x57) {
      // JK Classic Protocol (0x4E 0x57)
      let offset = 10;

      while (offset < dataView.byteLength - 2) {
        const tag = dataView.getUint8(offset);
        offset++;

        if (tag === 0x79) { // Cell Voltages List
          if (offset < dataView.byteLength) {
            const len = dataView.getUint8(offset);
            const tagDataStart = offset + 1;
            const tagDataEnd = Math.min(dataView.byteLength, tagDataStart + len);
            
            let cellIdx = 1;
            for (let i = tagDataStart; i + 2 < tagDataEnd; i += 3) {
              const cellNo = dataView.getUint8(i);
              const cellV = ((dataView.getUint8(i + 1) << 8) | dataView.getUint8(i + 2)) / 1000;
              if (cellV >= 1.5 && cellV <= 5.0) {
                parsedCells.push({
                  id: (cellNo >= 1 && cellNo <= 32) ? cellNo : cellIdx,
                  voltage: Number(cellV.toFixed(3)),
                  isBalancing: false,
                  healthStatus: cellV < 2.8 || cellV > 4.25 ? 'Warning' : 'Good'
                });
                cellIdx++;
              }
            }
            offset = tagDataEnd;
          }
        } else if (tag === 0x80 || tag === 0x81 || tag === 0x82) { // Temperatures
          if (offset + 1 < dataView.byteLength) {
            const rawT = (dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1);
            let tempVal = rawT > 32767 ? rawT - 65536 : rawT;
            if (tempVal > 100) tempVal = 100 - tempVal;
            if (tempVal > -40 && tempVal < 120) {
              parsedTemp = tempVal;
            }
            offset += 2;
          }
        } else if (tag === 0x83) { // Total Pack Voltage (0.01V)
          if (offset + 1 < dataView.byteLength) {
            parsedV = ((dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1)) / 100;
            offset += 2;
          }
        } else if (tag === 0x84) { // Current (0.01A)
          if (offset + 1 < dataView.byteLength) {
            const rawI = (dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1);
            if (rawI & 0x8000) {
              // Bit 15 set = CHARGING (Positive current in A)
              parsedI = (rawI & 0x7FFF) / 100;
            } else {
              // Bit 15 clear = DISCHARGING (Negative current in A)
              parsedI = -((rawI & 0x7FFF) / 100);
            }
            offset += 2;
          }
        } else if (tag === 0x85) { // SOC %
          if (offset < dataView.byteLength) {
            parsedSoc = dataView.getUint8(offset);
            offset += 1;
          }
        } else if (tag === 0x87) { // Cycle count (2 bytes)
          if (offset + 1 < dataView.byteLength) {
            parsedCycles = (dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1);
            offset += 2;
          }
        } else if (
          tag === 0x86 || tag === 0xA2 || tag === 0xA3 || 
          tag === 0xA4 || tag === 0xA5 || tag === 0xA6 || tag === 0xB9 || tag === 0xC0
        ) {
          offset += 1; // 1-byte tags
        } else if (
          tag === 0x8A || tag === 0x8B || tag === 0x8C || tag === 0x8E || 
          tag === 0x8F || tag === 0x90 || tag === 0x91 || tag === 0x92 || 
          tag === 0x93 || tag === 0x94 || tag === 0x95 || tag === 0x96 || 
          tag === 0x97 || tag === 0x98 || tag === 0x99 || tag === 0x9A || 
          tag === 0x9B || tag === 0x9C || tag === 0x9D || tag === 0x9E || 
          tag === 0x9F || tag === 0xA0 || tag === 0xA1 || tag === 0xA7 || 
          (tag >= 0xB0 && tag <= 0xB3) || tag === 0xB4
        ) {
          offset += 2; // 2-byte tags
        } else if (
          tag === 0x88 || tag === 0x89 || tag === 0xA8 || tag === 0xA9 || 
          tag === 0xAA || tag === 0xAB || tag === 0xAC || tag === 0xAD || 
          tag === 0xB5 || tag === 0xB8
        ) {
          offset += 4; // 4-byte tags
        } else if (
          tag === 0xAE || tag === 0xAF || tag === 0xB6 || tag === 0xB7 || tag === 0xBA
        ) {
          offset += 16; // 16-byte string tags
        } else {
          offset += 1; // Safe 1-byte increment for unhandled tags
        }
      }

      // DIRECT INDEPENDENT TAG SCANNER FOR 0x4E 0x57 CLASSIC FRAMES
      if (dataView.byteLength >= 12) {
        for (let i = 0; i < dataView.byteLength - 2; i++) {
          const tag = dataView.getUint8(i);

          if (tag === 0x79 && parsedCells.length === 0 && i + 2 < dataView.byteLength) {
            const len = dataView.getUint8(i + 1);
            const endIdx = Math.min(dataView.byteLength, i + 2 + len);
            let cellIdx = 1;
            for (let c = i + 2; c + 2 < endIdx; c += 3) {
              const cNo = dataView.getUint8(c);
              const cVal = ((dataView.getUint8(c + 1) << 8) | dataView.getUint8(c + 2)) / 1000;
              if (cVal >= 1.5 && cVal <= 5.0) {
                parsedCells.push({
                  id: (cNo >= 1 && cNo <= 32) ? cNo : cellIdx,
                  voltage: Number(cVal.toFixed(3)),
                  isBalancing: false,
                  healthStatus: cVal < 2.8 || cVal > 4.25 ? 'Warning' : 'Good'
                });
                cellIdx++;
              }
            }
          } else if (tag === 0x83 && i + 2 < dataView.byteLength) {
            const vVal = ((dataView.getUint8(i + 1) << 8) | dataView.getUint8(i + 2)) / 100;
            if (vVal >= 10.0 && vVal <= 150.0) {
              parsedV = vVal;
            }
          } else if (tag === 0x84 && i + 2 < dataView.byteLength && parsedI === 0) {
            const rawI = (dataView.getUint8(i + 1) << 8) | dataView.getUint8(i + 2);
            if (rawI & 0x8000) {
              parsedI = (rawI & 0x7FFF) / 100;
            } else {
              parsedI = -((rawI & 0x7FFF) / 100);
            }
          } else if (tag === 0x85 && i + 1 < dataView.byteLength) {
            const socVal = dataView.getUint8(i + 1);
            if (socVal > 0 && socVal <= 100) {
              parsedSoc = socVal;
            }
          } else if ((tag === 0x80 || tag === 0x81 || tag === 0x82) && parsedTemp === 0 && i + 2 < dataView.byteLength) {
            const rawT = (dataView.getUint8(i + 1) << 8) | dataView.getUint8(i + 2);
            let tVal = rawT > 32767 ? rawT - 65536 : rawT;
            if (tVal > 100) tVal = 100 - tVal;
            if (tVal > -40 && tVal < 120) {
              parsedTemp = tVal;
            }
          } else if (tag === 0x87 && parsedCycles === 0 && i + 2 < dataView.byteLength) {
            const cVal = (dataView.getUint8(i + 1) << 8) | dataView.getUint8(i + 2);
            if (cVal > 0 && cVal < 10000) {
              parsedCycles = cVal;
            }
          }
        }
      }
    } else if ((h0 === 0xAA && h1 === 0x55) || (h0 === 0x55 && h1 === 0xAA)) {
      // JK02 / JK04 / Okinawa BMS frame parsing
      // Payload structure (Little Endian):
      // 0-3: Header (55 AA EB 90)
      // 4: Record type (0x02 for cell info / telemetry)
      // 5: Frame counter
      // 6+: Cell voltages (2 bytes each, mV, Little Endian)
      const recordType = dataView.byteLength >= 5 ? dataView.getUint8(4) : 0;
      
      if (recordType === 0x02 && dataView.byteLength >= 150) {
        // Read Cell Voltages (up to 32 cells)
        let sumCellsV = 0;
        let cellIdx = 1;
        
        // Scan cell voltages first to determine realistic pack voltage and validate offset
        for (let i = 0; i < 32 && (6 + i * 2 + 1) < dataView.byteLength; i++) {
          const cV = dataView.getUint16(6 + i * 2, true) / 1000;
          if (cV >= 1.5 && cV <= 5.0) {
            parsedCells.push({
              id: cellIdx,
              voltage: Number(cV.toFixed(3)),
              isBalancing: false, // We check balancing later if needed
              healthStatus: cV < 2.8 || cV > 4.25 ? 'Warning' : 'Good'
            });
            sumCellsV += cV;
            cellIdx++;
          }
        }

        // JK02 variants use either offset 0 (24S) or offset 32 (32S) for telemetry data.
        // We test both offsets against the sum of cell voltages to find the correct total voltage.
        let vOff0 = dataView.byteLength >= 118 + 4 ? dataView.getUint32(118, true) / 1000 : 0;
        let vOff32 = dataView.byteLength >= 150 + 4 ? dataView.getUint32(150, true) / 1000 : 0;
        
        let baseOffset = 0;
        // If 32S offset matches the sum of cells much better than 24S offset, use 32S offset
        if (Math.abs(vOff32 - sumCellsV) < Math.abs(vOff0 - sumCellsV) && vOff32 >= 10 && vOff32 <= 150) {
          baseOffset = 32;
        }

        const off = baseOffset;
        
        if (dataView.byteLength >= 118 + off + 4) {
          parsedV = dataView.getUint32(118 + off, true) / 1000;
        }
        
        if (dataView.byteLength >= 126 + off + 4) {
          parsedI = dataView.getInt32(126 + off, true) / 1000; // int32
        }
        
        if (dataView.byteLength >= 130 + off + 2) {
          // Temperature Sensor 1
          parsedTemp = dataView.getInt16(130 + off, true) / 10;
        }
        
        if (dataView.byteLength >= 141 + off + 1) {
          parsedSoc = dataView.getUint8(141 + off);
        }
        
        if (dataView.byteLength >= 150 + off + 4) {
          parsedCycles = dataView.getUint32(150 + off, true);
        }
      }
    }

    // High Precision Cell Voltage Sum Validation:
    // Cell ADCs in JK BMS provide 1mV precision per cell. If cell voltages are parsed,
    // compute sum of cells and compare with total pack voltage. If parsedV is 0 or differs significantly,
    // use the exact sum of cell voltages!
    let sumCellsV = 0;
    if (parsedCells.length > 0) {
      sumCellsV = Number(parsedCells.reduce((acc, c) => acc + c.voltage, 0).toFixed(2));
    }

    if (sumCellsV > 0 && (parsedV === 0 || Math.abs(parsedV - sumCellsV) > 2.0)) {
      parsedV = sumCellsV;
    }

    setBmsData(prev => {
      // If voltage jumped significantly (>5V difference), reset voltage smoother to prevent lag
      if (parsedV > 0 && Math.abs(parsedV - prev.voltage) > 5.0) {
        smootherRef.current.reset();
      }

      const smoothedV = parsedV > 0 ? Number(smootherRef.current.getSmoothedVoltage(parsedV).toFixed(2)) : prev.voltage;
      
      // Fallback 2: Calculate SOC from voltage if raw SOC is missing/0 or out of bounds
      let activeSoc = parsedSoc > 0 && parsedSoc <= 100 ? parsedSoc : prev.capacityPercent;
      if ((activeSoc <= 0 || activeSoc > 100) && smoothedV > prev.minVoltage && prev.maxVoltage > prev.minVoltage) {
        activeSoc = Math.min(100, Math.max(0, Math.round(((smoothedV - prev.minVoltage) / (prev.maxVoltage - prev.minVoltage)) * 100)));
      }

      const estRange = computeDynamicRange(
        smoothedV,
        activeSoc,
        prev.rangeCalcMode,
        prev.maxRangeKM,
        prev.rangeOffsetKM,
        prev.rangePerVolt,
        prev.minVoltage,
        prev.maxVoltage
      );

      const isMosfetActive = prev.chargeDischargeActive;
      const current = isMosfetActive ? parsedI : 0.0;
      const power = isMosfetActive ? Number((smoothedV * parsedI).toFixed(1)) : 0.0;

      let currentStatus: BMSData['status'] = 'MOSFET Off';
      if (isMosfetActive) {
        if (parsedI > 0.5) currentStatus = 'Charging';
        else if (parsedI < -0.5) currentStatus = 'Discharging';
        else currentStatus = 'Normal';
      }

      return {
        ...prev,
        voltage: smoothedV,
        current,
        capacityPercent: activeSoc,
        temperature: parsedTemp !== 0 ? parsedTemp : prev.temperature,
        cycleCount: parsedCycles > 0 ? parsedCycles : prev.cycleCount,
        cells: parsedCells.length > 0 ? parsedCells : prev.cells,
        power,
        status: currentStatus,
        estimatedRangeKM: estRange,
        detectedProtocol: 'JK BMS'
      };
    });
  }, [addHexLog]);

  // 4. ANT BMS FRAME PARSER (Header 0xDB 0xDB or 0x7A 0x7A)
  const parseAntFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    if (dataView.byteLength >= 10) {
      const packV = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 10;
      const soc = dataView.getUint8(8);
      addHexLog('RX', rawHex, `ANT BMS -> Volts: ${packV}V, SOC: ${soc}%`);

      setBmsData(prev => {
        const smoothedV = Number(smootherRef.current.getSmoothedVoltage(packV).toFixed(2));
        const estRange = computeDynamicRange(
          smoothedV,
          soc,
          prev.rangeCalcMode,
          prev.maxRangeKM,
          prev.rangeOffsetKM,
          prev.rangePerVolt,
          prev.minVoltage,
          prev.maxVoltage
        );
        return {
          ...prev,
          voltage: smoothedV,
          capacityPercent: soc,
          estimatedRangeKM: estRange,
          detectedProtocol: 'ANT BMS'
        };
      });
    }
  }, [addHexLog]);

  // 5. ASCII / UTF-8 SERIAL PARSER
  const parseAsciiString = useCallback((textLine: string) => {
    addHexLog('RX', textLine, 'ASCII Serial Text Stream');

    // Try parsing JSON if available
    if (textLine.startsWith('{') && textLine.endsWith('}')) {
      try {
        const json = JSON.parse(textLine);
        setBmsData(prev => ({
          ...prev,
          voltage: typeof json.voltage === 'number' ? json.voltage : prev.voltage,
          current: typeof json.current === 'number' ? json.current : prev.current,
          capacityPercent: typeof json.soc === 'number' ? json.soc : prev.capacityPercent,
          temperature: typeof json.temp === 'number' ? json.temp : prev.temperature,
          detectedProtocol: 'ASCII/UART'
        }));
        return;
      } catch (e) {
        // Fallback to regex below
      }
    }

    // Regex extractors for standard serial format e.g. "V:58.4, I:2.5, SOC:88%"
    const vMatch = textLine.match(/V[:=]?\s*(\d+\.?\d*)/i) || textLine.match(/(\d+\.?\d*)\s*V\b/i);
    const iMatch = textLine.match(/I[:=]?\s*(-?\d+\.?\d*)/i) || textLine.match(/(-?\d+\.?\d*)\s*A\b/i);
    const socMatch = textLine.match(/SOC[:=]?\s*(\d+)/i) || textLine.match(/(\d+)\s*%/);
    const tempMatch = textLine.match(/T[:=]?\s*(\d+\.?\d*)/i) || textLine.match(/(\d+\.?\d*)\s*°?C\b/i);

    setBmsData(prev => ({
      ...prev,
      voltage: vMatch ? Number(smootherRef.current.getSmoothedVoltage(parseFloat(vMatch[1])).toFixed(2)) : prev.voltage,
      current: iMatch ? parseFloat(iMatch[1]) : prev.current,
      capacityPercent: socMatch ? parseInt(socMatch[1], 10) : prev.capacityPercent,
      temperature: tempMatch ? parseFloat(tempMatch[1]) : prev.temperature,
      detectedProtocol: 'ASCII/UART'
    }));
  }, [addHexLog]);

  // 6. STANDARD BATTERY SERVICE PARSER
  const parseStandardBattery = useCallback((socLevel: number) => {
    addHexLog('RX', `0x${socLevel.toString(16).padStart(2, '0')}`, `Standard Battery Level -> ${socLevel}%`);
    setBmsData(prev => ({
      ...prev,
      capacityPercent: socLevel,
      detectedProtocol: 'Standard Battery'
    }));
  }, [addHexLog]);

  // --- STREAM REASSEMBLY ENGINE ---
  // Processes cumulative rxBufferRef across fragmented BLE notifications
  const processRxBuffer = useCallback(() => {
    let buffer = rxBufferRef.current;
    let maxLoopAttempts = 40;

    // Helper: Find byte sequence index in array
    const findSeq = (arr: number[], seq: number[]): number => {
      for (let i = 0; i <= arr.length - seq.length; i++) {
        let match = true;
        for (let j = 0; j < seq.length; j++) {
          if (arr[i + j] !== seq[j]) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    };

    while (buffer.length > 0 && maxLoopAttempts > 0) {
      maxLoopAttempts--;

      // Find indices of all potential BMS frame headers
      const jk4EIdx = findSeq(buffer, [0x4E, 0x57]);
      let jkAAIdx = findSeq(buffer, [0x55, 0xAA, 0xEB, 0x90]);
      if (jkAAIdx < 0) jkAAIdx = findSeq(buffer, [0xAA, 0x55, 0x90, 0xEB]);
      if (jkAAIdx < 0) jkAAIdx = findSeq(buffer, [0x55, 0xAA, 0x00, 0x00]); // Fallback for some variants

      let dalyIdx = findSeq(buffer, [0xA5, 0x01]);
      let jbdIdx = findSeq(buffer, [0xDD, 0x03]);
      if (jbdIdx < 0) jbdIdx = findSeq(buffer, [0xDD, 0x04]);

      let antIdx = findSeq(buffer, [0xDB, 0xDB]);
      if (antIdx < 0) antIdx = findSeq(buffer, [0x7A, 0x7A]);

      // Collect all candidate header start positions >= 0
      const candidates: { type: string; index: number }[] = [];
      if (jk4EIdx >= 0) candidates.push({ type: 'JK_4E', index: jk4EIdx });
      if (jkAAIdx >= 0) candidates.push({ type: 'JK_AA', index: jkAAIdx });
      if (dalyIdx >= 0) candidates.push({ type: 'DALY', index: dalyIdx });
      if (jbdIdx >= 0) candidates.push({ type: 'JBD', index: jbdIdx });
      if (antIdx >= 0) candidates.push({ type: 'ANT', index: antIdx });

      if (candidates.length === 0) {
        // Check ASCII or single byte
        const newlineIdx = buffer.findIndex(b => b === 0x0A || b === 0x0D);
        if (newlineIdx >= 0) {
          const lineBytes = buffer.slice(0, newlineIdx);
          const textLine = String.fromCharCode(...lineBytes).trim();
          if (textLine.length >= 3) parseAsciiString(textLine);
          buffer = buffer.slice(newlineIdx + 1);
          rxBufferRef.current = buffer;
          continue;
        }

        if (buffer.length === 1 && (bmsData.detectedProtocol === 'Standard Battery' || bmsData.serviceUUID?.includes('180f'))) {
          parseStandardBattery(buffer[0]);
          buffer = [];
          rxBufferRef.current = buffer;
          break;
        }

        if (buffer.length > 300) {
          buffer = buffer.slice(buffer.length - 100);
          rxBufferRef.current = buffer;
        }
        break;
      }

      // Pick the candidate header that appears EARLIEST in the buffer
      candidates.sort((a, b) => a.index - b.index);
      const earliest = candidates[0];

      // Slice off leading junk bytes before the earliest valid header
      if (earliest.index > 0) {
        buffer = buffer.slice(earliest.index);
        rxBufferRef.current = buffer;
        
        // Update candidate indices to reflect the new buffer start
        candidates.forEach(c => {
          c.index -= earliest.index;
        });
      }

      // Process according to the earliest header type
      if (earliest.type === 'JK_4E') {
        if (buffer.length >= 4) {
          const rawLen = (buffer[2] << 8) | buffer[3];
          let expectedLen = (rawLen >= 10 && rawLen <= 400) ? (rawLen + 4) : 277;

          // Boundary protection: If another BMS header starts later in buffer, respect boundary
          const nextHeader = candidates.find(c => c.index > 0);
          if (nextHeader && nextHeader.index >= 12 && nextHeader.index < expectedLen) {
            expectedLen = nextHeader.index;
          }

          if (buffer.length >= expectedLen || (buffer.length >= 200 && !nextHeader)) {
            const actualLen = Math.min(buffer.length, expectedLen);
            const frame = buffer.slice(0, actualLen);
            const dataView = new DataView(new Uint8Array(frame).buffer);
            parseJkFrame(dataView);
            buffer = buffer.slice(actualLen);
            rxBufferRef.current = buffer;
            continue;
          } else {
            break; // Wait for remaining BLE MTU packets to arrive
          }
        } else {
          break;
        }
      } else if (earliest.type === 'JK_AA') {
        const nextHeader = candidates.find(c => c.index > 0);
        let expectedLen = 300; // JK02 telemetry frames are 300 bytes
        if (nextHeader && nextHeader.index >= 16) {
          expectedLen = nextHeader.index;
        }

        if (buffer.length >= expectedLen || (buffer.length >= 200 && !nextHeader)) {
          const actualLen = Math.min(buffer.length, expectedLen);
          const frame = buffer.slice(0, actualLen);
          const dataView = new DataView(new Uint8Array(frame).buffer);
          parseJkFrame(dataView);
          buffer = buffer.slice(actualLen);
          rxBufferRef.current = buffer;
          continue;
        } else {
          break; // Wait for more chunks to assemble the full JK02 frame
        }
      } else if (earliest.type === 'DALY') {
        if (buffer.length >= 13) {
          const frame = buffer.slice(0, 13);
          const dataView = new DataView(new Uint8Array(frame).buffer);
          parseDalyFrame(dataView);
          buffer = buffer.slice(13);
          rxBufferRef.current = buffer;
          continue;
        } else {
          break;
        }
      } else if (earliest.type === 'JBD') {
        if (buffer.length >= 4) {
          const dataLength = buffer[3];
          const totalFrameSize = 4 + dataLength + 3;
          if (buffer.length >= totalFrameSize) {
            const frame = buffer.slice(0, totalFrameSize);
            const dataView = new DataView(new Uint8Array(frame).buffer);
            parseJbdFrame(dataView);
            buffer = buffer.slice(totalFrameSize);
            rxBufferRef.current = buffer;
            continue;
          } else {
            break;
          }
        } else {
          break;
        }
      } else if (earliest.type === 'ANT') {
        if (buffer.length >= 10) {
          const dataView = new DataView(new Uint8Array(buffer).buffer);
          parseAntFrame(dataView);
          buffer = [];
          rxBufferRef.current = buffer;
          break;
        } else {
          break;
        }
      }
    }
  }, [parseDalyFrame, parseJbdFrame, parseJkFrame, parseAntFrame, parseAsciiString, parseStandardBattery, bmsData.detectedProtocol, bmsData.serviceUUID]);

  // Main entrypoint called on every `characteristicvaluechanged`
  const ingestIncomingDataView = useCallback((dataView: DataView) => {
    if (!dataView || dataView.byteLength === 0) return;

    // Convert DataView bytes to JS array and append to stream accumulator
    const newBytes: number[] = [];
    for (let i = 0; i < dataView.byteLength; i++) {
      newBytes.push(dataView.getUint8(i));
    }

    rxBufferRef.current = [...rxBufferRef.current, ...newBytes];

    // Trigger reassembly and packet parsing
    processRxBuffer();
  }, [processRxBuffer]);

  // --- WRITE HEX COMMAND TO BMS ---
  const sendHexCommand = useCallback(async (commandInput: string | number[] | Uint8Array) => {
    let payload: Uint8Array;
    let hexDisplay = '';

    try {
      if (typeof commandInput === 'string') {
        payload = hexStringToUint8Array(commandInput);
        hexDisplay = commandInput.toUpperCase();
      } else if (Array.isArray(commandInput)) {
        payload = new Uint8Array(commandInput);
        hexDisplay = Array.from(payload).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      } else {
        payload = commandInput;
        hexDisplay = Array.from(payload).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      }

      if (!writeCharRef.current) {
        addHexLog('SYS', hexDisplay, 'Cannot send: No writable characteristic connected.');
        return false;
      }

      const char = writeCharRef.current;
      addHexLog('TX', hexDisplay, `Sent to ${char.uuid.substring(0, 8)}...`);

      if (char.properties.writeWithoutResponse && char.properties.write) {
        try {
          await char.writeValueWithoutResponse(payload);
        } catch {
          await char.writeValue(payload);
        }
      } else if (char.properties.writeWithoutResponse) {
        await char.writeValueWithoutResponse(payload);
      } else if (char.properties.write) {
        await char.writeValue(payload);
      } else {
        addHexLog('SYS', hexDisplay, 'Characteristic properties do not support write.');
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('Failed to send Hex command:', err);
      addHexLog('SYS', hexDisplay, `Write Failed: ${err.message}`);
      return false;
    }
  }, [addHexLog]);

  // --- AUTO-PROBE / AUTO-POLLING LOOP ---
  const probeAndPollCycle = useCallback(() => {
    if (!writeCharRef.current) return;

    // 1. If Protocol is locked, send that protocol's polling sequence
    if (bmsData.detectedProtocol === 'Daly') {
      sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_MIN_MAX_CELL.bytes), 250);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_CELL_VOLTAGES.bytes), 500);
    } else if (bmsData.detectedProtocol === 'JBD/Xiaoxiang') {
      sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_CELL_VOLTAGES.bytes), 300);
    } else if (bmsData.detectedProtocol === 'JK BMS') {
      sendHexCommand(BMS_PRESET_COMMANDS.JK_WAKE_PULSE.bytes);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JK_READ_ALL_INFO.bytes), 100);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JK_READ_DEVICE_INFO.bytes), 250);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JK02_READ_INFO.bytes), 400);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JK_HANDSHAKE.bytes), 550);
      setTimeout(() => sendHexCommand(BMS_PRESET_COMMANDS.JK02_WAKE_INFO.bytes), 700);
    } else if (bmsData.detectedProtocol === 'ANT BMS') {
      sendHexCommand(BMS_PRESET_COMMANDS.ANT_READ_TELEMETRY.bytes);
    } else {
      // 2. UNKNOWN / AUTO-PROBING PROTOCOL: Send queries for JK BMS, Daly, JBD, and ANT sequentially
      addHexLog('SYS', 'AUTO_PROBE', 'Probing all BMS protocols (JK Classic & JK02 -> Daly -> JBD -> ANT)...');
      sendHexCommand(BMS_PRESET_COMMANDS.JK_READ_ALL_INFO.bytes);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.JK02_READ_INFO.bytes);
      }, 150);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
      }, 300);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
      }, 500);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.ANT_READ_TELEMETRY.bytes);
      }, 750);
    }
  }, [bmsData.detectedProtocol, sendHexCommand, addHexLog]);

  useEffect(() => {
    if (isConnected && bmsData.autoPollEnabled && writeCharRef.current) {
      pollingTimerRef.current = setInterval(() => {
        probeAndPollCycle();
      }, bmsData.pollingIntervalMs);
    } else {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    }

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isConnected, bmsData.autoPollEnabled, bmsData.pollingIntervalMs, probeAndPollCycle]);

  // --- WEB BLUETOOTH CONNECT METHOD ---
  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth API is not supported in this browser. Please use Google Chrome on Android or Desktop.");
      addHexLog('SYS', 'N/A', 'Web Bluetooth API unavailable in current environment.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      addHexLog('SYS', 'SCANNING', 'Opening Bluetooth scanner popup...');

      let device: BluetoothDevice;

      // 1. Dual request strategy: Accept all devices with optional services, or fallback to namePrefix filters
      try {
        device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ALL_OPTIONAL_SERVICES
        });
      } catch (firstError: any) {
        if (firstError.name === 'NotFoundError' || firstError.message?.includes('cancelled')) {
          throw firstError;
        }
        addHexLog('SYS', 'SCAN_FALLBACK', 'AcceptAllDevices fallback: Trying filtered BLE request...');
        device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'JK' },
            { namePrefix: 'NW' },
            { namePrefix: 'Okinawa' },
            { namePrefix: 'Yukinava' },
            { namePrefix: 'JBD' },
            { namePrefix: 'Xiaoxiang' },
            { namePrefix: 'Daly' },
            { namePrefix: 'ANT' },
            { namePrefix: 'BMS' },
            { namePrefix: 'Scooter' },
            { namePrefix: 'Battery' },
            { namePrefix: 'EV' },
            { namePrefix: 'SmartBMS' }
          ],
          optionalServices: ALL_OPTIONAL_SERVICES
        });
      }

      deviceRef.current = device;
      setDeviceName(device.name || 'BMS BLE Device');
      addHexLog('SYS', 'PAIRING', `Selected Device: ${device.name || 'Unnamed BMS'} [${device.id}]`);

      // Device Name Auto-Protocol Detection (Okinawa / Yukinava / JK / Daly / JBD / ANT)
      const nameUpper = (device.name || '').toUpperCase();
      if (
        nameUpper.includes('JK') || 
        nameUpper.includes('NW') || 
        nameUpper.includes('YUKINAVA') || 
        nameUpper.includes('OKINAWA') ||
        nameUpper.includes('REVOLT') ||
        nameUpper.includes('AMPERE') ||
        nameUpper.includes('HERO') ||
        nameUpper.includes('PURE') ||
        nameUpper.includes('ATHER') ||
        nameUpper.includes('BGAUSS') ||
        nameUpper.includes('OKAYA') ||
        nameUpper.includes('KOMAKI') ||
        nameUpper.includes('BIKE') ||
        nameUpper.includes('SCOOTER') ||
        nameUpper.includes('SMARTBMS')
      ) {
        setBmsData(prev => ({ ...prev, detectedProtocol: 'JK BMS', connectionType: 'BLE' }));
        addHexLog('SYS', 'AUTO_DETECT', 'Auto-detected protocol from device name: JK BMS');
      } else if (nameUpper.includes('XIAOXIANG') || nameUpper.includes('JBD')) {
        setBmsData(prev => ({ ...prev, detectedProtocol: 'JBD/Xiaoxiang', connectionType: 'BLE' }));
        addHexLog('SYS', 'AUTO_DETECT', 'Auto-detected protocol from device name: JBD/Xiaoxiang');
      } else if (nameUpper.includes('DALY') || nameUpper.includes('DL-')) {
        setBmsData(prev => ({ ...prev, detectedProtocol: 'Daly', connectionType: 'BLE' }));
        addHexLog('SYS', 'AUTO_DETECT', 'Auto-detected protocol from device name: Daly');
      } else if (nameUpper.includes('ANT')) {
        setBmsData(prev => ({ ...prev, detectedProtocol: 'ANT BMS', connectionType: 'BLE' }));
        addHexLog('SYS', 'AUTO_DETECT', 'Auto-detected protocol from device name: ANT BMS');
      } else {
        setBmsData(prev => ({ ...prev, connectionType: 'BLE' }));
      }

      // Disconnect event handler
      device.addEventListener('gattserverdisconnected', () => {
        addHexLog('SYS', 'DISCONNECTED', 'GATT Server Disconnected.');
        disconnect();
      });

      // 2. Connect to GATT Server
      addHexLog('SYS', 'CONNECTING', 'Connecting to GATT server...');
      const server = await device.gatt?.connect();
      
      if (!server) {
        throw new Error('Failed to establish GATT connection server.');
      }
      gattServerRef.current = server;
      setIsConnected(true);

      // 3. Discover Primary Services
      addHexLog('SYS', 'DISCOVERING', 'Discovering GATT primary services...');
      let services: BluetoothRemoteGATTService[] = [];
      try {
        services = await server.getPrimaryServices();
      } catch (svcErr) {
        console.warn('getPrimaryServices failed, trying specific service UUIDs:', svcErr);
        // Fallback: try getting primary service by specific known BMS UUIDs
        const knownUuids = ['0000ffe0-0000-1000-8000-00805f9b34fb', '0000e7e0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '6e400001-b5a3-f393-e0a9-e50e24dcca9e', 'battery_service'];
        for (const uuid of knownUuids) {
          try {
            const singleSvc = await server.getPrimaryService(uuid);
            if (singleSvc) services.push(singleSvc);
          } catch (e) {
            // continue
          }
        }
      }

      addHexLog('SYS', 'SERVICES', `Found ${services.length} primary service(s) on device.`);

      let selectedNotifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      let selectedWriteChar: BluetoothRemoteGATTCharacteristic | null = null;
      let matchedServiceUUID = '';

      // SMART GATT SERVICE MATCHING ALGORITHM across all discovered services
      for (const service of services) {
        const serviceUuid = service.uuid.toLowerCase();
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            const props = char.properties;
            addHexLog('SYS', 'CHAR_DISCOVERED', `Service ${serviceUuid.substring(0, 8)}... -> Char ${char.uuid.substring(0, 8)}... (Notify: ${props.notify || props.indicate}, Write: ${props.write || props.writeWithoutResponse})`);

            if ((props.notify || props.indicate) && !selectedNotifyChar) {
              selectedNotifyChar = char;
              matchedServiceUUID = service.uuid;
            }
            if ((props.write || props.writeWithoutResponse) && !selectedWriteChar) {
              selectedWriteChar = char;
            }
          }
        } catch (e) {
          console.warn(`Could not inspect service ${serviceUuid}:`, e);
        }
      }

      if (!selectedNotifyChar) {
        throw new Error('No Bluetooth characteristic with NOTIFY or INDICATE found on this device.');
      }

      notifyCharRef.current = selectedNotifyChar;
      writeCharRef.current = selectedWriteChar;

      addHexLog('SYS', 'CONFIGURED', `Notify Char: ${selectedNotifyChar.uuid}, Write Char: ${selectedWriteChar ? selectedWriteChar.uuid : 'None'}`);

      // 4. Enable BLE Notifications
      addHexLog('SYS', 'START_NOTIFY', `Subscribing to notifications on ${selectedNotifyChar.uuid.substring(0, 8)}...`);
      await selectedNotifyChar.startNotifications();
      addHexLog('SYS', 'NOTIFICATIONS_ACTIVE', 'Successfully enabled BLE notifications!');

      // 5. Attach event listener for incoming raw data packets
      selectedNotifyChar.addEventListener('characteristicvaluechanged', (event: Event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        if (char && char.value) {
          ingestIncomingDataView(char.value);
        }
      });

      setBmsData(prev => ({
        ...prev,
        serviceUUID: matchedServiceUUID,
        notifyCharUUID: selectedNotifyChar?.uuid,
        writeCharUUID: selectedWriteChar?.uuid,
        connectionType: 'BLE'
      }));

      // 6. Trigger immediate Hardware Wake Pulse & Protocol Probe Cycle
      if (selectedWriteChar) {
        addHexLog('SYS', 'WAKING', 'Sending JK BMS / Okinawa BLE Hardware Wake Pulse...');
        // Send wake byte pulse sequence
        sendHexCommand(BMS_PRESET_COMMANDS.JK_WAKE_PULSE.bytes);
        
        setTimeout(() => {
          probeAndPollCycle();
        }, 300);
      }

    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
        addHexLog('SYS', 'CANCELLED', 'Device selection cancelled by user.');
      } else {
        console.error('Bluetooth connection error:', err);
        setError(err.message || 'Failed to connect to Bluetooth device');
        addHexLog('SYS', 'ERROR', `Connection failed: ${err.message}`);
      }
      setIsConnecting(false);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // --- DEMO MOCK SIMULATION (For testing in non-BLE environments / iframe previews) ---
  const simulateIncomingPacket = useCallback((presetKey: keyof typeof BMS_PRESET_COMMANDS | 'JK_16S_REAL' | 'OKINAWA_DUAL_REAL') => {
    addHexLog('SYS', 'SIMULATION', `Simulating Live Hardware Packet: ${presetKey}`);
    
    let mockBytes: number[];
    if (presetKey === 'OKINAWA_DUAL_REAL' || presetKey === 'JK02_READ_INFO') {
      // Okinawa Praise / i-Praise Dual Lithium Pack (JK02/Okinawa 67.2V 20S Pack @ 92% SOC, 28°C)
      mockBytes = [
        0xAA, 0x55, 0x90, 0xEB, 0x97, 0x1A, 0x40, 0x00, 0x5C, 0x1C, 0x00, 0x20,
        0x01, 0x0E, 0x48, 0x02, 0x0E, 0x48, 0x03, 0x0E, 0x48, 0x04, 0x0E, 0x48,
        0x05, 0x0E, 0x48, 0x06, 0x0E, 0x48, 0x07, 0x0E, 0x48, 0x08, 0x0E, 0x48,
        0x09, 0x0E, 0x48, 0x0A, 0x0E, 0x48, 0x0B, 0x0E, 0x48, 0x0C, 0x0E, 0x48,
        0x0D, 0x0E, 0x48, 0x0E, 0x0E, 0x48, 0x0F, 0x0E, 0x48, 0x10, 0x0E, 0x48
      ];
      setDeviceName('Okinawa Lithium Dual Battery');
      setIsConnected(true);
      setBmsData(prev => ({ ...prev, detectedProtocol: 'JK BMS' }));
    } else if (presetKey === 'JK_16S_REAL' || presetKey.startsWith('JK')) {
      // JK BMS 16S 60V Pack: 16 cells @ 3.65V = 58.40V, 1.5A discharge, 88% SOC, 28°C, 45 cycles
      mockBytes = [
        0x4E, 0x57, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x00, 0x00, // Header
        0x79, 0x30, // Tag 0x79 (Cell voltages: 16 cells x 3 bytes = 48 bytes)
        0x01, 0x0E, 0x42, 0x02, 0x0E, 0x42, 0x03, 0x0E, 0x42, 0x04, 0x0E, 0x42,
        0x05, 0x0E, 0x42, 0x06, 0x0E, 0x42, 0x07, 0x0E, 0x42, 0x08, 0x0E, 0x42,
        0x09, 0x0E, 0x42, 0x0A, 0x0E, 0x42, 0x0B, 0x0E, 0x42, 0x0C, 0x0E, 0x42,
        0x0D, 0x0E, 0x42, 0x0E, 0x0E, 0x42, 0x0F, 0x0E, 0x42, 0x10, 0x0E, 0x42,
        0x80, 0x00, 0x1C, // Tag 0x80 Temp 28°C
        0x83, 0x16, 0xD0, // Tag 0x83 Total Pack Voltage 58.40V
        0x84, 0x00, 0x96, // Tag 0x84 Current 1.50A
        0x85, 0x58,       // Tag 0x85 SOC 88%
        0x87, 0x00, 0x2D  // Tag 0x87 Cycles 45
      ];
      setDeviceName('JK BMS Smart 16S Pack');
      setIsConnected(true);
      setBmsData(prev => ({ ...prev, detectedProtocol: 'JK BMS' }));
    } else if (presetKey.startsWith('DALY')) {
      // Daly 0x90 mock frame: 58.4V, 0.0A, 85% SOC
      mockBytes = [0xA5, 0x01, 0x90, 0x08, 0x02, 0x48, 0x00, 0x00, 0x75, 0x30, 0x03, 0x52, 0x00];
      setDeviceName('Daly Smart BMS');
      setIsConnected(true);
      setBmsData(prev => ({ ...prev, detectedProtocol: 'Daly' }));
    } else {
      // JBD Basic Info mock frame: 58.40V, 1.20A, 88% SOC, 28°C
      mockBytes = [0xDD, 0x03, 0x00, 0x1B, 0x16, 0xD0, 0x00, 0x78, 0x09, 0xC4, 0x0B, 0xB8, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x58, 0x03, 0x01, 0x0B, 0xBA, 0x77];
      setDeviceName('JBD / Xiaoxiang BMS');
      setIsConnected(true);
      setBmsData(prev => ({ ...prev, detectedProtocol: 'JBD/Xiaoxiang' }));
    }

    const dataView = new DataView(new Uint8Array(mockBytes).buffer);
    ingestIncomingDataView(dataView);
  }, [addHexLog, ingestIncomingDataView]);

  const disconnect = useCallback(() => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    if (gattServerRef.current?.connected) {
      gattServerRef.current.disconnect();
    }
    writeCharRef.current = null;
    notifyCharRef.current = null;
    deviceRef.current = null;
    gattServerRef.current = null;
    rxBufferRef.current = [];
    smootherRef.current.reset();

    setIsConnected(false);
    setDeviceName(null);
    setBmsData(INITIAL_DATA);
    addHexLog('SYS', 'DISCONNECTED', 'Session closed cleanly.');
  }, [addHexLog]);

  const setManualProtocol = useCallback((protocol: BMSData['detectedProtocol']) => {
    setBmsData(prev => ({ ...prev, detectedProtocol: protocol }));
    addHexLog('SYS', 'PROTOCOL_CHANGE', `Manually set protocol to: ${protocol}`);
  }, [addHexLog]);

  const triggerPollNow = useCallback(() => {
    addHexLog('SYS', 'MANUAL_POLL', 'Triggered manual BMS poll');
    probeAndPollCycle();
  }, [addHexLog, probeAndPollCycle]);

  const toggleAutoPoll = useCallback(() => {
    setBmsData(prev => ({ ...prev, autoPollEnabled: !prev.autoPollEnabled }));
  }, []);

  const clearHexLogs = useCallback(() => {
    setBmsData(prev => ({ ...prev, rawHexLogs: [], totalPacketsReceived: 0 }));
  }, []);

  const toggleAntiTheft = useCallback(() => {
    setBmsData(prev => {
      const nextMosfetOn = !prev.chargeDischargeActive;
      const nextLocked = !nextMosfetOn;
      
      addHexLog('SYS', 'MOSFET_STATE', `Kill Switch / MOSFET set to: ${nextMosfetOn ? 'ON (Charge & Discharge Active)' : 'OFF (Kill Switch Cutoff)'}`);
      
      // If connected via BLE, send hardware MOS control frames
      if (writeCharRef.current) {
        if (prev.detectedProtocol === 'Daly') {
          const byteVal = nextMosfetOn ? 0x01 : 0x00;
          sendHexCommand([0xA5, 0x40, 0xD9, 0x08, byteVal, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, nextMosfetOn ? 0xBF : 0xBE]);
        } else if (prev.detectedProtocol === 'JBD/Xiaoxiang') {
          const mosVal = nextMosfetOn ? 0x00 : 0x03;
          sendHexCommand([0xDD, 0x5A, 0xE1, 0x02, 0x00, mosVal, 0xFF, nextMosfetOn ? 0x1D : 0x1A, 0x77]);
        } else if (prev.detectedProtocol === 'JK BMS') {
          const mosVal = nextMosfetOn ? 0x01 : 0x02;
          sendHexCommand([0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x06, mosVal, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x01, nextMosfetOn ? 0x27 : 0x28]);
        }
      }

      return {
        ...prev,
        isLocked: nextLocked,
        chargeDischargeActive: nextMosfetOn,
        current: nextMosfetOn ? prev.current : 0.0,
        power: nextMosfetOn ? prev.power : 0.0,
        status: nextMosfetOn ? 'Normal' : 'MOSFET Off'
      };
    });
  }, [addHexLog, sendHexCommand]);

  const setChargeLimit = useCallback((limit: number) => {
    setBmsData(prev => ({ ...prev, chargeLimit: limit }));
  }, []);

  const setReserveBuffer = useCallback((buffer: number) => {
    setBmsData(prev => ({ ...prev, reserveBuffer: buffer }));
  }, []);

  const setRangeCalcMode = useCallback((mode: 'voltage' | 'soc') => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        mode,
        prev.maxRangeKM,
        prev.rangeOffsetKM,
        prev.rangePerVolt,
        prev.minVoltage,
        prev.maxVoltage
      );
      return { ...prev, rangeCalcMode: mode, estimatedRangeKM: newRange };
    });
  }, []);

  const setRangeOffsetKM = useCallback((offset: number) => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        prev.maxRangeKM,
        offset,
        prev.rangePerVolt,
        prev.minVoltage,
        prev.maxVoltage
      );
      return { ...prev, rangeOffsetKM: offset, estimatedRangeKM: newRange };
    });
  }, []);

  const setRangePerVolt = useCallback((perVolt: number) => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        prev.maxRangeKM,
        prev.rangeOffsetKM,
        perVolt,
        prev.minVoltage,
        prev.maxVoltage
      );
      return { ...prev, rangePerVolt: perVolt, estimatedRangeKM: newRange };
    });
  }, []);

  const setMaxRange = useCallback((range: number) => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        range,
        prev.rangeOffsetKM,
        prev.rangePerVolt,
        prev.minVoltage,
        prev.maxVoltage
      );
      return { ...prev, maxRangeKM: range, estimatedRangeKM: newRange };
    });
  }, []);

  const setMinVoltage = useCallback((voltage: number) => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        prev.maxRangeKM,
        prev.rangeOffsetKM,
        prev.rangePerVolt,
        voltage,
        prev.maxVoltage
      );
      return { ...prev, minVoltage: voltage, estimatedRangeKM: newRange };
    });
  }, []);

  const setMaxVoltage = useCallback((voltage: number) => {
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        prev.maxRangeKM,
        prev.rangeOffsetKM,
        prev.rangePerVolt,
        prev.minVoltage,
        voltage
      );
      return { ...prev, maxVoltage: voltage, estimatedRangeKM: newRange };
    });
  }, []);

  const applyBatteryPreset = useCallback((presetKey: keyof typeof BATTERY_PRESETS) => {
    const preset = BATTERY_PRESETS[presetKey];
    if (!preset) return;
    setBmsData(prev => {
      const newRange = computeDynamicRange(
        prev.voltage,
        prev.capacityPercent,
        prev.rangeCalcMode,
        preset.maxRangeKM,
        prev.rangeOffsetKM,
        preset.rangePerVolt,
        preset.minVoltage,
        preset.maxVoltage
      );
      return {
        ...prev,
        minVoltage: preset.minVoltage,
        maxVoltage: preset.maxVoltage,
        maxRangeKM: preset.maxRangeKM,
        rangePerVolt: preset.rangePerVolt,
        estimatedRangeKM: newRange
      };
    });
    addHexLog('SYS', 'PRESET_APPLIED', `Applied Battery Profile: ${preset.name} (${preset.minVoltage}V - ${preset.maxVoltage}V)`);
  }, [addHexLog]);

  return {
    isConnected,
    isConnecting,
    error,
    deviceName,
    bmsData,
    connectBluetooth,
    disconnect,
    sendHexCommand,
    simulateIncomingPacket,
    setManualProtocol,
    triggerPollNow,
    toggleAutoPoll,
    clearHexLogs,
    toggleAntiTheft,
    setChargeLimit,
    setReserveBuffer,
    setRangeCalcMode,
    setRangeOffsetKM,
    setRangePerVolt,
    setMaxRange,
    setMinVoltage,
    setMaxVoltage,
    applyBatteryPreset
  };
}
