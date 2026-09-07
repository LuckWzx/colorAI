import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Copy,
  Check,
  Pipette,
  Palette,
  Layers,
  BookOpen,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ============ 类型 ============ */
interface CorrectedColor {
  id: string;
  name: string;
  category: string;
  correctedHex: string;
  correctedRgb: { r: number; g: number; b: number };
  originalHex: string;
  description: string;
  correctionNote: string;
  tags: string[];
}

interface Brand {
  id: string;
  name: string;
  fullName: string;
  industry: string;
  logoInitial: string;
  logoGradient: string;
  description: string;
  colorCount: number;
  colors: CorrectedColor[];
}

/* ============ Mock 品牌数据 ============ */
const BRANDS: Brand[] = [
  {
    id: 'brand-nike',
    name: 'Nike',
    fullName: '耐克 Nike',
    industry: '运动服饰',
    logoInitial: 'N',
    logoGradient: 'from-black to-neutral-700',
    description: '全球领先的运动品牌，标志性 Swoosh 红与运动风配色。',
    colorCount: 6,
    colors: [
      {
        id: 'nike-1',
        name: 'Swoosh 红',
        category: '品牌主色',
        correctedHex: '#FA5400',
        correctedRgb: { r: 250, g: 84, b: 0 },
        originalHex: '#E64A00',
        description: 'Nike 经典 Swoosh 标志使用的鲜亮橙色。',
        correctionNote: '白平衡 +20R / 饱和度 +15 / 对比度 +8，使橙色更贴近品牌官方色。',
        tags: ['品牌主色', '标志', '运动'],
      },
      {
        id: 'nike-2',
        name: 'Just Do It 黑',
        category: '品牌辅色',
        correctedHex: '#0B0B0B',
        correctedRgb: { r: 11, g: 11, b: 11 },
        originalHex: '#1A1A1A',
        description: 'Nike 标志性深黑色，用于文案与边框。',
        correctionNote: '亮度 -12 / 黑场补偿 +5，修正拍摄灰雾。',
        tags: ['品牌辅色', '黑色'],
      },
      {
        id: 'nike-3',
        name: 'Air Max 银',
        category: '产品配色',
        correctedHex: '#BFBFBF',
        correctedRgb: { r: 191, g: 191, b: 191 },
        originalHex: '#C8C8C8',
        description: 'Air Max 系列运动鞋常用的金属银色。',
        correctionNote: '色温 -15 / 饱和度 -10，降低金属反光偏色。',
        tags: ['产品', '金属'],
      },
      {
        id: 'nike-4',
        name: 'Tiger 绿',
        category: '限定配色',
        correctedHex: '#007A3D',
        correctedRgb: { r: 0, g: 122, b: 61 },
        originalHex: '#006B34',
        description: 'Nike x Tiger Woods 联名系列森林绿。',
        correctionNote: '色相 +8 / 明度 +6，还原球场绿的自然感。',
        tags: ['限定', '高尔夫'],
      },
      {
        id: 'nike-5',
        name: 'Flyknit 蓝',
        category: '产品配色',
        correctedHex: '#1E4D8C',
        correctedRgb: { r: 30, g: 77, b: 140 },
        originalHex: '#2A4F80',
        description: 'Flyknit 飞线系列的科技蓝。',
        correctionNote: '对比度 +10 / 色相 -5，提升科技质感。',
        tags: ['产品', '跑鞋'],
      },
      {
        id: 'nike-6',
        name: 'Lacquer 红',
        category: '产品配色',
        correctedHex: '#C8102E',
        correctedRgb: { r: 200, g: 16, b: 46 },
        originalHex: '#B8142A',
        description: '漆皮质感的正红色，用于 Air Force 1 等经典款。',
        correctionNote: '饱和度 +12 / 明度 +4，强化漆皮高光。',
        tags: ['产品', '经典'],
      },
    ],
  },
  {
    id: 'brand-apple',
    name: 'Apple',
    fullName: '苹果 Apple',
    industry: '消费电子',
    logoInitial: '',
    logoGradient: 'from-zinc-700 to-zinc-400',
    description: 'Apple 生态系统标志性配色，含产品金属质感与 UI 配色。',
    colorCount: 5,
    colors: [
      {
        id: 'apple-1',
        name: 'Apple 银',
        category: '产品主色',
        correctedHex: '#A2AAAD',
        correctedRgb: { r: 162, g: 170, b: 173 },
        originalHex: '#A8ADB0',
        description: 'Apple 经典铝合金银色，用于 MacBook / iPhone 机身。',
        correctionNote: '色温 -8 / 饱和度 -5，修正铝金属在暖光下的泛黄。',
        tags: ['产品', '金属', '笔记本'],
      },
      {
        id: 'apple-2',
        name: 'Space Gray',
        category: '产品主色',
        correctedHex: '#4A4A4A',
        correctedRgb: { r: 74, g: 74, b: 74 },
        originalHex: '#505050',
        description: '深空灰，Apple 设备经典配色。',
        correctionNote: '黑场补偿 +8 / 对比度 +6，使灰色更纯净。',
        tags: ['产品', '深色'],
      },
      {
        id: 'apple-3',
        name: 'Midnight',
        category: '产品主色',
        correctedHex: '#3B3F45',
        correctedRgb: { r: 59, g: 63, b: 69 },
        originalHex: '#45494F',
        description: '午夜黑，iPhone 15 Pro 经典色。',
        correctionNote: '亮度 -10 / 色相微调 -3，修正显示屏偏蓝。',
        tags: ['产品', 'iPhone'],
      },
      {
        id: 'apple-4',
        name: 'Product RED',
        category: '限定配色',
        correctedHex: '#C8102E',
        correctedRgb: { r: 200, g: 16, b: 46 },
        originalHex: '#B8142A',
        description: 'Apple Product (RED) 慈善红色。',
        correctionNote: '饱和度 +10 / 亮度 +3，保持红色鲜艳。',
        tags: ['限定', '慈善'],
      },
      {
        id: 'apple-5',
        name: 'iMessage 蓝',
        category: 'UI 配色',
        correctedHex: '#007AFF',
        correctedRgb: { r: 0, g: 122, b: 255 },
        originalHex: '#0A74F2',
        description: 'iOS 标志性 iMessage 蓝色。',
        correctionNote: '色相 -5 / 饱和度 +8，修正屏幕显示偏差。',
        tags: ['UI', 'iOS'],
      },
    ],
  },
  {
    id: 'brand-coca',
    name: 'Coca-Cola',
    fullName: '可口可乐',
    industry: '食品饮料',
    logoInitial: 'C',
    logoGradient: 'from-red-700 to-red-500',
    description: '百年经典品牌红与品牌资产色库。',
    colorCount: 4,
    colors: [
      {
        id: 'coca-1',
        name: 'Coke 红',
        category: '品牌主色',
        correctedHex: '#F40009',
        correctedRgb: { r: 244, g: 0, b: 9 },
        originalHex: '#E60008',
        description: '可口可乐标志性正红色。',
        correctionNote: '饱和度 +15 / 亮度 +6，修正印刷偏暗红。',
        tags: ['品牌主色', '标志红'],
      },
      {
        id: 'coca-2',
        name: 'Coke 黑',
        category: '品牌辅色',
        correctedHex: '#1A1A1A',
        correctedRgb: { r: 26, g: 26, b: 26 },
        originalHex: '#202020',
        description: '可乐包装上的深黑色。',
        correctionNote: '黑场补偿 +5，使黑色更纯净。',
        tags: ['品牌辅色'],
      },
      {
        id: 'coca-3',
        name: 'Diet Coke 银',
        category: '产品配色',
        correctedHex: '#E6E6E6',
        correctedRgb: { r: 230, g: 230, b: 230 },
        originalHex: '#E0E0E0',
        description: '健怡可乐银白色。',
        correctionNote: '亮度 +4 / 饱和度 -3，修正冷柜内蓝调。',
        tags: ['产品', '健怡'],
      },
      {
        id: 'coca-4',
        name: 'Sprite 绿',
        category: '产品配色',
        correctedHex: '#00A651',
        correctedRgb: { r: 0, g: 166, b: 81 },
        originalHex: '#00994A',
        description: '雪碧品牌绿色。',
        correctionNote: '色相 +6 / 饱和度 +10，还原柠檬绿。',
        tags: ['产品', '雪碧'],
      },
    ],
  },
  {
    id: 'brand-starbucks',
    name: 'Starbucks',
    fullName: '星巴克',
    industry: '餐饮连锁',
    logoInitial: 'S',
    logoGradient: 'from-emerald-800 to-emerald-500',
    description: '星巴克美人鱼 Logo 绿色与门店视觉配色。',
    colorCount: 3,
    colors: [
      {
        id: 'star-1',
        name: 'Starbucks 绿',
        category: '品牌主色',
        correctedHex: '#006241',
        correctedRgb: { r: 0, g: 98, b: 65 },
        originalHex: '#005538',
        description: '星巴克经典深绿 Logo 色。',
        correctionNote: '色相 +8 / 饱和度 +12，还原品牌森林绿。',
        tags: ['品牌主色', 'Logo'],
      },
      {
        id: 'star-2',
        name: 'Frappuccino 白',
        category: '产品配色',
        correctedHex: '#F5F1E8',
        correctedRgb: { r: 245, g: 241, b: 232 },
        originalHex: '#EFEADB',
        description: '星冰乐奶油白。',
        correctionNote: '色温 +8 / 饱和度 -4，修正奶油偏黄。',
        tags: ['产品', '奶油'],
      },
      {
        id: 'star-3',
        name: 'Pumpkin 橙',
        category: '季节限定',
        correctedHex: '#D8641C',
        correctedRgb: { r: 216, g: 100, b: 28 },
        originalHex: '#C85A1A',
        description: '南瓜拿铁季标志性橙色。',
        correctionNote: '饱和度 +15 / 亮度 +5，强化南瓜橙。',
        tags: ['限定', '秋季'],
      },
    ],
  },
  {
    id: 'brand-ikea',
    name: 'IKEA',
    fullName: '宜家 IKEA',
    industry: '家居零售',
    logoInitial: 'I',
    logoGradient: 'from-blue-600 to-yellow-400',
    description: '宜家蓝黄双色品牌标识。',
    colorCount: 2,
    colors: [
      {
        id: 'ikea-1',
        name: 'IKEA 黄',
        category: '品牌主色',
        correctedHex: '#FFDB00',
        correctedRgb: { r: 255, g: 219, b: 0 },
        originalHex: '#F5D000',
        description: '宜家经典标志黄色。',
        correctionNote: '饱和度 +12 / 色相 -3，还原 IKEA 明亮黄。',
        tags: ['品牌主色', '标志'],
      },
      {
        id: 'ikea-2',
        name: 'IKEA 蓝',
        category: '品牌辅色',
        correctedHex: '#0058A3',
        correctedRgb: { r: 0, g: 88, b: 163 },
        originalHex: '#004E94',
        description: '宜家标志蓝色。',
        correctionNote: '饱和度 +10 / 色相 +4，修正打印偏暗。',
        tags: ['品牌辅色', '标志'],
      },
    ],
  },
  {
    id: 'brand-toyota',
    name: 'Toyota',
    fullName: '丰田 Toyota',
    industry: '汽车',
    logoInitial: 'T',
    logoGradient: 'from-red-600 to-red-400',
    description: '丰田汽车品牌红色与车身漆色库。',
    colorCount: 3,
    colors: [
      {
        id: 'toyota-1',
        name: 'Toyota 红',
        category: '品牌主色',
        correctedHex: '#CC0000',
        correctedRgb: { r: 204, g: 0, b: 0 },
        originalHex: '#B80000',
        description: '丰田品牌红色。',
        correctionNote: '饱和度 +18 / 亮度 +4，使标志红更醒目。',
        tags: ['品牌主色', '标志'],
      },
      {
        id: 'toyota-2',
        name: 'Attitude 黑',
        category: '车身漆色',
        correctedHex: '#0A0A0A',
        correctedRgb: { r: 10, g: 10, b: 10 },
        originalHex: '#141414',
        description: '丰田 Attitude 黑色珠光漆。',
        correctionNote: '黑场补偿 +10，还原漆面深邃感。',
        tags: ['车身', '珠光'],
      },
      {
        id: 'toyota-3',
        name: 'Blizzard 白',
        category: '车身漆色',
        correctedHex: '#F8F8F8',
        correctedRgb: { r: 248, g: 248, b: 248 },
        originalHex: '#F0F0F0',
        description: '丰田 Blizzard 白色珠光漆。',
        correctionNote: '亮度 +6 / 饱和度 -3，修正偏黄。',
        tags: ['车身', '珠光白'],
      },
    ],
  },
];

