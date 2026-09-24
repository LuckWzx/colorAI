/**
 * 图片放大（灯箱）Store —— 把「点图放大」做成**全站通用能力**。
 *
 * 为什么是 store，而不是 props / Context：
 *   - **props**：每加一张卡片都要从页面一路往下钻（页面 → 消息气泡 → 卡片 → 图片），
 *     加一个功能改三个文件，且漏一处就没效果；
 *   - **Context**：得在 App 外再套一层 Provider，而本项目零 Context，多引入一种范式；
 *   - **store**：任何深度的组件写一行 `const zoom = useImageZoom()` 就能用，
 *     不需要任何父级配合。项目已用 Zustand（`appStore` / `authStore`），风格一致。
 *
 * 全局**只有一个**灯箱实例（`<ImageLightboxHost />` 挂在 App 根部），
 * 所以「同时只能开一张图」是天然成立的，不会出现多个浮层互相打架。
 *
 * 用法：
 *   const zoom = useImageZoom();
 *   <img src={url} onClick={() => zoom(url, '对比图 A')} />
 *
 * 用 `SmartImage` 的话连这行都不用写 —— 它默认就可点放大。
 */
import { create } from 'zustand';

export interface ImageZoomTarget {
  src: string;
  /** 底部小标签，如「校正后 · 方案 1」。省略则不显示 */
  label?: string;
}

interface ImageZoomState {
  target: ImageZoomTarget | null;
  open: (src: string, label?: string) => void;
  close: () => void;
}

export const useImageZoomStore = create<ImageZoomState>((set) => ({
  target: null,
  open: (src, label) => set({ target: { src, label } }),
  close: () => set({ target: null }),
}));

/**
 * 通用入口：拿到「打开灯箱」的函数。
 *
 * 只订阅 action、不订阅 `target`，所以返回的引用**稳定** ——
 * 灯箱开合不会让调用方重渲染。
 */
export function useImageZoom() {
  return useImageZoomStore((s) => s.open);
}

export default useImageZoomStore;
