import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 全屏图片灯箱（点击图片放大预览）。
 *
 * 交互（对齐微信 / 相册的习惯）：
 *   - 点击遮罩 **或图片本身** → 关闭（所以「再点一下就回到聊天窗」是同一套逻辑）
 *   - Esc 键 / 右上角 X → 关闭
 *   - 打开期间锁 body 滚动，避免背景跟着滚
 *
 * ⚠️ 必须挂在**页面顶层**（Workspace 根部），不能塞进消息卡片里。
 * 消息卡片的根节点带 `animate-fade-in-up`，而该动画是
 * `fadeInUp 0.45s ease-out both` —— `both` 让元素在动画结束后**保留**
 * `transform: translateY(0)`。只要 transform 不是 `none`，就会成为
 * `position: fixed` 的包含块，灯箱会被限制在**卡片内部**而不是铺满视口。
 * 同目录下的摄像头弹窗 / 登录引导弹窗也是因此挂在顶层。
 */
export interface ImageLightboxProps {
  src: string;
  /** 底部小标签，如「校正后 ·方案 1」。省略则不显示 */
  label?: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, label, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in-up"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label || '图片预览'}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="关闭预览"
      >
        <X className="w-6 h-6" />
      </button>

      {/*
        图片不 stopPropagation：点它 = 点遮罩 = 关闭。
        鼠标指针给 zoom-out，暗示「再点一下退出」。
      */}
      <img
        src={src}
        alt={label || '预览图'}
        className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl cursor-zoom-out"
      />

      {label && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/12 text-white/90 text-xs backdrop-blur-sm pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}
