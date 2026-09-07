import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  Lightbulb,
  Loader2,
  Download,
  Ribbon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorService } from '@/services/colorService';
import type { PhoneCorrectResponse } from '@/types';

type DeviceOption = 'ios' | 'android' | 'auto';
type SceneOption = 'outdoor' | 'indoor' | 'studio' | 'night';

interface AdjustmentBarProps {
  label: string;
  value: number;
  suffix?: string;
  fromColor: string;
  toColor: string;
  trackColor?: string;
}

function AdjustmentBar({
  label,
  value,
  suffix = '%',
  fromColor,
  toColor,
  trackColor,
}: AdjustmentBarProps) {
  const absValue = Math.abs(value);
  const isPositive = value >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-brand-text/90 font-medium">{label}</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            value > 0 ? 'text-brand-accentLight' : value < 0 ? 'text-brand-teal' : 'text-brand-muted'
          )}
        >
          {value > 0 ? '+' : ''}
          {value}
          {suffix}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
        <div
          className={cn(
            'absolute top-0 h-full rounded-full transition-all duration-700 ease-out',
            trackColor || (isPositive ? toColor : fromColor)
          )}
          style={{
            width: `${Math.min(absValue, 100)}%`,
            left: isPositive ? '50%' : `${50 - Math.min(absValue, 100)}%`,
            background: isPositive
              ? `linear-gradient(to right, rgba(255,255,255,0.1), ${toColor})`
              : `linear-gradient(to right, ${fromColor}, rgba(255,255,255,0.1))`,
          }}
        />
      </div>
    </div>
  );
}

