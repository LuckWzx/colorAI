/**
 * 全局鉴权 Fetch 封装
 *
 * 自动从 Zustand authStore 读取 Bearer token 并附加到请求头，
 * 所有需要登录的 fetch 调用统一使用 authFetch 替代原生 fetch。
 *
 * 用法与原生 fetch 完全一致：
 *   const res = await authFetch('/api/sessions');
 *   const res = await authFetch('/api/sessions/123', { method: 'DELETE' });
 */

import { useAuthStore } from '@/store/authStore';

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, { ...init, headers });
}
