import { create } from 'zustand';

interface Sensor {
  id: number;
  position: [number, number, number];
  name: string;
  csvFile?: File;
  currentData?: {
    temperature: number;
    humidity: number;
    absoluteHumidity: number;
    dewPoint: number;
    timestamp: number;
  };
}

type MetricType = 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  token: string | null;
  machineId: string | null;
  
  // Mode
  mode: 'live' | 'replay';
  
  // 3D Model
  gltfModel: string | null;
  
  // Sensors
  sensors: Sensor[];
  
  // Replay
  isPlaying: boolean;
  currentTimestamp: number;
  timeRange: [number, number] | null;
  
  // Data Analysis
  dataReady: boolean;
  selectedMetric: MetricType;
  
  // WebSocket
  wsConnected: boolean;
  
  // Actions
  setAuth: (token: string, machineId: string) => void;
  logout: () => void;
  setMode: (mode: 'live' | 'replay') => void;
  setGltfModel: (model: string) => void;
  setSensors: (sensors: Sensor[]) => void;
  updateSensorData: (sensorId: number, data: any) => void;
  setSensorCsv: (sensorId: number, file: File) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTimestamp: (timestamp: number | ((prev: number) => number)) => void;
  setTimeRange: (range: [number, number]) => void;
  setDataReady: (ready: boolean) => void;
  setSelectedMetric: (metric: MetricType) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  token: null,
  machineId: null,
  mode: 'replay',
  gltfModel: null,
  sensors: [],
  isPlaying: false,
  currentTimestamp: 0,
  timeRange: null,
  dataReady: false,
  selectedMetric: 'temperature',
  wsConnected: false,
  
  setAuth: (token, machineId) => set({ isAuthenticated: true, token, machineId }),
  logout: () => set({ isAuthenticated: false, token: null, machineId: null }),
  setMode: (mode) => set({ mode }),
  setGltfModel: (model) => set({ gltfModel: model }),
  setSensors: (sensors) => set({ sensors }),
  updateSensorData: (sensorId, data) => set((state) => ({
    sensors: state.sensors.map(s => 
      s.id === sensorId ? { ...s, currentData: data } : s
    )
  })),
  setSensorCsv: (sensorId, file) => set((state) => ({
    sensors: state.sensors.map(s => 
      s.id === sensorId ? { ...s, csvFile: file } : s
    )
  })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTimestamp: (timestamp) => set((state) => ({
    currentTimestamp: typeof timestamp === 'function' ? timestamp(state.currentTimestamp) : timestamp
  })),
  setTimeRange: (range) => set({ timeRange: range }),
  setDataReady: (ready) => set({ dataReady: ready }),
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));