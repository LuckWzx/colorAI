import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export default function SmartImage({
  src,
  alt = '',
  className = '',
  wrapperClassName = '',
  expiredText = '图片已过期',
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

  const shell = cn(
    'relative w-full rounded-xl border flex items-center justify-center overflow-hidden',
    'min-h-[160px]',
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
    <div className={shell}>
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
    </div>
  );
}