/* ============ 辅助函数 ============ */
function getBrand(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}

/* ============ 面包屑 ============ */
function Breadcrumb({
  trail,
  onBack,
}: {
  trail: { label: string; level: number }[];
  onBack: () => void;
}) {
  return (
    <button
      onClick={onBack}
      className="group inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-accentLight transition-colors mb-4"
    >
      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      {trail.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 text-brand-muted/60" />}
          <span
            className={cn(
              i === trail.length - 1 ? 'text-brand-text font-medium' : ''
            )}
          >
            {t.label}
          </span>
        </span>
      ))}
    </button>
  );
}

/* ============ 品牌列表 ============ */
function BrandList({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold spectrum-text">颜色品牌库</h2>
          <p className="text-sm text-brand-muted mt-1">
            精选 {BRANDS.length} 个全球知名品牌，所有颜色均经 AI 视觉校正。
          </p>
        </div>
        <div className="glass-card !p-3 inline-flex items-center gap-2 text-xs text-brand-muted">
          <BookOpen className="w-4 h-4 text-brand-accent" />
          <span>
            共 <span className="text-brand-text font-semibold">{BRANDS.reduce((s, b) => s + b.colorCount, 0)}</span> 个校正色
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="group glass-card p-4 text-left hover:-translate-y-0.5 hover:border-white/20 transition-all"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br',
                  b.logoGradient
                )}
              >
                <span className="font-serif font-bold text-xl text-white drop-shadow">
                  {b.logoInitial}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-brand-text truncate">{b.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-accentLight group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <div className="text-[11px] text-brand-muted mt-0.5">{b.industry}</div>
              </div>
            </div>
            <p className="text-xs text-brand-muted leading-relaxed mt-3 line-clamp-2">
              {b.description}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {b.colors.slice(0, 4).map((c) => (
                  <span
                    key={c.id}
                    className="w-4 h-4 rounded-full border-2 border-brand-darker"
                    style={{ background: c.correctedHex }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-brand-muted">
                {b.colorCount} 个色
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============ 品牌颜色库 ============ */
function BrandColorList({
  brand,
  onSelect,
}: {
  brand: Brand;
  onSelect: (colorId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br shrink-0',
            brand.logoGradient
          )}
        >
          <span className="font-serif font-bold text-3xl text-white drop-shadow">
            {brand.logoInitial}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-2xl font-bold spectrum-text">{brand.fullName} · 校正色库</h2>
          <p className="text-sm text-brand-muted mt-1">{brand.description}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-brand-muted">
            <span>{brand.industry}</span>
            <span>·</span>
            <span>共 {brand.colorCount} 个 AI 校正色</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brand.colors.map((c) => {
          const beforeDiff =
            c.correctedRgb.r !== parseInt(c.originalHex.slice(1, 3), 16) ||
            c.correctedRgb.g !== parseInt(c.originalHex.slice(3, 5), 16) ||
            c.correctedRgb.b !== parseInt(c.originalHex.slice(5, 7), 16);
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="group glass-card p-3 text-left hover:-translate-y-0.5 hover:border-white/20 transition-all"
            >
              <div
                className="aspect-square rounded-xl mb-3 relative overflow-hidden border border-white/10 shadow-inner"
                style={{ background: c.correctedHex }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {beforeDiff && (
                  <div className="absolute bottom-2 left-2 text-[9px] bg-brand-darker/70 backdrop-blur px-1.5 py-0.5 rounded text-brand-accentLight border border-brand-accent/30">
                    AI 校正
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text text-sm truncate">{c.name}</span>
                <ChevronRight className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-accentLight group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <div className="mt-1 font-mono text-[11px] text-brand-muted tabular-nums">
                {c.correctedHex.toUpperCase()}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[10px] text-brand-muted bg-white/5 px-1.5 py-0.5 rounded">
                  {c.category}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ 颜色详情 ============ */
function ColorDetail({
  brand,
  color,
  onBack,
}: {
  brand: Brand;
  color: CorrectedColor;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const rgbStr = `rgb(${color.correctedRgb.r}, ${color.correctedRgb.g}, ${color.correctedRgb.b})`;
  const hsl = useMemo(() => {
    const r = color.correctedRgb.r / 255;
    const g = color.correctedRgb.g / 255;
    const b = color.correctedRgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          break;
        case g:
          h = ((b - r) / d + 2) * 60;
          break;
        case b:
          h = ((r - g) / d + 4) * 60;
          break;
      }
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }, [color]);

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
      {/* 大色块 */}
      <div className="glass-card p-4">
        <div
          className="aspect-square w-full rounded-2xl shadow-2xl relative overflow-hidden border border-white/10"
          style={{ background: color.correctedHex }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/20" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="font-serif text-xl font-bold text-white drop-shadow-lg">
              {color.name}
            </div>
            <div className="font-mono text-xs text-white/80 drop-shadow">
              {color.correctedHex.toUpperCase()}
            </div>
          </div>
        </div>

        {/* 校正前后对比 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="glass-card !bg-white/5 !border-white/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-brand-muted mb-2">校正前</div>
            <div
              className="w-full aspect-video rounded-lg mb-2 shadow-inner"
              style={{ background: color.originalHex }}
            />
            <div className="font-mono text-[11px] text-brand-muted">
              {color.originalHex.toUpperCase()}
            </div>
          </div>
          <div className="glass-card !bg-brand-accent/5 !border-brand-accent/20 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-brand-accentLight mb-2">
              AI 校正后
            </div>
            <div
              className="w-full aspect-video rounded-lg mb-2 shadow-inner ring-1 ring-brand-accent/30"
              style={{ background: color.correctedHex }}
            />
            <div className="font-mono text-[11px] text-brand-accentLight">
              {color.correctedHex.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* 详情信息 */}
      <div className="space-y-4">
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-brand-muted">
                  {brand.fullName}
                </span>
                <span className="text-brand-muted">·</span>
                <span className="text-xs text-brand-accentLight">{color.category}</span>
              </div>
              <h2 className="font-serif text-3xl font-bold spectrum-text">{color.name}</h2>
            </div>
            <button onClick={onBack} className="btn-secondary !py-1.5 !px-3 text-xs">
              返回色库
            </button>
          </div>
          <p className="text-sm text-brand-muted leading-relaxed">{color.description}</p>

          {/* 校正说明 */}
          <div className="mt-4 p-3 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
            <div className="text-xs text-brand-accentLight leading-relaxed">
              <div className="font-semibold mb-1">AI 视觉校正说明</div>
              {color.correctionNote}
            </div>
          </div>

          {/* 标签 */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {color.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-brand-muted"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* 色彩值 */}
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-brand-muted mb-3">
            色彩空间值（已校正）
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'HEX', value: color.correctedHex.toUpperCase() },
              {
                label: 'RGB',
                value: `${color.correctedRgb.r}, ${color.correctedRgb.g}, ${color.correctedRgb.b}`,
              },
              {
                label: 'HSL',
                value: `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`,
              },
            ].map((v) => (
              <div
                key={v.label}
                className="glass-card !bg-white/5 !border-white/10 p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-muted">
                    {v.label}
                  </div>
                  <div className="font-mono text-sm text-brand-text tabular-nums mt-0.5">
                    {v.value}
                  </div>
                </div>
                <button
                  onClick={() => copy(v.value)}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-brand-muted hover:text-brand-accentLight shrink-0"
                  aria-label="复制"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* 额外提示：RGB 字符串一键复制 */}
          <div className="mt-3">
            <button
              onClick={() => copy(rgbStr)}
              className="w-full glass-card !bg-white/5 !border-white/10 p-3 flex items-center justify-between gap-2 text-xs hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Pipette className="w-4 h-4 text-brand-accent" />
                <span className="font-mono text-brand-muted">{rgbStr}</span>
              </div>
              <span className="text-brand-accentLight">
                {copied ? '已复制' : '复制完整 RGB'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 主页面 ============ */
export default function ColorLibrary() {
  const navigate = useNavigate();
  const { brandId, colorId } = useParams();

  const brand = brandId ? getBrand(brandId) : undefined;
  const color = brand && colorId ? brand.colors.find((c) => c.id === colorId) : undefined;

  // 面包屑 trail
  const trail = useMemo(() => {
    const t: { label: string; level: number }[] = [
      { label: '色卡库', level: 0 },
    ];
    if (brand) t.push({ label: brand.fullName, level: 1 });
    if (color) t.push({ label: color.name, level: 2 });
    return t;
  }, [brand, color]);

  const onBack = () => {
    if (color && brand) {
      navigate(`/color-library/${brand.id}`);
    } else if (brand) {
      navigate('/color-library');
    } else {
      navigate('/community');
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      {/* 背景 */}
      <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
      <div
        className="fixed top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
      />
      <div
        className="fixed bottom-0 -right-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4ECDC4 0%, transparent 60%)' }}
      />

      {/* Hero */}
      <section className="relative pt-16 pb-6 px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-brand-muted mb-3">
            <button onClick={() => navigate('/community')} className="hover:text-brand-accentLight transition-colors">
              曲泉AI
            </button>
            <span>/</span>
            <button onClick={() => navigate('/community')} className="hover:text-brand-accentLight transition-colors">
              色研社区
            </button>
            <span>/</span>
            <span className="text-brand-text">色卡库</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift flex items-center justify-center shadow-glow">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold spectrum-text">AI 视觉校正色卡库</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                所有颜色均由 AI 视觉校正引擎校正，色温、白平衡、饱和度、色相均已优化至品牌官方标准。
              </p>
            </div>
          </div>

          {/* 面包屑 */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <Breadcrumb trail={trail} onBack={onBack} />
          </div>
        </div>
      </section>

      {/* 主体 */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto">
          {!brand && <BrandList onSelect={(id) => navigate(`/color-library/${id}`)} />}
          {brand && !color && (
            <BrandColorList
              brand={brand}
              onSelect={(cid) => navigate(`/color-library/${brand.id}/${cid}`)}
            />
          )}
          {brand && color && <ColorDetail brand={brand} color={color} onBack={onBack} />}
          {brandId && !brand && (
            <div className="glass-card p-10 text-center">
              <Library className="w-10 h-10 text-brand-muted/60 mx-auto mb-3" />
              <div className="text-brand-muted">未找到该品牌，</div>
              <button onClick={() => navigate('/color-library')} className="text-brand-accentLight hover:underline mt-2">
                返回品牌列表
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
