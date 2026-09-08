import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  BookOpen,
  FileText,
  Cpu,
  TrendingUp,
  Download,
  Clock,
  User,
  Tag,
  BarChart3,
  Newspaper,
  Code,
  BookMarked,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/security';

type TabKey = 'literature' | 'techdoc' | 'algorithm' | 'trend';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const TABS: TabDef[] = [
  { key: 'literature', label: '颜色文献', icon: BookMarked, desc: '学术论文 / 研究报告' },
  { key: 'techdoc', label: '校色技术', icon: FileText, desc: '色彩校正技术文档' },
  { key: 'algorithm', label: '算法集合', icon: Code, desc: '颜色处理算法实现' },
  { key: 'trend', label: '行业趋势', icon: TrendingUp, desc: '色彩行业趋势洞察' },
];

/* ============ Mock Data ============ */

interface Literature {
  id: string;
  title: string;
  author: string;
  source: string;
  date: string;
  tags: string[];
  abstract: string;
  downloads: number;
}

const LITERATURE: Literature[] = [
  {
    id: 'l1',
    title: '基于深度学习的低光照图像色彩校正方法研究',
    author: '张宇, 李明, 王芳',
    source: '《计算机视觉学报》2025.3',
    date: '2025-03-15',
    tags: ['深度学习', '低光照', '色彩校正'],
    abstract: '提出一种基于 U-Net 改进的低光照图像色彩校正网络，通过引入色彩恒常性约束损失函数，实现亮度与色彩的同步恢复。',
    downloads: 1248,
  },
  {
    id: 'l2',
    title: 'CIE DE2000 色差公式的工程化实现与性能分析',
    author: '陈志强, 刘丽',
    source: '《光学技术》2024.11',
    date: '2024-11-20',
    tags: ['CIE', '色差', '色彩工程'],
    abstract: '详细阐述 CIE DE2000 色差公式的数值实现方法，分析在不同色彩空间下的计算精度与性能表现。',
    downloads: 892,
  },
  {
    id: 'l3',
    title: '智能手机摄像头色彩还原算法综述',
    author: '王海涛',
    source: '清华大学博士论文',
    date: '2024-09-01',
    tags: ['手机摄影', '色彩还原', 'ISP'],
    abstract: '系统梳理智能手机 ISP 中的色彩处理流程，包括 AWB、CCM、Gamma 校正等核心算法的演进与对比。',
    downloads: 3520,
  },
  {
    id: 'l4',
    title: '高动态范围(HDR)图像的色彩映射算法研究',
    author: '陈思远, 赵鹏',
    source: 'IEEE Transactions on Image Processing',
    date: '2025-01-08',
    tags: ['HDR', '色彩映射', 'Tone Mapping'],
    abstract: '提出一种感知驱动的 HDR 色彩映射算法，在保持色彩准确性的同时提升视觉对比度。',
    downloads: 2156,
  },
  {
    id: 'l5',
    title: '基于色彩心理学的品牌色彩选择模型',
    author: '林雅婷',
    source: '《设计研究》2024.6',
    date: '2024-06-30',
    tags: ['色彩心理学', '品牌设计', '色彩评估'],
    abstract: '构建结合文化背景与情感维度的品牌色彩选择评估模型，为品牌色彩系统搭建提供量化工具。',
    downloads: 678,
  },
  {
    id: 'l6',
    title: '印刷色彩管理中的 ICC Profile 生成与优化',
    author: '黄建国, 周明',
    source: '《印刷工业》2024.8',
    date: '2024-08-15',
    tags: ['ICC', '色彩管理', '印刷'],
    abstract: '研究印刷流程中 ICC Profile 的生成方法，提出基于分区拟合的 Profile 优化策略，提升跨设备色彩一致性。',
    downloads: 445,
  },
];

interface TechDoc {
  id: string;
  title: string;
  level: '入门' | '中级' | '高级';
  category: string;
  updated: string;
  summary: string;
  readTime: string;
}