export default function PhoneCorrection() {
  const [file, setFile] = useState<File | null>(null);
  const [device, setDevice] = useState<DeviceOption>('auto');
  const [scene, setScene] = useState<SceneOption>('outdoor');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhoneCorrectResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = useCallback((f: File | null) => {
    if (!f) return;
    if (!/image\/(jpeg|png|webp)/i.test(f.type)) return;
    setFile(f);
    setResult(null);
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    handleFilePick(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0] || null;
    handleFilePick(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const handleStart = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await colorService.phoneCorrectImage(file, device, scene);
      setResult(res);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async () => {
    if (!result?.correctedUrl) return;
    try {
      const res = await fetch(result.correctedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visual-corrected-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(result.correctedUrl, '_blank');
    }
  };

  const fileSize = file ? (file.size / 1024).toFixed(file.size > 1024 ? 1 : 0) : '0';
  const fileSizeUnit = file && file.size > 1024 * 1024 ? ' MB' : ' KB';
  const displaySize = file && file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) : fileSize;

  const devices: { key: DeviceOption; label: string }[] = [
    { key: 'ios', label: 'iOS' },
    { key: 'android', label: 'Android' },
    { key: 'auto', label: '自动检测' },
  ];

  const scenes: { key: SceneOption; label: string }[] = [
    { key: 'outdoor', label: '户外日光' },
    { key: 'indoor', label: '室内灯光' },
    { key: 'studio', label: '影棚' },
    { key: 'night', label: '夜景' },
  ];

  return (
    <div className="relative z-10 min-h-screen bg-brand-darker bg-noise-texture py-12 px-4">
      <div className="container">
        <header className="text-center mb-10 animate-fade-in-up">
          <h1 className="font-serif font-bold mb-4 spectrum-text" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.25rem)' }}>
            手机拍摄校色
          </h1>
          <p className="text-brand-muted text-lg max-w-2xl mx-auto">
            模拟人眼视觉感知，将手机摄像头色彩还原为真实世界颜色
          </p>
        </header>

        <div className="glass-card p-5 mb-6 flex items-start gap-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-brand-text/85 leading-relaxed text-sm md:text-[15px]">
            手机摄像头传感器的ISP算法会对照片进行自动美化导致色偏（例如苹果偏暖、安卓偏饱和），本功能基于人眼视觉模型将色彩校正为与您亲眼所见一致。建议配合户外自然光拍摄效果最佳。
          </p>
        </div>

        <section
          className="glass-card p-6 md:p-8 mb-6 animate-fade-in-up"
          style={{ animationDelay: '160ms' }}
        >
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-14 px-6 text-center',
              isDragging
                ? 'border-brand-accent/70 bg-brand-accent/5 shadow-glow-accent'
                : file
                ? 'border-brand-teal/40 bg-brand-teal/[0.03]'
                : 'border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onInputChange}
            />
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mb-5 transition-all',
                isDragging
                  ? 'bg-brand-accent/20 shadow-glow-accent'
                  : 'bg-white/5 border border-white/10'
              )}
            >
              <Upload
                className={cn(
                  'w-7 h-7 transition-colors',
                  isDragging ? 'text-brand-accent' : 'text-brand-text/70'
                )}
              />
            </div>
            <div className="text-brand-text/90 font-medium mb-1.5">
              拖拽图片到此处，或<span className="text-brand-accent underline underline-offset-2 mx-1">点击上传</span>
            </div>
            <div className="text-brand-muted text-xs">支持 JPG / PNG / WEBP 格式</div>
          </div>

          {file && (
            <div className="mt-5 flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-brand-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-brand-text/90 text-sm font-medium truncate">{file.name}</div>
                  <div className="text-brand-muted text-xs">{displaySize}{fileSizeUnit}</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="text-brand-muted hover:text-brand-accent text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              >
                移除
              </button>
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <div className="text-brand-text/80 text-sm font-medium mb-3">设备选择</div>
              <div className="flex flex-wrap gap-2">
                {devices.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDevice(d.key)}
                    className={cn('btn-pill', device === d.key && 'btn-pill-active')}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-brand-text/80 text-sm font-medium mb-3">场景选择</div>
              <div className="flex flex-wrap gap-2">
                {scenes.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setScene(s.key)}
                    className={cn('btn-pill', scene === s.key && 'btn-pill-active')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleStart}
              disabled={!file || loading}
              className={cn(
                'btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-[220px]',
                loading && 'pointer-events-none'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  校色中...
                </>
              ) : (
                '开始视觉校色'
              )}
            </button>
          </div>
        </section>

        {result && (
          <section className="space-y-6 animate-fade-in-up">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="glass-card p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-brand-text/85">
                    手机直出（原图）
                  </div>
                </div>
                <div className="aspect-video rounded-xl overflow-hidden bg-black/30 border border-white/5">
                  <img
                    src={result.originalUrl}
                    alt="original"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="glass-card p-4 ring-2 ring-amber-400/50 shadow-glow-accent relative overflow-hidden">
                <div className="absolute -top-1 right-4 z-10">
                  <div className="relative">
                    <Ribbon className="w-10 h-10 text-amber-400 fill-amber-400/20" />
                    <span className="absolute inset-0 flex items-center justify-center pt-1 text-[10px] font-bold text-amber-300">
                      推荐
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-xs font-medium text-amber-300">
                    视觉真实
                  </div>
                </div>
                <div className="aspect-video rounded-xl overflow-hidden bg-black/30 border border-amber-400/20">
                  <img
                    src={result.correctedUrl}
                    alt="corrected"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-400/30 text-xs font-medium text-blue-300">
                    标准校正（白平衡基线）
                  </div>
                </div>
                <div className="aspect-video rounded-xl overflow-hidden bg-black/30 border border-blue-400/20">
                  <img
                    src={result.standardUrl}
                    alt="standard"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-semibold text-brand-text/90 mb-5 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-spectrum-gradient" />
                色彩调整参数
              </h3>
              <div className="space-y-5">
                <AdjustmentBar
                  label="红通道偏移"
                  value={result.adjustment.redShift}
                  suffix="%"
                  fromColor="#3B82F6"
                  toColor="#EF4444"
                />
                <AdjustmentBar
                  label="绿通道偏移"
                  value={result.adjustment.greenShift}
                  suffix="%"
                  fromColor="#F97316"
                  toColor="#22C55E"
                />
                <AdjustmentBar
                  label="蓝通道偏移"
                  value={result.adjustment.blueShift}
                  suffix="%"
                  fromColor="#F59E0B"
                  toColor="#3B82F6"
                />
                <AdjustmentBar
                  label="亮度调整"
                  value={result.adjustment.brightness}
                  suffix=""
                  fromColor="#6366F1"
                  toColor="#FACC15"
                />
                <AdjustmentBar
                  label="曝光补偿 EV"
                  value={result.adjustment.exposure}
                  suffix=" EV"
                  fromColor="#8B5CF6"
                  toColor="#D946EF"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center pb-10">
              <button onClick={handleReset} className="btn-secondary">
                重新上传
              </button>
              <button onClick={handleDownload} className="btn-primary">
                <Download className="w-5 h-5" />
                下载视觉校色图
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
