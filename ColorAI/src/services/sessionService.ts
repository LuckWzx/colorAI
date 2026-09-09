/**
 * 智能体聊天「会话历史」服务层
 *
 * 约定后端 REST 接口（字段与 ChatSessionDTO 对齐）：
 *   GET    /api/sessions         → 会话元数据列表（按 updatedAt 倒序，不含 messages/history）
 *   GET    /api/sessions/:id     → 会话详情（含 messages / history）
 *   PUT    /api/sessions/:id     → 全量保存（新建时 id 由前端预生成，服务端 upsert 并保留 createdAt）
 *   DELETE /api/sessions/:id     → 删除会话
 *
 * 时间戳统一为 epoch 毫秒（number）；未知消息结构以 unknown 透传，由业务层收窄类型。
 */

/** 会话 DTO：列表接口省略 messages/history，详情接口补齐 */
export interface ChatSessionDTO {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  messages?: unknown[];
  history?: unknown[];
}

/** 保存入参：业务层只提供内容字段，时间戳与计数由存储层维护 */
export interface SaveSessionInput {
  id: string;
  title: string;
  messages?: unknown[];
  history?: unknown[];
}

export interface ChatSessionService {
  /** 会话元数据列表（按最近更新倒序） */
  list(): Promise<ChatSessionDTO[]>;
  /** 单个会话详情（含 messages/history），不存在返回 null */
  get(id: string): Promise<ChatSessionDTO | null>;
  /** 全量保存（upsert：同 id 覆盖，保留原 createdAt），返回落库后的完整 DTO */
  save(input: SaveSessionInput): Promise<ChatSessionDTO>;
  /** 删除会话 */
  remove(id: string): Promise<void>;
}

/** 从 Zustand persist store 读取 auth token */
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('colorai_auth');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** 会话服务：直接调用后端 REST API（需登录） */
export const sessionService: ChatSessionService = {
  async list() {
    const res = await fetch('/api/sessions', { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.items)) {
      throw new Error('Invalid response from sessions API');
    }
    return data.items.sort(
      (a: ChatSessionDTO, b: ChatSessionDTO) => b.updatedAt - a.updatedAt
    );
  },

  async get(id) {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
    const data = await res.json();
    if (!data?.success || !data.session) return null;
    return data.session as ChatSessionDTO;
  },

  async save(input) {
    const res = await fetch(`/api/sessions/${encodeURIComponent(input.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title: input.title,
        messages: input.messages,
        history: input.history,
      }),
    });
    if (!res.ok) throw new Error(`Failed to save session: ${res.status}`);
    const data = await res.json();
    if (!data?.success || !data.session) {
      throw new Error('Invalid response from save session API');
    }
    return data.session as ChatSessionDTO;
  },

  async remove(id) {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
  },
};
