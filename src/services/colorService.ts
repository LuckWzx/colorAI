import type { CorrectionMode, CorrectionResult, CompareResult, PhoneCorrectResponse } from "@/types";

type DeviceType = 'ios' | 'android' | 'auto';
type SceneType = 'outdoor' | 'indoor' | 'studio' | 'night';

function applyPhoneCorrection(
  file: File,
  device: DeviceType = 'auto',
  scene: SceneType = 'outdoor'
): Promise<PhoneCorrectResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = () => {
        const original = reader.result as string;
        const canvas1 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d')!;
        const canvas2 = document.createElement('canvas');
        const ctx2 = canvas2.getContext('2d')!;
        const img = new Image();
        img.onload = () => {
          canvas1.width = img.width;
          canvas1.height = img.height;
          canvas2.width = img.width;
          canvas2.height = img.height;
          ctx1.drawImage(img, 0, 0);
          ctx2.drawImage(img, 0, 0);
          const imgData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
          const data1 = imgData1.data;
          const imgData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
          const data2 = imgData2.data;

          let redShiftPct = 0,
            greenShiftPct = 0,
            blueShiftPct = 0,
            brightnessVal = 0,
            exposureEV = 0;

          if (device === 'ios') {
            redShiftPct = 4.5;
            greenShiftPct = -1.5;
            blueShiftPct = -3;
          } else if (device === 'android') {
            redShiftPct = -2;
            greenShiftPct = 2;
            blueShiftPct = 3.5;
          } else {
            redShiftPct = 1.5;
            greenShiftPct = 0.5;
            blueShiftPct = -1;
          }

          if (scene === 'indoor') {
            redShiftPct += 3;
            greenShiftPct += 1;
            blueShiftPct -= 4;
            brightnessVal = 8;
          } else if (scene === 'night') {
            redShiftPct += 1;
            greenShiftPct -= 3;
            blueShiftPct += 2;
            brightnessVal = 18;
            exposureEV = 0.8;
          } else if (scene === 'studio') {
            redShiftPct += 0;
            greenShiftPct += 0;
            blueShiftPct += 0;
            brightnessVal = 5;
          } else {
            redShiftPct += 1;
            greenShiftPct -= 0.5;
            blueShiftPct -= 0.5;
            brightnessVal = 3;
          }

          const rShiftVis = -redShiftPct;
          const gShiftVis = -greenShiftPct;
          const bShiftVis = -blueShiftPct;

          for (let i = 0; i < data1.length; i += 4) {
            let r = data1[i],
              g = data1[i + 1],
              b = data1[i + 2];
            r = r * (1 + rShiftVis / 100) + brightnessVal;
            g = g * (1 + gShiftVis / 100) + brightnessVal;
            b = b * (1 + bShiftVis / 100) + brightnessVal;
            data1[i] = Math.max(0, Math.min(255, r));
            data1[i + 1] = Math.max(0, Math.min(255, g));
            data1[i + 2] = Math.max(0, Math.min(255, b));

            let r2 = data2[i],
              g2 = data2[i + 1],
              b2 = data2[i + 2];
            const avg = (r2 + g2 + b2) / 3;
            const gray = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
            r2 = avg + (r2 - gray) * 1.05 + 4;
            g2 = avg + (g2 - gray) * 1.05 + 2;
            b2 = avg + (b2 - gray) * 1.05;
            data2[i] = Math.max(0, Math.min(255, r2));
            data2[i + 1] = Math.max(0, Math.min(255, g2));
            data2[i + 2] = Math.max(0, Math.min(255, b2));
          }

          ctx1.putImageData(imgData1, 0, 0);
          ctx2.putImageData(imgData2, 0, 0);

          resolve({
            success: true,
            originalUrl: original,
            correctedUrl: canvas1.toDataURL('image/jpeg', 0.92),
            standardUrl: canvas2.toDataURL('image/jpeg', 0.92),
            adjustment: {
              redShift: +rShiftVis.toFixed(1),
              greenShift: +gShiftVis.toFixed(1),
              blueShift: +bShiftVis.toFixed(1),
              brightness: brightnessVal,
              exposure: Math.round(exposureEV * 10) / 10,
            },
          });
        };
        img.src = original;
      };
      reader.readAsDataURL(file);
    }, 1500 + Math.random() * 800);
  });
}

