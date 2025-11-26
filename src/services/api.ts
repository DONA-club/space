import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await api.post('/login', credentials);
    return response.data;
  },
};

export const modelAPI = {
  getGltf: async (machineId: string) => {
    const response = await api.get(`/gltf/${machineId}`);
    return response.data;
  },
};

export const dataAPI = {
  uploadCsvFiles: async (files: FormData) => {
    const response = await api.post('/csv', files, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  getInterpolation: async (timestamp: number) => {
    const response = await api.get(`/interpolation/${timestamp}`);
    return response.data;
  },
};

export const createWebSocket = (machineId: string, token: string) => {
  const wsUrl = API_URL.replace('http', 'ws');
  return new WebSocket(`${wsUrl}/live/${machineId}?token=${token}`);
};

export default api;