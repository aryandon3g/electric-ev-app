import { useState, useCallback, useRef, useEffect } from 'react';
import { BMSData, CellData, BLEHexLog } from '../types';

// --- COMMON CHINESE BMS & UART SERVICE UUIDS ---
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
  STANDARD_BATTERY: {
    SERVICE: 'battery_service',
    NOTIFY: 'battery_level',
  }
};

// All optional service UUIDs to pass to Bluetooth requestDevice
const ALL_OPTIONAL_SERVICES = [
  'battery_service',
  BMS_UUIDS.DALY.SERVICE,
  BMS_UUIDS.JBD.SERVICE,
  BMS_UUIDS.NUS.SERVICE,
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '00001000-0000-1000-8000-00805f9b34fb',
  '0000a002-0000-1000-8000-00805f9b34fb'
];

// Preset Hex Commands
export const BMS_PRESET_COMMANDS = {
  // Daly BMS Poll Commands
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

// --- CORE SOC & SMOOTHING ALGORITHMS ---
export const calculateTrueZeroSoC = (voltage: number, reserveBuffer: number = 0, minV: number = 55.0, maxV: number = 64.0): number => {
  if (voltage <= minV) return 0;
  if (voltage >= maxV) return 100;
  const rawSoC = ((voltage - minV) / (maxV - minV)) * 100;
  if (rawSoC <= reserveBuffer) return 0;
  return ((rawSoC - reserveBuffer) / (100 - reserveBuffer)) * 100;
};

export const applyWeakCellFallback = (cells: CellData[], currentSoC: number): number => {
  if (!cells || cells.length === 0) return currentSoC;
  const lowestCellVoltage = Math.min(...cells.map(c => c.voltage));
  if (lowestCellVoltage < 2.9) {
    return Math.min(currentSoC, 5);
  }
  return currentSoC;
};

export class VoltageSmoother {
  private history: { value: number; timestamp: number }[] = [];
  private windowMs: number;

  constructor(windowSeconds = 5) {
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

const generateEmptyCells = (count = 16): CellData[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i + 1,
    voltage: 3.65,
    isBalancing: false,
    healthStatus: 'Good'
  }));
};

