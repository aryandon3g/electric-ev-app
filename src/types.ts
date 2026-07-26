export interface CellData {
  id: number;
  voltage: number;
  isBalancing: boolean;
  healthStatus?: 'Good' | 'Warning' | 'Critical';
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
  errorLogs: { timestamp: string; code: string; message: string }[];
}
