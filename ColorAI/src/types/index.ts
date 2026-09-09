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
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'cmyk' | 'lab' | 'hsv';
export type ColorSpace = ColorFormat;

export type CorrectionMode = 'auto' | 'nature' | 'portrait' | 'product' | 'landscape';

export interface CorrectResponse {
  success: boolean;
  originalUrl: string;
  correctedUrl: string;
  meta: {
    brightnessDiff: number;
    contrastDiff: number;
    saturationDiff: number;
    whiteBalanceShift: 'warm' | 'cool' | 'neutral';
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
  similarity: {
    deltaE: number;
    percent: number;
    level: '极高' | '高' | '中' | '低' | '极低';
  };
  dominantColorsA: string[];
  dominantColorsB: string[];
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

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  category?: string;
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
  logo?: string;
  category: string[];
  desc: string;
  website?: string;
  rating: number;
  initial?: string;
  description?: string;
}

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';