function simulateImageCorrection(file: File, mode: CorrectionMode): Promise<CorrectionResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = () => {
        const original = reader.result as string;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          const brightnessShift = mode === "landscape" ? 15 : mode === "portrait" ? 10 : mode === "product" ? 20 : 12;
          const contrastShift = mode === "product" ? 1.18 : mode === "landscape" ? 1.12 : 1.08;
          const saturationMult = mode === "landscape" ? 1.2 : mode === "portrait" ? 1.1 : mode === "product" ? 1.15 : 1.12;

          for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];
            r = (r - 128) * contrastShift + 128 + brightnessShift;
            g = (g - 128) * contrastShift + 128 + brightnessShift;
            b = (b - 128) * contrastShift + 128 + brightnessShift;

            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * saturationMult;
            g = gray + (g - gray) * saturationMult;
            b = gray + (b - gray) * saturationMult;

            if (mode === "portrait") {
              r += 4;
              g -= 1;
              b -= 2;
            } else if (mode === "landscape") {
              g += 3;
              b += 2;
            }

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
          }
          ctx.putImageData(imageData, 0, 0);

          const wb = mode === "portrait" ? "warm" as const : mode === "landscape" ? "cool" as const : "neutral" as const;

          resolve({
            originalImage: original,
            correctedImage: canvas.toDataURL("image/jpeg", 0.92),
            metadata: {
              brightness: brightnessShift,
              contrast: Math.round((contrastShift - 1) * 100),
              saturation: Math.round((saturationMult - 1) * 100),
              whiteBalance: wb,
            },
          });
        };
        img.src = original;
      };
      reader.readAsDataURL(file);
    }, 1400 + Math.random() * 800);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractDominantColors(dataUrl: string, count = 5): Promise<Array<{ hex: string; ratio: number }>> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const buckets: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = Math.floor(data[i] / 16) * 16;
        const g = Math.floor(data[i + 1] / 16) * 16;
        const b = Math.floor(data[i + 2] / 16) * 16;
        const key = `${r},${g},${b}`;
        buckets[key] = (buckets[key] || 0) + 1;
      }
      const total = size * size;
      const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, count * 3);
      const results: Array<{ hex: string; ratio: number }> = [];
      for (const [key, c] of sorted) {
        if (results.length >= count) break;
        const [r, g, b] = key.split(",").map(Number);
        const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
        if (!results.some((x) => x.hex === hex)) {
          results.push({ hex, ratio: c / total });
        }
      }
      const sumR = results.reduce((s, x) => s + x.ratio, 0);
      resolve(results.map((x) => ({ ...x, ratio: x.ratio / sumR })));
    };
    img.src = dataUrl;
  });
}

function hexToRgbArray(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToLab([r, g, b]: [number, number, number]) {
  let rn = r / 255, gn = g / 255, bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  const x = (rn * 41.24 + gn * 35.76 + bn * 18.05) / 95.047;
  const y = (rn * 21.26 + gn * 71.52 + bn * 7.22) / 100;
  const z = (rn * 1.93 + gn * 11.92 + bn * 95.05) / 108.883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))] as [number, number, number];
}

function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const ap1 = a1 * (1 + G);
  const ap2 = a2 * (1 + G);
  const Cp1 = Math.sqrt(ap1 * ap1 + b1 * b1);
  const Cp2 = Math.sqrt(ap2 * ap2 + b2 * b2);
  const hp1 = b1 === 0 && ap1 === 0 ? 0 : (Math.atan2(b1, ap1) * 180 / Math.PI + 360) % 360;
  const hp2 = b2 === 0 && ap2 === 0 ? 0 : (Math.atan2(b2, ap2) * 180 / Math.PI + 360) % 360;
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    const diff = hp2 - hp1;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * Math.PI / 180) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = (hp1 + hp2) / 2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hbp < 180 ? 180 : -180;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.2 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  const SL = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)))
    * Math.sin((60 * Math.exp(-Math.pow((hbp - 275) / 25, 2))) * Math.PI / 90);
  const dL = dLp / SL;
  const dC = dCp / SC;
  const dH = dHp / SH;
  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

