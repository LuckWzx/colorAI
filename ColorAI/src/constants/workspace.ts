/**
 * Workspace 常量定义
 * 工具卡片、工具坞配置
 */

import {
  Image as ImageIcon,
  Pipette,
  Palette,
  GitCompare,
  Smartphone,
} from 'lucide-react';
import type { FeatureKey } from '@/types';

// ——— 功能卡片 ———

export interface FeatureItem {
  key: FeatureKey;
  title: string;
  desc: string;
  icon: typeof ImageIcon;
  gradient: string;
  accent: string;
  /**
   * 后端是否已实现该能力。
   *
   * false 的功能**点了也没有结果**：Agent 侧没有对应工具（未注册），
   * 只会如实回复「功能还没上线」。置灰是为了不让用户走进死路 ——
   * 详见 go-backend/doc/图片校色Tool封装设计.md §8.2。
   *
   * 后端实现并注册工具后，把这里改成 true 即可（同时补 FEATURE_TOOL_MAPPING）。
   */
  available: boolean;
}

export const FEATURES: FeatureItem[] = [
  {
    key: 'correct',
    title: '图片一键校正',
    desc: 'AI 智能白平衡还原真实色彩',
    icon: ImageIcon,
    gradient: 'from-[#FF6B35] to-[#F7C59F]',
    accent: '#FF6B35',
    available: true,
  },
  {
    key: 'pick',
    title: '智能取色器',
    desc: '点击图片获取多格式色值',
    icon: Pipette,
    gradient: 'from-[#4ECDC4] to-[#0E4D64]',
    accent: '#4ECDC4',
    available: false,
  },
  {
    key: 'convert',
    title: '色彩空间转换',
    desc: 'HEX RGB CMYK Lab 实时互转',
    icon: Palette,
    gradient: 'from-[#A855F7] to-[#EC4899]',
    accent: '#A855F7',
    available: false,
  },
  {
    key: 'compare',
    title: '颜色相似度对比',
    desc: 'ΔE 专业色差量化评分',
    icon: GitCompare,
    gradient: 'from-[#3B82F6] to-[#8B5CF6]',
    accent: '#3B82F6',
    available: false,
  },
  {
    key: 'phone',
    title: '手机拍摄校色',
    desc: '还原人眼视觉真实颜色',
    icon: Smartphone,
    gradient: 'from-[#10B981] to-[#059669]',
    accent: '#10B981',
    available: false,
  },
];

/** 按 key 查功能是否已上线；key 不存在时按"不可用"处理（保守） */
export function isFeatureAvailable(key: string | null | undefined): boolean {
  if (!key) return false;
  return FEATURES.find((f) => f.key === key)?.available ?? false;
}

// ——— 工具坞 ———

export interface DockItem {
  id: string;
  kind: 'chat' | 'page';
  key: string;
  path?: string;
  title: string;
  desc: string;
  icon: typeof ImageIcon;
  color: string;
  available: boolean;
}

/** 聊天处理的 5 个核心工具（常驻工具坞） */
export const DOCK_CHAT: DockItem[] = FEATURES.map((f) => ({
  id: f.key,
  kind: 'chat' as const,
  key: f.key,
  title: f.title,
  desc: f.desc,
  icon: f.icon,
  color: f.accent,
  available: f.available,
}));

/** 全部工具（更多面板用） */
export const DOCK_ALL: DockItem[] = [...DOCK_CHAT];
