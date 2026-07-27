export interface CellData {
  id: number;
  voltage: number;
  isBalancing: boolean;
  healthStatus?: 'Good' | 'Warning' | 'Critical';
}

export interface BLEHexLog {
  id: string;
  timestamp: string;
  type: 'RX' | 'TX' | 'SYS';
  hex: string;
  decodedInfo?: string;
}

export interface BMSData {
  voltage: number;
  current: number;
  capacityPercent: number;
  temperature: number;
  status: 'Normal' | 'Charging' | 'Discharging' | 'Warning' | 'Error';
  power: number; // Watts
  remainingCapacityAH: number;
  nominalCapacityAH: number;
  cells: CellData[];
  cycleCount: number;
  
  // Advanced Features
  estimatedRangeKM: number;
  efficiencyWhPerKm: number;
  thermalState: 'Normal' | 'Throttled' | 'Critical';
  isLocked: boolean;
  alerts: string[];
  timeToFullChargeMinutes: number | null;
  chargeLimit: number;
  reserveBuffer: number;
  tripEnergyWh: number;
  maxRangeKM: number;
  minVoltage: number;
  maxVoltage: number;
  errorLogs: { timestamp: string; code: string; message: string }[];

  // BLE Specific & Raw Packet Debugging
  serviceUUID?: string;
  notifyCharUUID?: string;
  writeCharUUID?: string;
  detectedProtocol?: 'Daly' | 'JBD/Xiaoxiang' | 'Nordic UART' | 'Standard Battery' | 'Unknown';
  rawHexLogs: BLEHexLog[];
  autoPollEnabled: boolean;
  pollingIntervalMs: number;
}

