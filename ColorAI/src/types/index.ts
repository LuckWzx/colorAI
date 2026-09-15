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

/** 校色的一个候选结果（真实接口会返回多张，按 distance 升序） */
export interface CorrectionCandidate {
  /** 校正后图片 URL */
  correctedImage: string;
  /** 该候选与标准环境的距离，越小越接近 */
  distance: number;
  /** 校正所用的参考机型 / 场景 */
  modelName: string;
}

/**
 * 图片一键校色结果。
 *
 * 对齐校色接口的真实返回（见 go-backend/doc/Color_Correction.md）：
 * 接口不返回 brightness/contrast/saturation/whiteBalance 这类"调整量"，
 * 而是返回「拍摄环境是否达标 + 若干张候选校正图」。
 *
 * `passed=false` 是**正常的业务分支**（拍摄环境不达标），此时 `success` 仍为 true，
 * 错误文案在 `error` 里，前端应引导用户重拍，而不是当作请求失败。
 */
export interface CorrectionResult {
  success: boolean;
  /** false = 拍摄环境不达标，应引导重新拍摄 */
  passed: boolean;
  /** 原图 URL */
  originalImage: string;
  /** 候选校正图，可能多张；passed=true 时至少一张 */
  candidates: CorrectionCandidate[];
  /** 原图与标准环境的距离 */
  distance: number;
  /** 达标阈值，distance < threshold 即 passed */
  threshold: number;
  /** 检测到的品牌 */
  brand?: string;
  /** 设备描述 */
  deviceInfo?: string;
  /** 处理耗时（秒） */
  elapsedTime?: number;
  /** 仅 passed=false 时有值，直接展示给用户 */
  error?: string;
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
  correctedUrl: string;
  standardUrl: string;
  adjustment: {
    redShift: number;
    greenShift: number;
    blueShift: number;
    brightness: number;
    exposure: number;
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
  phoneResult?: PhoneCorrectResponse;
}

export type Message = UserMessage | AssistantMessage;
