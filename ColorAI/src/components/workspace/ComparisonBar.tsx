/**
 * 色差对比条：左右对比色值 + ΔE 可视化刻度
 */

interface ComparisonBarProps {
  leftHex: string;
  rightHex: string;
  deltaE: number;
}

export default function ComparisonBar({ leftHex, rightHex, deltaE }: ComparisonBarProps) {
  const pct = Math.min(deltaE / 10, 1) * 100;
  const width = Math.max(pct, 4);
  const color = deltaE < 3 ? '#10b981' : deltaE < 6 ? '#f59e0b' : '#ef4444';
  const suffix = deltaE < 1 ? ' (几乎一致)' : deltaE < 3 ? ' (细微)' : deltaE < 6 ? ' (可辨)' : ' (显著)';

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-brand-paper/60 border border-brand-line">
      <div
        className="w-7 h-7 rounded-lg border border-brand-line shadow-sm shrink-0"
        style={{ background: leftHex }}
      />
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs text-brand-ink">
          {deltaE.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-brand-line/70 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-brand-ink/20" />
        <div
          className="absolute top-0 bottom-0 rounded-r-full transition-all"
          style={{
            left: pct >= 0 ? '50%' : `${50 - width / 2}%`,
            width: `${width / 2}%`,
            background: color,
          }}
        />
      </div>
      <div
        className="w-7 h-7 rounded-lg border border-brand-line shadow-sm shrink-0"
        style={{ background: rightHex }}
      />
    </div>
  );
}
