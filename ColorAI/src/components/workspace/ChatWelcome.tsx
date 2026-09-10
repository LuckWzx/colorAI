/**
 * 欢迎首屏：曲泉AI 品牌标识 + 功能卡片入口
 */

import { FEATURES } from '@/constants/workspace';
import type { FeatureKey } from '@/types';
import { cn } from '@/lib/utils';

interface ChatWelcomeProps {
  onSelectFeature: (key: FeatureKey) => void;
}

export default function ChatWelcome({ onSelectFeature }: ChatWelcomeProps) {
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
          <span className="sm:hidden"> </span>
          上传图片或描述你的色彩问题
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4 sm:mt-6 px-2 sm:px-0">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => onSelectFeature(f.key)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl p-3 sm:p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]',
                  `bg-gradient-to-br ${f.gradient} text-white shadow-card`
                )}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-2 opacity-90" />
                <p className="text-xs sm:text-sm font-semibold leading-tight">{f.title}</p>
                <p className="text-[10px] sm:text-xs opacity-80 mt-0.5 leading-snug">{f.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
