import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ImagePlus,
  Send,
  Loader2,
  Sparkles,
  X,
  Video,
  Download,
  Copy,
  Check,
  ArrowLeft,
  History,
  Camera,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { colorService } from '@/services/colorService';
import { chatService } from '@/services/chatService';
import { useAppStore } from '@/store/appStore';
import { convertFrom, getColorName, formatColorValue, parseColor, detectColorFormat } from '@/utils/colorConverter';
import { uid } from '@/lib/uid';
import { FEATURES } from '@/constants/workspace';
import type { DockItem } from '@/constants/workspace';
import { dataUrlToFile } from '@/utils/workspace';
import { useSession } from '@/hooks/useSession';
import type { FeatureKey, UserMessage, Message } from '@/types';

import ChatSidebar from '@/components/workspace/ChatSidebar';
import ToolDock, { ToolDockPanel } from '@/components/workspace/ToolDock';

export default function Workspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const startNew = (location.state as { newChat?: boolean } | null)?.newChat === true;
  const setCorrectedImage = useAppStore((s) => s.setCorrectedImage);
  const setPickedColor = useAppStore((s) => s.setPickedColor);

  // —— 会话状态（useSession hook 管理） ——
  const {
    sessions, activeId, messages, chatHistory,
    setMessages, setChatHistory,
    switchSession, createSession, deleteSession,
    flushSave, liveRef, skipAutoSaveRef,
  } = useSession({ startNew });

  // —— UI 状态 ——
  const [input, setInput] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreview, setPendingPreview] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);

  // —— Refs ——
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const secondFileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // —— 消息变更自动滚动到底部 ——
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // —— 工具函数 ——
  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copyToClipboard = (text: string, label = '已复制') => {
    navigator.clipboard?.writeText(text).then(() => showToast(label));
  };

  const handleContinue = useCallback(() => {
    setPendingImages([]);
    setPendingPreview([]);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // —— 会话操作 ——
  const openSession = async (id: string) => {
    if (id === activeId) return;
    await switchSession(id);
    setSelectedFeature(null);
    setPendingImages([]);
    setPendingPreview([]);
    setInput('');
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
    } catch {
      showToast('会话删除失败，请重试');
      return;
    }
    setSelectedFeature(null);
    setPendingImages([]);
    setPendingPreview([]);
    setInput('');
    setSidebarOpen(false);
  };

  const startNewChat = async () => {
    await flushSave();
    createSession();
    setSelectedFeature(null);
    setPendingImages([]);
    setPendingPreview([]);
    setInput('');
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleReset = () => {
    void startNewChat();
  };

  // —— 工具坞选择 ——
  const handleDockSelect = useCallback(
    (item: DockItem) => {
      // "更多"按钮：切换面板展开/收起
      if (item.key === '__more__') {
        setMoreToolsOpen((v) => !v);
        return;
      }
      setMoreToolsOpen(false);
      if (item.kind === 'chat') {
        if (selectedFeature === item.key) {
          setSelectedFeature(null);
          return;
        }
        setSelectedFeature(item.key as FeatureKey);
        setTimeout(() => textareaRef.current?.focus(), 50);
      } else if (item.path) {
        navigate(item.path);
      }
    },
    [navigate, selectedFeature]
  );

  // —— 取色流程核心逻辑 ——
  const runPickWithFile = useCallback(
    async (file: File, previewUrl: string, userText?: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(), role: 'user', createdAt: Date.now(),
          text: userText || '', images: [previewUrl], feature: 'pick' as const,
        },
      ]);

      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: 'assistant', type: 'loading' as const, createdAt: Date.now() },
      ]);

      try {
        const correctRes = await colorService.correctImage(file, 'auto');
        setCorrectedImage(correctRes.correctedImage);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = correctRes.correctedImage;
        await new Promise<void>((res) => { img.onload = () => res(); });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const cx = Math.floor(img.naturalWidth / 2);
        const cy = Math.floor(img.naturalHeight / 2);
        const d = ctx.getImageData(cx, cy, 1, 1).data;
        const color = convertFrom('rgb', { r: d[0], g: d[1], b: d[2] });
        const colorName = getColorName(color.hex);
        setPickedColor(color);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(), role: 'assistant', type: 'pick' as const,
                  text: '已为你分析图片中心主色调，可点击原图任意位置取色，这里是图像中心点颜色：',
                  pickResult: { color, colorName },
                  correctResult: correctRes,
                  createdAt: Date.now(),
                }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: uid(), role: 'assistant', type: 'text' as const, text: '取色失败，请稍后重试。', createdAt: Date.now() }
              : m
          )
        );
      }
    },
    [setCorrectedImage, setPickedColor, setMessages]
  );

  const goToPick = useCallback(
    (imageUrl?: string) => {
      setSelectedFeature('pick');
      setPendingImages([]);
      setPendingPreview([]);
      setInput('');
      if (imageUrl && imageUrl.startsWith('data:')) {
        const file = dataUrlToFile(imageUrl, 'corrected.jpg');
        runPickWithFile(file, imageUrl, '对校色后的图片进行取色');
        return;
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [runPickWithFile]
  );

  // —— 匹配颜色胶自动对比 ——
  const triggerAutoCompare = useCallback(async () => {
    const picked = useAppStore.getState().pickedColor;
    if (!picked) {
      showToast('请先完成取色，再来匹配颜色胶');
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', createdAt: Date.now(), text: '匹配颜色胶', feature: 'compare' as const },
    ]);
    const loadingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', type: 'loading' as const, createdAt: Date.now() },
    ]);
    try {
      const res = await colorService.matchColorGel(picked.hex);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { id: uid(), role: 'assistant', type: 'compare' as const, text: '已基于您刚才取的颜色，从色卡库匹配出最接近的颜色胶：', compareResult: res, createdAt: Date.now() }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { id: uid(), role: 'assistant', type: 'text' as const, text: '颜色胶匹配失败，请稍后重试。', createdAt: Date.now() }
            : m
        )
      );
    }
  }, [setMessages]);

  // —— 附近商家跳转 ——
  const goToShops = useCallback((hex?: string) => {
    const targetHex = hex || useAppStore.getState().pickedColor?.hex;
    const url = targetHex
      ? `/partner-cooperation?color=${encodeURIComponent(targetHex)}`
      : '/partner-cooperation';
    navigate(url);
  }, []);

  // —— 核心消息分发：添加用户消息 + loading + 执行工具逻辑 ——
  const addUserMessageAndRun = async (msg: Omit<UserMessage, 'id' | 'createdAt' | 'role'>) => {
    const userMsg: UserMessage = {
      id: uid(), role: 'user', createdAt: Date.now(), ...msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    const loadingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', type: 'loading' as const, createdAt: Date.now() },
    ]);

    try {
      if (msg.feature === 'correct' && msg.images?.[0]) {
        const file = pendingImages[0];
        const res = await colorService.correctImage(file, 'auto');
        setCorrectedImage(res.correctedImage);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: uid(), role: 'assistant', type: 'correct' as const, correctResult: res, createdAt: Date.now() }
              : m
          )
        );
      } else if (msg.feature === 'pick' && msg.images?.[0]) {
        const file = pendingImages[0];
        const correctRes = await colorService.correctImage(file, 'auto');
        setCorrectedImage(correctRes.correctedImage);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = correctRes.correctedImage;
        await new Promise<void>((res) => { img.onload = () => res(); });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const cx = Math.floor(img.naturalWidth / 2);
        const cy = Math.floor(img.naturalHeight / 2);
        const d = ctx.getImageData(cx, cy, 1, 1).data;
        const color = convertFrom('rgb', { r: d[0], g: d[1], b: d[2] });
        const colorName = getColorName(color.hex);
        setPickedColor(color);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(), role: 'assistant', type: 'pick' as const,
                  text: '已为你分析图片中心主色调，可点击原图任意位置取色，这里是图像中心点颜色：',
                  pickResult: { color, colorName },
                  correctResult: correctRes,
                  createdAt: Date.now(),
                }
              : m
          )
        );
      } else if (msg.feature === 'compare' && msg.images?.length >= 2) {
        const res = await colorService.compareImages(pendingImages[0], pendingImages[1]);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: uid(), role: 'assistant', type: 'compare' as const, compareResult: res, createdAt: Date.now() }
              : m
          )
        );
      } else if (msg.feature === 'convert' && msg.text?.trim()) {
        const text = msg.text.trim();
        const detected = detectColorFormat(text);
        let color;
        try {
          color = parseColor(text);
        } catch {
          color = convertFrom('hex', '#888888');
        }
        const addHistory = useAppStore.getState?.().addColorToHistory;
        if (addHistory && color?.hex) addHistory(color.hex);
        const colorName = getColorName(color.hex);
        const detectLabel: any = detected !== 'unknown' ? detected : 'hex';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(), role: 'assistant', type: 'convert' as const,
                  text: `已识别输入格式：${detectLabel.toUpperCase()}，以下是全部 6 种色彩空间的转换结果：`,
                  convertResult: { input: text, detectedFormat: detectLabel, color, colorName },
                  createdAt: Date.now(),
                }
              : m
          )
        );
      } else if (msg.feature === 'phone' && msg.images?.[0]) {
        const file = pendingImages[0];
        const res = await colorService.phoneCorrectImage(file, 'auto', 'outdoor');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { id: uid(), role: 'assistant', type: 'phone' as const, phoneResult: res, createdAt: Date.now() }
              : m
          )
        );
      } else {
        const userText = msg.text?.trim() || '你好';
        // 用函数式更新获取最新 chatHistory，避免闭包过期
        let latestHistory = chatHistory;
        setChatHistory((prev) => {
          latestHistory = [...prev, { role: 'user', content: userText }];
          return latestHistory;
        });
        try {
          const response = await chatService.chat(userText, latestHistory);
          const assistantText = response.text;
          setChatHistory((prev) => [...prev, { role: 'assistant', content: assistantText }]);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? { id: uid(), role: 'assistant', type: 'text' as const, text: assistantText, createdAt: Date.now() }
                : m
            )
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? { id: uid(), role: 'assistant', type: 'text' as const, text: '抱歉，AI 服务暂时不可用，请稍后重试或选择上方功能卡片使用。', createdAt: Date.now() }
                : m
            )
          );
        }
      }
    } finally {
      setPendingImages([]);
      setPendingPreview([]);
    }
  };

  // —— 文件处理 ——
  const handleFileSelected = (files: FileList | null, allowMultiple = false) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    const toAdd = allowMultiple ? arr.slice(0, 2) : arr.slice(0, 1);
    setPendingImages((prev) => [...prev, ...toAdd].slice(0, 2));
    toAdd.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPendingPreview((prev) => [...prev, url]);
    });
  };

  const removePendingImage = (idx: number) => {
    setPendingPreview((prev) => prev.filter((_, i) => i !== idx));
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // —— 摄像头 ——
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      showToast('无法访问摄像头，请检查权限或改用上传图片');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPendingImages((prev) => [...prev, file].slice(0, 2));
      setPendingPreview((prev) => [...prev, URL.createObjectURL(file)]);
      closeCamera();
    }, 'image/jpeg', 0.92);
  };

  // —— 发送消息 ——
  const handleSend = () => {
    if (selectedFeature === 'convert') {
      const text = input.trim();
      if (!text) {
        showToast('请输入色值，例如 #FF6B35');
        return;
      }
      const detected = detectColorFormat(text);
      if (detected === 'unknown') {
        showToast('无法识别的色值格式，请检查输入');
        return;
      }
    }
    const needImage = ['correct', 'pick', 'phone'].includes(selectedFeature || '');
    const needTwoImages = selectedFeature === 'compare';
    if (needImage && pendingImages.length < 1) {
      showToast('请上传 1 张图片');
      return;
    }
    if (needTwoImages && pendingImages.length < 2) {
      showToast('请上传 2 张图片进行对比');
      return;
    }
    addUserMessageAndRun({
      text: input,
      images: pendingPreview.length ? pendingPreview : undefined,
      feature: selectedFeature || undefined,
    });
    setInput('');
  };

  // —— 计算属性 ——
  const needImages =
    selectedFeature === 'compare'
      ? 2
      : ['correct', 'pick', 'phone'].includes(selectedFeature || '')
        ? 1
        : 0;

  const featureHint = (() => {
    if (!selectedFeature) return null;
    if (needImages > 0 && pendingPreview.length >= needImages) return null;
    if (selectedFeature === 'compare') return '请上传 2 张图片进行颜色对比';
    if (selectedFeature === 'convert') return '请在输入框中输入任意格式色值（如 #FF6B35 / rgb(10,20,30) / hsl(200,80%,50%)）';
    if (['correct', 'pick', 'phone'].includes(selectedFeature)) return '请上传 1 张图片进行处理';
    return '';
  })();

  return (
    <div className="workspace-shell relative h-dvh w-screen overflow-hidden flex bg-brand-paper">
      {/* —— 桌面端：会话历史侧栏 —— */}
      <aside className="hidden lg:flex flex-col w-[280px] shrink-0 border-r border-brand-line bg-brand-surface/50">
        <ChatSidebar
          sessions={sessions}
          activeId={activeId}
          onNew={() => void startNewChat()}
          onOpen={(id) => void openSession(id)}
          onDelete={(id) => void handleDeleteSession(id)}
        />
      </aside>

      {/* 聊天主区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶栏 */}
        <header className="relative z-20 shrink-0 flex items-center justify-between px-4 lg:px-8 h-14 sm:h-16 border-b border-brand-line bg-white/85 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
              aria-label="返回首页"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-cmyk-strip shadow-card" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base sm:text-lg spectrum-text">曲泉AI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/25">
                  色彩智能体
                </span>
              </div>
              <p className="text-[11px] text-brand-muted hidden sm:block">随时为你处理专业色彩任务</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden md:flex items-center gap-2 text-xs text-brand-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              服务在线 · AI 已连接
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
              aria-label="会话历史"
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 消息流 */}
        <main
          ref={scrollRef}
          className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 sm:py-5"
        >
          <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onCopy={copyToClipboard}
                onContinue={handleContinue}
                onReset={handleReset}
                onGoPick={goToPick}
                onAutoCompare={triggerAutoCompare}
                onGoShops={goToShops}
              />
            ))}
          </div>
        </main>

        {/* 底部输入区 */}
        <footer className="relative z-20 shrink-0 border-t border-brand-line bg-brand-paper overflow-hidden max-h-[62vh]">
          <div className="mx-auto max-w-4xl px-3 sm:px-4 pt-3 sm:pt-5 pb-3 sm:pb-4 overflow-y-auto max-h-[62vh]">
            {featureHint && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-accent/10 border border-brand-accent/25 text-brand-accent text-xs animate-fade-in-up">
                <Sparkles className="w-4 h-4" />
                {featureHint}
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="ml-auto text-brand-muted hover:text-brand-accent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {pendingPreview.length > 0 && (
              <div className="mb-3 flex gap-2 sm:gap-3 overflow-x-auto animate-fade-in-up pb-1">
                {pendingPreview.map((src, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img
                      src={src}
                      alt=""
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-brand-line bg-brand-surface p-0.5"
                    />
                    <button
                      onClick={() => removePendingImage(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-brand-muted border border-brand-lineStrong shadow-card flex items-center justify-center hover:text-brand-accent hover:border-brand-accent/50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-brand-primary text-white font-mono">
                      图{i + 1}
                    </span>
                  </div>
                ))}
                {(selectedFeature === 'compare' || (!selectedFeature && pendingPreview.length === 1)) &&
                  pendingPreview.length < 2 && (
                    <button
                      onClick={() => secondFileInputRef.current?.click()}
                      className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-dashed border-brand-lineStrong/70 hover:border-brand-primary/60 text-brand-muted hover:text-brand-primary flex flex-col items-center justify-center transition-colors"
                    >
                      <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                      <span className="text-[9px] sm:text-[10px]">添加图片</span>
                    </button>
                  )}
              </div>
            )}

            {/* 工具坞 */}
            <ToolDock
              selectedFeature={selectedFeature}
              onSelect={handleDockSelect}
            />
            {moreToolsOpen && (
              <ToolDockPanel
                selectedFeature={selectedFeature}
                onSelect={handleDockSelect}
              />
            )}

            {/* 输入框 */}
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-2 shadow-card">
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1 p-1">
                  <button
                    onClick={openCamera}
                    className="p-2.5 rounded-xl text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
                    title="拍照"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
                    title="上传图片"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple={selectedFeature === 'compare'}
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files, selectedFeature === 'compare')}
                  />
                  <input
                    ref={secondFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files, true)}
                  />
                </div>

                <div className="h-8 w-px bg-brand-line mx-1" />

                <div className="flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={
                      selectedFeature === 'convert'
                        ? '已选【色彩空间转换】— 输入色值后发送'
                        : selectedFeature
                        ? `已选【${FEATURES.find((x) => x.key === selectedFeature)?.title}】— 上传图片后发送...`
                        : '告诉曲泉AI你想做什么，或上传图片直接开始处理...'
                    }
                    className="w-full resize-none bg-transparent px-3 py-3 text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
                    style={{ minHeight: '44px', maxHeight: '160px' }}
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingImages.length === 0 && !selectedFeature}
                  className={cn(
                    'p-2.5 rounded-xl shrink-0 ml-1 transition-all duration-150 active:scale-95',
                    !input.trim() && pendingImages.length === 0 && !selectedFeature
                      ? 'bg-brand-line text-brand-faint cursor-not-allowed'
                      : 'bg-brand-primary text-white shadow-sm hover:bg-brand-primaryLight hover:shadow-card'
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-brand-muted mt-2.5">
              曲泉AI · 接入 AI 大模型 · 支持色彩问答 + 5 大图像处理功能
            </p>
          </div>
        </footer>
      </div>

      {/* —— 移动端：会话历史抽屉 —— */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-ink/30 backdrop-blur-[2px] animate-fade-in-up"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(84%,320px)] flex flex-col bg-brand-paper border-r border-brand-line shadow-lift animate-[drawerIn_0.24s_ease-out]">
            <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-brand-line">
              <p className="text-sm font-semibold text-brand-ink">会话历史</p>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
                aria-label="关闭会话历史"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatSidebar
                compact
                sessions={sessions}
                activeId={activeId}
                onNew={() => void startNewChat()}
                onOpen={(id) => {
                  setSidebarOpen(false);
                  void openSession(id);
                }}
                onDelete={(id) => void handleDeleteSession(id)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* 摄像头弹窗 */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4 animate-fade-in-up">
          <div className="w-full max-w-2xl bg-brand-surface rounded-3xl border border-brand-line overflow-hidden shadow-lift">
            <div className="flex items-center justify-between p-4 border-b border-brand-line">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-brand-accent" />
                <h3 className="font-semibold">拍照上传</h3>
              </div>
              <button
                onClick={closeCamera}
                className="p-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-paper transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex items-center justify-center gap-4 p-5">
              <button onClick={closeCamera} className="btn-secondary">
                取消
              </button>
              <button onClick={takePhoto} className="btn-primary !px-10">
                <Camera className="w-5 h-5" />
                拍照
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-fade-in-up">
          <div className="glass-card px-4 py-2.5 flex items-center gap-2 text-sm shadow-lift">
            <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// 消息气泡渲染（内部组件，按 type 分支渲染）
// ─────────────────────────────────────────────────

function MessageBubble({
  msg,
  onCopy,
  onContinue,
  onReset,
  onGoPick,
  onAutoCompare,
  onGoShops,
}: {
  msg: Message;
  onCopy: (t: string, l?: string) => void;
  onContinue?: () => void;
  onReset?: () => void;
  onGoPick?: (imageUrl?: string) => void;
  onAutoCompare?: () => void;
  onGoShops?: (hex?: string) => void;
}) {
  const Avatar = () => (
    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-cmyk-strip shadow-card mr-3" />
  );

  const ResultActions = () => {
    if (msg.role !== 'assistant') return null;
    const type = msg.type;
    let primary: { label: string; onClick: () => void } | null = null;
    if (type === 'correct' || type === 'phone') {
      const correctedUrl =
        type === 'correct' ? msg.correctResult?.correctedImage : (msg.phoneResult as Record<string, string>)?.correctedUrl;
      primary = { label: '去取色', onClick: () => onGoPick?.(correctedUrl as string) };
    } else if (type === 'pick' && msg.pickResult) {
      primary = { label: '匹配颜色胶', onClick: () => onAutoCompare?.() };
    } else if (type === 'compare' && msg.compareResult) {
      const hex = msg.compareResult.imageA.dominantColors[0]?.hex;
      primary = { label: '附近商家', onClick: () => onGoShops?.(hex) };
    } else if (type === 'convert') {
      primary = { label: '去取色', onClick: () => onGoPick?.() };
    }
    if (!primary) return null;
    return (
      <div className="mt-5 pt-4 border-t border-brand-line flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="text-xs text-brand-muted font-medium mr-0 sm:mr-2 px-1">本次操作已完成，接下来：</div>
        <div className="flex gap-2 flex-1">
          <button
            type="button"
            onClick={primary.onClick}
            className="btn-primary flex-1 !py-2.5 !px-4 text-sm inline-flex items-center justify-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            {primary.label}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="btn-secondary flex-1 !py-2.5 !px-4 text-sm inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首屏
          </button>
        </div>
      </div>
    );
  };

  // —— 用户消息 ——
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[85%] sm:max-w-[75%]">
          {msg.images && msg.images.length > 0 && (
            <div className="flex gap-2 mb-2 justify-end flex-wrap">
              {msg.images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="max-w-full max-h-[320px] w-auto h-auto object-contain rounded-2xl border border-brand-line shadow-card"
                />
              ))}
            </div>
          )}
          {msg.feature && (
            <div className="mb-1.5 text-right">
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/25">
                <Sparkles className="w-3 h-3" />
                {FEATURES.find((f) => f.key === msg.feature)?.title}
              </span>
            </div>
          )}
          {msg.text && (
            <div className="inline-block px-5 py-3 rounded-2xl rounded-br-md bg-brand-primary text-white text-sm leading-relaxed shadow-card">
              {msg.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // —— 欢迎消息 ——
  if (msg.type === 'welcome') {
    return (
      <div className="flex justify-center py-3 sm:py-6 animate-fade-in-up">
        <div className="text-center max-w-lg">
          <div className="relative mx-auto w-14 h-14 sm:w-20 sm:h-20 mb-3 sm:mb-5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-card ring-1 ring-brand-line grid grid-cols-2">
            <span className="bg-[#009EE0]" />
            <span className="bg-[#E4007E]" />
            <span className="bg-[#FFD200]" />
            <span className="bg-[#1F1F1F]" />
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 spectrum-text">你好，我是曲泉AI</h1>
          <p className="text-brand-muted text-sm sm:text-base leading-relaxed mb-2 sm:mb-4 px-2 sm:px-0">
            你的专属色彩智能体 👋
            <span className="hidden sm:inline"><br /></span>
            我可以帮你一键校正图片、精准取色、转换色彩空间、对比颜色相似度，也可以直接向我提问任何色彩相关问题——基于 AI 大模型，专业回答等你。
          </p>
          <p className="text-xs sm:text-sm text-brand-muted/80">
            选择下方功能开始，或直接输入你的色彩问题～
          </p>
        </div>
      </div>
    );
  }

  // —— Loading ——
  if (msg.type === 'loading') {
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-md">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
            <span className="text-sm text-brand-muted">曲泉AI 正在处理...</span>
          </div>
        </div>
      </div>
    );
  }

  // —— 纯文本回复 ——
  if (msg.type === 'text') {
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-md max-w-[85%] text-sm text-brand-text leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  // —— 图片校正 ——
  if (msg.type === 'correct' && msg.correctResult) {
    const res = msg.correctResult;
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card p-5 rounded-2xl rounded-tl-md max-w-full w-full sm:max-w-[90%]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-accent" />
            <h4 className="font-semibold">图片校正完成</h4>
            <span className="text-xs text-brand-muted">亮度/对比度/饱和度已调整</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5">原图</div>
              <div className="w-full rounded-xl border border-brand-line bg-brand-paper/60 flex items-center justify-center overflow-hidden">
                <img src={res.originalImage} className="max-w-full max-h-[420px] object-contain w-full h-auto rounded-xl" />
              </div>
            </div>
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5 flex items-center gap-1">
                校正后 <span className="text-brand-teal">·推荐下载</span>
              </div>
              <div className="w-full rounded-xl border border-brand-teal/40 bg-brand-teal/5 flex items-center justify-center overflow-hidden shadow-inner">
                <img src={res.correctedImage} className="max-w-full max-h-[420px] object-contain w-full h-auto rounded-xl" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
            <StatChip label="亮度" value={res.metadata.brightness} suffix="%" />
            <StatChip label="对比度" value={res.metadata.contrast} suffix="%" />
            <StatChip label="饱和度" value={res.metadata.saturation} suffix="%" />
            <div className="px-3 py-2 rounded-xl bg-brand-paper/70 border border-brand-line">
              <div className="text-brand-muted text-[11px] mb-0.5">白平衡</div>
              <div className={cn(
                'font-semibold',
                res.metadata.whiteBalance === 'warm' && 'text-amber-600',
                res.metadata.whiteBalance === 'cool' && 'text-sky-700',
                res.metadata.whiteBalance === 'neutral' && 'text-brand-text'
              )}>
                {res.metadata.whiteBalance === 'warm' ? '偏暖校正' : res.metadata.whiteBalance === 'cool' ? '偏冷校正' : '中性白平衡'}
              </div>
            </div>
          </div>
          <a href={res.correctedImage} download="ququan-corrected.jpg" className="btn-primary !py-2 !px-4 text-sm inline-flex">
            <Download className="w-4 h-4" />
            下载校正图
          </a>
          <ResultActions />
        </div>
      </div>
    );
  }

  // —— 取色结果（含校色图） ——
  if (msg.type === 'pick' && msg.pickResult && msg.correctResult) {
    const { color, colorName } = msg.pickResult;
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card p-5 rounded-2xl rounded-tl-md max-w-full w-full sm:max-w-[90%]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-teal" />
            <h4 className="font-semibold">取色分析结果</h4>
          </div>
          <img
            src={msg.correctResult.correctedImage}
            className="w-full max-h-64 object-contain rounded-xl border border-brand-line mb-4"
          />
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div
              className="w-24 h-24 rounded-2xl border border-brand-line shadow-card shrink-0"
              style={{ background: color.hex }}
            />
            <div className="flex-1 w-full">
              <div className="font-serif text-2xl font-bold spectrum-text mb-1">{colorName}</div>
              <div className="space-y-1.5">
                {(['hex', 'rgb', 'hsl', 'cmyk', 'lab', 'hsv'] as const).map((k) => (
                  <div key={k} className="flex items-center gap-3 bg-brand-paper/60 rounded-lg px-3 py-2 border border-brand-line">
                    <span className="text-[11px] uppercase text-brand-muted w-14">{k}</span>
                    <span className="font-mono text-sm flex-1 min-w-0 truncate">{formatColorValue(k, color as any)}</span>
                    <button onClick={() => onCopy?.(formatColorValue(k, color as any), `${k.toUpperCase()} 已复制`)}>
                      <Copy className="w-4 h-4 text-brand-muted hover:text-brand-primary" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ResultActions />
        </div>
      </div>
    );
  }

  // —— 颜色相似度对比 ——
  if (msg.type === 'compare' && msg.compareResult) {
    const res = msg.compareResult;
    const level =
      res.similarity >= 90 ? '极高' : res.similarity >= 75 ? '高' : res.similarity >= 55 ? '中' : '低';
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card p-5 rounded-2xl rounded-tl-md max-w-full w-full sm:max-w-[90%]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <h4 className="font-semibold">颜色相似度对比</h4>
          </div>
          <div className="flex items-center justify-center py-6 mb-4">
            <div className="relative text-center">
              <svg width={200} height={200}>
                <circle cx="100" cy="100" r="85" stroke="rgba(36,51,61,0.08)" strokeWidth={14} fill="none" />
                <circle
                  cx="100" cy="100" r="85"
                  stroke="url(#compRingGrad)"
                  strokeWidth={14} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 85}
                  strokeDashoffset={2 * Math.PI * 85 * (1 - res.similarity / 100)}
                  transform="rotate(-90 100 100)"
                />
                <defs>
                  <linearGradient id="compRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#E4572E" />
                    <stop offset="50%" stopColor="#0E4D64" />
                    <stop offset="100%" stopColor="#2FA8A0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-serif text-4xl font-bold spectrum-text">{Math.round(res.similarity)}%</div>
                <div className="text-sm text-brand-muted">相似度 · {level}</div>
                <div className="text-xs text-brand-muted mt-1 font-mono">ΔE = {res.deltaE.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5">实物图A 主色</div>
              <div className="space-y-1.5">
                {res.imageA.dominantColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-brand-paper/60 p-2 border border-brand-line">
                    <div className="w-8 h-8 rounded-md" style={{ background: c.hex }} />
                    <span className="font-mono text-xs">{c.hex}</span>
                    <span className="ml-auto text-[10px] text-brand-muted">{Math.round(c.ratio * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5">实物图B 主色</div>
              <div className="space-y-1.5">
                {res.imageB.dominantColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-brand-paper/60 p-2 border border-brand-line">
                    <div className="w-8 h-8 rounded-md" style={{ background: c.hex }} />
                    <span className="font-mono text-xs">{c.hex}</span>
                    <span className="ml-auto text-[10px] text-brand-muted">{Math.round(c.ratio * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ResultActions />
        </div>
      </div>
    );
  }

  // —— 色彩空间转换 ——
  if (msg.type === 'convert' && msg.convertResult) {
    const res = msg.convertResult;
    const SPACES: Array<{ key: any; label: string }> = [
      { key: 'hex', label: 'HEX' },
      { key: 'rgb', label: 'RGB' },
      { key: 'hsl', label: 'HSL' },
      { key: 'hsv', label: 'HSV' },
      { key: 'cmyk', label: 'CMYK' },
      { key: 'lab', label: 'Lab' },
    ];
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card p-5 rounded-2xl rounded-tl-md max-w-full w-full sm:max-w-[90%]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h4 className="font-semibold">色彩空间转换完成</h4>
            <span className="text-xs text-brand-muted">
              识别格式：{String(res.detectedFormat).toUpperCase()} · 输入：
              <span className="font-mono text-purple-700">{res.input}</span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
            <div
              className="w-24 h-24 rounded-2xl border border-brand-line shadow-card shrink-0"
              style={{ background: res.color.hex }}
            />
            <div className="flex-1 w-full">
              <div className="font-serif text-2xl font-bold spectrum-text mb-1">{res.colorName}</div>
              <div className="space-y-1.5">
                {SPACES.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 bg-brand-paper/60 rounded-lg px-3 py-2 border border-brand-line">
                    <span className="text-[11px] uppercase text-brand-muted w-14">{label}</span>
                    <span className="font-mono text-sm flex-1 min-w-0 truncate">{formatColorValue(key as any, res.color as any)}</span>
                    <button onClick={() => onCopy?.(formatColorValue(key as any, res.color as any), `${label} 已复制`)}>
                      <Copy className="w-4 h-4 text-brand-muted hover:text-brand-primary" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Link to="/color-converter" className="btn-secondary !py-2 !px-4 text-sm inline-flex">
            打开完整转换工作台
          </Link>
          <ResultActions />
        </div>
      </div>
    );
  }

  // —— 手机拍摄校色 ——
  if (msg.type === 'phone' && msg.phoneResult) {
    const res = msg.phoneResult as any;
    return (
      <div className="flex items-start animate-fade-in-up">
        <Avatar />
        <div className="glass-card p-5 rounded-2xl rounded-tl-md max-w-full w-full sm:max-w-[90%]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h4 className="font-semibold">手机视觉校色完成</h4>
            <span className="text-xs text-brand-muted">已还原人眼真实色彩</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5">手机直出</div>
              <div className="w-full rounded-xl border border-brand-line bg-brand-paper/60 flex items-center justify-center overflow-hidden">
                <img src={res.originalUrl} className="max-w-full max-h-[340px] object-contain w-full h-auto rounded-xl" />
              </div>
            </div>
            <div className="ring-2 ring-amber-400/60 rounded-xl overflow-hidden relative bg-amber-50/90">
              <div className="absolute top-1.5 left-1.5 z-10 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                推荐 ⭐ 视觉真实
              </div>
              <div className="text-[11px] text-brand-muted mt-7 px-1 mb-1.5">视觉校色结果</div>
              <div className="flex items-center justify-center">
                <img src={res.correctedUrl} className="max-w-full max-h-[300px] object-contain w-full h-auto rounded-xl px-1 pb-1" />
              </div>
            </div>
            <div>
              <div className="text-[11px] text-brand-muted mb-1.5">标准校正基线</div>
              <div className="w-full rounded-xl border border-brand-line bg-brand-paper/60 flex items-center justify-center overflow-hidden">
                <img src={res.standardUrl} className="max-w-full max-h-[340px] object-contain w-full h-auto rounded-xl" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 text-xs">
            <AdjustBar label="红通道" value={res.adjustment.redShift} suffix="%" color="#ef4444" />
            <AdjustBar label="绿通道" value={res.adjustment.greenShift} suffix="%" color="#22c55e" />
            <AdjustBar label="蓝通道" value={res.adjustment.blueShift} suffix="%" color="#3b82f6" />
            <AdjustBar label="亮度" value={res.adjustment.brightness} color="#eab308" />
            <AdjustBar label="曝光" value={res.adjustment.exposure} suffix=" EV" color="#a855f7" />
          </div>
          <a href={res.correctedUrl} download="ququan-phone-corrected.jpg" className="btn-primary !py-2 !px-4 text-sm inline-flex">
            <Download className="w-4 h-4" />
            下载视觉校色图
          </a>
          <ResultActions />
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────
// 辅助渲染组件
// ─────────────────────────────────────────────────

/** ArrowRight 图标（MessageBubble 内用） */
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function StatChip({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const pos = value > 0;
  return (
    <div className="px-3 py-2 rounded-xl bg-brand-paper/70 border border-brand-line">
      <div className="text-brand-muted text-[11px] mb-0.5">{label}</div>
      <div className={cn('font-semibold', pos ? 'text-emerald-600' : value < 0 ? 'text-orange-600' : 'text-brand-text')}>
        {pos ? '+' : ''}{value.toFixed(1)}{suffix}
        {pos ? ' ↑' : value < 0 ? ' ↓' : ''}
      </div>
    </div>
  );
}

function AdjustBar({ label, value, suffix = '', color }: { label: string; value: number; suffix?: string; color: string }) {
  const pct = Math.max(-100, Math.min(100, value * 5));
  const width = Math.abs(pct);
  return (
    <div className="px-3 py-2 rounded-xl bg-brand-paper/70 border border-brand-line">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span className="text-brand-muted">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}{suffix}
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
    </div>
  );
}
