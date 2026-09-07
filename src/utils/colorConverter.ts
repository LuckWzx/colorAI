import type { ColorFormats, ColorSpace, ColorFormat, FullColorValues } from "@/types";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = (h % 360) / 360;
  const sn = s / 100, ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) / 360) * 6;
  const sn = s / 100, vn = v / 100;
  const i = Math.floor(hn);
  const f = hn - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = vn; g = t; b = p; break;
    case 1: r = q; g = vn; b = p; break;
    case 2: r = p; g = vn; b = t; break;
    case 3: r = p; g = q; b = vn; break;
    case 4: r = t; g = p; b = vn; break;
    case 5: r = vn; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbToCmyk(r: number, g: number, b: number): { c: number; m: number; y: number; k: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  const cn = c / 100, mn = m / 100, yn = y / 100, kn = k / 100;
  return {
    r: Math.round(255 * (1 - cn) * (1 - kn)),
    g: Math.round(255 * (1 - mn) * (1 - kn)),
    b: Math.round(255 * (1 - yn) * (1 - kn)),
  };
}

function rgbToXyz(r: number, g: number, b: number) {
  let rn = r / 255, gn = g / 255, bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  rn *= 100; gn *= 100; bn *= 100;
  return {
    x: rn * 0.4124 + gn * 0.3576 + bn * 0.1805,
    y: rn * 0.2126 + gn * 0.7152 + bn * 0.0722,
    z: rn * 0.0193 + gn * 0.1192 + bn * 0.9505,
  };
}

function xyzToRgb(x: number, y: number, z: number) {
  const xn = x / 100, yn = y / 100, zn = z / 100;
  let r = xn * 3.2406 + yn * -1.5372 + zn * -0.4986;
  let g = xn * -0.9689 + yn * 1.8758 + zn * 0.0415;
  let b = xn * 0.0557 + yn * -0.2040 + zn * 1.0570;
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;
  return {
    r: Math.round(clamp(r, 0, 1) * 255),
    g: Math.round(clamp(g, 0, 1) * 255),
    b: Math.round(clamp(b, 0, 1) * 255),
  };
}

export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  const xyz = rgbToXyz(r, g, b);
  const refX = 95.047, refY = 100, refZ = 108.883;
  let x = xyz.x / refX, y = xyz.y / refY, z = xyz.z / refZ;
  const f = (t: number) => t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return {
    l: Math.round((116 * y - 16) * 100) / 100,
    a: Math.round((500 * (x - y)) * 100) / 100,
    b: Math.round((200 * (y - z)) * 100) / 100,
  };
}

export function labToRgb(l: number, a: number, b: number): { r: number; g: number; b: number } {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const invF = (t: number) => {
    const cube = t * t * t;
    return cube > 0.008856 ? cube : (t - 16 / 116) / 7.787;
  };
  const refX = 95.047, refY = 100, refZ = 108.883;
  const x = invF(fx) * refX;
  const y = invF(fy) * refY;
  const z = invF(fz) * refZ;
  return xyzToRgb(x, y, z);
}

export function convertFrom(space: ColorSpace, value: any): ColorFormats {
  let rgb = { r: 0, g: 0, b: 0 };
  switch (space) {
    case "hex":
      rgb = hexToRgb(value as string);
      break;
    case "rgb":
      rgb = { r: value.r, g: value.g, b: value.b };
      break;
    case "hsl":
      rgb = hslToRgb(value.h, value.s, value.l);
      break;
    case "hsv":
      rgb = hsvToRgb(value.h, value.s, value.v);
      break;
    case "cmyk":
      rgb = cmykToRgb(value.c, value.m, value.y, value.k);
      break;
    case "lab":
      rgb = labToRgb(value.l, value.a, value.b);
      break;
  }
  const { r, g, b } = rgb;
  return {
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b },
    hsl: rgbToHsl(r, g, b),
    hsv: rgbToHsv(r, g, b),
    cmyk: rgbToCmyk(r, g, b),
    lab: rgbToLab(r, g, b),
    format: space,
    originalInput: typeof value === 'string' ? value : JSON.stringify(value),
  };
}

