import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Sun,
  Contrast,
  Droplet,
  Thermometer,
  Download,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileImage,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { colorService } from "@/services/colorService";
import type { CorrectionMode, CorrectionResult } from "@/types";

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

interface BeforeAfterSliderProps {
  originalUrl: string;
  correctedUrl: string;
}

function BeforeAfterSlider({ originalUrl, correctedUrl }: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      updatePosition(e.clientX);
    };
    const handleUp = () => {
      isDraggingRef.current = false;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleUp);
    };
  }, [updatePosition]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl select-none"
      onMouseDown={(e) => {
        isDraggingRef.current = true;
        updatePosition(e.clientX);
      }}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          isDraggingRef.current = true;
          updatePosition(e.touches[0].clientX);
        }
      }}
    >
      <img
        src={originalUrl}
        alt="原图"
        className="absolute inset-0 w-full h-full object-contain bg-black/30"
        draggable={false}
      />
      <img
        src={correctedUrl}
        alt="校正后"
        className="absolute inset-0 w-full h-full object-contain bg-black/30"
        style={{
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
        }}
        draggable={false}
      />

      <div className="absolute top-3 left-3 z-10">
        <div className="glass-card px-3 py-1.5 text-xs font-semibold text-brand-text shadow-glow">
          原图
        </div>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <div className="glass-card px-3 py-1.5 text-xs font-semibold text-brand-text shadow-glow">
          校正后
        </div>
      </div>

      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] z-10"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
      />

      <div
        className="absolute top-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.6),0_0_0_3px_rgba(255,107,53,0.3)] flex items-center justify-center cursor-grab active:cursor-grabbing border border-white/20"
        style={{
          left: `${sliderPos}%`,
          transform: "translate(-50%, -50%)",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          isDraggingRef.current = true;
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          isDraggingRef.current = true;
        }}
      >
        <ChevronLeft className="w-4 h-4 text-slate-700 -mr-0.5" />
        <ChevronRight className="w-4 h-4 text-slate-700 -ml-0.5" />
      </div>
    </div>
  );
}

interface DiffBadgeProps {
  value: number;
  unit?: string;
}

function DiffBadge({ value, unit = "%" }: DiffBadgeProps) {
  const positive = value > 0;
  const negative = value < 0;
  const absValue = Math.abs(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold",
        positive && "bg-emerald-500/15 text-emerald-400",
        negative && "bg-orange-500/15 text-orange-400",
        !positive && !negative && "bg-white/10 text-brand-muted"
      )}
    >
      {positive ? `+${absValue}${unit}` : negative ? `-${absValue}${unit}` : `0${unit}`}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const MODE_OPTIONS: Array<{ key: CorrectionMode; label: string }> = [
  { key: "auto", label: "自动" },
  { key: "landscape", label: "风景" },
  { key: "portrait", label: "人像" },
  { key: "product", label: "产品" },
];

export default function ImageCorrection() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<CorrectionMode>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setCorrectedImage = useAppStore((s) => s.setCorrectedImage);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  };

  const handleReset = () => {
    setFile(null);
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setResult(null);
    setMode("auto");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleCorrect = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await colorService.correctImage(file, mode);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleUseForPicker = () => {
    if (!result) return;
    setCorrectedImage(result.correctedImage);
    navigate("/color-picker");
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.correctedImage;
    a.download = "corrected.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-dvh bg-brand-darker bg-noise-texture py-12 px-4">
      <div className="container max-w-5xl">
        <PageHeader
          title="图片一键校正"
          subtitle="上传图片，AI自动识别场景并智能校正白平衡/对比度/饱和度"
        />

        {!result ? (
          <div className="space-y-6 animate-fade-in-up">
            <div
              className={cn(
                "glass-card border-2 border-dashed p-8 md:p-12 transition-all duration-300 cursor-pointer",
                isDragging
                  ? "border-brand-teal bg-brand-teal/10 shadow-glow"
                  : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-brand-accent/40 bg-brand-accent/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-brand-accent" />
                </div>
                <div>
                  <p className="font-semibold text-brand-text text-lg mb-1">
                    点击上传
                  </p>
                  <p className="text-sm text-brand-muted">支持 JPG / PNG / WEBP</p>
                </div>
                {file && (
                  <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 max-w-md w-full">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileImage className="w-6 h-6 text-brand-muted" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium text-brand-text truncate text-sm">
                        {file.name}
                      </div>
                      <div className="text-xs text-brand-muted mt-0.5">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-brand-muted uppercase tracking-wider">
                  场景模式
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMode(opt.key)}
                    className={cn("btn-pill", mode === opt.key && "btn-pill-active")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleCorrect}
                disabled={!file || loading}
                className={cn(
                  "btn-primary px-12 text-lg",
                  (!file || loading) && "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    校正中...
                  </>
                ) : (
                  <>
                    开始校正
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-card p-4 md:p-6">
              <BeforeAfterSlider
                originalUrl={result.originalImage}
                correctedUrl={result.correctedImage}
              />
            </div>

            <div className="glass-card p-6 md:p-8">
              <h3 className="font-semibold text-brand-text mb-6 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-spectrum-gradient" />
                校正元数据
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">
                      亮度变化
                    </div>
                    <DiffBadge value={result.metadata.brightness} />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <Contrast className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">
                      对比度变化
                    </div>
                    <DiffBadge value={result.metadata.contrast} />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Droplet className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">
                      饱和度变化
                    </div>
                    <DiffBadge value={result.metadata.saturation} />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border",
                      result.metadata.whiteBalance === "warm" &&
                        "bg-orange-500/15 border-orange-500/20",
                      result.metadata.whiteBalance === "cool" &&
                        "bg-blue-500/15 border-blue-500/20",
                      result.metadata.whiteBalance === "neutral" &&
                        "bg-white/10 border-white/10"
                    )}
                  >
                    <Thermometer
                      className={cn(
                        "w-5 h-5",
                        result.metadata.whiteBalance === "warm" && "text-orange-400",
                        result.metadata.whiteBalance === "cool" && "text-blue-400",
                        result.metadata.whiteBalance === "neutral" && "text-brand-muted"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">
                      白平衡
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold",
                        result.metadata.whiteBalance === "warm" &&
                          "bg-orange-500/15 text-orange-400",
                        result.metadata.whiteBalance === "cool" &&
                          "bg-blue-500/15 text-blue-400",
                        result.metadata.whiteBalance === "neutral" &&
                          "bg-white/10 text-brand-muted"
                      )}
                    >
                      {result.metadata.whiteBalance === "warm"
                        ? "偏暖"
                        : result.metadata.whiteBalance === "cool"
                        ? "偏冷"
                        : "中性"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button type="button" onClick={handleReset} className="btn-secondary">
                <RefreshCcw className="w-4 h-4" />
                重新上传
              </button>
              <button type="button" onClick={handleDownload} className="btn-primary">
                <Download className="w-4 h-4" />
                下载校正图片
              </button>
              <button type="button" onClick={handleUseForPicker} className="btn-primary">
                用于取色分析
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
