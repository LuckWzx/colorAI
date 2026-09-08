import { useState, useRef } from 'react';
import ColorDots from '@/components/ColorDots';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';

/**
 * 首页 Hero 展示素材（演示占位）。
 * TODO: 后续替换正式素材时，仅需更新 SAMPLES 数组的 src 与 name。
 */
const SAMPLES = [
  { src: '/uploads/Ln4ZouX2zsnGiHiZVUBJaW4vd4Bzj3USoXCbbMXVFgd2SQLgf_ZTCyFe0ERXtZCyrV2TtxTJhrfLS69eVj5cX7sG2Z718ZBm5QE4u4luYgrmRODx8-bg7jevFkvnr-PGoBR3UhbkGpDHVSgz5C-ZwsPpxCn422N_M1bCrYjH8L0phNJb-eWW5HJZjP1UuMOx.jpg', name: '演示样张 01' },
  { src: '/uploads/oY3f1YptJgsPelrGGggpiyWLxdNaHXSIrrT3GLi_fLuUtbLDpxM5TFL8hxi_xYcggix20JGkDU0GdRG8MZCYVdVbSvqpRDXutNcbi03I-5XrnNuFHa9lgoUHK_bg4DvmqxVUx7nktqiUqBGGU2TY1M-NV-3ymqFJGsuA8w2rSRBjEu0SdYk965IhJRWdbS1f.jpg', name: '演示样张 02' },
  { src: '/uploads/E9DfNEiOJ8PkrAqheZMa-zUfcHI5PCOrXsIAy_yfRTfntTszlAR_Jn2uADHbwyLTsexPw-SViakbkOjHnl0MkNjbTaY8I7ns9tA_Nt8QEOY7Aip9exrsKf5Lhc0n76tfR-zSHT7i6005M3RD3GzN9p2Jk7E6nOFyQDv_STBC924.jpg', name: '演示样张 03' },
  { src: '/uploads/RXEYgMKddYNLbmRi6ehlpU9cZJ3H5I0rM7qIrvnkMDes8z3rnNwnxWzyVIXBBPbLP35Hd5jsFuRI9SXeAG7QD4jQATM7sNujcSX6xTCcbmSjwaGQ2xbA__1ZP_E695eZ6Lsp_0zhLeSiLsF7gJaR_PCV3WEu4OU7TWqikpu6TAg.jpg', name: '演示样张 04' },
];

/** 桌面端研究数据带：值 + 完整说明 */
const STATS_DESKTOP = [
  { num: 'ΔE ≤ 2.0', label: '专业级色差判定' },
  { num: '6', label: '色彩空间同步互转' },
  { num: 'CMYK·Lab', label: '印刷级色彩标准' },
];

/** 移动端首屏精简数据行（一行放得下） */
const STATS_MOBILE = [
  { num: 'ΔE≤2.0', label: '专业色差' },
  { num: '6', label: '空间互转' },
  { num: 'CMYK·Lab', label: '印刷标准' },
];

type ViewState = { cur: number; exit: number | null; dir: 1 | -1 };

/** 预载目标图，保证翻阅转场时新图已就绪 */
function preload(src: string) {
  const img = new Image();
  img.src = src;
}

/** 品牌标题组：eyebrow + 主标题 + 一句话定位（移动 / 桌面共用文案）
 *  onImage：浮在样张背景上时用深墨色文字 + 品牌色高亮，保证对雾底的可读性 */
function HeroCopy({ onImage = false }: { onImage?: boolean }) {
  return (
    <>
      <p className={`eyebrow ${onImage ? 'text-brand-ink' : ''}`}>
        <ColorDots size={8} />
        Ququan Color Lab
      </p>
      <h1
        className="font-serif font-bold text-brand-ink leading-[1.1] mt-3 mb-3 lg:mt-5 lg:mb-5"
        style={{ fontSize: 'clamp(40px, 11vw, 76px)' }}
      >
        曲泉AI
      </h1>
      <p
        className={`text-[15px] leading-[1.65] lg:text-xl lg:leading-relaxed max-w-xl ${
          onImage ? 'text-brand-ink' : 'text-brand-muted'
        }`}
      >
        为设计师与摄影师的色彩实验室——一键校色、精准取色、
        六维色彩空间互转、ΔE 色差量化，
        <span
          className={
            onImage ? 'text-brand-primary font-semibold' : 'text-brand-ink font-medium'
          }
        >
          让屏幕里的每一帧颜色，都被准确看见
        </span>
      </p>
    </>
  );
}

