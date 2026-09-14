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
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  messageId?: string; // 后端返回的消息ID（用于SSE/WebSocket场景关联）
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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
      messageId: messageId || '', // 前端生成的消息ID
      messages: messages, // 系统提示词由后端自动注入，前端无需携带
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `AI 服务请求失败 (${res.status})`);
  }

  const data = await res.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('AI 服务返回为空');
  }

  return {
    text: data.choices[0].message.content,
    model: data.model || 'unknown',
    messageId: data.messageId, // 后端返回的消息ID
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
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
   * @param messageId 消息ID（前端生成，用于SSE/WebSocket场景关联）
   */
  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    sessionId?: string,
    messageId?: string
  ): Promise<ChatResponse> {
    const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];
    return callViaProxy(messages, sessionId, messageId);
  },
};
