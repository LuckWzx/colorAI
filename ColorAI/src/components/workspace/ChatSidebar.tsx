/**
 * 会话历史侧栏
 * 桌面端常驻（aside 内嵌）；移动端抽屉复用
 * 新建对话 / 点击切换 / 垃圾桶两步确认删除
 */

import { useState } from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatSessionDTO } from '@/services/sessionService';

/** 会话时间显示：今天 → HH:MM；昨天 → 昨天；今年 → M月D日；更早 → YYYY/M/D */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

interface ChatSidebarProps {
  sessions: ChatSessionDTO[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export default function ChatSidebar({
  sessions,
  activeId,
  onNew,
  onOpen,
  onDelete,
  compact = false,
}: ChatSidebarProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className={cn('shrink-0', compact ? 'px-2.5 pt-2.5 pb-1.5' : 'px-4 pt-5 pb-3')}>
        {!compact && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cmyk-strip shadow-card" />
            <div>
              <p className="font-serif font-bold text-brand-ink leading-none">曲泉AI</p>
              <p className="text-[10px] text-brand-muted mt-1">会话历史</p>
            </div>
          </div>
        )}
        <button
          onClick={onNew}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primaryLight transition-colors active:scale-[0.98]',
            compact ? 'py-1.5' : 'mt-4 py-2'
          )}
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-1">
        {sessions.length === 0 ? (
          <div className="pt-8 pb-6 flex flex-col items-center text-center px-4">
            <MessageSquare className="w-8 h-8 text-brand-lineStrong mb-2" />
            <p className="text-xs text-brand-muted leading-relaxed">
              暂无历史会话
              <br />
              开启一段对话后会自动记录在这里
            </p>
          </div>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeId;
            const confirming = confirmId === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  'group relative flex items-center gap-2.5 pl-3 pr-2 py-2.5 rounded-xl cursor-pointer transition-colors',
                  active ? 'bg-brand-primary/10' : 'hover:bg-brand-paper'
                )}
                onClick={() => {
                  setConfirmId(null);
                  onOpen(s.id);
                }}
              >
                <MessageSquare
                  className={cn(
                    'w-4 h-4 shrink-0',
                    active ? 'text-brand-primary' : 'text-brand-muted group-hover:text-brand-primary'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-[13px] truncate leading-tight',
                      active ? 'text-brand-primary font-semibold' : 'text-brand-ink'
                    )}
                  >
                    {s.title || '新对话'}
                  </p>
                  <p className="text-[10px] text-brand-faint mt-0.5">
                    {fmtTime(s.updatedAt)} · {s.messageCount} 条消息
                  </p>
                </div>
                {confirming ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setConfirmId(null); onDelete(s.id); }}
                      className="px-2 py-1 rounded-lg bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors"
                    >
                      删除
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-2 py-1 rounded-lg text-brand-muted text-[11px] hover:bg-brand-line/60 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmId(s.id); }}
                    className={cn(
                      'p-1.5 rounded-lg shrink-0 transition-colors',
                      active ? 'text-brand-muted' : 'text-brand-faint',
                      !active && 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                    )}
                    aria-label="删除会话"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
