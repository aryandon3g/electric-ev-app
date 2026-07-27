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

// Comprehensive list of optional service UUIDs for Bluetooth requestDevice
const ALL_OPTIONAL_SERVICES = [
  'battery_service',
  BMS_UUIDS.DALY.SERVICE,
  BMS_UUIDS.JBD.SERVICE,
  BMS_UUIDS.JK.SERVICE,
  BMS_UUIDS.NUS.SERVICE,
  BMS_UUIDS.ANT.SERVICE,
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '00001000-0000-1000-8000-00805f9b34fb',
  '0000a002-0000-1000-8000-00805f9b34fb',
  '00000001-0000-1000-8000-00805f9b34fb',
  '0000f00d-0000-1000-8000-00805f9b34fb'
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

  // JK BMS Commands
  JK_READ_ALL_INFO: {
    name: 'JK BMS Read All Telemetry',
    hex: '4E 57 00 13 00 00 00 00 06 03 00 00 00 00 00 00 68 00 00 01 29',
    bytes: [0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x01, 0x29]
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

  getSmoothedVoltage(newVoltage: number): number {
    const now = Date.now();
    this.history.push({ value: newVoltage, timestamp: now });
    this.history = this.history.filter(item => now - item.timestamp <= this.windowMs);
    const sum = this.history.reduce((acc, item) => acc + item.value, 0);
    return sum / this.history.length;
  }
}

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
  alerts: [],
  timeToFullChargeMinutes: null,
  chargeLimit: 100,
  reserveBuffer: 5,
  tripEnergyWh: 0,
  maxRangeKM: 70,
  minVoltage: 40,
  maxVoltage: 84,
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
        const power = Number((smoothedV * rawCurr).toFixed(1));
        const estRange = (rawSoc / 100) * prev.maxRangeKM;

        let status: BMSData['status'] = 'Normal';
        if (rawCurr > 0.5) status = 'Charging';
        else if (rawCurr < -0.5) status = 'Discharging';

        return {
          ...prev,
          voltage: smoothedV,
          current: rawCurr,
          capacityPercent: rawSoc,
          remainingCapacityAH: capacityAH,
          power,
          status,
          estimatedRangeKM: Number(estRange.toFixed(1)),
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
      
      // JBD byte 21 provides the direct SOC percentage!
      let rawSoc = dataView.byteLength >= 22 ? dataView.getUint8(21) : 0;
      if (rawSoc === 0 && nominalAH > 0) {
        rawSoc = Number(((remainingAH / nominalAH) * 100).toFixed(1));
      }

      // Temperature sensor (Kelvin in 0.1K, offset 2731)
      let tempC = 25.0;
      if (dataView.byteLength >= 26) {
        const rawK = (dataView.getUint8(24) << 8) | dataView.getUint8(25);
        if (rawK > 0) {
          tempC = Number(((rawK - 2731) / 10).toFixed(1));
        }
      }

      // Balance status bitmask at offset 16-17
      const balanceMask = (dataView.getUint8(16) << 8) | dataView.getUint8(17);

      addHexLog('RX', rawHex, `JBD Basic Info -> Volts: ${rawVolts}V, Curr: ${rawCurr}A, SOC: ${rawSoc}%, Rem: ${remainingAH}Ah, Temp: ${tempC}°C, Cycles: ${cycles}`);

      setBmsData(prev => {
        const smoothedV = Number(smootherRef.current.getSmoothedVoltage(rawVolts).toFixed(2));
        const estRange = (rawSoc / 100) * prev.maxRangeKM;
        const power = Number((smoothedV * rawCurr).toFixed(1));

        let currentStatus: BMSData['status'] = 'Normal';
        if (rawCurr > 0.5) currentStatus = 'Charging';
        else if (rawCurr < -0.5) currentStatus = 'Discharging';

        // Update balancing state on cells if balance mask present
        const updatedCells = prev.cells.map((cell, idx) => ({
          ...cell,
          isBalancing: Boolean(balanceMask & (1 << idx))
        }));

        return {
          ...prev,
          voltage: smoothedV,
          current: rawCurr,
          capacityPercent: rawSoc,
          remainingCapacityAH: remainingAH,
          nominalCapacityAH: nominalAH > 0 ? nominalAH : prev.nominalCapacityAH,
          cycleCount: cycles,
          temperature: tempC,
          power,
          status: currentStatus,
          estimatedRangeKM: Number(estRange.toFixed(1)),
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

  // 3. JK BMS FRAME PARSER (Header 0x4E 0x57 "NW")
  const parseJkFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    addHexLog('RX', rawHex, 'JK BMS Telemetry Frame Received');

    // Parse TLV fields inside JK BMS payload
    let offset = 10; // TLV start
    let parsedV = 0;
    let parsedI = 0;
    let parsedSoc = 0;
    let parsedTemp = 0;
    const parsedCells: CellData[] = [];

    while (offset < dataView.byteLength - 4) {
      const tag = dataView.getUint8(offset);
      offset++;

      if (tag === 0x79) { // Cell voltages list
        const len = dataView.getUint8(offset);
        offset++;
        const cellCount = len / 3;
        for (let i = 0; i < cellCount && (offset + 2) < dataView.byteLength; i++) {
          const cellV = ((dataView.getUint8(offset + 1) << 8) | dataView.getUint8(offset + 2)) / 1000;
          parsedCells.push({ id: i + 1, voltage: cellV, isBalancing: false, healthStatus: cellV < 2.9 || cellV > 4.25 ? 'Warning' : 'Good' });
          offset += 3;
        }
      } else if (tag === 0x83) { // Total Pack Voltage
        parsedV = ((dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1)) / 100;
        offset += 2;
      } else if (tag === 0x84) { // Current
        const rawI = (dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1);
        parsedI = (rawI > 32767 ? rawI - 65536 : rawI) / 100;
        offset += 2;
      } else if (tag === 0x85) { // SOC %
        parsedSoc = dataView.getUint8(offset);
        offset += 1;
      } else if (tag === 0x80 || tag === 0x81) { // Temperatures
        const rawT = (dataView.getUint8(offset) << 8) | dataView.getUint8(offset + 1);
        parsedTemp = rawT > 32767 ? rawT - 65536 : rawT;
        offset += 2;
      } else {
        offset += 2; // Advance default field
      }
    }

    setBmsData(prev => ({
      ...prev,
      voltage: parsedV > 0 ? Number(smootherRef.current.getSmoothedVoltage(parsedV).toFixed(2)) : prev.voltage,
      current: parsedI !== 0 ? parsedI : prev.current,
      capacityPercent: parsedSoc > 0 ? parsedSoc : prev.capacityPercent,
      temperature: parsedTemp !== 0 ? parsedTemp : prev.temperature,
      cells: parsedCells.length > 0 ? parsedCells : prev.cells,
      detectedProtocol: 'JK BMS'
    }));
  }, [addHexLog]);

  // 4. ANT BMS FRAME PARSER (Header 0xDB 0xDB or 0x7A 0x7A)
  const parseAntFrame = useCallback((dataView: DataView) => {
    const rawHex = dataViewToHexString(dataView);
    if (dataView.byteLength >= 10) {
      const packV = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 10;
      const soc = dataView.getUint8(8);
      addHexLog('RX', rawHex, `ANT BMS -> Volts: ${packV}V, SOC: ${soc}%`);

      setBmsData(prev => ({
        ...prev,
        voltage: Number(smootherRef.current.getSmoothedVoltage(packV).toFixed(2)),
        capacityPercent: soc,
        detectedProtocol: 'ANT BMS'
      }));
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
    setBmsData(prev => {
      const simulatedV = prev.minVoltage + ((socLevel / 100) * (prev.maxVoltage - prev.minVoltage));
      return {
        ...prev,
        capacityPercent: socLevel,
        voltage: Number(simulatedV.toFixed(2)),
        detectedProtocol: 'Standard Battery'
      };
    });
  }, [addHexLog]);

  // --- STREAM REASSEMBLY ENGINE ---
  // Processes cumulative rxBufferRef across fragmented BLE notifications
  const processRxBuffer = useCallback(() => {
    let buffer = rxBufferRef.current;
    let maxLoopAttempts = 40;

    while (buffer.length > 0 && maxLoopAttempts > 0) {
      maxLoopAttempts--;

      // A) DALY BMS (Header 0xA5)
      const dalyIdx = buffer.indexOf(0xA5);
      if (dalyIdx >= 0) {
        if (dalyIdx > 0 && dalyIdx < 30) {
          buffer = buffer.slice(dalyIdx);
          rxBufferRef.current = buffer;
        }
        if (buffer.length >= 13) {
          const frame = buffer.slice(0, 13);
          const dataView = new DataView(new Uint8Array(frame).buffer);
          parseDalyFrame(dataView);
          buffer = buffer.slice(13);
          rxBufferRef.current = buffer;
          continue;
        } else {
          break; // Wait for second BLE chunk
        }
      }

      // B) JBD / XIAOXIANG (Header 0xDD)
      const jbdIdx = buffer.indexOf(0xDD);
      if (jbdIdx >= 0) {
        if (jbdIdx > 0 && jbdIdx < 30) {
          buffer = buffer.slice(jbdIdx);
          rxBufferRef.current = buffer;
        }
        if (buffer.length >= 4) {
          const dataLength = buffer[3];
          const totalFrameSize = 4 + dataLength + 3; // header(1) + cmd(1) + status(1) + len(1) + payload(N) + checksum(2) + stop(1)
          if (buffer.length >= totalFrameSize) {
            const frame = buffer.slice(0, totalFrameSize);
            const dataView = new DataView(new Uint8Array(frame).buffer);
            parseJbdFrame(dataView);
            buffer = buffer.slice(totalFrameSize);
            rxBufferRef.current = buffer;
            continue;
          } else {
            break; // Wait for remaining bytes of JBD frame
          }
        } else {
          break;
        }
      }

      // C) JK BMS (Header 0x4E 0x57 "NW")
      let jkIdx = -1;
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i] === 0x4E && buffer[i + 1] === 0x57) {
          jkIdx = i;
          break;
        }
      }
      if (jkIdx >= 0) {
        if (jkIdx > 0 && jkIdx < 30) {
          buffer = buffer.slice(jkIdx);
          rxBufferRef.current = buffer;
        }
        if (buffer.length >= 20) {
          const dataView = new DataView(new Uint8Array(buffer).buffer);
          parseJkFrame(dataView);
          buffer = [];
          rxBufferRef.current = buffer;
          break;
        } else {
          break;
        }
      }

      // D) ANT BMS (Header 0xDB 0xDB or 0x7A 0x7A)
      let antIdx = -1;
      for (let i = 0; i < buffer.length - 1; i++) {
        if ((buffer[i] === 0xDB && buffer[i + 1] === 0xDB) || (buffer[i] === 0x7A && buffer[i + 1] === 0x7A)) {
          antIdx = i;
          break;
        }
      }
      if (antIdx >= 0) {
        if (antIdx > 0 && antIdx < 30) {
          buffer = buffer.slice(antIdx);
          rxBufferRef.current = buffer;
        }
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

      // E) ASCII NEWLINE STREAM
      const newlineIdx = buffer.findIndex(b => b === 0x0A || b === 0x0D);
      if (newlineIdx >= 0) {
        const lineBytes = buffer.slice(0, newlineIdx);
        const textLine = String.fromCharCode(...lineBytes).trim();
        if (textLine.length >= 3) {
          parseAsciiString(textLine);
        }
        buffer = buffer.slice(newlineIdx + 1);
        rxBufferRef.current = buffer;
        continue;
      }

      // F) SINGLE-BYTE BATTERY LEVEL
      if (buffer.length === 1 && (bmsData.detectedProtocol === 'Standard Battery' || bmsData.serviceUUID?.includes('180f'))) {
        parseStandardBattery(buffer[0]);
        buffer = [];
        rxBufferRef.current = buffer;
        break;
      }

      // Prevent buffer overflow by dropping stale leading byte if no signature matched after 200 bytes
      if (buffer.length > 200) {
        buffer = buffer.slice(1);
        rxBufferRef.current = buffer;
      } else {
        break;
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

      if (char.properties.writeWithoutResponse) {
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
      sendHexCommand(BMS_PRESET_COMMANDS.JK_READ_ALL_INFO.bytes);
    } else if (bmsData.detectedProtocol === 'ANT BMS') {
      sendHexCommand(BMS_PRESET_COMMANDS.ANT_READ_TELEMETRY.bytes);
    } else {
      // 2. UNKNOWN PROTOCOL: AUTO-PROBE by sending query commands for Daly, JBD, and JK sequentially
      addHexLog('SYS', 'AUTO_PROBE', 'Probing BMS protocol (Daly -> JBD -> JK)...');
      sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
      }, 350);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.JK_READ_ALL_INFO.bytes);
      }, 700);
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
      addHexLog('SYS', 'SCANNING', 'Requesting BLE device popup...');

      // 1. Request Bluetooth Device with all known BMS UART services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_OPTIONAL_SERVICES
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'BMS BLE Device');
      addHexLog('SYS', 'PAIRING', `Selected Device: ${device.name || 'Unnamed BMS'} [${device.id}]`);

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
      const services = await server.getPrimaryServices();
      addHexLog('SYS', 'SERVICES', `Found ${services.length} services on device.`);

      let selectedNotifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      let selectedWriteChar: BluetoothRemoteGATTCharacteristic | null = null;
      let matchedServiceUUID = '';

      // SMART GATT SERVICE MATCHING ALGORITHM
      // Find a single service that contains BOTH a Notify/Indicate characteristic AND a Write characteristic
      for (const service of services) {
        const serviceUuid = service.uuid.toLowerCase();
        try {
          const chars = await service.getCharacteristics();
          let notifyInService: BluetoothRemoteGATTCharacteristic | null = null;
          let writeInService: BluetoothRemoteGATTCharacteristic | null = null;

          for (const char of chars) {
            const props = char.properties;
            addHexLog('SYS', 'CHAR_DISCOVERED', `Service ${serviceUuid.substring(0, 8)}... -> Char ${char.uuid.substring(0, 8)}... (Notify: ${props.notify || props.indicate}, Write: ${props.write || props.writeWithoutResponse})`);

            if ((props.notify || props.indicate) && !notifyInService) {
              notifyInService = char;
            }
            if ((props.write || props.writeWithoutResponse) && !writeInService) {
              writeInService = char;
            }
          }

          // If this service has BOTH Notify and Write, it's overwhelmingly the BMS UART service!
          if (notifyInService && writeInService && !selectedNotifyChar) {
            selectedNotifyChar = notifyInService;
            selectedWriteChar = writeInService;
            matchedServiceUUID = service.uuid;
            addHexLog('SYS', 'MATCHED_UART_SERVICE', `Found complete UART pair in service: ${serviceUuid}`);
            break;
          }

          // Fallback single characteristic capture
          if (notifyInService && !selectedNotifyChar) {
            selectedNotifyChar = notifyInService;
            matchedServiceUUID = service.uuid;
          }
          if (writeInService && !selectedWriteChar) {
            selectedWriteChar = writeInService;
          }
        } catch (e) {
          console.warn(`Could not inspect service ${serviceUuid}:`, e);
        }
      }

      if (!selectedNotifyChar) {
        throw new Error('No characteristic with NOTIFY or INDICATE properties found on device.');
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
        writeCharUUID: selectedWriteChar?.uuid
      }));

      // 6. Trigger immediate protocol probe cycle
      if (selectedWriteChar) {
        addHexLog('SYS', 'PROBING', 'Sending initial auto-probe commands...');
        sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
        setTimeout(() => {
          sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
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

  // --- DEMO MOCK SIMULATION (For testing in non-BLE environments) ---
  const simulateIncomingPacket = useCallback((presetKey: keyof typeof BMS_PRESET_COMMANDS) => {
    addHexLog('SYS', 'SIMULATION', `Triggered mock packet for ${presetKey}`);
    
    let mockBytes: number[];
    if (presetKey.startsWith('DALY')) {
      // Daly 0x90 mock frame: 58.4V, 0.0A, 85% SOC
      mockBytes = [0xA5, 0x01, 0x90, 0x08, 0x02, 0x48, 0x00, 0x00, 0x75, 0x30, 0x03, 0x52, 0x00];
    } else if (presetKey.startsWith('JBD')) {
      // JBD Basic Info mock frame: 58.40V, 1.20A, 88% SOC, 28°C
      mockBytes = [0xDD, 0x03, 0x00, 0x1B, 0x16, 0xD0, 0x00, 0x78, 0x09, 0xC4, 0x0B, 0xB8, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x58, 0x03, 0x01, 0x0B, 0xBA, 0x77];
    } else {
      mockBytes = [0x4E, 0x57, 0x00, 0x13, 0x00, 0x00, 0x00, 0x00, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x01, 0x29];
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

    setIsConnected(false);
    setDeviceName(null);
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
    setMaxRange,
    setMinVoltage,
    setMaxVoltage
  };
}