const TECHDOCS: TechDoc[] = [
  {
    id: 't1',
    title: '色彩管理基础：从 RGB 到 CMYK',
    level: '入门',
    category: '基础概念',
    updated: '2025-04-10',
    summary: '理解不同色彩空间的转换原理，掌握 ICC Profile 在跨设备色彩传递中的作用。',
    readTime: '8 分钟',
  },
  {
    id: 't2',
    title: '显示器校色实操指南（Spyder/i1Display Pro）',
    level: '入门',
    category: '设备校色',
    updated: '2025-03-22',
    summary: '手把手教你使用 Spyder 或 i1Display Pro 进行显示器硬件校色，获得 ΔE<2 的精准色彩。',
    readTime: '12 分钟',
  },
  {
    id: 't3',
    title: '白平衡(WB)算法详解与实现',
    level: '中级',
    category: 'ISP 算法',
    updated: '2025-02-18',
    summary: '深入分析灰度世界假设、白点检测、深度学习等白平衡算法的原理与优劣对比。',
    readTime: '15 分钟',
  },
  {
    id: 't4',
    title: '相机色彩校正矩阵(CCM)标定教程',
    level: '中级',
    category: 'ISP 算法',
    updated: '2025-01-25',
    summary: '使用 ColorChecker 与 Python 标定相机 CCM 矩阵，实现从传感器空间到 sRGB 的精准转换。',
    readTime: '20 分钟',
  },
  {
    id: 't5',
    title: '色彩恒常性理论：从 Retinex 到深度学习',
    level: '中级',
    category: '色彩科学',
    updated: '2024-12-15',
    summary: '全面理解色彩恒常性的生理机制与计算模型，包括 Retinex、Land 理论及现代深度学习方法。',
    readTime: '25 分钟',
  },
  {
    id: 't6',
    title: '工业色差检测：从目视到仪器',
    level: '高级',
    category: '工业应用',
    updated: '2024-11-28',
    summary: '工业场景下色差检测的完整流程：标准光源选择、测量仪器选型、ΔE 判定标准与质量控制体系。',
    readTime: '18 分钟',
  },
  {
    id: 't7',
    title: '色彩分级系统：DaVinci Resolve 进阶技巧',
    level: '高级',
    category: '视频调色',
    updated: '2024-10-30',
    summary: '在 DaVinci Resolve 中实现电影级色彩分级：节点树结构、LUT 运用、HDR 工作流与色彩叙事。',
    readTime: '30 分钟',
  },
];

interface Algorithm {
  id: string;
  name: string;
  category: string;
  complexity: '简单' | '中等' | '复杂';
  language: string;
  description: string;
  codeSnippet: string;
}

