/**
 * 全局鉴权 Fetch 封装
 *
 * 自动从 Zustand persist store 读取 Bearer token 并附加到请求头，
 * 所有需要登录的 fetch 调用统一使用 authFetch 替代原生 fetch。
 *
 * 用法与原生 fetch 完全一致：
 *   const res = await authFetch('/api/sessions');
 *   const res = await authFetch('/api/sessions/123', { method: 'DELETE' });
 */

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('colorai_auth');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, { ...init, headers });
}
