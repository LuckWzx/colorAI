/**
 * 智能体聊天「会话历史」服务层 —— 前后端接口契约
 *
 * 后端接口未就绪前，本文件用 localStorage 提供同签名实现；
 * 后端完成后，只需将下方 localSessionStore 替换为 fetch 实现（页面层无需改动）。
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

/** —— 本地（localStorage）实现：后端就绪前暂存 —— */
const SESSIONS_KEY = 'ququan.workspace.sessions.v1';

function loadRaw(): ChatSessionDTO[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSessionDTO[]) : [];
  } catch {
    return [];
  }
}

function persistRaw(list: ChatSessionDTO[]): boolean {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('会话保存失败（可能超出本地存储配额）：', e);
    return false;
  }
}

const localSessionStore: ChatSessionService = {
  async list() {
    return loadRaw()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messageCount,
      }));
  },
  async get(id) {
    const found = loadRaw().find((s) => s.id === id);
    return found ?? null;
  },
  async save(input) {
    const list = loadRaw();
    const existed = list.find((s) => s.id === input.id);
    const stored: ChatSessionDTO = {
      id: input.id,
      title: input.title.trim() || '新对话',
      createdAt: existed?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      messageCount: input.messages?.length ?? existed?.messageCount ?? 0,
      messages: input.messages,
      history: input.history,
    };
    const next = [stored, ...list.filter((s) => s.id !== input.id)].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    persistRaw(next);
    return stored;
  },
  async remove(id) {
    const next = loadRaw().filter((s) => s.id !== id);
    persistRaw(next);
  },
};

/** 导出服务实例：接入后端时替换此实现（例如改为 httpSessionStore） */
export const sessionService: ChatSessionService = localSessionStore;
