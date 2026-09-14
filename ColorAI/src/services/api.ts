import axios from 'axios';

const isBrowser = typeof window !== 'undefined';

const apiClient = axios.create({
  baseURL: isBrowser ? '/api' : 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动携带 token
apiClient.interceptors.request.use((config) => {
  if (isBrowser) {
    const raw = localStorage.getItem('colorai_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch { /* ignore */ }
    }
  }
  return config;
});

// 响应拦截器：401 自动清除登录态并跳转登录页
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && isBrowser) {
      localStorage.removeItem('colorai_auth');
      // 避免在登录页本身循环跳转
      if (!location.pathname.includes('/login')) {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;
