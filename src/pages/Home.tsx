import { useState } from 'react';
import ColorDots from '@/components/ColorDots';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

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

/** 预载目标图，保证翻阅转场时新图已就绪 */
function preload(src: string) {
  const img = new Image();
  img.src = src;
}

export default function Home() {
  const navigate = useNavigate();
  const total = SAMPLES.length;
  /** exit：正在滑出模糊的旧图索引；dir：翻阅方向（1 前进 / -1 后退） */
  const [view, setView] = useState<{ cur: number; exit: number | null; dir: 1 | -1 }>({
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

  return (
    <div className="min-h-screen bg-brand-paper">
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

        <div className="relative container grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center pt-24 md:pt-28 pb-16 md:pb-24 px-4 lg:px-8">
          {/* 左侧文案 */}
          <div className="text-left">
            <p className="eyebrow">
              <ColorDots size={8} />
              Ququan Color Lab
            </p>

            <h1
              className="font-serif font-bold text-brand-ink leading-[1.12] mt-6 mb-6"
              style={{ fontSize: 'clamp(48px, 7.5vw, 76px)' }}
            >
              曲泉AI
            </h1>

            <p className="text-brand-muted text-lg md:text-xl leading-relaxed max-w-xl mb-4">
              为设计师与摄影师的色彩实验室——一键校色、精准取色、
              六维色彩空间互转、ΔE 色差量化，
              <span className="text-brand-ink font-medium">
                让屏幕里的每一帧颜色，都被准确看见
              </span>
            </p>

            <div className="flex flex-wrap gap-4 mt-9">
              <button
                onClick={() => navigate('/workspace')}
                className="btn-primary !px-8 !py-3.5 text-[15px]"
              >
                立即体验
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/community')} className="btn-secondary !px-8 !py-3.5 text-[15px]">
                色研社区
              </button>
            </div>

            {/* 研究数据带 */}
            <dl className="mt-14 pt-7 border-t border-brand-line grid grid-cols-3 gap-6 max-w-lg">
              {[
                { num: 'ΔE ≤ 2.0', label: '专业级色差判定' },
                { num: '6', label: '色彩空间同步互转' },
                { num: 'CMYK·Lab', label: '印刷级色彩标准' },
              ].map((s) => (
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

          {/* 右侧：色彩样张翻阅（向左滑出模糊转场） */}
          <div className="relative max-w-[420px] w-full mx-auto lg:mx-0 lg:justify-self-end py-6">
            <div
              role="group"
              aria-roledescription="色彩样张"
              aria-label={`正在展示第 ${view.cur + 1} 张，共 ${total} 张`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(1);
                else if (e.key === 'ArrowLeft') go(-1);
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
            <div className="mt-4 flex items-center gap-1">
              <button
                onClick={() => go(-1)}
                aria-label="上一张"
                className="p-1.5 -ml-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {SAMPLES.map((s, i) => (
                  <button
                    key={s.src}
                    onClick={() => jumpTo(i)}
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
                onClick={() => go(1)}
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
        </div>
      </section>
    </div>
  );
}