const ALGORITHMS: Algorithm[] = [
  {
    id: 'a1',
    name: 'sRGB 转线性光',
    category: '色彩空间转换',
    complexity: '简单',
    language: 'Python',
    description: '将 sRGB 图像的非线性 Gamma 编码转换为线性光空间，用于后续色彩处理。',
    codeSnippet: `def srgb_to_linear(srgb):
    # sRGB 值范围 [0, 1]
    mask = srgb <= 0.04045
    linear = np.where(mask,
        srgb / 12.92,
        ((srgb + 0.055) / 1.055) ** 2.4
    )
    return linear`,
  },
  {
    id: 'a2',
    name: 'CIEDE2000 色差计算',
    category: '色差评估',
    complexity: '中等',
    language: 'Python',
    description: 'CIE 推荐的最新色差公式，在 CIE Lab 空间中计算两个颜色的感知差异。',
    codeSnippet: `def delta_e_2000(lab1, lab2):
    # 输入：两个 CIE Lab 颜色值
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1 = np.sqrt(a1**2 + b1**2)
    C2 = np.sqrt(a2**2 + b2**2)
    C_avg = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(C_avg**7 / (C_avg**7 + 25**7)))
    a1p = a1 * (1 + G)
    a2p = a2 * (1 + G)
    # ... 完整实现见技术文档 t2
    return dE`,
  },
  {
    id: 'a3',
    name: 'Retinex 色彩恒常性算法',
    category: '色彩恒常性',
    complexity: '复杂',
    language: 'Python',
    description: '基于 Retinex 理论的单尺度/多尺度色彩恒常性算法，用于消除光照影响。',
    codeSnippet: `def retinex_ssr(image, sigma=25):
    img = np.float32(image) + 1.0
    gaussian = cv2.GaussianBlur(img, (0, 0), sigma)
    ssr = np.log(img) - np.log(gaussian)
    ssr = cv2.normalize(ssr, None, 0, 1, cv2.NORM_MINMAX)
    return ssr`,
  },
  {
    id: 'a4',
    name: '灰度世界白平衡',
    category: '白平衡',
    complexity: '简单',
    language: 'Python',
    description: '基于灰度世界假设的自动白平衡算法，通过计算图像均值估计光源色温。',
    codeSnippet: `def gray_world_wb(image):
    avg_r = np.mean(image[:,:,0])
    avg_g = np.mean(image[:,:,1])
    avg_b = np.mean(image[:,:,2])
    gray = (avg_r + avg_g + avg_b) / 3
    image[:,:,0] *= gray / avg_r
    image[:,:,2] *= gray / avg_b
    return np.clip(image, 0, 255).astype(np.uint8)`,
  },
  {
    id: 'a5',
    name: 'Gamma 校正',
    category: '色彩空间转换',
    complexity: '简单',
    language: 'Python',
    description: '对图像进行 Gamma 编码/解码，调整亮度动态范围。',
    codeSnippet: `def gamma_correction(image, gamma=2.2):
    lookup = np.array([((i / 255.0) ** gamma) * 255
                       for i in range(256)]).astype(np.uint8)
    return cv2.LUT(image, lookup)`,
  },
  {
    id: 'a6',
    name: 'Lab 空间色彩迁移',
    category: '色彩风格迁移',
    complexity: '中等',
    language: 'Python',
    description: '在 CIE Lab 空间中实现两幅图像的色彩风格迁移，保留亮度结构。',
    codeSnippet: `def color_transfer(source, target):
    src_lab = cv2.cvtColor(source, cv2.COLOR_BGR2LAB)
    tgt_lab = cv2.cvtColor(target, cv2.COLOR_BGR2LAB)
    # 统计源图与目标图 a/b 通道的均值和方差
    src_mean, src_std = get_stats(src_lab)
    tgt_mean, tgt_std = get_stats(tgt_lab)
    # 匹配统计量
    result_lab = (tgt_lab - tgt_mean) * (src_std / tgt_std) + src_mean
    return cv2.cvtColor(result_lab, cv2.COLOR_LAB2BGR)`,
  },
];

interface Trend {
  id: string;
  title: string;
  category: string;
  heat: '🔥' | '📈' | '💡';
  summary: string;
  date: string;
  reads: number;
  tags: string[];
}

const TRENDS: Trend[] = [
  {
    id: 'tr1',
    title: '2025 春夏流行色趋势：数字世界的治愈色彩',
    category: '流行色',
    heat: '🔥',
    summary: 'Pantone 2025 年度色「Mocha Mousse」引领柔和棕色调流行，数字平台涌现治愈系低饱和色彩方案。',
    date: '2025-04-01',
    reads: 15280,
    tags: ['Pantone', '流行色', '2025'],
  },
  {
    id: 'tr2',
    title: 'AI 色彩生成：Stable Diffusion 与 ControlNet 在色彩设计中的应用',
    category: 'AI 技术',
    heat: '🔥',
    summary: '生成式 AI 正在重塑色彩设计流程，品牌设计师开始使用 AI 快速生成和评估色彩方案。',
    date: '2025-03-20',
    reads: 23560,
    tags: ['AI', '生成式', '色彩设计'],
  },
  {
    id: 'tr3',
    title: 'XR 设备色彩标准：苹果 Vision Pro 与 Meta Quest 的色彩表现对比',
    category: '硬件评测',
    heat: '📈',
    summary: '空间计算时代，XR 设备的色彩还原精度成为新的技术竞争焦点。',
    date: '2025-03-15',
    reads: 8920,
    tags: ['XR', 'Vision Pro', '色彩标准'],
  },
  {
    id: 'tr4',
    title: '可持续色彩：环保染料与水性涂料的技术突破',
    category: '可持续',
    heat: '💡',
    summary: '纺织与涂料行业加速向环保型色彩转型，天然染料与低 VOC 技术迎来规模化应用。',
    date: '2025-03-01',
    reads: 6780,
    tags: ['环保', '染料', '可持续'],
  },
  {
    id: 'tr5',
    title: '电影色彩趋势：从青橙色到"新黑"的审美变迁',
    category: '影视',
    heat: '📈',
    summary: '分析近十年电影调色风格演变，青橙色不再是唯一选择，"新黑"与单色调成为新潮流。',
    date: '2025-02-15',
    reads: 11240,
    tags: ['电影', '调色', '色彩风格'],
  },
  {
    id: 'tr6',
    title: '汽车色彩 2025：从单色到个性化定制',
    category: '工业设计',
    heat: '🔥',
    summary: '新能源时代推动汽车色彩向个性化发展，哑光、金属珠光、变色涂层成为热门选项。',
    date: '2025-02-01',
    reads: 9560,
    tags: ['汽车', '工业设计', '定制'],
  },
];

