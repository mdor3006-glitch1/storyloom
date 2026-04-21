import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

function getApiUrl(): string {
  // In production builds, use the explicitly configured backend URL.
  if (!__DEV__) {
    return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  // In dev (Expo Go or dev build), derive the host from the Metro bundler address
  // so the app always reaches the backend regardless of which network we're on.
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.42:8081"
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 90000, // 90s — Claude + FLUX pipeline can take up to 60s
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT + log every outgoing request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().sessionToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log(`[API] ▶ ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
    hasToken: !!token,
    contentType: config.headers['Content-Type'],
  });
  return config;
});

// Log every response / error
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ✓ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`[API] ✗ ${error.response?.status ?? 'NO_RESPONSE'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      code: error.code,
      message: error.message,
      data: error.response?.data,
    });
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