/** 主 CTA：立即体验（工作台）/ 色研社区；stretch 为移动端通栏等分样式 */
function CTARow({
  onWorkspace,
  onCommunity,
  stretch = false,
  className = '',
}: {
  onWorkspace: () => void;
  onCommunity: () => void;
  stretch?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} ${stretch ? 'flex gap-3 mt-4' : 'flex flex-wrap gap-4 mt-9'}`}>
      <button
        onClick={onWorkspace}
        className={`btn-primary ${stretch ? 'flex-1 !px-4 !py-3 text-[15px]' : '!px-8 !py-3.5 text-[15px]'}`}
      >
        立即体验
        <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={onCommunity}
        className={`btn-secondary ${stretch ? 'flex-1 !px-4 !py-3 text-[15px]' : '!px-8 !py-3.5 text-[15px]'}`}
      >
        色研社区
      </button>
    </div>
  );
}

/**
 * 样张翻阅组件（桌面端右栏）：aspect-[4/5] 竖卡 + 底部图注；
 * 移动端样张已改为全屏背景，见 BackdropPlate。
 */
function PlateViewer({
  view,
  onGo,
  onJump,
}: {
  view: ViewState;
  onGo: (dir: 1 | -1) => void;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex flex-col w-full">
      <div
        role="group"
        aria-roledescription="色彩样张"
        aria-label={`正在展示第 ${view.cur + 1} 张，共 ${SAMPLES.length} 张`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onGo(1);
          else if (e.key === 'ArrowLeft') onGo(-1);
        }}
        className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-brand-line bg-brand-surface shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 select-none"
      >
        {/* 旧图：向左（或向右）滑出并模糊。
            opacity-0 兜底：若动画未执行（系统减少动效/后台节流），旧图直接隐藏，新图立即可见 */}
        {view.exit !== null && (
          <img
            key={`out-${view.exit}`}
            src={SAMPLES[view.exit].src}
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-cover opacity-0 ${view.dir === 1 ? 'plate-out-l' : 'plate-out-r'}`}
          />
        )}
        {/* 当前图：从右侧（或左侧）滑入并清晰 */}
        <img
          key={`cur-${view.cur}`}
          src={SAMPLES[view.cur].src}
          alt={SAMPLES[view.cur].name}
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover ${
            view.exit !== null ? (view.dir === 1 ? 'plate-in-r' : 'plate-in-l') : ''
          }`}
        />
        {/* 右上角编号签 */}
        <span className="absolute top-3 right-3 pointer-events-none font-mono text-[10px] tracking-[0.2em] text-brand-ink/70 bg-white/85 border border-brand-line/70 rounded-md px-2 py-1">
          PLATE {String(view.cur + 1).padStart(2, '0')}
        </span>
      </div>

      {/* 翻阅工具条：上一张 / 位置点 / 下一张 */}
      <div className="flex items-center gap-1 shrink-0 mt-4">
        <button
          onClick={() => onGo(-1)}
          aria-label="上一张"
          className="p-1.5 -ml-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {SAMPLES.map((s, i) => (
            <button
              key={s.src}
              onClick={() => onJump(i)}
              aria-label={`查看第 ${i + 1} 张`}
              aria-current={i === view.cur}
              title={s.name}
              className="group flex items-center justify-center p-1.5"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 group-hover:scale-[1.8] ${
                  i === view.cur
                    ? 'w-5 bg-brand-primary'
                    : 'w-1.5 bg-brand-lineStrong/70 group-hover:bg-brand-faint'
                }`}
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => onGo(1)}
          aria-label="下一张"
          className="p-1.5 -mr-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 标本图注 */}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-brand-faint text-center">
        Plate {String(view.cur + 1).padStart(2, '0')} · {SAMPLES[view.cur].name}
      </p>
    </div>
  );
}

/**
 * 移动端全屏背景样张：铺满 Hero 的同图双层——底层清晰原图，顶层同图模糊后
 * mask 顶部实底向下渐隐，让文字区背后的图柔化成色雾，并平滑过渡回清晰原图。
 */
