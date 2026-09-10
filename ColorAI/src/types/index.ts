/* ============================================================
 * 全局共享类型定义
 * 所有跨模块复用的接口、类型统一在此声明
 * ============================================================ */

// ——— 色彩基础 ———

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'cmyk' | 'lab' | 'hsv';
export type ColorSpace = ColorFormat;

export interface FullColorValues {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
  lab: { l: number; a: number; b: number };
  hsv: { h: number; s: number; v: number };
  format: ColorFormat | 'unknown';
  originalInput: string;
}

export type ColorFormats = FullColorValues;
export type CorrectionMode = 'auto' | 'nature' | 'portrait' | 'product' | 'landscape';

// ——— API 响应 ———

export interface CorrectResponse {
  success: boolean;
  originalUrl: string;
  correctedUrl: string;
  meta: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
  };
}

export interface CorrectionResult {
  originalImage: string;
  correctedImage: string;
  metadata: {
    brightness: number;
    contrast: number;
    saturation: number;
    whiteBalance: 'warm' | 'cool' | 'neutral';
  };
}

export interface PickResponse {
  success: boolean;
  color: FullColorValues;
  colorName?: string;
}

export interface CompareResponse {
  success: boolean;
  similarity: number;
  deltaE: number;
  pass: boolean;
  details: {
    brightnessDiff: number;
    colorDiff: number;
    saturationDiff: number;
  };
}

export interface CompareResult {
  similarity: number;
  deltaE: number;
  imageA: {
    imageUrl: string;
    dominantColors: Array<{ hex: string; ratio: number }>;
  };
  imageB: {
    imageUrl: string;
    dominantColors: Array<{ hex: string; ratio: number }>;
  };
}

export interface PhoneCorrectResponse {
  success: boolean;
  originalUrl: string;
  visualCorrectedUrl: string;
  standardCorrectedUrl: string;
  adjustment: {
    redChannel: number;
    greenChannel: number;
    blueChannel: number;
    brightness: number;
    exposureCompensation: number;
  };
}

// ——— 知识库 ———

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  level?: number;
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  products: string[];
  rating: number;
}

export interface Brand {
  id: string;
  name: string;
  initial?: string;
  rating: number;
  category: string[];
  description?: string;
  website?: string;
}

// ——— 通用状态 ———

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

// ——— Workspace 消息类型 ———

/** 功能键：决定工具卡片和消息归属 */
export type FeatureKey = 'correct' | 'pick' | 'convert' | 'compare' | 'phone';

export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant';
  createdAt: number;
}

export interface UserMessage extends BaseMessage {
  role: 'user';
  text?: string;
  images?: string[];
  feature?: FeatureKey;
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  text?: string;
  type: 'welcome' | 'text' | 'correct' | 'pick' | 'compare' | 'convert' | 'phone' | 'loading';
  correctResult?: CorrectionResult;
  pickResult?: { color: FullColorValues; colorName: string };
  compareResult?: CompareResult;
  convertResult?: {
    input: string;
    detectedFormat: string;
    color: FullColorValues;
    colorName: string;
  };
  phoneResult?: unknown;
}

export type Message = UserMessage | AssistantMessage;
