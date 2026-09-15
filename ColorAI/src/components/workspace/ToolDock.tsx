/**
 * 工具坞：顶部功能标签 + 更多工具面板
 */

import { LayoutGrid, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOCK_CHAT, DOCK_ALL } from '@/constants/workspace';
import type { DockItem } from '@/constants/workspace';

interface ToolDockProps {
  selectedFeature: string | null;
  onSelect: (item: DockItem) => void;
}

export default function ToolDock({ selectedFeature, onSelect }: ToolDockProps) {
  const moreOpenId = '__more__';

  return (
    <>
      {/* 常驻工具标签 */}
      <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 animate-fade-in-up">
        {DOCK_CHAT.map((item) => {
          const Icon = item.icon;
          const active = selectedFeature === item.key;
          // 后端未实现的能力：置灰并标注，避免用户点进去得到「功能还没上线」
          const disabled = !item.available;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (!disabled) onSelect(item);
              }}
              disabled={disabled}
              title={disabled ? '该功能尚未上线，敬请期待' : undefined}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                disabled
                  ? 'border-brand-line bg-brand-paper text-brand-faint cursor-not-allowed'
                  : active
                    ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                    : 'border-brand-line bg-brand-surface text-brand-muted hover:text-brand-ink hover:border-brand-lineStrong'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.title}
              {disabled && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-brand-line/70 text-brand-muted">开发中</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => onSelect({ id: moreOpenId, kind: 'chat', key: moreOpenId, title: '更多', desc: '', icon: LayoutGrid, color: '', available: true })}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
            'border-brand-line bg-brand-surface text-brand-muted hover:text-brand-ink hover:border-brand-lineStrong'
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          更多
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

/** 全部工具面板（上拉展开） */
export function ToolDockPanel({
  selectedFeature,
  onSelect,
}: {
  selectedFeature: string | null;
  onSelect: (item: DockItem) => void;
}) {
  return (
    <div className="mb-2.5 rounded-2xl border border-brand-line bg-brand-surface p-2.5 shadow-lift animate-fade-in-up">
      <div className="flex items-center justify-between px-1.5 py-1 mb-1">
        <p className="text-[11px] font-medium text-brand-muted">全部色彩工具</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-brand-faint">{DOCK_ALL.length} tools</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {DOCK_ALL.map((item) => {
          const Icon = item.icon;
          const active = item.kind === 'chat' && selectedFeature === item.key;
          const disabled = !item.available;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (!disabled) onSelect(item);
              }}
              disabled={disabled}
              title={disabled ? '该功能尚未上线，敬请期待' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : active
                    ? 'bg-brand-accent/10 ring-1 ring-inset ring-brand-accent/30'
                    : 'hover:bg-brand-paper'
              )}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color}18` }}
              >
                <Icon className="w-4 h-4" style={{ color: item.color }} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand-ink truncate flex items-center gap-1.5">
                  <span className="truncate">{item.title}</span>
                  {disabled && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-brand-line/70 text-brand-muted shrink-0">开发中</span>
                  )}
                </p>
                <p className="text-[10px] text-brand-muted truncate">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