function BackdropPlate({ view }: { view: ViewState }) {
  /** 模糊区跟随中部文字带：顶部短留清晰 → 8% 起淡入 → 48% 实区 → 72% 淡出 */
  const mask = 'linear-gradient(to bottom, transparent 0%, black 8%, black 48%, transparent 72%)';
  return (
    <div className="absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      {/* 旧图：向左（右）滑出并模糊，露出下方新图（opacity-0 为动画未执行时的兜底） */}
      {view.exit !== null && (
        <img
          key={`out-${view.exit}`}
          src={SAMPLES[view.exit].src}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover opacity-0 ${view.dir === 1 ? 'plate-out-l' : 'plate-out-r'}`}
        />
      )}
      {/* 当前主图：下半屏清晰展示 */}
      <img
        key={`cur-${view.cur}`}
        src={SAMPLES[view.cur].src}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* 同图模糊层：仅顶部文字区可见，聚焦文字的柔雾 */}
      <img
        key={`blur-${view.cur}`}
        src={SAMPLES[view.cur].src}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          filter: 'blur(16px)',
          transform: 'scale(1.08)', // 放大补偿模糊边缘透底
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
      {/* 纸色淡雾：叠加在模糊带上保证文字对比度（自身 alpha 起止透明，无需 mask） */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(244,245,243,0) 0%, rgba(244,245,243,0.46) 24%, rgba(244,245,243,0.46) 46%, rgba(244,245,243,0.14) 58%, rgba(244,245,243,0) 76%)',
        }}
      />
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const total = SAMPLES.length;
  /** 手动滑动换图：记录触摸起点 X，结束时按位移方向翻页 */
  const touchStartX = useRef<number | null>(null);
  /** exit：正在滑出模糊的旧图索引；dir：翻阅方向（1 前进 / -1 后退） */
  const [view, setView] = useState<ViewState>({
    cur: 0,
    exit: null,
    dir: 1,
  });

  const go = (dir: 1 | -1) => {
    // 事件处理器内直接读当前视图，切换即时可靠
    const cur = view.cur;
    const next = (cur + dir + total) % total;
    // 预载翻页后相邻的两张，保证连续翻阅流畅
    preload(SAMPLES[(next + 1) % total].src);
    preload(SAMPLES[(next - 1 + total) % total].src);
    setView({ cur: next, exit: cur, dir });
    clearExitAfter(cur);
  };

  const jumpTo = (i: number) => {
    const cur = view.cur;
    if (i === cur) return;
    const fwd = (i - cur + total) % total;
    setView({ cur: i, exit: cur, dir: fwd <= total / 2 ? 1 : -1 });
    clearExitAfter(cur);
  };

  /**
   * 退出图动画结束后定时移除（不依赖 animationend 事件，
   * 避免页面被节流/后台时事件丢失导致旧图残留覆盖新图）
   */
  const clearExitAfter = (exitIdx: number) => {
    window.setTimeout(() => {
      setView((v) => (v.exit === exitIdx ? { ...v, exit: null } : v));
    }, 550);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
  };

  const goWorkspace = () => navigate('/workspace');
  const goCommunity = () => navigate('/community');

  return (
    <div className="bg-brand-paper">
      {/* ==================== Hero ==================== */}
      <section className="relative overflow-hidden">
        {/* 坐标纸底纹（向下渐隐） */}
        <div
          className="graph-grid absolute inset-0 pointer-events-none"
          style={{
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
          }}
        />

        {/* —— H5 移动版：样张铺满作背景；文字带整体下移，CTA 落在屏幕中部 ——
            高度 = 100dvh - 150px（Navbar 占位 64 + Footer ≈86），保证首屏零滚动 */}
        <div
          className="lg:hidden relative overflow-hidden"
          style={{ height: 'calc(100dvh - 150px)' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <BackdropPlate view={view} />

          {/* 浮层文案：标题 → 数据一行 → CTA（距顶 13%，整体重心居中偏上，上下留白均衡） */}
          <div className="absolute inset-x-0 z-10 px-4" style={{ top: '13%' }}>
            <HeroCopy onImage />

            <div className="flex items-center justify-center gap-x-3 mt-5">
              {STATS_MOBILE.map((s, i) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-brand-ink/35 mx-1 select-none" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="font-mono text-xs font-semibold text-brand-ink tabular-nums">
                    {s.num}
                  </span>
                  <span className="text-[11px] text-brand-ink/80">{s.label}</span>
                </span>
              ))}
            </div>

            <CTARow onWorkspace={goWorkspace} onCommunity={goCommunity} stretch />
          </div>

          {/* 滑动换图提示：首屏短暂出现后自动淡出 */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-20"
            aria-hidden="true"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/70 border border-white/60 backdrop-blur-sm text-[11px] tracking-[0.12em] text-brand-ink/70 shadow-sm animate-[hintFade_4.2s_ease_forwards]">
              <MoveHorizontal className="w-3.5 h-3.5" />
              左右滑动切换样张
            </span>
          </div>
        </div>

        {/* —— 桌面版：左侧文案 + 右侧样张翻阅（内容垂直居中，触屏设备同样支持滑动） —— */}
        <div
          className="hidden lg:block relative"
          style={{ height: 'calc(100dvh - 150px)' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="container grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center h-full px-4 lg:px-8">
            {/* 左侧文案 */}
            <div className="text-left">
              <HeroCopy />

              <CTARow onWorkspace={goWorkspace} onCommunity={goCommunity} />

              {/* 研究数据带 */}
              <dl className="mt-14 pt-7 border-t border-brand-line grid grid-cols-3 gap-6 max-w-lg">
                {STATS_DESKTOP.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-mono text-xl md:text-[22px] font-semibold text-brand-ink tabular-nums">
                      {s.num}
                    </dd>
                    <dd className="text-xs text-brand-faint mt-1.5 leading-snug">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* 右侧：色彩样张翻阅 */}
            <div className="max-w-[420px] w-full mx-auto lg:mx-0 lg:justify-self-end">
              <PlateViewer view={view} onGo={go} onJump={jumpTo} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