const INITIAL_DATA: BMSData = {
  voltage: 58.4,
  current: 0.0,
  capacityPercent: 85,
  temperature: 28.5,
  status: 'Normal',
  power: 0,
  remainingCapacityAH: 25.5,
  nominalCapacityAH: 30.0,
  cells: generateEmptyCells(16),
  cycleCount: 42,
  estimatedRangeKM: 59.5,
  efficiencyWhPerKm: 22,
  thermalState: 'Normal',
  isLocked: false,
  alerts: [],
  timeToFullChargeMinutes: null,
  chargeLimit: 100,
  reserveBuffer: 5,
  tripEnergyWh: 140,
  maxRangeKM: 70,
  minVoltage: 52,
  maxVoltage: 64.4,
  errorLogs: [],
  rawHexLogs: [],
  autoPollEnabled: true,
  pollingIntervalMs: 2000
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
  const smootherRef = useRef(new VoltageSmoother(5));

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
      rawHexLogs: [logItem, ...prev.rawHexLogs.slice(0, 99)] // Keep last 100 logs
    }));
  }, []);

  // --- RAW PACKET PARSER FOR CHINESE BMS (DALY & JBD) ---
  const parseRawPacket = useCallback((dataView: DataView) => {
    if (dataView.byteLength === 0) return;

    const rawHex = dataViewToHexString(dataView);
    const firstByte = dataView.getUint8(0);

    // 1. DALY BMS PACKET (Starts with 0xA5)
    if (firstByte === 0xA5 && dataView.byteLength >= 13) {
      const command = dataView.getUint8(2); // e.g. 0x90, 0x91, 0x92, 0x95
      
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

          return {
            ...prev,
            voltage: smoothedV,
            current: rawCurr,
            capacityPercent: rawSoc,
            remainingCapacityAH: capacityAH,
            power,
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
        const temp = dataView.getUint8(4) - 40; // Offset 40
        addHexLog('RX', rawHex, `Daly 0x92 -> Temp: ${temp}°C`);
        setBmsData(prev => ({ ...prev, temperature: temp }));
      } else if (command === 0x95) { // Cell Voltages Frame
        const frameNo = dataView.getUint8(4);
        addHexLog('RX', rawHex, `Daly 0x95 -> Cell Voltages Frame ${frameNo}`);
      } else {
        addHexLog('RX', rawHex, `Daly Response (Cmd 0x${command.toString(16)})`);
      }
      return;
    }

    // 2. JBD / XIAOXIANG PACKET (Starts with 0xDD)
    if (firstByte === 0xDD && dataView.byteLength >= 7) {
      const command = dataView.getUint8(1);
      const status = dataView.getUint8(2);

      if (command === 0x03 && status === 0x00) { // Basic Info
        const rawVolts = ((dataView.getUint8(4) << 8) | dataView.getUint8(5)) / 100;
        // Current is signed 16-bit
        const currentInt = (dataView.getUint8(6) << 8) | dataView.getUint8(7);
        const rawCurr = (currentInt > 32767 ? currentInt - 65536 : currentInt) / 100;
        const remainingAH = ((dataView.getUint8(8) << 8) | dataView.getUint8(9)) / 100;
        const nominalAH = ((dataView.getUint8(10) << 8) | dataView.getUint8(11)) / 100;
        const cycles = (dataView.getUint8(12) << 8) | dataView.getUint8(13);
        
        const calculatedSoc = nominalAH > 0 ? (remainingAH / nominalAH) * 100 : 0;

        addHexLog('RX', rawHex, `JBD Basic Info -> Pack Volts: ${rawVolts}V, Curr: ${rawCurr}A, Rem: ${remainingAH}Ah (${calculatedSoc.toFixed(1)}%), Cycles: ${cycles}`);

        setBmsData(prev => {
          const smoothedV = Number(smootherRef.current.getSmoothedVoltage(rawVolts).toFixed(2));
          const estRange = (calculatedSoc / 100) * prev.maxRangeKM;

          return {
            ...prev,
            voltage: smoothedV,
            current: rawCurr,
            capacityPercent: Number(calculatedSoc.toFixed(1)),
            remainingCapacityAH: remainingAH,
            nominalCapacityAH: nominalAH > 0 ? nominalAH : prev.nominalCapacityAH,
            cycleCount: cycles,
            estimatedRangeKM: Number(estRange.toFixed(1)),
            detectedProtocol: 'JBD/Xiaoxiang'
          };
        });
      } else if (command === 0x04 && status === 0x00) { // Cell Voltages
        const dataLength = dataView.getUint8(3);
        const cellCount = Math.floor(dataLength / 2);
        const newCells: CellData[] = [];

        for (let i = 0; i < cellCount; i++) {
          const cellV = ((dataView.getUint8(4 + i * 2) << 8) | dataView.getUint8(5 + i * 2)) / 1000;
          newCells.push({
            id: i + 1,
            voltage: cellV,
            isBalancing: false,
            healthStatus: cellV < 3.0 || cellV > 4.25 ? 'Warning' : 'Good'
          });
        }

        addHexLog('RX', rawHex, `JBD Cell Voltages -> ${cellCount} cells parsed (${newCells.map(c => c.voltage.toFixed(2)).join(', ')})`);
        
        setBmsData(prev => ({ ...prev, cells: newCells }));
      } else {
        addHexLog('RX', rawHex, `JBD Frame Cmd 0x${command.toString(16)}`);
      }
      return;
    }

    // 3. STANDARD BATTERY SERVICE PACKET (1 byte uint8 %)
    if (dataView.byteLength === 1) {
      const socLevel = dataView.getUint8(0);
      addHexLog('RX', rawHex, `Standard Battery Service -> ${socLevel}%`);
      setBmsData(prev => {
        const simulatedV = prev.minVoltage + ((socLevel / 100) * (prev.maxVoltage - prev.minVoltage));
        return {
          ...prev,
          capacityPercent: socLevel,
          voltage: Number(simulatedV.toFixed(2)),
          detectedProtocol: 'Standard Battery'
        };
      });
      return;
    }

    // Unrecognized UART packet
    addHexLog('RX', rawHex, 'Custom UART Stream Packet');
  }, [addHexLog]);

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

  // --- AUTO POLLING POLLING LOOP ---
  const triggerPollCycle = useCallback(() => {
    if (!writeCharRef.current) return;

    // Send Daly query or JBD query based on detected protocol or fallback
    if (bmsData.detectedProtocol === 'Daly' || !bmsData.detectedProtocol) {
      sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_MIN_MAX_CELL.bytes);
      }, 300);
    } else if (bmsData.detectedProtocol === 'JBD/Xiaoxiang') {
      sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
      setTimeout(() => {
        sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_CELL_VOLTAGES.bytes);
      }, 300);
    }
  }, [bmsData.detectedProtocol, sendHexCommand]);

  useEffect(() => {
    if (isConnected && bmsData.autoPollEnabled && writeCharRef.current) {
      pollingTimerRef.current = setInterval(() => {
        triggerPollCycle();
      }, bmsData.pollingIntervalMs);
    } else {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    }

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isConnected, bmsData.autoPollEnabled, bmsData.pollingIntervalMs, triggerPollCycle]);

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

      // 1. Request Bluetooth Device with all Chinese BMS UART services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_OPTIONAL_SERVICES
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'BMS BLE Device');
      addHexLog('SYS', 'PAIRING', `Selected Device: ${device.name || 'Unnamed BMS'} [${device.id}]`);

      // Event listener for disconnect
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
      addHexLog('SYS', 'DISCOVERING', 'Discovering primary services...');
      const services = await server.getPrimaryServices();
      addHexLog('SYS', 'SERVICES', `Found ${services.length} services.`);

      let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
      let matchedServiceUUID = '';

      // Inspect discovered services to locate UART notify & write characteristics
      for (const service of services) {
        const uuid = service.uuid.toLowerCase();
        addHexLog('SYS', 'SERVICE', `Inspecting Service: ${uuid}`);

        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const charUuid = char.uuid.toLowerCase();
            const props = char.properties;
            
            addHexLog('SYS', 'CHAR', `Char: ${charUuid.substring(0, 8)}... (Notify: ${props.notify}, Indicate: ${props.indicate}, Write: ${props.write}, WriteNoResp: ${props.writeWithoutResponse})`);

            if ((props.notify || props.indicate) && !notifyChar) {
              notifyChar = char;
              matchedServiceUUID = service.uuid;
            }

            if ((props.write || props.writeWithoutResponse) && !writeChar) {
              writeChar = char;
            }
          }
        } catch (e) {
          console.warn(`Could not fetch characteristics for service ${uuid}:`, e);
        }
      }

      if (!notifyChar) {
        throw new Error('No characteristic with NOTIFY or INDICATE properties found on device.');
      }

      // Save references
      notifyCharRef.current = notifyChar;
      writeCharRef.current = writeChar;

      addHexLog('SYS', 'CONFIGURED', `Notify Char: ${notifyChar.uuid}, Write Char: ${writeChar ? writeChar.uuid : 'None'}`);

      // 4. Properly call and await startNotifications()
      addHexLog('SYS', 'START_NOTIFY', `Subscribing to notifications on ${notifyChar.uuid.substring(0, 8)}...`);
      await notifyChar.startNotifications();
      addHexLog('SYS', 'NOTIFICATIONS_ACTIVE', 'Successfully enabled BLE notifications!');

      // 5. Attach event listener for incoming data packets
      notifyChar.addEventListener('characteristicvaluechanged', (event: Event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        if (char && char.value) {
          parseRawPacket(char.value);
        }
      });

      setBmsData(prev => ({
        ...prev,
        serviceUUID: matchedServiceUUID,
        notifyCharUUID: notifyChar?.uuid,
        writeCharUUID: writeChar?.uuid
      }));

      // 6. Send initial Wake-Up / Ping payload to kickstart data transmission
      if (writeChar) {
        addHexLog('SYS', 'PINGING', 'Sending initial wakeup/read command to BMS...');
        // Try Daly poll first
        sendHexCommand(BMS_PRESET_COMMANDS.DALY_READ_SOC_VOLTS.bytes);
        setTimeout(() => {
          sendHexCommand(BMS_PRESET_COMMANDS.JBD_READ_BASIC_INFO.bytes);
        }, 500);
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
    
    // Create mock DataView for Daly SOC packet (A5 01 90 ...) or JBD Basic Info (DD 03 ...)
    let mockBytes: number[];
    if (presetKey.startsWith('DALY')) {
      mockBytes = [0xA5, 0x01, 0x90, 0x08, 0x02, 0x48, 0x00, 0x00, 0x75, 0x30, 0x03, 0x20, 0x00, 0x00]; // 58.4V, 0A, 80%
    } else {
      mockBytes = [0xDD, 0x03, 0x00, 0x1B, 0x16, 0xD4, 0x00, 0x00, 0x09, 0xC4, 0x0B, 0xB8, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x10, 0x03, 0x02, 0x0B, 0xA0, 0x0B, 0xA2, 0x00, 0x00];
    }

    const buffer = new Uint8Array(mockBytes).buffer;
    const dataView = new DataView(buffer);
    parseRawPacket(dataView);
  }, [addHexLog, parseRawPacket]);

  const disconnect = useCallback(() => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    if (gattServerRef.current?.connected) {
      gattServerRef.current.disconnect();
    }
    writeCharRef.current = null;
    notifyCharRef.current = null;
    deviceRef.current = null;
    gattServerRef.current = null;

    setIsConnected(false);
    setDeviceName(null);
    addHexLog('SYS', 'DISCONNECTED', 'Session closed cleanly.');
  }, [addHexLog]);

  const toggleAutoPoll = useCallback(() => {
    setBmsData(prev => ({ ...prev, autoPollEnabled: !prev.autoPollEnabled }));
  }, []);

  const clearHexLogs = useCallback(() => {
    setBmsData(prev => ({ ...prev, rawHexLogs: [] }));
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
