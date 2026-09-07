import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Copy,
  Check,
  FileImage,
  Loader2,
  Sparkles,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { colorService } from "@/services/colorService";
import {
  convertFrom,
  getColorName,
  formatColorValue,
} from "@/utils/colorConverter";
import type { FullColorValues, ColorSpace, CorrectionResult } from "@/types";

interface PageHeaderProps {
  title: string;
  subtitle: string;
}

function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="text-center mb-10 animate-fade-in-up">
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3 tracking-tight">
        <span className="spectrum-text">{title}</span>
      </h1>
      <p className="text-brand-muted text-lg md:text-xl">{subtitle}</p>
    </div>
  );
}

interface ToastProps {
  message: string;
  visible: boolean;
}

function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed top-20 right-4 z-50 animate-fade-in-up">
      <div className="glass-card px-5 py-3 flex items-center gap-2 shadow-glow">
        <div className="w-7 h-7 rounded-full bg-spectrum-gradient flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
        <span className="font-medium text-brand-text">{message}</span>
      </div>
    </div>
  );
}

const FORMAT_LABELS: Array<{ key: ColorSpace; label: string }> = [
  { key: "hex", label: "HEX" },
  { key: "rgb", label: "RGB" },
  { key: "hsl", label: "HSL" },
  { key: "hsv", label: "HSV" },
  { key: "cmyk", label: "CMYK" },
  { key: "lab", label: "Lab" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ColorPicker() {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [leftIsDragging, setLeftIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const leftInputRef = useRef<HTMLInputElement>(null);

  const storedCorrectedImage = useAppStore((s) => s.currentCorrectedImage);
  const setCorrectedImage = useAppStore((s) => s.setCorrectedImage);
  const setPickedColor = useAppStore((s) => s.setPickedColor);
  const addColorToHistory = useAppStore((s) => s.addColorToHistory);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverColor, setHoverColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [confirmedColor, setConfirmedColor] = useState<FullColorValues | null>(null);
  const [confirmedCoord, setConfirmedCoord] = useState<{ x: number; y: number } | null>(null);

  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const showToastMsg = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2000);
  }, []);

  const copyToClipboard = async (text: string, label = "已复制") => {
    try {
      await navigator.clipboard.writeText(text);
      showToastMsg(label);
    } catch {
      showToastMsg("复制失败");
    }
  };

  const handleImageLoaded = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  }, []);

  const getPixelFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;
      const rect = img.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = Math.floor(relX * scaleX);
      const canvasY = Math.floor(relY * scaleY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
      return {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        relX,
        relY,
        rectW: rect.width,
        rectH: rect.height,
      };
    },
    []
  );

  const handleMove = (clientX: number, clientY: number) => {
    const info = getPixelFromEvent(clientX, clientY);
    if (!info) {
      setCursorPos(null);
      setHoverColor(null);
      return;
    }
    setCursorPos({ x: info.relX, y: info.relY });
    setHoverColor({ r: info.r, g: info.g, b: info.b });
  };

  const handleClick = (clientX: number, clientY: number) => {
    const info = getPixelFromEvent(clientX, clientY);
    if (!info) return;
    const converted = convertFrom("rgb", { r: info.r, g: info.g, b: info.b });
    setConfirmedColor(converted);
    setConfirmedCoord({
      x: Math.round((info.relX / info.rectW) * 100),
      y: Math.round((info.relY / info.rectH) * 100),
    });
    setPickedColor(converted);
    addColorToHistory(converted.hex);
  };

  const handleLeftDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLeftIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    startCorrect(f);
  };

  const startCorrect = async (file: File) => {
    setUploadFile(file);
    setUploadLoading(true);
    setImageUrl("");
    setConfirmedColor(null);
    setConfirmedCoord(null);
    setHoverColor(null);
    setCursorPos(null);
    try {
      const res: CorrectionResult = await colorService.correctImage(file, "auto");
      setImageUrl(res.correctedImage);
      setCorrectedImage(res.correctedImage);
    } finally {
      setUploadLoading(false);
    }
  };

  const useStoredImage = () => {
    if (!storedCorrectedImage) return;
    setImageUrl(storedCorrectedImage);
    setConfirmedColor(null);
    setConfirmedCoord(null);
    setHoverColor(null);
    setCursorPos(null);
  };

  const handleCopyAll = () => {
    if (!confirmedColor) return;
    const lines = FORMAT_LABELS.map(
      ({ key, label }) => `${label}: ${formatColorValue(key, confirmedColor)}`
    );
    copyToClipboard(lines.join("\n"), "全部色值已复制");
  };

  useEffect(() => {
    return () => {
      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-brand-darker bg-noise-texture py-12 px-4">
      <Toast message={toastMsg} visible={showToast} />
      <div className="container max-w-6xl">
        <PageHeader
          title="智能取色器"
          subtitle="上传校正后图片，点击任意位置获取多格式色值"
        />

        {!imageUrl ? (
          <div className="glass-card p-6 md:p-8 animate-fade-in-up">
            <div className="grid md:grid-cols-2 gap-6">
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-2xl p-6 md:p-8 transition-all duration-300 cursor-pointer min-h-[300px flex flex-col items-center justify-center",
                  leftIsDragging
                    ? "border-brand-teal bg-brand-teal/10 shadow-glow"
                    : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"
                )}
                onClick={() => leftInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setLeftIsDragging(true);
                }}
                onDragLeave={() => setLeftIsDragging(false)}
                onDrop={handleLeftDrop}
              >
                <input
                  ref={leftInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) startCorrect(f);
                  }}
                />
                {uploadLoading ? (
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-brand-accent/40 bg-brand-accent/10 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-text text-lg mb-1">
                        图片校正中...
                      </p>
                      <p className="text-sm text-brand-muted">
                        AI 正在优化白平衡和对比度
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-brand-teal/40 bg-brand-teal/10 flex items-center justify-center">
                      <ImagePlus className="w-10 h-10 text-brand-teal" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-text text-lg mb-1">
                        上传图片并校正
                      </p>
                      <p className="text-sm text-brand-muted mb-3">
                        支持 JPG / PNG / WEBP
                      </p>
                      <div className="inline-flex items-center gap-1.5 text-xs text-brand-accent">
                        <Sparkles className="w-3.5 h-3.5" />
                        自动校正后作为取色底图
                      </div>
                    </div>
                    {uploadFile && (
                      <div className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 max-w-sm w-full">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <FileImage className="w-5 h-5 text-brand-muted" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium text-brand-text truncate text-sm">
                            {uploadFile.name}
                          </div>
                          <div className="text-xs text-brand-muted mt-0.5">
                            {formatFileSize(uploadFile.size)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative border-2 border-dashed rounded-2xl p-6 md:p-8 transition-all duration-300 min-h-[300px] border-white/15 bg-white/[0.02] flex flex-col items-center justify-center">
                {storedCorrectedImage ? (
                  <div className="flex flex-col items-center text-center gap-5 w-full">
                    <div className="relative w-full max-w-[240px] aspect-[4/3] rounded-xl overflow-hidden border border-white/10 shadow-card">
                      <img
                        src={storedCorrectedImage}
                        alt="上次校正图片"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 glass-card px-2 py-0.5 text-[10px] font-semibold">
                        已缓存
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-brand-text text-lg mb-1">
                        暂存校正图片
                      </p>
                      <p className="text-sm text-brand-muted">
                        来自【图片一键校正】的输出
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={useStoredImage}
                      className="btn-primary px-8"
                    >
                      <Upload className="w-4 h-4" />
                      使用上次校正图片
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                      <FileImage className="w-10 h-10 text-brand-muted/60" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-muted text-lg mb-1">
                        暂存校正图片
                      </p>
                      <p className="text-sm text-brand-muted leading-relaxed max-w-xs">
                        暂未暂存校正图片，请先使用【图片一键校正】功能
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-card p-4 md:p-6">
              <div
                ref={containerRef}
                className="relative w-full flex items-center justify-center"
                style={{ maxHeight: 500 }}
              >
                <div className="relative inline-block">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="取色图片"
                    onLoad={handleImageLoaded}
                    onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                    onMouseLeave={() => {
                      setCursorPos(null);
                      setHoverColor(null);
                    }}
                    onClick={(e) => handleClick(e.clientX, e.clientY)}
                    onTouchMove={(e) => {
                      if (e.touches.length > 0) {
                        handleMove(e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (e.changedTouches.length > 0) {
                        handleClick(
                          e.changedTouches[0].clientX,
                          e.changedTouches[0].clientY
                        );
                      }
                    }}
                    className="max-w-full max-h-[500px] rounded-lg cursor-crosshair shadow-card"
                    style={{ maxHeight: 500 }}
                    draggable={false}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {cursorPos && hoverColor && (
                    <>
                      <div
                        className="absolute top-0 bottom-0 w-[1px] bg-white/60 pointer-events-none"
                        style={{ left: cursorPos.x }}
                      />
                      <div
                        className="absolute left-0 right-0 h-[1px] bg-white/60 pointer-events-none"
                        style={{ top: cursorPos.y }}
                      />
                      <div
                        className="absolute w-[50px] h-[50px] rounded-full pointer-events-none border-2 border-white shadow-[0_0_20px_rgba(0,0,0,0.5)] animate-pulse"
                        style={{
                          left: cursorPos.x - 25,
                          top: cursorPos.y - 25,
                          background: `rgb(${hoverColor.r}, ${hoverColor.g}, ${hoverColor.b})`,
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {confirmedColor ? (
              <div className="glass-card p-6 md:p-8 animate-fade-in-up">
                <div className="flex flex-col md:flex-row gap-6 mb-8">
                  <div
                    className="w-20 h-20 rounded-2xl border-2 border-white/10 flex-shrink-0"
                    style={{
                      background: confirmedColor.hex,
                      boxShadow: `inset 0 4px 20px rgba(0,0,0,0.25), 0 0 60px ${confirmedColor.hex}50, 0 0 30px ${confirmedColor.hex}30`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl md:text-3xl font-serif font-bold text-brand-text mb-1">
                      {getColorName(confirmedColor.hex)}
                    </div>
                    {confirmedCoord && (
                      <div className="text-sm text-brand-muted font-mono">
                        来源坐标 ({confirmedCoord.x}%, {confirmedCoord.y}%)
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  {FORMAT_LABELS.map(({ key, label }) => {
                    const value = formatColorValue(key, confirmedColor);
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-colors"
                      >
                        <div className="w-20 flex-shrink-0">
                          <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                            {label}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-mono text-lg text-brand-text truncate">
                            {value}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(value, `${label} 已复制`)}
                          className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center text-brand-muted hover:text-brand-text hover:bg-white/12 hover:border-white/20 transition-all"
                          aria-label={`复制${label}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="btn-primary px-10 text-lg"
                  >
                    <Copy className="w-5 h-5" />
                    一键复制全部色值
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 md:p-12 text-center animate-fade-in-up">
                <div className="inline-flex w-16 h-16 rounded-full border-2 border-dashed border-brand-accent/40 bg-brand-accent/10 items-center justify-center mb-5">
                  <Upload className="w-8 h-8 text-brand-accent" />
                </div>
                <div className="font-semibold text-brand-text text-lg mb-1">
                  点击图片任意位置开始取色
                </div>
                <p className="text-sm text-brand-muted">
                  移动鼠标预览颜色，点击确认获取多格式色值
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
