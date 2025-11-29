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

interface OutdoorData {
  temperature: number;
  humidity: number;
  absoluteHumidity: number;
  dewPoint: number;
  timestamp: number;
}

type MetricType = 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint';
type InterpolationMethod = 'idw' | 'rbf';
type RBFKernel = 'gaussian' | 'multiquadric' | 'inverse_multiquadric' | 'thin_plate_spline';
type VisualizationType = 'points' | 'vectors' | 'isosurface' | 'mesh';

interface Space {
  id: string;
  name: string;
  description: string | null;
  gltf_file_path: string | null;
  gltf_file_name: string | null;
  json_file_path: string | null;
  json_file_name: string | null;
  last_csv_date: string | null;
  created_at: string;
  updated_at: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  user: any | null;
  
  // Current Space
  currentSpace: Space | null;
  
  // Mode
  mode: 'live' | 'replay';
  
  // 3D Model
  gltfModel: string | null;
  roomVolume: string | null;
  
  // Sensors
  sensors: Sensor[];
  sensorOffset: { x: number; y: number; z: number };
  
  // Outdoor sensor
  outdoorData: OutdoorData | null;
  hasOutdoorData: boolean;
  
  // Replay
  isPlaying: boolean;
  currentTimestamp: number;
  timeRange: [number, number] | null;
  
  // Data Analysis
  dataReady: boolean;
  selectedMetric: MetricType;
  
  // Interpolation & Meshing
  meshingEnabled: boolean;
  interpolationMethod: InterpolationMethod;
  rbfKernel: RBFKernel;
  idwPower: number;
  meshResolution: number;
  visualizationType: VisualizationType;
  interpolationRange: { min: number; max: number } | null;
  
  // WebSocket
  wsConnected: boolean;
  
  // Actions
  setAuth: (user: any | null) => void;
  logout: () => void;
  setCurrentSpace: (space: Space | null) => void;
  setMode: (mode: 'live' | 'replay') => void;
  setGltfModel: (model: string | null) => void;
  setRoomVolume: (volume: string | null) => void;
  setSensors: (sensors: Sensor[]) => void;
  setSensorOffset: (offset: { x: number; y: number; z: number }) => void;
  updateSensorData: (sensorId: number, data: any) => void;
  setSensorCsv: (sensorId: number, file: File) => void;
  setOutdoorData: (data: OutdoorData | null) => void;
  setHasOutdoorData: (has: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTimestamp: (timestamp: number | ((prev: number) => number)) => void;
  setTimeRange: (range: [number, number]) => void;
  setDataReady: (ready: boolean) => void;
  setSelectedMetric: (metric: MetricType) => void;
  setMeshingEnabled: (enabled: boolean) => void;
  setInterpolationMethod: (method: InterpolationMethod) => void;
  setRbfKernel: (kernel: RBFKernel) => void;
  setIdwPower: (power: number) => void;
  setMeshResolution: (resolution: number) => void;
  setVisualizationType: (type: VisualizationType) => void;
  setInterpolationRange: (range: { min: number; max: number } | null) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  user: null,
  currentSpace: null,
  mode: 'replay',
  gltfModel: null,
  roomVolume: null,
  sensors: [],
  sensorOffset: { x: 0, y: 1.80, z: 2.60 },
  outdoorData: null,
  hasOutdoorData: false,
  isPlaying: false,
  currentTimestamp: 0,
  timeRange: null,
  dataReady: false,
  selectedMetric: 'temperature',
  meshingEnabled: false,
  interpolationMethod: 'idw',
  rbfKernel: 'multiquadric',
  idwPower: 2,
  meshResolution: 40,
  visualizationType: 'points',
  interpolationRange: null,
  wsConnected: false,
  
  setAuth: (user) => set({ 
    isAuthenticated: !!user, 
    user 
  }),
  logout: () => set({ 
    isAuthenticated: false, 
    user: null, 
    currentSpace: null,
    gltfModel: null,
    sensors: [],
    dataReady: false,
    outdoorData: null,
    hasOutdoorData: false
  }),
  setCurrentSpace: (space) => set({ currentSpace: space }),
  setMode: (mode) => set({ mode }),
  setGltfModel: (model) => set({ gltfModel: model }),
  setRoomVolume: (volume) => set({ roomVolume: volume }),
  setSensors: (sensors) => set({ sensors }),
  setSensorOffset: (offset) => set({ sensorOffset: offset }),
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
  setOutdoorData: (data) => set({ outdoorData: data }),
  setHasOutdoorData: (has) => set({ hasOutdoorData: has }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTimestamp: (timestamp) => set((state) => ({
    currentTimestamp: typeof timestamp === 'function' ? timestamp(state.currentTimestamp) : timestamp
  })),
  setTimeRange: (range) => set({ timeRange: range }),
  setDataReady: (ready) => set({ dataReady: ready }),
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  setMeshingEnabled: (enabled) => set({ meshingEnabled: enabled }),
  setInterpolationMethod: (method) => set({ interpolationMethod: method }),
  setRbfKernel: (kernel) => set({ rbfKernel: kernel }),
  setIdwPower: (power) => set({ idwPower: power }),
  setMeshResolution: (resolution) => set({ meshResolution: resolution }),
  setVisualizationType: (type) => set({ visualizationType: type }),
  setInterpolationRange: (range) => set({ interpolationRange: range }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));