import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageZoom } from '@/store/imageZoomStore';

/**
 * 带「过期兜底」的图片组件。
 *
 * 背景：图片存的是**完整 URL**（本地磁盘 / 后期阿里云 OSS），URL 会过期。
 * 过期后历史回放时图片就拉不到了，这里统一展示一个「已过期」占位样式。
 *
 * 关键设计：`<img onError>` 会对**任何**失败触发 —— 包括网络抖动、用户断网、
 * CDN 临时 5xx。一失败就判定「已过期」会误导用户，所以**先重试一次**，
 * 连续两次都失败才判定为过期。
 *
 * 外层容器带 `min-height`，避免图片挂掉后容器塌陷、把消息列表顶得跳动。
 */

type Status = 'loading' | 'retrying' | 'expired';

const RETRY_DELAY_MS = 1500;

export interface SmartImageProps {
  src?: string;
  alt?: string;
  /** 传给 <img> 的样式 */
  className?: string;
  /** 外层容器样式，可用来覆盖 min-height */
  wrapperClassName?: string;
  /** 过期占位文案 */
  expiredText?: string;
  /**
   * 是否可点击放大。**默认开启** —— 全站图片统一具备放大能力，
   * 新功能（图片对比、取色…）只要用 `SmartImage` 就自动获得，无需任何额外接线。
   * 纯装饰性缩略图可以传 `false` 关掉。
   */
  zoomable?: boolean;
  /**
   * 自定义放大行为，**覆盖**默认的全局灯箱（一般不用传）。
   * 传了就完全走这个回调，不再写全局 store。
   */
  onZoom?: (src: string, label?: string) => void;
}

export default function SmartImage({
  src,
  alt = '',
  className = '',
  wrapperClassName = '',
  expiredText = '图片已过期',
  zoomable = true,
  onZoom,
}: SmartImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const timerRef = useRef<number | null>(null);

  // src 变了（例如切换候选图）就重置状态，否则会沿用上一张图的过期态
  useEffect(() => {
    setAttempt(0);
    setStatus('loading');
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [src]);

  const handleError = () => {
    if (attempt === 0) {
      // 第一次失败 → 延时重试一次
      setStatus('retrying');
      timerRef.current = window.setTimeout(() => {
        setAttempt(1);
        setStatus('loading');
      }, RETRY_DELAY_MS);
    } else {
      // 重试仍失败 → 判定过期
      setStatus('expired');
    }
  };

  // 可放大 = 有图 + 没过期 + 没被关掉。默认走全局灯箱，`onZoom` 可覆盖。
  const zoomGlobal = useImageZoom();
  const zoomSrc = src && status !== 'expired' ? src : null;
  const handleZoom =
    zoomable && zoomSrc ? () => (onZoom ?? zoomGlobal)(zoomSrc, alt) : undefined;

  const shell = cn(
    'relative w-full rounded-xl border flex items-center justify-center overflow-hidden',
    'min-h-[160px]',
    handleZoom &&
      'group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
    wrapperClassName,
  );

  if (!src || status === 'expired') {
    return (
      <div className={cn(shell, 'border-dashed border-brand-line bg-brand-paper/60')}>
        <div className="flex flex-col items-center gap-1.5 text-brand-muted py-6">
          <ImageOff className="w-6 h-6" />
          <span className="text-xs">{src ? expiredText : '暂无图片'}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={shell}
      onClick={handleZoom}
      onKeyDown={
        handleZoom
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleZoom();
              }
            }
          : undefined
      }
      role={handleZoom ? 'button' : undefined}
      tabIndex={handleZoom ? 0 : undefined}
      aria-label={handleZoom ? (alt ? `${alt}，点击放大` : '点击放大') : undefined}
    >
      <img
        // 换 key 强制 <img> 重新挂载，否则同一个 src 浏览器不会重新请求
        key={attempt}
        src={src}
        alt={alt}
        className={className}
        onError={handleError}
      />
      {status === 'retrying' && (
        <div className="absolute flex items-center gap-1.5 text-xs text-brand-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          重新加载中
        </div>
      )}
      {/* 放大提示：pointer-events-none 保证不挡住外层点击 */}
      {handleZoom && (
        <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-ink/70 text-white text-[11px] backdrop-blur-sm">
            <Maximize2 className="w-3 h-3" />
            点击放大
          </span>
        </div>
      )}
    </div>
  );
}
