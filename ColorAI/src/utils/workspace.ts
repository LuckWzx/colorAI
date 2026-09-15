/**
 * Workspace 工具函数
 * 图片读取、欢迎消息工厂等纯函数
 */

import { uid } from '@/lib/uid';
import type {
  AssistantMessage,
  CorrectionResult,
  CompareResult,
  PhoneCorrectResponse,
} from '@/types';

/** 结果卡片字段：由后端返回的 metadata 提取（契约见 API.md「消息类型说明」） */
export type ResultFields = Pick<
  AssistantMessage,
  'correctResult' | 'pickResult' | 'compareResult' | 'convertResult' | 'phoneResult'
>;

/**
 * 把后端返回的 `{ type, metadata }` 展开成前端渲染卡片用的字段。
 *
 * **两条路径都要用**：
 *   1. 实时对话 —— Workspace 收到 /api/chat 响应后
 *   2. 恢复历史会话 —— useSession.switchSession 从 DB 读回消息后
 *
 * 只做其中一处会导致「刚发完能渲染、刷新后卡片变纯文本」。
 */
export function buildResultFields(
  type: AssistantMessage['type'],
  metadata: unknown,
): ResultFields {
  if (!metadata || typeof metadata !== 'object') return {};
  switch (type) {
    case 'correct':
      return { correctResult: metadata as CorrectionResult };
    case 'pick':
      return { pickResult: metadata as NonNullable<AssistantMessage['pickResult']> };
    case 'compare':
      return { compareResult: metadata as CompareResult };
    case 'convert':
      return { convertResult: metadata as NonNullable<AssistantMessage['convertResult']> };
    case 'phone':
      return { phoneResult: metadata as PhoneCorrectResponse };
    default:
      return {};
  }
}

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
