/**
 * useSession — Workspace 会话状态管理 hook
 *
 * 职责：会话列表、消息、上下文、切换/新建/删除
 * 消息保存由后端 chat 接口自动完成，前端无需主动保存。
 * 与 UI 渲染完全解耦，返回纯状态 + 操作方法
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { sessionService } from '@/services/sessionService';
import type { ChatSessionDTO } from '@/services/sessionService';
import type { ChatMessage } from '@/services/chatService';
import type { Message } from '@/types';
import { uid } from '@/lib/uid';
import { welcomeMsg } from '@/utils/workspace';

export interface UseSessionOptions {
  /** 是否跳过恢复最近会话（首页「立即体验」传 true） */
  startNew?: boolean;
}

export function useSession({ startNew = false }: UseSessionOptions = {}) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMsg()]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  /** 并发切换序号：只采纳最后一次加载结果 */
  const openSeq = useRef(0);

  // ——— 初始化：拉取列表，默认显示新会话欢迎页 ———
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await sessionService.list();
        if (!alive) return;
        setSessions(list);
        // startNew 为 true 或首次进入时都显示新会话
        // 只有用户主动从侧栏点击历史会话时才恢复
        if (startNew) return;
        // 列表为空也保持新对话
        if (list.length === 0) return;
      } catch {
        /* 保持新对话欢迎首屏 */
      }
    })();
    return () => { alive = false; };
  }, []);

  // ——— 操作方法 ———

  /** 切换到指定会话 */
  const switchSession = useCallback(async (targetId: string) => {
    if (targetId === activeId) return;
    const seq = ++openSeq.current;
    try {
      const detail = await sessionService.get(targetId);
      if (seq !== openSeq.current) return;
      const ms = (detail?.messages ?? []) as Message[];
      setMessages(ms.length ? ms : [welcomeMsg()]);
      setChatHistory((detail?.history ?? []) as ChatMessage[]);
      setActiveId(targetId);
    } catch { /* 保持欢迎首屏 */ }
  }, [activeId]);

  /** 新建空会话 */
  const createSession = useCallback(() => {
    const newId = uid();
    setMessages([welcomeMsg()]);
    setChatHistory([]);
    setActiveId(newId);
  }, []);

  /** 删除会话 */
  const deleteSession = useCallback(async (targetId: string) => {
    await sessionService.remove(targetId).catch(() => undefined);
    setSessions((prev) => prev.filter((s) => s.id !== targetId));
    if (activeId === targetId) {
      setActiveId(null);
      setMessages([welcomeMsg()]);
      setChatHistory([]);
    }
  }, [activeId]);

  return {
    sessions,
    setSessions,
    activeId,
    setActiveId,
    messages,
    setMessages,
    chatHistory,
    setChatHistory,
    switchSession,
    createSession,
    deleteSession,
  };
}
