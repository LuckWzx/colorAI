/**
 * Workspace 常量定义
 * 工具卡片、知识库入口、工具坞配置
 */

import {
  Image as ImageIcon,
  Pipette,
  Palette,
  GitCompare,
  Smartphone,
  Camera,
  HelpCircle,
  MapPin,
  Package2,
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
}

export const FEATURES: FeatureItem[] = [
  {
    key: 'correct',
    title: '图片一键校正',
    desc: 'AI 智能白平衡还原真实色彩',
    icon: ImageIcon,
    gradient: 'from-[#FF6B35] to-[#F7C59F]',
    accent: '#FF6B35',
  },
  {
    key: 'pick',
    title: '智能取色器',
    desc: '点击图片获取多格式色值',
    icon: Pipette,
    gradient: 'from-[#4ECDC4] to-[#0E4D64]',
    accent: '#4ECDC4',
  },
  {
    key: 'convert',
    title: '色彩空间转换',
    desc: 'HEX RGB CMYK Lab 实时互转',
    icon: Palette,
    gradient: 'from-[#A855F7] to-[#EC4899]',
    accent: '#A855F7',
  },
  {
    key: 'compare',
    title: '颜色相似度对比',
    desc: 'ΔE 专业色差量化评分',
    icon: GitCompare,
    gradient: 'from-[#3B82F6] to-[#8B5CF6]',
    accent: '#3B82F6',
  },
  {
    key: 'phone',
    title: '手机拍摄校色',
    desc: '还原人眼视觉真实颜色',
    icon: Smartphone,
    gradient: 'from-[#10B981] to-[#059669]',
    accent: '#10B981',
  },
];

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
}));

// ——— 知识库入口 ———

export interface KnowledgeToolItem {
  key: string;
  path: string;
  title: string;
  desc: string;
  icon: typeof HelpCircle;
  color: string;
}

export const KNOWLEDGE_TOOLS: KnowledgeToolItem[] = [
  {
    key: 'issues',
    path: '/knowledge?tab=issues',
    title: '拍照偏色解答',
    desc: '偏色原因专业解答',
    icon: HelpCircle,
    color: '#6FAE55',
  },
  {
    key: 'tips',
    path: '/knowledge?tab=tips',
    title: '拍照真实技巧',
    desc: '用光构图实操技巧',
    icon: Camera,
    color: '#2FA8A0',
  },
  {
    key: 'shops',
    path: '/knowledge?tab=shops',
    title: '附近色胶商铺',
    desc: '冲印微喷店铺地图',
    icon: MapPin,
    color: '#6B5BCD',
  },
  {
    key: 'brands',
    path: '/knowledge?tab=brands',
    title: '工业胶品牌',
    desc: '胶卷相纸品牌图鉴',
    icon: Package2,
    color: '#8A5FD0',
  },
];

/** 全部工具（聊天 + 知识库，更多面板用） */
export const DOCK_ALL: DockItem[] = [
  ...DOCK_CHAT,
  ...KNOWLEDGE_TOOLS.map((t) => ({
    id: t.key,
    kind: 'page' as const,
    key: t.key,
    path: t.path,
    title: t.title,
    desc: t.desc,
    icon: t.icon,
    color: t.color,
  })),
];
