import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  MessageCircle,
  Eye,
  ThumbsUp,
  Pin,
  Flame,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Image as ImageIcon,
  Pipette,
  Palette,
  GitCompare,
  Smartphone,
  HelpCircle,
  Briefcase,
  Library,
  BarChart3,
  Store,
  Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ============ 类型 ============ */
interface Post {
  id: string;
  author: string;
  avatarColor: string;
  authorLevel: number;
  createdAt: string;
  category: CategoryKey;
  title: string;
  excerpt: string;
  tags: string[];
  replies: number;
  views: number;
  likes: number;
  pinned?: boolean;
  hot?: boolean;
}

type CategoryKey =
  | 'all'
  | 'correct'
  | 'pick'
  | 'convert'
  | 'compare'
  | 'phone'
  | 'diagnose'
  | 'industry'
  | 'free';

interface Category {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

/* ============ 分类 ============ */
const CATEGORIES: Category[] = [
  { key: 'all', label: '全部', icon: Sparkles, desc: '所有讨论' },
  { key: 'correct', label: 'AI 校色', icon: ImageIcon, desc: '一键校正相关讨论' },
  { key: 'pick', label: '智能取色', icon: Pipette, desc: '取色器使用与案例' },
  { key: 'convert', label: '色彩转换', icon: Palette, desc: 'HEX/RGB/CMYK/Lab 互转' },
  { key: 'compare', label: '颜色对比', icon: GitCompare, desc: '相似度与 ΔE 量化' },
  { key: 'phone', label: '手机拍照', icon: Smartphone, desc: '手机拍摄校色技巧' },
  { key: 'diagnose', label: '偏色诊断', icon: HelpCircle, desc: '发红/发黄/发蓝等问题' },
  { key: 'industry', label: '行业应用', icon: Briefcase, desc: '印刷/涂料/纺织/设计' },
  { key: 'free', label: '自由讨论', icon: Flame, desc: '聊聊色彩一切' },
];

const CATEGORY_BADGE: Record<Exclude<CategoryKey, 'all'>, string> = {
  correct: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  pick: 'bg-teal-500/15 text-teal-300 border-teal-400/30',
  convert: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  compare: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  phone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  diagnose: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  industry: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
  free: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
};

/* ============ Mock 帖子 ============ */
const MOCK_POSTS: Post[] = [
  {
    id: 'p01',
    author: '色彩研究员-Lin',
    avatarColor: '#FF6B35',
    authorLevel: 3,
    createdAt: '2026-08-05 09:12',
    category: 'correct',
    title: 'AI 一键校正在逆光人像上的实测：肤色还原优于手动曲线',
    excerpt:
      '用曲泉AI对一组逆光人像做了一键校正，对比 Photoshop 手动曲线调整。结果显示 AI 在肤色色温恢复上更稳定，但高光细节略有损失。分享完整对比图和参数。',
    tags: ['逆光人像', '肤色还原', '白平衡'],
    replies: 48,
    views: 1284,
    likes: 96,
    pinned: true,
    hot: true,
  },
  {
    id: 'p02',
    author: '印刷老张',
    avatarColor: '#0E4D64',
    authorLevel: 2,
    createdAt: '2026-08-05 08:40',
    category: 'industry',
    title: '印刷打样与屏幕色差如何系统性消除？ΔE 控制在 3 以内的实操',
    excerpt:
      '分享一套从相机校色 → 屏幕校准 → 打样验证的完整闭环，用曲泉AI辅助取色和对比，把 ΔE 稳定控制在 3 以内，欢迎同行交流。',
    tags: ['印刷打样', 'ΔE', '色彩管理'],
    replies: 32,
    views: 892,
    likes: 71,
    hot: true,
  },
  {
    id: 'p03',
    author: '设计师小满',
    avatarColor: '#4ECDC4',
    authorLevel: 2,
    createdAt: '2026-08-04 22:15',
    category: 'convert',
    title: 'HEX 转 CMYK 总是偏色？一文讲清 RGB / CMYK / Lab 的转换陷阱',
    excerpt:
      '为什么同一组 HEX 在不同软件里转出来的 CMYK 不一样？原因是 sRGB 与 Display P3 的色域差异。本文用曲泉AI转换器做对照演示。',
    tags: ['色彩空间', 'CMYK', '色域'],
    replies: 25,
    views: 645,
    likes: 58,
  },
  {
    id: 'p04',
    author: '摄影师阿K',
    avatarColor: '#a855f7',
    authorLevel: 3,
    createdAt: '2026-08-04 18:30',
    category: 'phone',
    title: 'iPhone 15 Pro 拍美食为何发黄？三步用曲泉AI还原真实色彩',
    excerpt:
      '餐厅暖光下 iPhone 容易把食物拍得过黄。本文用曲泉AI手机校色功能，配合原始 EXIF 信息，三步还原让人垂涎的真实色调。',
    tags: ['iPhone', '美食摄影', '白平衡'],
    replies: 19,
    views: 537,
    likes: 44,
  },
  {
    id: 'p05',
    author: '涂料工程师-Wang',
    avatarColor: '#eab308',
    authorLevel: 3,
    createdAt: '2026-08-04 15:02',
    category: 'compare',
    title: '来样对比：曲泉AI ΔE2000 与传统色差仪的偏差在可接受范围',
    excerpt:
      '在工业涂料来样检验场景中，对比了曲泉AI颜色相似度对比功能与 X-Rite 色差仪的数据，平均偏差 ΔE ≈ 0.8，完全可用于产线快速筛查。',
    tags: ['涂料', '色差仪', '来样检验'],
    replies: 41,
    views: 768,
    likes: 67,
    hot: true,
  },
  {
    id: 'p06',
    author: '新手村-阿明',
    avatarColor: '#10b981',
    authorLevel: 1,
    createdAt: '2026-08-04 11:48',
    category: 'diagnose',
    title: '求助：室内白炽灯下拍出来的人脸发红，怎么破？',
    excerpt:
      '家里是暖白光台灯，手机拍出来人脸通红。试过手动调白平衡但效果不理想，请问曲泉AI能自动识别这种偏色吗？附图。',
    tags: ['白炽灯', '发红', '求助'],
    replies: 12,
    views: 312,
    likes: 18,
  },
  {
    id: 'p07',
    author: 'UI设计师-Coco',
    avatarColor: '#ec4899',
    authorLevel: 2,
    createdAt: '2026-08-03 20:25',
    category: 'pick',
    title: '从一张风景照建立完整品牌色板：曲泉AI取色器工作流分享',
    excerpt:
      '把一张日落照片导入曲泉AI，取 5 个主色，再通过色彩空间转换得到 HEX/RGB/HSL，最终输出为可导入 Figma 的品牌色 token。',
    tags: ['品牌色板', 'Figma', '取色工作流'],
    replies: 28,
    views: 619,
    likes: 53,
  },
  {
    id: 'p08',
    author: '纺织质检员-Zhao',
    avatarColor: '#3b82f6',
    authorLevel: 2,
    createdAt: '2026-08-03 16:10',
    category: 'industry',
    title: '纺织品色牢度测试中，AI 取色能否替代人工对色？',
    excerpt:
      '传统色牢度评级依赖人工对色，主观性强。尝试用曲泉AI取色 + 相似度对比做客观化评分，与人工评级一致性达 92%。',
    tags: ['纺织', '色牢度', '客观化'],
    replies: 35,
    views: 704,
    likes: 60,
  },
  {
    id: 'p09',
    author: '自由撰稿人-木子',
    avatarColor: '#f97316',
    authorLevel: 1,
    createdAt: '2026-08-03 10:30',
    category: 'free',
    title: '聊聊：色彩智能体会取代调色师吗？',
    excerpt:
      'AI 校色越来越强，调色师这个职业会消失吗？我的看法是：AI 替代的是机械重复，调色师的审美与叙事能力反而更稀缺。',
    tags: ['行业观察', 'AI替代', '调色师'],
    replies: 87,
    views: 1542,
    likes: 124,
    hot: true,
  },
  {
    id: 'p10',
    author: '产品经理-Echo',
    avatarColor: '#8b5cf6',
    authorLevel: 2,
    createdAt: '2026-08-02 21:45',
    category: 'free',
    title: '建议：希望曲泉AI增加"批量校正 + 导出预设"功能',
    excerpt:
      '摄影修图场景常常需要批量处理几百张照片并保持一致的调性。希望能在 Workspace 里支持批处理和保存预设，类似 LightRoom 的风格。',
    tags: ['功能建议', '批处理', '预设'],
    replies: 56,
    views: 928,
    likes: 89,
  },
];

const HOT_TOPICS = [
  { title: 'AI 一键校正在逆光人像上的实测', heat: 1284, trend: '+12%' },
  { title: '色彩智能体会取代调色师吗？', heat: 1542, trend: '+24%' },
  { title: 'HEX 转 CMYK 总是偏色？', heat: 645, trend: '+8%' },
  { title: '印刷打样 ΔE 控制在 3 以内', heat: 892, trend: '+15%' },
  { title: 'iPhone 15 Pro 拍美食发黄怎么办', heat: 537, trend: '+6%' },
];

const LEVEL_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: '入门', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  2: { label: '进阶', cls: 'bg-blue-500/15 text-blue-300 border-blue-400/30' },
  3: { label: '专业', cls: 'bg-purple-500/15 text-purple-300 border-purple-400/30' },
};