async function simulateCompare(fileA: File, fileB: File): Promise<CompareResult> {
  const [urlA, urlB] = await Promise.all([fileToDataUrl(fileA), fileToDataUrl(fileB)]);
  const [colorsA, colorsB] = await Promise.all([
    extractDominantColors(urlA, 5),
    extractDominantColors(urlB, 5),
  ]);
  await new Promise((r) => setTimeout(r, 800));

  const minLen = Math.min(colorsA.length, colorsB.length);
  let totalDE = 0;
  for (let i = 0; i < minLen; i++) {
    const labA = rgbToLab(hexToRgbArray(colorsA[i].hex));
    const labB = rgbToLab(hexToRgbArray(colorsB[i].hex));
    totalDE += deltaE2000(labA, labB);
  }
  const avgDE = totalDE / minLen;
  const similarity = Math.max(0, Math.min(100, 100 - avgDE * 2.5));

  return {
    similarity: Math.round(similarity * 100) / 100,
    deltaE: Math.round(avgDE * 100) / 100,
    imageA: { imageUrl: urlA, dominantColors: colorsA },
    imageB: { imageUrl: urlB, dominantColors: colorsB },
  };
}

/**
 * 计算两个 HEX 颜色之间的 ΔE2000 与相似度
 */
function computeColorDeltaE(hexA: string, hexB: string): { deltaE: number; similarity: number } {
  const labA = rgbToLab(hexToRgbArray(hexA));
  const labB = rgbToLab(hexToRgbArray(hexB));
  const de = deltaE2000(labA, labB);
  const sim = Math.max(0, Math.min(100, 100 - de * 2.5));
  return {
    deltaE: Math.round(de * 100) / 100,
    similarity: Math.round(sim * 100) / 100,
  };
}

/**
 * 基于 HEX 颜色生成一个相近的"颜色胶"匹配色
 * 策略：对 Lab 空间的 L/a/b 各做小幅扰动，模拟系统从色卡库中匹配的颜色胶
 */
function generateMatchedColorHex(hex: string): string {
  const [r, g, b] = hexToRgbArray(hex);
  const lab = rgbToLab([r, g, b]);
  // 在 Lab 空间做轻微偏移（模拟色卡库中最接近的匹配胶）
  const newL = Math.max(0, Math.min(100, lab[0] + (Math.random() * 4 - 2)));
  const newA = Math.max(-128, Math.min(128, lab[1] + (Math.random() * 3 - 1.5)));
  const newB = Math.max(-128, Math.min(128, lab[2] + (Math.random() * 3 - 1.5)));
  const rgb = labToRgbArray([newL, newA, newB]);
  return rgbToHexStr(rgb[0], rgb[1], rgb[2]);
}

function labToRgbArray([L, a, b]: [number, number, number]): [number, number, number] {
  const fy = (L + 16) / 116;
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
  const xn = x / 100, yn = y / 100, zn = z / 100;
  let r = xn * 3.2406 + yn * -1.5372 + zn * -0.4986;
  let g = xn * -0.9689 + yn * 1.8758 + zn * 0.0415;
  let bl = xn * 0.0557 + yn * -0.2040 + zn * 1.0570;
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bl = bl > 0.0031308 ? 1.055 * Math.pow(bl, 1 / 2.4) - 0.055 : 12.92 * bl;
  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bl * 255))),
  ];
}

function rgbToHexStr(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export const colorService = {
  async correctImage(file: File, mode: CorrectionMode = "auto"): Promise<CorrectionResult> {
    return simulateImageCorrection(file, mode);
  },

  async compareImages(fileA: File, fileB: File): Promise<CompareResult> {
    return simulateCompare(fileA, fileB);
  },

  /**
   * 基于一个 HEX 颜色，生成"系统匹配的颜色胶"对比结果
   * 用于"取色 → 匹配颜色胶"自动对比的工作流
   */
  async matchColorGel(hex: string): Promise<CompareResult> {
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
    const matchedHex = generateMatchedColorHex(hex);
    const { deltaE, similarity } = computeColorDeltaE(hex, matchedHex);
    return {
      similarity,
      deltaE,
      imageA: {
        imageUrl: '',
        dominantColors: [{ hex: hex.toUpperCase(), ratio: 1 }],
      },
      imageB: {
        imageUrl: '',
        dominantColors: [{ hex: matchedHex, ratio: 1 }],
      },
    };
  },

  async phoneCorrectImage(
    file: File,
    device?: DeviceType,
    scene?: SceneType
  ): Promise<PhoneCorrectResponse> {
    return applyPhoneCorrection(file, device, scene);
  },
};
