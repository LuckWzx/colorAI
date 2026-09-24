/**
 * 用户认证 Store
 * - 管理登录状态、用户信息、token
 * - 调用后端 /api/auth/* 接口
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import apiClient from '@/services/api';
import { sanitizeText, isValidPhone, maskPhone } from '@/lib/security';

export interface User {
  id: string;
  username: string;
  phone: string;
  avatar?: string;
  /** RFC3339 时间字符串（后端 time.Time 序列化结果），如 "2026-09-14T12:00:00Z" */
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (
    username: string,
    phone: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  /** 仅清空本地登录态，不发后端请求（token 已失效时用） */
  clearAuth: () => void;
  updateProfile: (patch: Partial<Pick<User, 'username' | 'avatar'>>) => void;
}

interface AuthAPIResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (phone, password) => {
        const p = sanitizeText(phone).trim();
        if (!isValidPhone(p)) {
          return { success: false, message: '请输入正确的手机号' };
        }
        if (!password || password.length < 6) {
          return { success: false, message: '密码至少 6 位' };
        }

        try {
          const { data } = await apiClient.post<AuthAPIResponse>('/auth/login', {
            phone: p,
            password,
          });
          if (!data.success) {
            return { success: false, message: data.error || '登录失败' };
          }
          if (data.user && data.token) {
            set({ user: data.user, token: data.token, isAuthenticated: true });
          }
          return { success: true };
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : '网络错误，请稍后重试';
          return { success: false, message: msg };
        }
      },

      register: async (username, phone, password) => {
        const name = sanitizeText(username).trim();
        const p = sanitizeText(phone).trim();
        if (!name || name.length < 2) {
          return { success: false, message: '昵称至少 2 个字符' };
        }
        if (!isValidPhone(p)) {
          return { success: false, message: '请输入正确的手机号' };
        }
        if (!password || password.length < 6) {
          return { success: false, message: '密码至少 6 位' };
        }

        try {
          const { data } = await apiClient.post<AuthAPIResponse>('/auth/register', {
            username: name,
            phone: p,
            password,
          });
          if (!data.success) {
            return { success: false, message: data.error || '注册失败' };
          }
          if (data.user && data.token) {
            set({ user: data.user, token: data.token, isAuthenticated: true });
          }
          return { success: true };
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : '网络错误，请稍后重试';
          return { success: false, message: msg };
        }
      },

      logout: async () => {
        try {
          const raw = localStorage.getItem('colorai_auth');
          if (raw) {
            const parsed = JSON.parse(raw);
            const token = parsed?.state?.token;
            if (token) {
              await apiClient.post('/auth/logout', null, {
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          }
        } catch { /* ignore */ }
        set({ user: null, token: null, isAuthenticated: false });
      },

      /** 清空本地登录态，不发后端请求。
       *  用于 authFetch 收到 401 时兜底 —— token 已经失效，再调 logout 也只会再失败一次。 */
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),

      updateProfile: (patch) => {
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...patch } };
        });
      },
    }),
    {
      name: 'colorai_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/** 获取脱敏后的手机号（用于展示） */
export function getMaskedPhone(user: User | null): string {
  return user ? maskPhone(user.phone) : '';
}

export default useAuthStore;
