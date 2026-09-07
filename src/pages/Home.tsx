import { useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon,
  Pipette,
  Palette,
  GitCompare,
  Smartphone,
  HelpCircle,
  Camera,
  MapPin,
  Package2,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FeatureCard {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  gradient: string;
}

const featureCards: FeatureCard[] = [
  {
    id: 1,
    title: '图片一键校正',
    description: 'AI自动识别场景，智能调整白平衡、对比度、饱和度，还原真实色彩',
    icon: ImageIcon,
    path: '/image-correction',
    gradient: 'from-[#FF6B35] to-[#F7C59F]',
  },
  {
    id: 2,
    title: '智能取色器',
    description: '点击图片任意位置获取精准颜色值，支持RGB/HEX/HSL/CMYK等多格式转换',
    icon: Pipette,
    path: '/color-picker',
    gradient: 'from-[#4ECDC4] to-[#0E4D64]',
  },
  {
    id: 3,
    title: '色彩空间转换',
    description: '全色彩空间互转：RGB/HEX/HSL/HSV/CMYK/LAB，专业级转换算法精准可靠',
    icon: Palette,
    path: '/color-converter',
    gradient: 'from-[#A855F7] to-[#EC4899]',
  },
  {
    id: 4,
    title: '颜色相似度对比',
    description: '上传两张图片进行色彩差异分析，DeltaE量化评分，生成专业对比报告',
    icon: GitCompare,
    path: '/color-compare',
    gradient: 'from-[#3B82F6] to-[#8B5CF6]',
  },
  {
    id: 5,
    title: '手机拍摄校色',
    description: '针对主流手机机型和拍摄场景，一键校正自动白平衡偏差，还原真实色调',
    icon: Smartphone,
    path: '/phone-correction',
    gradient: 'from-[#10B981] to-[#059669]',
  },
  {
    id: 6,
    title: '拍照偏色解答',
    description: '常见偏色问题知识库：室内偏黄、户外过曝、肤色偏红等难题的专业解答',
    icon: HelpCircle,
    path: '/knowledge?tab=issues',
    gradient: 'from-[#F59E0B] to-[#D97706]',
  },
  {
    id: 7,
    title: '拍照真实技巧',
    description: '黄金时刻用光、构图法则、产品布光等实操技巧，助你拍出专业作品',
    icon: Camera,
    path: '/knowledge?tab=tips',
    gradient: 'from-[#EF4444] to-[#DC2626]',
  },
  {
    id: 8,
    title: '附近色胶商铺',
    description: '附近专业冲印店、胶片社、艺术微喷工作室地图导航，实地校正无忧',
    icon: MapPin,
    path: '/knowledge?tab=shops',
    gradient: 'from-[#06B6D4] to-[#0891B2]',
  },
  {
    id: 9,
    title: '工业胶品牌',
    description: '专业胶卷、相纸、校色设备品牌图鉴：柯达、富士、伊尔福、爱普生等',
    icon: Package2,
    path: '/knowledge?tab=brands',
    gradient: 'from-[#6366F1] to-[#4F46E5]',
  },
];

const colorRingColors = [
  '#FF6B35',
  '#F7C59F',
  '#4ECDC4',
  '#1A6B88',
  '#A855F7',
  '#EC4899',
  '#10B981',
  '#F59E0B',
];

export default function Home() {
  const navigate = useNavigate();

  const scrollToFeatures = () => {
    const el = document.getElementById('features-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative min-h-screen bg-brand-dark overflow-hidden">
      <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-50" />

      <section id="hero-section" className="relative pt-28 pb-24 px-6 lg:px-12">
        <div
          className="absolute top-10 -left-32 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, #FF6B35 0%, #F7C59F 25%, #4ECDC4 50%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, #1A6B88 0%, #4ECDC4 30%, #A855F7 60%, transparent 80%)',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-left">
            <p
              className="inline-block text-sm md:text-base font-medium mb-6 bg-clip-text text-transparent bg-spectrum-gradient bg-[length:200%_auto] animate-gradient-shift tracking-wider"
            >
              让色彩更精准 · 让真实更可见
            </p>

            <h1
              className="font-serif font-bold leading-tight mb-8 bg-clip-text text-transparent bg-spectrum-gradient bg-[length:200%_auto] animate-gradient-shift"
              style={{ fontSize: 'clamp(64px, 10vw, 80px)' }}
            >
              曲泉AI
            </h1>

            <p className="text-brand-muted text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              专业色彩处理智能体，提供一键校色、智能取色、色彩转换、相似度对比、手机视觉校色等功能，让专业色彩触手可及
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/workspace')}
                className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-glow-accent"
              >
                <span
                  className="absolute inset-0 bg-spectrum-gradient bg-[length:200%_auto] animate-gradient-shift"
                />
                <span className="relative flex items-center gap-2">
                  立即体验
                  <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>

              <button
                onClick={() => navigate('/knowledge')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-brand-text border border-brand-border bg-brand-card backdrop-blur-sm transition-all duration-300 hover:border-brand-teal hover:text-brand-teal hover:shadow-glow"
              >
                <Info className="w-5 h-5" />
                了解更多
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center h-[480px]">
            <div
              className="absolute w-80 h-80 rounded-full border border-brand-border animate-pulse-slow"
              style={{ animationDuration: '8s' }}
            />
            <div
              className="absolute w-64 h-64 rounded-full border border-brand-border opacity-50 animate-pulse-slow"
              style={{ animationDuration: '6s' }}
            />

            <div
              className="relative w-80 h-80 animate-[spin_30s_linear_infinite]"
              style={{ animationDuration: '30s' }}
            >
              {colorRingColors.map((color, index) => {
                const angle = (360 / colorRingColors.length) * index;
                const rad = (angle * Math.PI) / 180;
                const radius = 140;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                return (
                  <div
                    key={index}
                    className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full shadow-lg transition-transform duration-300 hover:scale-125 animate-float"
                    style={{
                      backgroundColor: color,
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      animationDelay: `${index * 0.3}s`,
                      boxShadow: `0 0 30px ${color}80`,
                    }}
                  />
                );
              })}
            </div>

            <div
              className="absolute w-32 h-32 rounded-full bg-spectrum-gradient bg-[length:200%_auto] animate-gradient-shift shadow-2xl animate-float"
              style={{
                boxShadow:
                  '0 0 60px rgba(78, 205, 196, 0.4), 0 0 100px rgba(255, 107, 53, 0.3)',
              }}
            />
          </div>
        </div>
      </section>

      <section id="features-section" className="relative py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">
              九大功能
            </h2>
            <p className="text-brand-muted text-lg max-w-2xl mx-auto">
              从专业校色到色彩知识，一站式解决你所有色彩相关需求
            </p>
            <div
              className="mx-auto mt-6 h-1 w-32 rounded-full bg-spectrum-gradient bg-[length:200%_auto] animate-gradient-shift"
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {featureCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => navigate(card.path)}
                  className="group text-left relative p-8 rounded-2xl bg-brand-card border border-brand-border backdrop-blur-md transition-all duration-500 hover:-translate-y-1 overflow-hidden animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${card.gradient.includes('from') ? '' : card.gradient})`,
                      boxShadow: 'inset 0 0 60px rgba(255,255,255,0.03)',
                    }}
                  />
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${card.gradient
                        .replace('from-[', '')
                        .replace('] to-[', ', ')
                        .replace(']', '')})`,
                      padding: '1px',
                      WebkitMask:
                        'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />

                  <div className="relative z-10">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-6 shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}
                    >
                      <Icon className="w-7 h-7 text-white drop-shadow-md" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-3 transition-colors duration-300 group-hover:text-white">
                      {card.title}
                    </h3>

                    <p className="text-brand-muted text-sm leading-relaxed mb-5 transition-colors duration-300 group-hover:text-brand-text/80">
                      {card.description}
                    </p>

                    <div className="flex items-center gap-2 text-brand-teal text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                      立即使用
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  <div
                    className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none bg-gradient-to-br"
                    style={{
                      backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
                    }}
                  >
                    <div
                      className={`w-full h-full bg-gradient-to-br ${card.gradient}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
