/**
 * DeepSeek AI 服务模块
 * - 封装与 DeepSeek API 的对话调用
 * - 支持色彩智能体的 System Prompt
 *
 * 安全说明：
 *   API Key 仅在服务端使用，客户端不存储任何密钥。
 *   客户端通过 /api/deepseek/chat 后端代理转发。
 */

import { authFetch } from '@/lib/authFetch';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const COLOR_SYSTEM_PROMPT = `你是曲泉AI，一个专业的色彩智能体。你的专长是：
1. AI 一键校色：帮助用户校正图片的白平衡、色彩还原
2. 智能取色：从图片中提取主色调，支持 HEX/RGB/HSL/CMYK/Lab 等格式
3. 色彩空间转换：在不同色彩空间之间精准转换
4. 颜色对比：量化两个颜色的相似度（ΔE）
5. 手机拍摄校色：还原手机照片的人眼视觉真实色彩

请用专业、简洁、友好的语气回答用户关于色彩的问题。
当用户询问色彩理论、校色技巧、设备选择、行业应用等问题时，给出准确、实用的建议。
回答时适当使用色彩相关的专业术语，但要解释清楚。`;

/**
 * 通过后端代理调用 DeepSeek API
 * （API Key 仅存在于服务端环境变量中，不会暴露给前端）
 */
async function callViaProxy(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await authFetch('/api/deepseek/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        { role: 'system', content: COLOR_SYSTEM_PROMPT },
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `DeepSeek API 请求失败 (${res.status})`);
  }

  const data = await res.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('DeepSeek API 返回为空');
  }

  return {
    text: data.choices[0].message.content,
    model: data.model || 'deepseek-v4-flash',
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
 * DeepSeek 对话服务
 */
export const deepseekService = {
  /**
   * 发送对话请求（通过后端代理调用 DeepSeek API）
   */
  async chat(userMessage: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];
    return callViaProxy(messages);
  },
};
