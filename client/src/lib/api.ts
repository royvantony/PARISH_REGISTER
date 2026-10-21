import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token and active parish context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('parish_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeParishId = localStorage.getItem('parish_active_id');
    if (activeParishId) {
      config.headers['x-parish-id'] = activeParishId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthenticated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if we are already on /login or checking /api/auth/login
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest && window.location.pathname !== '/login') {
        localStorage.removeItem('parish_token');
        localStorage.removeItem('parish_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