export function detectColorFormat(input: string): ColorFormat | 'unknown' {
  const str = input.trim();
  if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(str)) return 'hex';
  if (/^rgba?\s*\(/i.test(str)) return 'rgb';
  if (/^hsla?\s*\(/i.test(str)) return 'hsl';
  if (/^hsva?\s*\(/i.test(str)) return 'hsv';
  if (/^cmyk\s*\(/i.test(str)) return 'cmyk';
  if (/^lab\s*\(/i.test(str)) return 'lab';
  return 'unknown';
}

function parseRgbString(str: string): { r: number; g: number; b: number } | null {
  const m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

function parseHslString(str: string): { h: number; s: number; l: number } | null {
  const m = str.match(/hsla?\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?/i);
  if (!m) return null;
  return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
}

function parseHsvString(str: string): { h: number; s: number; v: number } | null {
  const m = str.match(/hsva?\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?/i);
  if (!m) return null;
  return { h: parseFloat(m[1]), s: parseFloat(m[2]), v: parseFloat(m[3]) };
}

function parseCmykString(str: string): { c: number; m: number; y: number; k: number } | null {
  const m = str.match(/cmyk\s*\(\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?\s*,\s*(\d+\.?\d*)%?/i);
  if (!m) return null;
  return { c: parseFloat(m[1]), m: parseFloat(m[2]), y: parseFloat(m[3]), k: parseFloat(m[4]) };
}

function parseLabString(str: string): { l: number; a: number; b: number } | null {
  const m = str.match(/lab\s*\(\s*(\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
  if (!m) return null;
  return { l: parseFloat(m[1]), a: parseFloat(m[2]), b: parseFloat(m[3]) };
}

export function parseColor(input: string): FullColorValues {
  const original = input.trim();
  const format = detectColorFormat(original);
  let rgb = { r: 0, g: 0, b: 0 };
  switch (format) {
    case 'hex':
      rgb = hexToRgb(original);
      break;
    case 'rgb': {
      const parsed = parseRgbString(original);
      if (parsed) rgb = parsed;
      break;
    }
    case 'hsl': {
      const parsed = parseHslString(original);
      if (parsed) rgb = hslToRgb(parsed.h, parsed.s, parsed.l);
      break;
    }
    case 'hsv': {
      const parsed = parseHsvString(original);
      if (parsed) rgb = hsvToRgb(parsed.h, parsed.s, parsed.v);
      break;
    }
    case 'cmyk': {
      const parsed = parseCmykString(original);
      if (parsed) rgb = cmykToRgb(parsed.c, parsed.m, parsed.y, parsed.k);
      break;
    }
    case 'lab': {
      const parsed = parseLabString(original);
      if (parsed) rgb = labToRgb(parsed.l, parsed.a, parsed.b);
      break;
    }
  }
  const { r, g, b } = rgb;
  return {
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b },
    hsl: rgbToHsl(r, g, b),
    hsv: rgbToHsv(r, g, b),
    cmyk: rgbToCmyk(r, g, b),
    lab: rgbToLab(r, g, b),
    format,
    originalInput: original,
  };
}

export const colorNameMap: Array<{ name: string; range: { h: [number, number]; s?: [number, number]; l?: [number, number] } }> = [
  { name: "纯白", range: { h: [0, 360], l: [95, 100] } },
  { name: "浅灰", range: { h: [0, 360], l: [85, 95], s: [0, 10] } },
  { name: "银灰", range: { h: [0, 360], l: [70, 85], s: [0, 10] } },
  { name: "中灰", range: { h: [0, 360], l: [45, 70], s: [0, 10] } },
  { name: "深灰", range: { h: [0, 360], l: [25, 45], s: [0, 10] } },
  { name: "炭黑", range: { h: [0, 360], l: [10, 25], s: [0, 10] } },
  { name: "纯黑", range: { h: [0, 360], l: [0, 10] } },
  { name: "玫瑰红", range: { h: [345, 360], s: [50, 100], l: [60, 85] } },
  { name: "珊瑚红", range: { h: [0, 15], s: [50, 100], l: [55, 75] } },
  { name: "中国红", range: { h: [0, 10], s: [70, 100], l: [35, 55] } },
  { name: "勃艮第红", range: { h: [340, 360], s: [60, 100], l: [20, 40] } },
  { name: "胭脂红", range: { h: [330, 350], s: [60, 100], l: [40, 60] } },
  { name: "樱粉", range: { h: [330, 350], s: [30, 70], l: [75, 90] } },
  { name: "桃粉", range: { h: [340, 360], s: [40, 80], l: [70, 85] } },
  { name: "品红", range: { h: [300, 330], s: [60, 100], l: [40, 60] } },
  { name: "洋紫", range: { h: [280, 310], s: [50, 100], l: [40, 65] } },
  { name: "薰衣草紫", range: { h: [260, 290], s: [30, 70], l: [70, 90] } },
  { name: "皇家紫", range: { h: [260, 285], s: [60, 100], l: [30, 50] } },
  { name: "深紫", range: { h: [260, 290], s: [50, 100], l: [15, 35] } },
  { name: "靛蓝", range: { h: [240, 265], s: [60, 100], l: [30, 50] } },
  { name: "宝石蓝", range: { h: [210, 235], s: [60, 100], l: [40, 60] } },
  { name: "皇家蓝", range: { h: [220, 245], s: [70, 100], l: [35, 55] } },
  { name: "深海蓝", range: { h: [200, 230], s: [70, 100], l: [15, 35] } },
  { name: "天蓝", range: { h: [195, 215], s: [50, 100], l: [65, 85] } },
  { name: "雾霾蓝", range: { h: [200, 230], s: [20, 50], l: [55, 75] } },
  { name: "湖蓝", range: { h: [180, 200], s: [50, 100], l: [45, 65] } },
  { name: "薄荷青", range: { h: [160, 180], s: [40, 80], l: [70, 90] } },
  { name: "青色", range: { h: [170, 190], s: [60, 100], l: [35, 55] } },
  { name: "提夫尼蓝", range: { h: [170, 185], s: [50, 80], l: [60, 75] } },
  { name: "翠绿", range: { h: [140, 165], s: [60, 100], l: [35, 55] } },
  { name: "森林绿", range: { h: [120, 145], s: [60, 100], l: [20, 40] } },
  { name: "军绿", range: { h: [60, 95], s: [30, 60], l: [30, 50] } },
  { name: "橄榄绿", range: { h: [70, 100], s: [40, 80], l: [35, 55] } },
  { name: "嫩绿", range: { h: [80, 110], s: [50, 100], l: [60, 80] } },
  { name: "薄荷绿", range: { h: [130, 155], s: [30, 60], l: [75, 90] } },
  { name: "草绿", range: { h: [90, 120], s: [50, 90], l: [40, 60] } },
  { name: "柠檬黄", range: { h: [50, 65], s: [70, 100], l: [60, 80] } },
  { name: "金黄", range: { h: [40, 55], s: [70, 100], l: [50, 70] } },
  { name: "香槟金", range: { h: [35, 50], s: [30, 60], l: [70, 88] } },
  { name: "鹅黄", range: { h: [45, 60], s: [30, 60], l: [80, 95] } },
  { name: "土黄", range: { h: [30, 50], s: [40, 70], l: [40, 55] } },
  { name: "橙色", range: { h: [15, 35], s: [70, 100], l: [45, 65] } },
  { name: "珊瑚橙", range: { h: [10, 25], s: [60, 90], l: [60, 75] } },
  { name: "南瓜橙", range: { h: [20, 35], s: [70, 100], l: [40, 60] } },
  { name: "焦糖棕", range: { h: [20, 40], s: [40, 70], l: [30, 45] } },
  { name: "咖啡色", range: { h: [20, 40], s: [30, 60], l: [20, 40] } },
  { name: "驼色", range: { h: [25, 45], s: [30, 60], l: [55, 75] } },
  { name: "奶茶色", range: { h: [25, 40], s: [20, 50], l: [65, 85] } },
];

export function getColorName(hex: string): string {
  try {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    for (const item of colorNameMap) {
      const { h: hRange, s: sRange, l: lRange } = item.range;
      const hMatch = hRange[0] > hRange[1]
        ? h >= hRange[0] || h <= hRange[1]
        : h >= hRange[0] && h <= hRange[1];
      const sMatch = !sRange || (s >= sRange[0] && s <= sRange[1]);
      const lMatch = !lRange || (l >= lRange[0] && l <= lRange[1]);
      if (hMatch && sMatch && lMatch) return item.name;
    }
    return hex;
  } catch {
    return hex;
  }
}

export function formatColorValue(space: ColorSpace, formats: ColorFormats): string {
  switch (space) {
    case "hex": return formats.hex;
    case "rgb": return `rgb(${formats.rgb.r}, ${formats.rgb.g}, ${formats.rgb.b})`;
    case "hsl": return `hsl(${formats.hsl.h}, ${formats.hsl.s}%, ${formats.hsl.l}%)`;
    case "hsv": return `hsv(${formats.hsv.h}, ${formats.hsv.s}%, ${formats.hsv.v}%)`;
    case "cmyk": return `cmyk(${formats.cmyk.c}%, ${formats.cmyk.m}%, ${formats.cmyk.y}%, ${formats.cmyk.k}%)`;
    case "lab": return `Lab(${formats.lab.l.toFixed(1)}, ${formats.lab.a.toFixed(1)}, ${formats.lab.b.toFixed(1)})`;
  }
}
