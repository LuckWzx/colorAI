/**
 * Workspace 工具函数
 * 图片读取、欢迎消息工厂等纯函数
 */

import { uid } from '@/lib/uid';
import type { AssistantMessage } from '@/types';

/** 欢迎消息工厂（新会话 / 返回首屏 / 初始加载共用） */
export const welcomeMsg = (): AssistantMessage => ({
  id: uid(),
  role: 'assistant',
  type: 'welcome',
  createdAt: Date.now(),
});

/**
 * 将 File 读取为 dataURL
 * 用于把用户选择的图片交给后端处理（真正的图像计算在后端完成）
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
