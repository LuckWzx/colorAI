/**
 * 用户认证 Store
 * - 管理登录状态、用户信息、token
 * - 使用 localStorage 持久化（前端 Mock 方案）
 * - 后端 auth API 待实现，当前为本地 Mock
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sanitizeText, isValidPhone, maskPhone } from '@/lib/security';

export interface User {
  id: string;
  username: string;
  phone: string;
  avatar?: string;
  createdAt: number;
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
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, 'username' | 'avatar'>>) => void;
}

/** 简单密码哈希（演示用，生产环境请用 bcrypt 等服务端方案） */
function hashPassword(pwd: string): string {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    h = (h << 5) - h + pwd.charCodeAt(i);
    h |= 0;
  }
  return `h_${Math.abs(h).toString(36)}`;
}

/** 本地用户库 key（模拟后端数据库） */
const USER_DB_KEY = 'colorai_user_db';

interface StoredUser extends User {
  passwordHash: string;
}

function loadUserDB(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USER_DB_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveUserDB(users: StoredUser[]): void {
  localStorage.setItem(USER_DB_KEY, JSON.stringify(users));
}

function genToken(userId: string): string {
  return `tk_${userId}_${Date.now().toString(36)}`;
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
        // 模拟网络请求延迟
        await new Promise((r) => setTimeout(r, 400));

        const users = loadUserDB();
        const found = users.find((u) => u.phone === p);
        if (!found) {
          return { success: false, message: '该手机号尚未注册' };
        }
        if (found.passwordHash !== hashPassword(password)) {
          return { success: false, message: '密码错误' };
        }

        const { passwordHash, ...safeUser } = found;
        void passwordHash;
        const token = genToken(found.id);
        set({ user: safeUser, token, isAuthenticated: true });
        return { success: true };
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

        await new Promise((r) => setTimeout(r, 400));

        const users = loadUserDB();
        if (users.some((u) => u.phone === p)) {
          return { success: false, message: '该手机号已注册' };
        }

        const newUser: StoredUser = {
          id: `u_${Date.now().toString(36)}`,
          username: name,
          phone: p,
          createdAt: Date.now(),
          passwordHash: hashPassword(password),
        };
        users.push(newUser);
        saveUserDB(users);

        const { passwordHash, ...safeUser } = newUser;
        void passwordHash;
        const token = genToken(newUser.id);
        set({ user: safeUser, token, isAuthenticated: true });
        return { success: true };
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateProfile: (patch) => {
        set((state) => {
          if (!state.user) return state;
          const nextUser = { ...state.user, ...patch };
          // 同步到本地用户库
          const users = loadUserDB();
          const idx = users.findIndex((u) => u.id === state.user!.id);
          if (idx >= 0) {
            users[idx] = { ...users[idx], ...patch };
            saveUserDB(users);
          }
          return { user: nextUser };
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
