/**
 * AI 对话服务模块
 * - 封装与 LLM API 的对话调用
 * - 系统提示词由后端管理，前端无需携带
 *
 * 安全说明：
 *   API Key 仅在服务端使用，客户端不存储任何密钥。
 *   客户端通过 /api/chat 后端代理转发。
 *
 * 当前实现：DeepSeek API（后续可切换为其他 LLM 服务）
 */

import { authFetch } from '@/lib/authFetch';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  feature?: 'correct' | 'pick' | 'compare' | 'convert' | 'phone' | null;
  images?: string[] | null;
}

export interface ChatResponse {
  success: boolean;
  message: {
    id: string;
    role: 'assistant';
    type: 'text' | 'correct' | 'pick' | 'compare' | 'convert' | 'phone';
    content: string;
    metadata: unknown;
    createdAt: number;
  } | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  error?: string;
}

/**
 * 通过后端代理调用 LLM API
 * （API Key 仅存在于服务端环境变量中，不会暴露给前端）
 */
async function callViaProxy(messages: ChatMessage[], sessionId?: string, messageId?: string): Promise<ChatResponse> {
  const res = await authFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: sessionId || '',
      messageId: messageId || '',
      messages: messages,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `AI 服务请求失败 (${res.status})`);
  }

  const data = await res.json();
  if (!data?.success || !data?.message) {
    throw new Error(data?.error || 'AI 服务返回为空');
  }

  return data as ChatResponse;
}

/**
 * AI 对话服务
 */
export const chatService = {
  /**
   * 发送对话请求（通过后端代理调用 LLM API）
   * @param userMessage 用户消息内容
   * @param history 历史对话记录
   * @param sessionId 会话ID（可选）
   * @param messageId 消息ID（前端生成）
   * @param feature 快捷工具标识（可选）
   * @param images 图片数据数组（可选）
   */
  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    sessionId?: string,
    messageId?: string,
    feature?: ChatMessage['feature'],
    images?: string[]
  ): Promise<ChatResponse> {
    const messages: ChatMessage[] = [...history, {
      role: 'user',
      content: userMessage,
      feature: feature || null,
      images: images || null,
    }];
    return callViaProxy(messages, sessionId, messageId);
  },
};
