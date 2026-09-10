/**
 * useSession — Workspace 会话状态管理 hook
 *
 * 职责：会话列表、消息、上下文、自动保存、切换/新建/删除
 * 与 UI 渲染完全解耦，返回纯状态 + 操作方法
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { sessionService } from '@/services/sessionService';
import type { ChatSessionDTO } from '@/services/sessionService';
import type { ChatMessage } from '@/services/chatService';
import type { Message } from '@/types';
import { uid } from '@/lib/uid';
import { welcomeMsg, titleOf, stripWelcome, toSessionMeta } from '@/utils/workspace';

export interface UseSessionOptions {
  /** 是否跳过恢复最近会话（首页「立即体验」传 true） */
  startNew?: boolean;
}

export function useSession({ startNew = false }: UseSessionOptions = {}) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMsg()]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  /** 自动保存防抖计时器 */
  const saveTimer = useRef<number | null>(null);
  /** 并发切换序号：只采纳最后一次加载结果 */
  const openSeq = useRef(0);
  /** 加载期间跳过自动落库 */
  const skipAutoSaveRef = useRef(false);
  /** 最新现场快照（flush/卸载兜底用） */
  const liveRef = useRef({
    activeId: null as string | null,
    messages: [] as Message[],
    chatHistory: [] as ChatMessage[],
  });
  liveRef.current = { activeId, messages, chatHistory };

  // ——— 初始化：拉取列表，按需恢复最近会话 ———
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await sessionService.list();
        if (!alive) return;
        setSessions(list);
        if (startNew || list.length === 0) return;
        const recent = list[0];
        skipAutoSaveRef.current = true;
        setActiveId(recent.id);
        const detail = await sessionService.get(recent.id);
        if (!alive) return;
        const ms = (detail?.messages ?? []) as Message[];
        setMessages(ms.length ? ms : [welcomeMsg()]);
        setChatHistory((detail?.history ?? []) as ChatMessage[]);
      } catch {
        /* 保持新对话欢迎首屏 */
      }
    })();
    return () => { alive = false; };
  }, []);

  // ——— 自动保存（400ms 防抖） ———
  useEffect(() => {
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    if (activeId === null) {
      const hasReal = messages.some((m) => !(m.role === 'assistant' && m.type === 'welcome'));
      if (!hasReal) return;
      setActiveId(uid());
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void (async () => {
        try {
          const saved = await sessionService.save({
            id: activeId,
            title: titleOf(messages),
            messages: stripWelcome(messages),
            history: chatHistory,
          });
          if (saved) {
            setSessions((prev) => [toSessionMeta(saved), ...prev.filter((s) => s.id !== saved.id)]);
          }
        } catch { /* 下次重试 */ }
      })();
    }, 400);
  }, [messages, chatHistory, activeId]);

  // ——— 离开页面兜底保存 ———
  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const { activeId: id, messages: ms, chatHistory: hist } = liveRef.current;
      if (id === null) return;
      if (!ms.some((m) => !(m.role === 'assistant' && m.type === 'welcome'))) return;
      void sessionService
        .save({ id, title: titleOf(ms), messages: stripWelcome(ms), history: hist })
        .catch(() => undefined);
    };
  }, []);

  // ——— 操作方法 ———

  /** 立即保存（切换/新建前调用，防抖窗口内不丢数据） */
  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const { activeId: id, messages: ms, chatHistory: hist } = liveRef.current;
    if (id === null) return;
    if (!ms.some((m) => !(m.role === 'assistant' && m.type === 'welcome'))) return;
    try {
      await sessionService.save({
        id,
        title: titleOf(ms),
        messages: stripWelcome(ms),
        history: hist,
      });
    } catch { /* 兜底不阻塞 */ }
  }, []);

  /** 切换到指定会话 */
  const switchSession = useCallback(async (targetId: string) => {
    await flushSave();
    const seq = ++openSeq.current;
    skipAutoSaveRef.current = true;
    setActiveId(targetId);
    setMessages([welcomeMsg()]);
    setChatHistory([]);
    try {
      const detail = await sessionService.get(targetId);
      if (seq !== openSeq.current) return; // 已被更新的切换覆盖
      const ms = (detail?.messages ?? []) as Message[];
      setMessages(ms.length ? ms : [welcomeMsg()]);
      setChatHistory((detail?.history ?? []) as ChatMessage[]);
    } catch { /* 保持欢迎首屏 */ }
  }, [flushSave]);

  /** 新建空会话 */
  const createSession = useCallback(async () => {
    await flushSave();
    const newId = uid();
    setActiveId(newId);
    setMessages([welcomeMsg()]);
    setChatHistory([]);
  }, [flushSave]);

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
    flushSave,
    switchSession,
    createSession,
    deleteSession,
    /** 共享 refs（自动保存/滚动等） */
    saveTimer,
    liveRef,
    skipAutoSaveRef,
  };
}
