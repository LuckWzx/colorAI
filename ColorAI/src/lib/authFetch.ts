/**
 * 全局鉴权 Fetch 封装
 *
 * 自动从 Zustand authStore 读取 Bearer token 并附加到请求头，
 * 所有需要登录的 fetch 调用统一使用 authFetch 替代原生 fetch。
 *
 * 用法与原生 fetch 完全一致：
 *   const res = await authFetch('/api/sessions');
 *   const res = await authFetch('/api/sessions/123', { method: 'DELETE' });
 *
 * ⚠️ 约定：authFetch **只用于需要登录的接口**（登录/注册走 apiClient）。
 *    因此 401 一定是「未登录 / token 失效」，可以安全地当作鉴权失败处理。
 *
 * 401 处理：
 *    后端 RequireAuth 在「没带 token」和「token 失效」两种情况下都返回 401。
 *    这里统一清掉本地登录态并抛 AuthRequiredError，让调用方能区分
 *    「没登录」和「服务出错」—— 否则用户只会看到一句误导性的「服务不可用」。
 */

import { useAuthStore } from '@/store/authStore';

/** 需要登录、但当前没有有效登录态时抛出（区别于网络/服务错误） */
export class AuthRequiredError extends Error {
  constructor(message = '请先登录后再使用该功能') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

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

  const res = await fetch(input, { ...init, headers });

  // 401 = 没带 token，或 token 已失效（Redis 里 7 天过期、或服务端主动踢下线）。
  // 清掉本地登录态，让界面回到「未登录」；抛特定错误让业务层弹登录引导。
  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    throw new AuthRequiredError();
  }

  return res;
}
