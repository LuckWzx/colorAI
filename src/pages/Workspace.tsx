import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  Pipette,
  Palette,
  GitCompare,
  Smartphone,
  Camera,
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
  ChevronRight,
  ChevronDown,
  Home,
  ArrowRight,
  HelpCircle,
  MapPin,
  Package2,
  LayoutGrid,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { colorService } from '@/services/colorService';
import { deepseekService } from '@/services/deepseekService';
import type { ChatMessage } from '@/services/deepseekService';
import { useAppStore } from '@/store/appStore';
import { convertFrom, getColorName, formatColorValue, parseColor, detectColorFormat } from '@/utils/colorConverter';
import type { CorrectionResult, CompareResult } from '@/types';

type FeatureKey = 'correct' | 'pick' | 'convert' | 'compare' | 'phone';

const FEATURES: Array<{
  key: FeatureKey;
  title: string;
  desc: string;
  icon: any;
  gradient: string;
  accent: string;
}> = [
  {
    key: 'correct',
    title: '图片一键校正',
    desc: 'AI 智能白平衡还原真实色彩',
    icon: ImageIcon,
    gradient: 'from-[#FF6B35] to-[#F7C59F]',
    accent: '#FF6B35',
  },
  {
    key: 'pick',
    title: '智能取色器',
    desc: '点击图片获取多格式色值',
    icon: Pipette,
    gradient: 'from-[#4ECDC4] to-[#0E4D64]',
    accent: '#4ECDC4',
  },
  {
    key: 'convert',
    title: '色彩空间转换',
    desc: 'HEX RGB CMYK Lab 实时互转',
    icon: Palette,
    gradient: 'from-[#A855F7] to-[#EC4899]',
    accent: '#A855F7',
  },
  {
    key: 'compare',
    title: '颜色相似度对比',
    desc: 'ΔE 专业色差量化评分',
    icon: GitCompare,
    gradient: 'from-[#3B82F6] to-[#8B5CF6]',
    accent: '#3B82F6',
  },
  {
    key: 'phone',
    title: '手机拍摄校色',
    desc: '还原人眼视觉真实颜色',
    icon: Smartphone,
    gradient: 'from-[#10B981] to-[#059669]',
    accent: '#10B981',
  },
];

/** 工具坞条目：聊天内处理（chat）或页面跳转（page） */
interface DockItem {
  id: string;
  kind: 'chat' | 'page';
  key: string;
  path?: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
}

/** 知识问答 4 类页签工具 */
const KNOWLEDGE_TOOLS: Array<{
  key: string;
  path: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
}> = [
  {
    key: 'issues',
    path: '/knowledge?tab=issues',
    title: '拍照偏色解答',
    desc: '偏色原因专业解答',
    icon: HelpCircle,
    color: '#6FAE55',
  },
  {
    key: 'tips',
    path: '/knowledge?tab=tips',
    title: '拍照真实技巧',
    desc: '用光构图实操技巧',
    icon: Camera,
    color: '#2FA8A0',
  },
  {
    key: 'shops',
    path: '/knowledge?tab=shops',
    title: '附近色胶商铺',
    desc: '冲印微喷店铺地图',
    icon: MapPin,
    color: '#6B5BCD',
  },
  {
    key: 'brands',
    path: '/knowledge?tab=brands',
    title: '工业胶品牌',
    desc: '胶卷相纸品牌图鉴',
    icon: Package2,
    color: '#8A5FD0',
  },
];

/** 聊天处理的 5 个核心工具（常驻工具坞） */
const DOCK_CHAT: DockItem[] = FEATURES.map((f) => ({
  id: f.key,
  kind: 'chat' as const,
  key: f.key,
  title: f.title,
  desc: f.desc,
  icon: f.icon,
  color: f.accent,
}));

/** 全部 9 个工具（更多面板） */
const DOCK_ALL: DockItem[] = [
  ...DOCK_CHAT,
  ...KNOWLEDGE_TOOLS.map((t) => ({
    id: t.key,
    kind: 'page' as const,
    key: t.key,
    path: t.path,
    title: t.title,
    desc: t.desc,
    icon: t.icon,
    color: t.color,
  })),
];

interface BaseMessage {
  id: string;
  role: 'user' | 'assistant';
  createdAt: number;
}

interface UserMessage extends BaseMessage {
  role: 'user';
  text?: string;
  images?: string[];
  feature?: FeatureKey;
}

interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  text?: string;
  type: 'welcome' | 'text' | 'correct' | 'pick' | 'compare' | 'convert' | 'phone' | 'loading';
  correctResult?: CorrectionResult;
  pickResult?: { color: ReturnType<typeof convertFrom>; colorName: string };
  compareResult?: CompareResult;
  convertResult?: {
    input: string;
    detectedFormat: ReturnType<typeof detectColorFormat>;
    color: ReturnType<typeof convertFrom>;
    colorName: string;
  };
  phoneResult?: any;
}

type Message = UserMessage | AssistantMessage;

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * 将 dataURL 转换为 File 对象
 * 用于跨步骤复用校色后的图片（dataURL → File，再走取色流程）
 */
function dataUrlToFile(dataUrl: string, filename = 'corrected.jpg'): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
  return new File([new Blob([u8], { type: mime })], filename, { type: mime });
}

export default function Workspace() {
  const navigate = useNavigate();
  const setCorrectedImage = useAppStore((s) => s.setCorrectedImage);
  const setPickedColor = useAppStore((s) => s.setPickedColor);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreview, setPendingPreview] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [moreToolsOpen, setMoreToolsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const secondFileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const welcome: AssistantMessage = {
      id: uid(),
      role: 'assistant',
      type: 'welcome',
      createdAt: Date.now(),
    };
    setMessages([welcome]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleReset = useCallback(() => {
    const welcome: AssistantMessage = {
      id: uid(),
      role: 'assistant',
      type: 'welcome',
      createdAt: Date.now(),
    };
    setMessages([welcome]);
    setSelectedFeature(null);
    setPendingImages([]);
    setPendingPreview([]);
    setInput('');
    setChatHistory([]);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  /** 工具坞/更多面板选择：聊天类进入对话流程，页面类直接跳转 */
  const handleDockSelect = useCallback((item: DockItem) => {
    setMoreToolsOpen(false);
    if (item.kind === 'chat') {
      setSelectedFeature(item.key as FeatureKey);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else if (item.path) {
      navigate(item.path);
    }
  }, [navigate]);

  /**
   * 取色流程核心逻辑（可复用）
   * 添加用户消息 + loading → 执行校色与取色 → 更新为取色结果消息
   */
  const runPickWithFile = useCallback(
    async (file: File, previewUrl: string, userText?: string) => {
      // 用户消息
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'user',
          createdAt: Date.now(),
          text: userText || '',
          images: [previewUrl],
          feature: 'pick',
        },
      ]);

      // loading 占位
      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: 'assistant', type: 'loading', createdAt: Date.now() },
      ]);

      try {
        const correctRes = await colorService.correctImage(file, 'auto');
        setCorrectedImage(correctRes.correctedImage);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = correctRes.correctedImage;
        await new Promise<void>((res) => {
          img.onload = () => res();
        });
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
        // 保存取色到全局 store，供后续"匹配颜色胶"使用
        setPickedColor(color);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'pick',
                  text: `已为你分析图片中心主色调，可点击原图任意位置取色，这里是图像中心点颜色：`,
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
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'text',
                  text: '取色失败，请稍后重试。',
                  createdAt: Date.now(),
                }
              : m
          )
        );
      }
    },
    [setCorrectedImage, setPickedColor]
  );

  /**
   * 跳转到"智能取色器"功能
   * @param imageUrl 可选：传入校色后的图片 dataURL，自动复用并触发取色，无需用户重新上传
   */
  const goToPick = useCallback(
    (imageUrl?: string) => {
      setSelectedFeature('pick');
      setPendingImages([]);
      setPendingPreview([]);
      setInput('');

      // 若传入校色后图片，自动复用并执行取色流程
      if (imageUrl && imageUrl.startsWith('data:')) {
        const file = dataUrlToFile(imageUrl, 'corrected.jpg');
        runPickWithFile(file, imageUrl, '对校色后的图片进行取色');
        return;
      }

      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [runPickWithFile]
  );

  /**
   * 触发"匹配颜色胶"自动对比流程
   * 从全局 store 读取上次取色结果，自动生成系统匹配颜色胶，并展示 ΔE 对比结果
   */
  const triggerAutoCompare = useCallback(async () => {
    const picked = useAppStore.getState().pickedColor;
    if (!picked) {
      showToast('请先完成取色，再来匹配颜色胶');
      return;
    }

    // 用户消息：匹配颜色胶
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'user',
        createdAt: Date.now(),
        text: '匹配颜色胶',
        feature: 'compare',
      },
    ]);

    // loading 占位
    const loadingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', type: 'loading', createdAt: Date.now() },
    ]);

    try {
      const res = await colorService.matchColorGel(picked.hex);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: uid(),
                role: 'assistant',
                type: 'compare',
                text: '已基于您刚才取的颜色，从色卡库匹配出最接近的颜色胶：',
                compareResult: res,
                createdAt: Date.now(),
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: uid(),
                role: 'assistant',
                type: 'text',
                text: '颜色胶匹配失败，请稍后重试。',
                createdAt: Date.now(),
              }
            : m
        )
      );
    }
  }, []);

  /**
   * 跳转到"附近商家"列表
   * 通过 URL 参数携带主色 HEX，让商家页知道用户在找什么颜色胶
   */
  const goToShops = useCallback((hex?: string) => {
    const targetHex = hex || useAppStore.getState().pickedColor?.hex;
    const url = targetHex
      ? `/partner-cooperation?color=${encodeURIComponent(targetHex)}`
      : '/partner-cooperation';
    navigate(url);
  }, []);

  const addUserMessageAndRun = async (msg: Omit<UserMessage, 'id' | 'createdAt' | 'role'>) => {
    const userMsg: UserMessage = {
      id: uid(),
      role: 'user',
      createdAt: Date.now(),
      ...msg,
    };
    setMessages((prev) => [...prev, userMsg]);

    const loadingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', type: 'loading', createdAt: Date.now() },
    ]);

    try {
      if (msg.feature === 'correct' && msg.images?.[0]) {
        const file = pendingImages[0];
        const res = await colorService.correctImage(file, 'auto');
        setCorrectedImage(res.correctedImage);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'correct',
                  correctResult: res,
                  createdAt: Date.now(),
                }
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
        // 保存取色到全局 store，供后续"匹配颜色胶"使用
        setPickedColor(color);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'pick',
                  text: `已为你分析图片中心主色调，可点击原图任意位置取色，这里是图像中心点颜色：`,
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
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'compare',
                  compareResult: res,
                  createdAt: Date.now(),
                }
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
                  id: uid(),
                  role: 'assistant',
                  type: 'convert',
                  text: `已识别输入格式：${detectLabel.toUpperCase()}，以下是全部 6 种色彩空间的转换结果：`,
                  convertResult: {
                    input: text,
                    detectedFormat: detectLabel,
                    color,
                    colorName,
                  },
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
              ? {
                  id: uid(),
                  role: 'assistant',
                  type: 'phone',
                  phoneResult: res,
                  createdAt: Date.now(),
                }
              : m
          )
        );
      } else {
        const userText = msg.text?.trim() || '你好';
        setChatHistory((prev) => [...prev, { role: 'user', content: userText }]);

        try {
          const response = await deepseekService.chat(userText, chatHistory);
          const assistantText = response.text;
          setChatHistory((prev) => [...prev, { role: 'assistant', content: assistantText }]);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    id: uid(),
                    role: 'assistant',
                    type: 'text',
                    text: assistantText,
                    createdAt: Date.now(),
                  }
                : m
            )
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    id: uid(),
                    role: 'assistant',
                    type: 'text',
                    text: '抱歉，AI 服务暂时不可用，请稍后重试或选择上方功能卡片使用。',
                    createdAt: Date.now(),
                  }
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

  const featureHint = (() => {
    if (!selectedFeature) return null;
    if (selectedFeature === 'compare') return '请上传 2 张图片进行颜色对比';
    if (selectedFeature === 'convert') return '请在输入框中输入任意格式色值（如 #FF6B35 / rgb(10,20,30) / hsl(200,80%,50%)）';
    if (['correct', 'pick', 'phone'].includes(selectedFeature)) return '请上传 1 张图片进行处理';
    return '';
  })();

  return (
    <div className="relative h-dvh w-screen overflow-hidden flex flex-col bg-brand-paper">
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
        <div className="hidden md:flex items-center gap-2 text-xs text-brand-muted">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          服务在线 · DeepSeek AI 已连接
        </div>
      </header>

      <main
        ref={scrollRef}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 sm:py-5"
        style={{ scrollbarWidth: 'thin' }}
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

      <footer className="relative z-20 shrink-0 border-t border-brand-line bg-brand-paper overflow-hidden max-h-[62vh]">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 pt-3 sm:pt-5 pb-3 sm:pb-4 overflow-y-auto max-h-[62vh]" style={{ scrollbarWidth: 'thin' }}>
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

          {/* 工具坞：5 个核心处理工具常驻聊天框上方 */}
          <div
            className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 animate-fade-in-up"
            style={{ scrollbarWidth: 'thin' }}
          >
            {DOCK_CHAT.map((item) => {
              const Icon = item.icon;
              const active = selectedFeature === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleDockSelect(item)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    active
                      ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                      : 'border-brand-line bg-brand-surface text-brand-muted hover:text-brand-ink hover:border-brand-lineStrong'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.title}
                </button>
              );
            })}
            <button
              onClick={() => setMoreToolsOpen((v) => !v)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                moreToolsOpen
                  ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                  : 'border-brand-line bg-brand-surface text-brand-muted hover:text-brand-ink hover:border-brand-lineStrong'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              更多
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', moreToolsOpen && 'rotate-180')}
              />
            </button>
          </div>

          {/* 上拉面板：全部 9 个工具（含知识问答 4 类页签） */}
          {moreToolsOpen && (
            <div className="mb-2.5 rounded-2xl border border-brand-line bg-brand-surface p-2.5 shadow-lift animate-fade-in-up">
              <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                <p className="text-[11px] font-medium text-brand-muted">全部色彩工具</p>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brand-faint">
                  9 tools
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {DOCK_ALL.map((item) => {
                  const Icon = item.icon;
                  const active = item.kind === 'chat' && selectedFeature === item.key;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleDockSelect(item)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-brand-accent/10 ring-1 ring-inset ring-brand-accent/30' : 'hover:bg-brand-paper'
                      )}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}26`, color: item.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-brand-ink leading-tight truncate">
                          {item.title}
                        </span>
                        <span className="block text-[10px] text-brand-faint leading-tight mt-0.5 truncate">
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                      ? '已选【色彩空间转换】— 请输入色值，如 #FF6B35 / rgb(10,20,30) / hsl(200,80%,50%)...'
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
            曲泉AI · 接入 DeepSeek 大模型 · 支持色彩问答 + 5 大图像处理功能
          </p>
        </div>
      </footer>

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
              <button
                onClick={takePhoto}
                className="btn-primary !px-10"
              >
                <Camera className="w-5 h-5" />
                拍照
              </button>
            </div>
          </div>
        </div>
      )}

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
  /**
   * 根据 msg.type 渲染"本次操作已完成，接下来："按钮
   * - correct / phone → 【去取色】
   * - pick → 【匹配颜色胶】（自动调用系统匹配并对比）
   * - compare → 【附近商家】（跳转到 /partner-cooperation?color=xxx）
   * - convert → 默认【去取色】（同时保留打开完整转换工作台入口）
   */
  const ResultActions = () => {
    if (msg.role !== 'assistant') return null;
    const type = msg.type;
    let primary: { label: string; onClick: () => void } | null = null;
    if (type === 'correct' || type === 'phone') {
      // 复用校色后的图片，直接进入取色，无需用户重新上传
      const correctedUrl =
        type === 'correct'
          ? msg.correctResult?.correctedImage
          : msg.phoneResult?.correctedUrl;
      primary = { label: '去取色', onClick: () => onGoPick?.(correctedUrl) };
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
            <span className="hidden sm:inline">
              <br />
            </span>
            我可以帮你一键校正图片、精准取色、转换色彩空间、对比颜色相似度，也可以直接向我提问任何色彩相关问题——基于 DeepSeek 大模型，专业回答等你。
          </p>
          <p className="text-xs sm:text-sm text-brand-muted/80">
            选择下方功能开始，或直接输入你的色彩问题～
          </p>
        </div>
      </div>
    );
  }

  const Avatar = () => (
    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-cmyk-strip shadow-card mr-3" />
  );

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
          <a
            href={res.correctedImage}
            download="ququan-corrected.jpg"
            className="btn-primary !py-2 !px-4 text-sm inline-flex"
          >
            <Download className="w-4 h-4" />
            下载校正图
          </a>
          <ResultActions />
        </div>
      </div>
    );
  }

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
                  cx="100"
                  cy="100"
                  r="85"
                  stroke="url(#compRingGrad)"
                  strokeWidth={14}
                  fill="none"
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
          <Link
            to="/color-converter"
            className="btn-secondary !py-2 !px-4 text-sm inline-flex"
          >
            打开完整转换工作台
          </Link>
          <ResultActions />
        </div>
      </div>
    );
  }

  if (msg.type === 'phone' && msg.phoneResult) {
    const res = msg.phoneResult;
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
          <a
            href={res.correctedUrl}
            download="ququan-phone-corrected.jpg"
            className="btn-primary !py-2 !px-4 text-sm inline-flex"
          >
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
