import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  X,
  CircleDot,
  ArrowRightLeft,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { colorService } from "@/services/colorService";
import type { CompareResult } from "@/types";

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

interface UploadSlotProps {
  label: string;
  accent: "A" | "B";
  file: File | null;
  previewUrl: string;
  onSelect: (f: File | null) => void;
}

function UploadSlot({ label, accent, file, previewUrl, onSelect }: UploadSlotProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    onSelect(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const accentColor = accent === "A" ? "brand-accent" : "brand-teal";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-spectrum-gradient shadow-glow"
          )}
        >
          {accent}
        </span>
        <span className="font-semibold text-brand-text">{label}</span>
      </div>
      <div
        className={cn(
          "relative w-full aspect-[4/3] glass-card border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden",
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
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
                inputRef.current && (inputRef.current.value = "");
              }}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white border border-white/10 hover:bg-black/70 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 p-6">
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center border border-dashed",
                accent === "A"
                  ? "border-brand-accent/40 bg-brand-accent/10"
                  : "border-brand-teal/40 bg-brand-teal/10"
              )}
            >
              <Upload
                className={cn(
                  "w-6 h-6",
                  accent === "A" ? "text-brand-accent" : "text-brand-teal"
                )}
              />
            </div>
            <div>
              <p className="font-medium text-brand-text mb-1">点击上传</p>
              <p className="text-sm text-brand-muted">支持 JPG / PNG / WEBP</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SimilarityGaugeProps {
  similarity: number;
  deltaE: number;
}

function SimilarityGauge({ similarity, deltaE }: SimilarityGaugeProps) {
  const size = 280;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (similarity / 100) * circumference;

  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(similarity * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [similarity]);

  const getLevel = (s: number) => {
    if (s >= 90) return { text: "极高", cls: "text-brand-teal" };
    if (s >= 75) return { text: "高", cls: "text-emerald-400" };
    if (s >= 55) return { text: "中", cls: "text-amber-400" };
    if (s >= 35) return { text: "低", cls: "text-orange-400" };
    return { text: "极低", cls: "text-brand-accent" };
  };
  const level = getLevel(similarity);
  const animatedOffset = circumference - (animated / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="spectrumRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B35" />
              <stop offset="33%" stopColor="#F7C59F" />
              <stop offset="66%" stopColor="#0E4D64" />
              <stop offset="100%" stopColor="#4ECDC4" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#spectrumRing)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animatedOffset}
            style={{
              transition: "none",
              filter: "drop-shadow(0 0 12px rgba(78,205,196,0.4))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-serif text-6xl font-bold spectrum-text mb-2">
            {Math.round(animated)}%
          </div>
          <div className={cn("text-lg font-semibold", level.cls)}>{level.text}相似度</div>
          <div className="mt-3 text-sm text-brand-muted font-mono">
            ΔE = {deltaE.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ColorCompare() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState("");
  const [previewB, setPreviewB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleFile = useCallback(
    (which: "A" | "B", f: File | null) => {
      if (which === "A") {
        setFileA(f);
        if (previewA.startsWith("blob:")) URL.revokeObjectURL(previewA);
        setPreviewA(f ? URL.createObjectURL(f) : "");
      } else {
        setFileB(f);
        if (previewB.startsWith("blob:")) URL.revokeObjectURL(previewB);
        setPreviewB(f ? URL.createObjectURL(f) : "");
      }
      setResult(null);
    },
    [previewA, previewB]
  );

  useEffect(() => {
    return () => {
      if (previewA.startsWith("blob:")) URL.revokeObjectURL(previewA);
      if (previewB.startsWith("blob:")) URL.revokeObjectURL(previewB);
    };
  }, []);

  const handleCompare = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    try {
      const res = await colorService.compareImages(fileA, fileB);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const canCompare = Boolean(fileA && fileB) && !loading;

  const deltaERows = [
    { range: "ΔE < 1", desc: "人眼几乎不可辨别差异", tone: "text-brand-teal" },
    { range: "ΔE 1 ~ 2", desc: "极微差异，专业人员可察觉", tone: "text-emerald-400" },
    { range: "ΔE 2 ~ 4", desc: "可察觉差异，普通用户可感知", tone: "text-amber-400" },
    { range: "ΔE 4 ~ 6", desc: "明显差异，色彩偏移可见", tone: "text-orange-400" },
    { range: "ΔE > 6", desc: "大差异，非同类色感", tone: "text-brand-accent" },
  ];

  return (
    <div className="min-h-dvh bg-brand-darker bg-noise-texture py-12 px-4">
      <div className="container max-w-6xl">
        <PageHeader
          title="颜色相似度对比"
          subtitle="双图主色提取，CIE ΔE2000专业色差评分"
        />

        <div className="grid md:grid-cols-2 gap-6 mb-8 animate-fade-in-up">
          <UploadSlot
            label="实物图A"
            accent="A"
            file={fileA}
            previewUrl={previewA}
            onSelect={(f) => handleFile("A", f)}
          />
          <UploadSlot
            label="实物图B"
            accent="B"
            file={fileB}
            previewUrl={previewB}
            onSelect={(f) => handleFile("B", f)}
          />
        </div>

        <div className="flex justify-center mb-10 animate-fade-in-up">
          <button
            type="button"
            onClick={handleCompare}
            disabled={!canCompare}
            className="btn-primary px-10 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                <CircleDot className="w-5 h-5" />
                开始对比
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="glass-card p-8 md:p-10">
              <SimilarityGauge
                similarity={result.similarity}
                deltaE={result.deltaE}
              />
            </div>

            <div className="glass-card p-6 md:p-8">
              <h3 className="font-semibold text-brand-text mb-6 flex items-center gap-2 text-center justify-center">
                <span className="w-1 h-5 rounded-full bg-spectrum-gradient" />
                主色卡对比
              </h3>

              <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-spectrum-gradient shadow-glow">
                      A
                    </span>
                    <span className="font-semibold text-brand-text">图A主色</span>
                  </div>
                  <div className="space-y-2">
                    {result.imageA.dominantColors.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl overflow-hidden bg-white/5 border border-white/10"
                      >
                        <div
                          className="w-16 h-12 flex-shrink-0"
                          style={{ background: c.hex }}
                        />
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="font-mono font-semibold text-brand-text">
                            {c.hex}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${c.ratio * 100}%`,
                                background: c.hex,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-brand-muted pr-4 font-mono">
                          {(c.ratio * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-2xl font-serif spectrum-text font-bold">≈</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-spectrum-gradient shadow-glow">
                      B
                    </span>
                    <span className="font-semibold text-brand-text">图B主色</span>
                  </div>
                  <div className="space-y-2">
                    {result.imageB.dominantColors.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl overflow-hidden bg-white/5 border border-white/10"
                      >
                        <div
                          className="w-16 h-12 flex-shrink-0"
                          style={{ background: c.hex }}
                        />
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="font-mono font-semibold text-brand-text">
                            {c.hex}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${c.ratio * 100}%`,
                                background: c.hex,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-brand-muted pr-4 font-mono">
                          {(c.ratio * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 md:p-8">
              <h3 className="font-semibold text-brand-text mb-5 flex items-center gap-2">
                <Info className="w-5 h-5 text-brand-teal" />
                ΔE 色差参考说明
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {deltaERows.map((row) => (
                  <div
                    key={row.range}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors"
                  >
                    <div className={cn("font-mono font-bold text-sm mb-1", row.tone)}>
                      {row.range}
                    </div>
                    <div className="text-xs text-brand-muted leading-relaxed">
                      {row.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