/* ============ 组件 ============ */
function Avatar({ name, color }: { name: string; color: string }) {
  const initial = name.slice(0, 1);
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold text-white shadow-lg shrink-0"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
    >
      {initial}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const cat = CATEGORIES.find((c) => c.key === post.category)!;
  const catBadge = CATEGORY_BADGE[post.category as Exclude<CategoryKey, 'all'>];
  const level = LEVEL_LABELS[post.authorLevel];

  return (
    <article className="glass-card p-5 hover:border-white/20 transition-all hover:-translate-y-0.5 group">
      <div className="flex items-start gap-4">
        <Avatar name={post.author} color={post.avatarColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-medium text-brand-text">{post.author}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', level.cls)}>
              {level.label}
            </span>
            <span className="text-xs text-brand-muted">{post.createdAt}</span>
            {post.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-accent/15 text-brand-accent border border-brand-accent/30">
                <Pin className="w-3 h-3" /> 置顶
              </span>
            )}
            {post.hot && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-400/30">
                <Flame className="w-3 h-3" /> 热议
              </span>
            )}
          </div>

          <h3 className="font-serif text-lg font-bold text-brand-text leading-snug mb-2 group-hover:text-brand-accentLight transition-colors">
            {post.title}
          </h3>

          <p className="text-sm text-brand-muted leading-relaxed mb-3 line-clamp-2">
            {post.excerpt}
          </p>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium',
                catBadge
              )}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </span>
            {post.tags.map((t, i) => (
              <span
                key={t}
                className="text-[11px] text-brand-muted bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
              >
                #{t}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-5 text-xs text-brand-muted">
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              <span className="tabular-nums">{post.replies}</span> 回复
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span className="tabular-nums">{post.views.toLocaleString()}</span> 浏览
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4" />
              <span className="tabular-nums">{post.likes}</span> 赞
            </span>
            <button className="ml-auto inline-flex items-center gap-1 text-brand-accentLight hover:text-brand-accent transition-colors">
              查看详情 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ============ 主页面 ============ */
export default function Community() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');

  const filteredPosts = useMemo(() => {
    let list = MOCK_POSTS.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (
          p.title.toLowerCase().includes(k) ||
          p.excerpt.toLowerCase().includes(k) ||
          p.tags.some((t) => t.toLowerCase().includes(k))
        );
      }
      return true;
    });
    if (sort === 'hot') {
      list = [...list].sort((a, b) => b.views + b.replies * 5 - (a.views + a.replies * 5));
    }
    // 置顶永远在前
    return list.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [activeCategory, keyword, sort]);

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

  return (
    <div className="relative min-h-dvh pb-20">
      {/* 背景光晕 */}
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
      <section className="relative pt-16 pb-10 px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-brand-muted mb-4">
            <span>曲泉AI</span>
            <span>/</span>
            <span className="text-brand-text">色研社区</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift flex items-center justify-center shadow-glow">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="font-serif text-4xl md:text-5xl font-bold spectrum-text">曲泉色研社区</h1>
              </div>
              <p className="text-brand-muted leading-relaxed max-w-2xl">
                围绕 <span className="text-brand-accentLight font-medium">AI 颜色智能体</span> 的开放讨论区。
                分享校色实测、取色转换技巧、偏色诊断案例与行业应用，
                与色彩研究员、设计师、摄影师、印刷/涂料/纺织从业者一起，把色彩做得更准。
              </p>
            </div>
            <button onClick={() => navigate('/start-discussion')} className="btn-primary !py-3 !px-6 inline-flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              发起讨论
            </button>
          </div>

          {/* 功能入口 */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: Library,
                title: '色卡库',
                desc: '行业标准色卡 · 品牌色库',
                badge: '3,284 套',
                gradient: 'from-orange-500/20 to-rose-500/20',
                onClick: () => navigate('/color-library'),
              },
              {
                icon: BarChart3,
                title: '趋势报告',
                desc: 'AI 色彩趋势洞察',
                badge: '本周更新',
                gradient: 'from-brand-accent/20 to-amber-500/20',
                onClick: () => navigate('/trend-report'),
              },
              {
                icon: Store,
                title: '商户入驻',
                desc: '色胶商铺 / 冲印店地图',
                badge: '立即申请',
                gradient: 'from-brand-teal/20 to-emerald-500/20',
                onClick: () => navigate('/merchant-onboarding'),
              },
              {
                icon: Handshake,
                title: '异业合作',
                desc: '设计师 / 品牌方 / 培训机构',
                badge: '合作洽谈',
                gradient: 'from-violet-500/20 to-brand-accent/20',
                onClick: () => navigate('/partner-cooperation'),
              },
            ].map((f) => (
              <button
                key={f.title}
                onClick={f.onClick}
                className="group glass-card p-4 text-left hover:-translate-y-0.5 hover:border-white/20 transition-all relative overflow-hidden"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                />
                <div className="relative flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0">
                    <f.icon className="w-5 h-5 text-brand-accentLight group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-semibold text-brand-text">{f.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-accentLight group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="text-xs text-brand-muted leading-snug mb-2">{f.desc}</div>
                    <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-brand-muted group-hover:text-brand-accentLight">
                      {f.badge}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 主体 */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-6">
          {/* 左侧：分类 */}
          <aside className="space-y-2">
            <div className="glass-card p-2">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-brand-muted">
                讨论分类
              </div>
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = activeCategory === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setActiveCategory(c.key)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                      active
                        ? 'bg-brand-accent/15 text-brand-accentLight border border-brand-accent/30'
                        : 'text-brand-text/80 hover:bg-white/5 border border-transparent'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{c.label}</div>
                      <div className="text-[10px] text-brand-muted truncate">{c.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-brand-accent" />
                <span className="text-sm font-semibold">本周热榜</span>
              </div>
              <ol className="space-y-2.5">
                {HOT_TOPICS.map((t, i) => (
                  <li key={t.title} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        'shrink-0 w-5 h-5 rounded-md flex items-center justify-center font-bold tabular-nums',
                        i < 3
                          ? 'bg-brand-accent/20 text-brand-accentLight'
                          : 'bg-white/5 text-brand-muted'
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-brand-text/90 leading-snug line-clamp-2">{t.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-brand-muted mt-0.5">
                        <span>{t.heat.toLocaleString()} 热度</span>
                        <span className="text-emerald-400">{t.trend}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* 中间：帖子列表 */}
          <div>
            {/* 工具栏 */}
            <div className="glass-card p-3 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
                <Search className="w-4 h-4 text-brand-muted shrink-0" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索标题、摘要或标签…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/70 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                {(
                  [
                    { k: 'latest', label: '最新' },
                    { k: 'hot', label: '热门' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setSort(s.k)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      sort === s.k
                        ? 'bg-brand-accent/20 text-brand-accentLight'
                        : 'text-brand-muted hover:text-white'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 text-sm text-brand-muted">
              <span>
                当前：<span className="text-brand-text font-medium">{activeCat.label}</span>
              </span>
              <span>·</span>
              <span>共 <span className="text-brand-text">{filteredPosts.length}</span> 条讨论</span>
            </div>

            <div className="space-y-4">
              {filteredPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {filteredPosts.length === 0 && (
                <div className="glass-card p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-brand-muted/60" />
                  </div>
                  <div className="text-brand-muted">没有匹配的讨论，换个关键词试试～</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <button className="btn-secondary !py-2.5 !px-6 text-sm">加载更多讨论</button>
            </div>
          </div>

          {/* 右侧：活跃成员 / 社区公约 */}
          <aside className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold">本周活跃成员</span>
              </div>
              <div className="space-y-3">
                {MOCK_POSTS.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs text-brand-muted w-4 tabular-nums">{i + 1}</span>
                    <Avatar name={p.author} color={p.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-brand-text truncate">{p.author}</div>
                      <div className="text-[10px] text-brand-muted">
                        贡献 <span className="text-brand-accentLight">{120 - i * 18}</span> 帖
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-teal" />
                <span className="text-sm font-semibold">社区公约</span>
              </div>
              <ul className="space-y-2 text-xs text-brand-muted leading-relaxed">
                <li>· 围绕 AI 颜色智能体与色彩专业话题讨论</li>
                <li>· 分享实测数据与案例时请附图与参数</li>
                <li>· 尊重不同行业视角，理性交流</li>
                <li>· 禁止广告、引战与不实信息</li>
              </ul>
              <button className="mt-4 w-full btn-secondary !py-2 text-xs">查看完整规范</button>
            </div>

            <div className="glass-card p-4 bg-gradient-to-br from-brand-accent/10 to-brand-teal/10">
              <div className="font-serif text-base font-bold spectrum-text mb-1">想体验 AI 校色？</div>
              <p className="text-xs text-brand-muted mb-3">在 Workspace 直接试用，再回到社区分享你的发现。</p>
              <a href="/workspace" className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1.5">
                进入工作台 <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
