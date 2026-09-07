import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Pipette,
  Hash,
  RefreshCcw,
  History,
  Plus,
  Minus as MinusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import {
  convertFrom,
  formatColorValue,
  rgbToHex,
} from "@/utils/colorConverter";
import type { ColorFormats, ColorSpace } from "@/types";

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

function Toast({ message, visible }: { message: string; visible: boolean }) {
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

const SPACES: Array<{ key: ColorSpace; label: string }> = [
  { key: "hex", label: "HEX" },
  { key: "rgb", label: "RGB" },
  { key: "hsl", label: "HSL" },
  { key: "hsv", label: "HSV" },
  { key: "cmyk", label: "CMYK" },
  { key: "lab", label: "Lab" },
];

interface StepperInputProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
}

function StepperInput({ value, onChange, min, max, step = 1, suffix, label }: StepperInputProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-brand-muted mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex items-stretch rounded-xl overflow-hidden border border-white/10 focus-within:border-brand-teal/50 transition-colors">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-3 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-brand-text transition-colors"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <input
          type="number"
          value={Number.isFinite(value) ? value : min}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="flex-1 w-full bg-white/5 border-x border-white/10 px-4 py-3 text-brand-text font-mono text-lg text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="px-3 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-brand-text transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        {suffix && (
          <div className="px-3 bg-white/8 flex items-center text-brand-muted font-medium border-l border-white/10 text-sm">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ColorConverterPage() {
  const [formats, setFormats] = useState<ColorFormats>(() =>
    convertFrom("hex", "#4ECDC4")
  );
  const [activeTab, setActiveTab] = useState<ColorSpace>("hex");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const colorHistory = useAppStore((s) => s.colorHistory);
  const addColorToHistory = useAppStore((s) => s.addColorToHistory);

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

  const updateFrom = useCallback(
    (space: ColorSpace, value: any) => {
      const next = convertFrom(space, value);
      setFormats(next);
    },
    []
  );

  useEffect(() => {
    addColorToHistory(formats.hex);
  }, [formats.hex, addColorToHistory]);

  const handleEyeDropper = async () => {
    try {
      const ED = (window as any).EyeDropper;
      if (!ED) {
        showToastMsg("当前浏览器不支持取色器");
        return;
      }
      const ed = new ED();
      const res = await ed.open();
      if (res?.sRGBHex) {
        updateFrom("hex", res.sRGBHex.toUpperCase());
      }
    } catch {
      // 用户取消
    }
  };

  const [hexInput, setHexInput] = useState(formats.hex);
  useEffect(() => {
    if (hexInput.replace("#", "").length >= 6) {
      const formatted = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
      const validHex = /^#?[0-9A-Fa-f]{6}$/.test(formatted);
      if (validHex) {
        const target = (formatted.startsWith("#") ? formatted : `#${formatted}`).toUpperCase();
        setFormats(convertFrom("hex", target));
      }
    }
  }, [hexInput]);

  const eyeDropperSupported = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className="min-h-screen bg-brand-darker bg-noise-texture py-12 px-4">
      <Toast message={toastMsg} visible={showToast} />
      <div className="container max-w-5xl">
        <PageHeader
          title="色彩空间转换"
          subtitle="支持 HEX RGB HSL HSV CMYK Lab 6种空间实时互转"
        />

        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 mb-6">
          <div className="glass-card p-6 md:p-8 animate-fade-in-up">
            <div className="flex justify-center mb-8">
              <div
                className="w-[200px] h-[200px] rounded-2xl border-4 border-white/10"
                style={{
                  background: formats.hex,
                  boxShadow: `inset 0 4px 20px rgba(0,0,0,0.3), 0 0 80px ${formats.hex}50, 0 0 40px ${formats.hex}30`,
                }}
              />
            </div>

            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex flex-wrap gap-2">
                {SPACES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      "btn-pill",
                      activeTab === key && "btn-pill-active"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {eyeDropperSupported && (
                <button
                  type="button"
                  onClick={handleEyeDropper}
                  className="btn-pill"
                  title="屏幕取色"
                >
                  <Pipette className="w-4 h-4" />
                  取色器
                </button>
              )}
            </div>

            <div className="space-y-4">
              {activeTab === "hex" && (
                <div>
                  <label className="block text-xs font-semibold text-brand-muted mb-2 uppercase tracking-wider">HEX 色值</label>
                  <div className="relative flex items-stretch rounded-xl overflow-hidden border border-white/10 focus-within:border-brand-teal/50 transition-colors">
                    <div className="flex items-center px-4 bg-white/8 border-r border-white/10 text-brand-muted font-mono text-lg">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={hexInput.replace("#", "")}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                        setHexInput(v ? `#${v.toUpperCase()}` : "");
                      }}
                      onBlur={() => {
                        const clean = formats.hex;
                        setHexInput(clean);
                      }}
                      placeholder="4ECDC4"
                      className="flex-1 w-full bg-white/5 px-4 py-3 text-brand-text font-mono text-lg focus:outline-none uppercase"
                      maxLength={6}
                    />
                    <div
                      className="w-14 bg-white/8 border-l border-white/10"
                      style={{ background: formats.hex }}
                    />
                  </div>
                </div>
              )}

              {activeTab === "rgb" && (
                <div className="grid grid-cols-3 gap-3">
                  <StepperInput
                    label="R"
                    value={formats.rgb.r}
                    min={0}
                    max={255}
                    onChange={(v) => updateFrom("rgb", { ...formats.rgb, r: v })}
                  />
                  <StepperInput
                    label="G"
                    value={formats.rgb.g}
                    min={0}
                    max={255}
                    onChange={(v) => updateFrom("rgb", { ...formats.rgb, g: v })}
                  />
                  <StepperInput
                    label="B"
                    value={formats.rgb.b}
                    min={0}
                    max={255}
                    onChange={(v) => updateFrom("rgb", { ...formats.rgb, b: v })}
                  />
                </div>
              )}

              {activeTab === "hsl" && (
                <div className="grid grid-cols-3 gap-3">
                  <StepperInput
                    label="H"
                    value={formats.hsl.h}
                    min={0}
                    max={360}
                    suffix="°"
                    onChange={(v) => updateFrom("hsl", { ...formats.hsl, h: v })}
                  />
                  <StepperInput
                    label="S"
                    value={formats.hsl.s}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("hsl", { ...formats.hsl, s: v })}
                  />
                  <StepperInput
                    label="L"
                    value={formats.hsl.l}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("hsl", { ...formats.hsl, l: v })}
                  />
                </div>
              )}

              {activeTab === "hsv" && (
                <div className="grid grid-cols-3 gap-3">
                  <StepperInput
                    label="H"
                    value={formats.hsv.h}
                    min={0}
                    max={360}
                    suffix="°"
                    onChange={(v) => updateFrom("hsv", { ...formats.hsv, h: v })}
                  />
                  <StepperInput
                    label="S"
                    value={formats.hsv.s}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("hsv", { ...formats.hsv, s: v })}
                  />
                  <StepperInput
                    label="V"
                    value={formats.hsv.v}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("hsv", { ...formats.hsv, v: v })}
                  />
                </div>
              )}

              {activeTab === "cmyk" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StepperInput
                    label="C"
                    value={formats.cmyk.c}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("cmyk", { ...formats.cmyk, c: v })}
                  />
                  <StepperInput
                    label="M"
                    value={formats.cmyk.m}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("cmyk", { ...formats.cmyk, m: v })}
                  />
                  <StepperInput
                    label="Y"
                    value={formats.cmyk.y}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("cmyk", { ...formats.cmyk, y: v })}
                  />
                  <StepperInput
                    label="K"
                    value={formats.cmyk.k}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => updateFrom("cmyk", { ...formats.cmyk, k: v })}
                  />
                </div>
              )}

              {activeTab === "lab" && (
                <div className="grid grid-cols-3 gap-3">
                  <StepperInput
                    label="L"
                    value={Math.round(formats.lab.l)}
                    min={0}
                    max={100}
                    onChange={(v) => updateFrom("lab", { ...formats.lab, l: v })}
                  />
                  <StepperInput
                    label="A"
                    value={Math.round(formats.lab.a)}
                    min={-128}
                    max={127}
                    onChange={(v) => updateFrom("lab", { ...formats.lab, a: v })}
                  />
                  <StepperInput
                    label="B"
                    value={Math.round(formats.lab.b)}
                    min={-128}
                    max={127}
                    onChange={(v) => updateFrom("lab", { ...formats.lab, b: v })}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const r = Math.floor(Math.random() * 256);
                  const g = Math.floor(Math.random() * 256);
                  const b = Math.floor(Math.random() * 256);
                  updateFrom("rgb", { r, g, b });
                }}
                className="btn-secondary"
              >
                <RefreshCcw className="w-4 h-4" />
                随机颜色
              </button>
            </div>
          </div>

          <div className="glass-card p-6 md:p-8 animate-fade-in-up">
            <h3 className="font-semibold text-brand-text mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-spectrum-gradient" />
              转换结果
            </h3>
            <div className="space-y-2">
              {SPACES.map(({ key, label }) => {
                const value = formatColorValue(key, formats);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-colors"
                  >
                    <div className="w-20 flex-shrink-0">
                      <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-mono text-brand-text truncate">{value}</span>
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
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-5">
            <History className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text">历史记录</h3>
            <span className="text-xs text-brand-muted ml-2">点击色块恢复</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {colorHistory.length === 0 ? (
              <p className="text-sm text-brand-muted py-2">暂无历史颜色</p>
            ) : (
              colorHistory.map((item) => (
                <button
                  key={`${item.hex}-${item.timestamp}`}
                  type="button"
                  onClick={() => updateFrom("hex", item.hex)}
                  className="group relative flex flex-col items-center gap-1 transition-transform hover:scale-110"
                  title={item.hex}
                >
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white/15 shadow-card group-hover:border-white/40 group-hover:shadow-lg transition-all"
                    style={{
                      background: item.hex,
                      boxShadow: `0 2px 12px ${item.hex}40`,
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
