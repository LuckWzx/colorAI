/**
 * Workspace 工具函数
 * 会话标题推断、消息过滤、ID 管理等纯函数
 */

import { uid } from '@/lib/uid';
import { FEATURES } from '@/constants/workspace';
import type { Message, UserMessage, AssistantMessage } from '@/types';
import type { ChatSessionDTO } from '@/services/sessionService';

/** 欢迎消息工厂（新会话 / 返回首屏 / 初始加载共用） */
export const welcomeMsg = (): AssistantMessage => ({
  id: uid(),
  role: 'assistant',
  type: 'welcome',
  createdAt: Date.now(),
});

/** 从消息流推断会话标题：首条用户文字 → 工具名 → 兜底 */
export function titleOf(ms: Message[]): string {
  const textMsg = ms.find((m) => m.role === 'user' && m.text?.trim());
  if (textMsg?.text?.trim()) return textMsg.text.trim().slice(0, 26);
  const featMsg = ms.find((m): m is UserMessage => m.role === 'user' && !!m.feature);
  if (featMsg?.feature) return FEATURES.find((f) => f.key === featMsg.feature)?.title ?? '图片处理';
  return '新对话';
}

/** 列表 state 只保留元数据（不含 messages/history 大对象） */
export function toSessionMeta(s: ChatSessionDTO): ChatSessionDTO {
  return {
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messageCount,
  };
}

/** 落库前剔除欢迎卡：欢迎卡只属于「空会话首屏」，不写入历史，避免回放旧会话时欢迎卡重复出现 */
export function stripWelcome(ms: Message[]): unknown[] {
  return ms.filter((m) => !(m.role === 'assistant' && m.type === 'welcome')) as unknown[];
}

/**
 * 将 dataURL 转换为 File 对象
 * 用于跨步骤复用校色后的图片（dataURL → File，再走取色流程）
 */
export function dataUrlToFile(dataUrl: string, filename = 'corrected.jpg'): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
  return new File([new Blob([u8], { type: mime })], filename, { type: mime });
}