/* ============ 辅助组件 ============ */

function LevelBadge({ level }: { level: TechDoc['level'] }) {
  const styles: Record<TechDoc['level'], string> = {
    入门: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    中级: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    高级: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', styles[level])}>
      {level}
    </span>
  );
}

function ComplexityBadge({ complexity }: { complexity: Algorithm['complexity'] }) {
  const styles: Record<Algorithm['complexity'], string> = {
    简单: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    中等: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
    复杂: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', styles[complexity])}>
      {complexity}
    </span>
  );
}

/* ============ 主页面 ============ */
export default function TrendReport() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('literature');
  const [keyword, setKeyword] = useState('');

  /* ---- 过滤 ---- */
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const filter = <T extends Record<string, any>>(list: T[], fields: string[]) => {
      if (!k) return list;
      return list.filter((item) =>
        fields.some((f) => String(item[f] ?? '').toLowerCase().includes(k))
      );
    };
    switch (activeTab) {
      case 'literature':
        return filter<Literature>(LITERATURE, ['title', 'author', 'source', 'tags', 'abstract']);
      case 'techdoc':
        return filter<TechDoc>(TECHDOCS, ['title', 'category', 'summary']);
      case 'algorithm':
        return filter<Algorithm>(ALGORITHMS, ['name', 'category', 'description', 'language']);
      case 'trend':
        return filter<Trend>(TRENDS, ['title', 'category', 'summary', 'tags']);
    }
  }, [activeTab, keyword]);

  const activeTabDef = TABS.find((t) => t.key === activeTab)!;

  /* ============ 渲染每个 Tab 的列表项 ============ */
  const renderList = () => {
    if (filtered.length === 0) {
      return (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-brand-muted/60" />
          </div>
          <div className="text-brand-muted">没有匹配的内容，换个关键词试试～</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'literature':
        return (
          <div className="space-y-3">
            {(filtered as Literature[]).map((item) => (
              <article
                key={item.id}
                className="glass-card p-4 hover:border-white/20 transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-brand-accent/20 border border-white/10 flex items-center justify-center shrink-0">
                    <BookMarked className="w-5 h-5 text-brand-accentLight" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-brand-text group-hover:text-brand-accentLight transition-colors mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-brand-muted leading-relaxed mb-2">
                      {item.abstract}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-brand-muted">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.author}
                      </span>
                      <span>·</span>
                      <span>{item.source}</span>
                      <span>·</span>
                      <span>{item.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-brand-muted bg-white/5 px-1.5 py-0.5 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="inline-flex items-center gap-1 text-[11px] text-brand-muted">
                      <Download className="w-3 h-3" />
                      <span className="tabular-nums">{item.downloads}</span>
                    </div>
                    <button className="btn-primary !py-1.5 !px-3 text-[11px] inline-flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      下载
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        );

      case 'techdoc':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(filtered as TechDoc[]).map((item) => (
              <article
                key={item.id}
                className="glass-card p-4 hover:border-white/20 transition-all group cursor-pointer flex flex-col"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-brand-text group-hover:text-brand-accentLight transition-colors text-sm">
                      {item.title}
                    </h3>
                  </div>
                  <LevelBadge level={item.level} />
                </div>
                <p className="text-xs text-brand-muted leading-relaxed mb-3 flex-1">
                  {item.summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-brand-muted pt-2 border-t border-white/5">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {item.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.readTime}
                  </span>
                  <span>{item.updated}</span>
                </div>
              </article>
            ))}
          </div>
        );

      case 'algorithm':
        return (
          <div className="space-y-3">
            {(filtered as Algorithm[]).map((item) => (
              <article
                key={item.id}
                className="glass-card p-4 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-brand-text group-hover:text-brand-accentLight transition-colors">
                        {item.name}
                      </h3>
                      <ComplexityBadge complexity={item.complexity} />
                      <span className="text-[10px] text-brand-muted bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {item.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted leading-relaxed mt-2">
                      {item.description}
                    </p>
                  </div>
                </div>
                <pre className="bg-black/30 rounded-lg p-3 text-xs text-emerald-300/90 font-mono overflow-x-auto leading-relaxed">
                  <code>{item.codeSnippet}</code>
                </pre>
              </article>
            ))}
          </div>
        );

      case 'trend':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(filtered as Trend[]).map((item) => (
              <article
                key={item.id}
                className="glass-card p-4 hover:border-white/20 transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center shrink-0 text-lg">
                    {item.heat}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-brand-text group-hover:text-brand-accentLight transition-colors text-sm">
                        {item.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-brand-muted mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {item.category}
                      </span>
                      <span>·</span>
                      <span>{item.date}</span>
                    </div>
                    <p className="text-xs text-brand-muted leading-relaxed mb-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] text-brand-muted bg-white/5 px-1.5 py-0.5 rounded"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-brand-muted">
                        <BookOpen className="w-3 h-3" />
                        <span className="tabular-nums">{item.reads.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="relative min-h-dvh pb-20">
      {/* 背景 */}
      <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
      <div
        className="fixed top-20 -right-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
      />
      <div
        className="fixed bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 60%)' }}
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
            <span className="text-brand-text">趋势报告</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-accent to-amber-500 flex items-center justify-center shadow-glow">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold spectrum-text">色彩趋势报告</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                汇聚颜色相关学术文献、校色技术文档、算法实现与行业趋势洞察。
              </p>
            </div>
          </div>

          {/* 统计 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '学术文献', value: LITERATURE.length, icon: BookMarked },
              { label: '技术文档', value: TECHDOCS.length, icon: FileText },
              { label: '算法实现', value: ALGORITHMS.length, icon: Cpu },
              { label: '趋势报告', value: TRENDS.length, icon: Newspaper },
            ].map((s) => (
              <div key={s.label} className="glass-card p-3 flex items-center gap-2">
                <s.icon className="w-4 h-4 text-brand-accentLight shrink-0" />
                <div>
                  <div className="text-xs text-brand-muted">{s.label}</div>
                  <div className="font-serif text-lg font-bold spectrum-text tabular-nums">
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs + Search + List */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto">
          {/* Tabs */}
          <div className="glass-card p-3 mb-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setActiveTab(t.key);
                      setKeyword('');
                    }}
                    className={cn(
                      'shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      active
                        ? 'bg-brand-accent/15 text-brand-accentLight border border-brand-accent/30'
                        : 'text-brand-text/80 hover:bg-white/5 border border-transparent'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    <span className="text-[10px] text-brand-muted ml-0.5 hidden sm:inline">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
              <Search className="w-4 h-4 text-brand-muted shrink-0" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(sanitizeText(e.target.value))}
                placeholder={`在「${activeTabDef.label}」中搜索…`}
                className="flex-1 min-w-0 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/70 focus:outline-none"
              />
            </div>
            <div className="text-xs text-brand-muted flex items-center gap-2">
              <span>
                共 <span className="text-brand-text font-medium">{filtered.length}</span> 条结果
              </span>
            </div>
          </div>

          {/* 列表 */}
          {renderList()}
        </div>
      </section>
    </div>
  );
}
