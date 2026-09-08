import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronsUpDown,
  Camera,
  MapPin,
  Phone,
  Star,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ColorDots from '@/components/ColorDots';
import { knowledgeService } from '@/services/knowledgeService';
import type { QAItem, Shop, Brand } from '@/shared/types';

type TabKey = 'issues' | 'tips' | 'shops' | 'brands';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'issues', label: '拍照偏色原因' },
  { key: 'tips', label: '拍照真实技巧' },
  { key: 'shops', label: '附近色胶商铺' },
  { key: 'brands', label: '工业胶品牌大全' },
];

const CATEGORY_STYLES: Record<string, string> = {
  发红: 'bg-red-50 text-red-700 border-red-200',
  发黄: 'bg-amber-50 text-amber-700 border-amber-200',
  发蓝: 'bg-blue-50 text-blue-700 border-blue-200',
  发暗: 'bg-slate-100 text-slate-600 border-slate-200',
  发白: 'bg-white text-brand-ink border-brand-line',
  其他: 'bg-violet-50 text-violet-700 border-violet-200',
};

const TAG_COLORS = [
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-rose-50 text-rose-700 border-rose-200',
];

const LEVEL_STYLES: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  2: 'bg-blue-50 text-blue-700 border-blue-200',
  3: 'bg-violet-50 text-violet-700 border-violet-200',
};
const LEVEL_LABELS: Record<number, string> = { 1: '入门', 2: '进阶', 3: '专业' };

const CITIES = ['全部', '深圳', '广州', '上海', '北京', '杭州'];
const BRAND_CATS = ['全部', '工业颜色胶', '胶粘剂', '玻璃胶', '密封胶'];
const CITY_API_MAP: Record<string, string> = { 全部: 'all' };

function tagColor(i: number) {
  return TAG_COLORS[i % TAG_COLORS.length];
}

const BRAND_COLORS = [
  '#E4572E',
  '#E8A23B',
  '#0E4D64',
  '#3D7EDB',
  '#D6538E',
  '#6FAE55',
  '#2FA8A0',
  '#6B5BCD',
  '#8A5FD0',
];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
      <span className="font-semibold text-amber-600 tabular-nums text-sm">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function BrandSwatch({ initial, name }: { initial: string; name: string }) {
  const color =
    BRAND_COLORS[
      [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % BRAND_COLORS.length
    ];
  return (
    <div
      className="w-[120px] h-[80px] rounded-xl flex items-center justify-center border border-black/5 shadow-sm"
      style={{ backgroundColor: color }}
    >
      <span className="font-serif font-bold text-4xl text-white">{initial}</span>
    </div>
  );
}

function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card p-5 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-5 w-2/5 rounded-lg bg-brand-ink/[0.07] mb-3" />
          <div className="h-3 w-full rounded bg-brand-ink/[0.05] mb-2" />
          <div className="h-3 w-4/5 rounded bg-brand-ink/[0.05]" />
        </div>
      ))}
    </div>
  );
}

function NoResult({ text = '暂无匹配结果' }: { text?: string }) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-brand-ink/[0.05] border border-brand-line flex items-center justify-center mb-4">
        <Search className="w-7 h-7 text-brand-faint" />
      </div>
      <div className="text-brand-muted text-sm">{text}</div>
    </div>
  );
}

function IssueItem({
  item,
  open,
  onToggle,
}: {
  item: QAItem;
  open: boolean;
  onToggle: () => void;
}) {
  const catStyle =
    CATEGORY_STYLES[item.category || '其他'] || CATEGORY_STYLES['其他'];
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left p-5 hover:bg-brand-ink/[0.02] transition-colors"
      >
        <span
          className={cn(
            'shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border mt-0.5',
            catStyle
          )}
        >
          {item.category || '其他'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-brand-ink leading-snug pr-8">
            {item.question}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 shrink-0 text-brand-muted transition-transform duration-300 mt-0.5',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 space-y-3 animate-fade-in-up border-t border-brand-line">
          <div className="pt-4 text-brand-ink text-[15px] leading-relaxed whitespace-pre-line">
            {item.answer}
          </div>
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {item.tags.map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-lg text-xs border',
                    tagColor(i)
                  )}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TipCard({ tip, index }: { tip: QAItem; index: number }) {
  const lv = tip.level ?? 1;
  const lvStyle = LEVEL_STYLES[lv] || LEVEL_STYLES[1];
  return (
    <div
      className="glass-card p-6 hover:border-brand-primary/30 transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-brand-primary/[0.08] text-brand-primary">
          <Camera className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border', lvStyle)}>
          {LEVEL_LABELS[lv] || '入门'}
        </span>
      </div>
      <h3 className="font-semibold text-brand-ink text-lg mb-3 leading-snug">
        {tip.question}
      </h3>
      <p className="text-brand-muted text-sm leading-relaxed whitespace-pre-line">
        {tip.answer}
      </p>
    </div>
  );
}

function ShopCard({ shop, index }: { shop: Shop; index: number }) {
  return (
    <div
      className="glass-card p-5 hover:border-brand-primary/30 transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-brand-ink text-lg leading-tight pr-2">
          {shop.name}
        </h3>
        <RatingStars rating={shop.rating} />
      </div>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-start gap-2.5 text-brand-ink/85">
          <MapPin className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
          <span className="leading-snug">
            {shop.address}
            <span className="text-brand-muted ml-1">（{shop.city}）</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <Phone className="w-4 h-4 text-brand-accent shrink-0" />
          <a
            href={`tel:${shop.phone}`}
            className="text-brand-accent hover:underline underline-offset-2"
          >
            {shop.phone}
          </a>
        </div>
      </div>
      {shop.products?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-brand-line">
          {shop.products.map((p, i) => (
            <span
              key={p}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs border',
                tagColor(i)
              )}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandCard({ brand, index }: { brand: Brand; index: number }) {
  const initial = brand.initial || brand.name.slice(0, 1);
  return (
    <div
      className="glass-card p-5 hover:border-brand-primary/30 transition-all duration-300 animate-fade-in-up flex flex-col"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-4 mb-4">
        <BrandSwatch initial={initial} name={brand.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-brand-ink leading-tight">{brand.name}</h3>
          </div>
          <RatingStars rating={brand.rating} />
        </div>
      </div>
      {brand.category?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {brand.category.map((c, i) => (
            <span
              key={c}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border',
                tagColor(i)
              )}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="text-brand-muted text-sm leading-relaxed line-clamp-2 mb-4">
        {brand.description || ''}
      </p>
      <div className="mt-auto pt-3 border-t border-brand-line">
        {brand.website ? (
          <a
            href={brand.website}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-secondary !py-2 !px-4 text-sm w-full"
          >
            访问官网
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <div className="text-brand-muted text-xs text-center py-1">暂无官网信息</div>
        )}
      </div>
    </div>
  );
}

export default function Knowledge() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') as TabKey) || 'issues';
  const validTab = TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : 'issues';

  const [tab, setTab] = useState<TabKey>(validTab);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  const [issues, setIssues] = useState<QAItem[]>([]);
  const [tips, setTips] = useState<QAItem[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const [city, setCity] = useState('全部');
  const [brandCat, setBrandCat] = useState('全部');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => clearTimeout(handler);
  }, [keyword]);

  useEffect(() => {
    setTab(validTab);
  }, [validTab]);

  const switchTab = (k: TabKey) => {
    setTab(k);
    const next = new URLSearchParams(searchParams);
    next.set('tab', k);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        if (tab === 'issues') {
          const d = await knowledgeService.getColorIssues(debouncedKeyword);
          if (!cancelled) setIssues(d);
        } else if (tab === 'tips') {
          const d = await knowledgeService.getPhotoTips();
          if (!cancelled) setTips(d);
        } else if (tab === 'shops') {
          const d = await knowledgeService.getShops(CITY_API_MAP[city] || city);
          if (!cancelled) setShops(d);
        } else if (tab === 'brands') {
          const d = await knowledgeService.getBrands(brandCat);
          if (!cancelled) setBrands(d);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tab, debouncedKeyword, city, brandCat]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredIssues = useMemo(() => {
    if (!debouncedKeyword) return issues;
    const kw = debouncedKeyword.toLowerCase();
    return issues.filter(
      (i) =>
        i.question.toLowerCase().includes(kw) ||
        i.answer.toLowerCase().includes(kw) ||
        i.tags?.some((t) => t.toLowerCase().includes(kw))
    );
  }, [issues, debouncedKeyword]);

  const filteredTips = useMemo(() => {
    if (!debouncedKeyword) return tips;
    const kw = debouncedKeyword.toLowerCase();
    return tips.filter(
      (i) =>
        i.question.toLowerCase().includes(kw) ||
        i.answer.toLowerCase().includes(kw) ||
        i.tags?.some((t) => t.toLowerCase().includes(kw))
    );
  }, [tips, debouncedKeyword]);

  const filteredShops = useMemo(() => {
    if (!debouncedKeyword) return shops;
    const kw = debouncedKeyword.toLowerCase();
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.address.toLowerCase().includes(kw) ||
        s.city.toLowerCase().includes(kw) ||
        s.products?.some((p) => p.toLowerCase().includes(kw))
    );
  }, [shops, debouncedKeyword]);

  const filteredBrands = useMemo(() => {
    if (!debouncedKeyword) return brands;
    const kw = debouncedKeyword.toLowerCase();
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(kw) ||
        (b.description || '').toLowerCase().includes(kw) ||
        b.category?.some((c) => c.toLowerCase().includes(kw))
    );
  }, [brands, debouncedKeyword]);

  const groupedIssues = useMemo(() => {
    const groups: Record<string, QAItem[]> = {};
    for (const it of filteredIssues) {
      const k = it.category || '其他';
      (groups[k] ||= []).push(it);
    }
    return groups;
  }, [filteredIssues]);

  return (
    <div className="min-h-screen bg-brand-paper py-12 px-4">
      <div className="container">
        <header className="text-center mb-10 animate-fade-in-up">
          <p className="eyebrow justify-center">
            <ColorDots size={7} />
            Knowledge Base
          </p>
          <h1
            className="font-serif font-bold text-brand-ink mt-4 mb-3"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 3.25rem)' }}
          >
            色彩知识问答
          </h1>
          <p className="text-brand-muted text-[15px] md:text-base max-w-2xl mx-auto">
            偏色原因解答、拍照技巧、附近商铺、工业胶品牌图鉴
          </p>
        </header>

        <div className="relative max-w-2xl mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-faint" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            type="text"
            placeholder="搜索问题、品牌、商铺..."
            className="w-full pl-12 pr-4 py-3.5 text-brand-ink placeholder-brand-faint bg-white border border-brand-line rounded-xl shadow-sm focus:outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 transition-all duration-200"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 justify-center mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={cn('btn-pill', tab === t.key && 'btn-pill-active')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section>
          {loading && <SkeletonList count={tab === 'tips' || tab === 'brands' ? 6 : 4} />}

          {!loading && tab === 'issues' && (
            <div className="space-y-6">
              {Object.keys(groupedIssues).length === 0 && <NoResult />}
              {Object.entries(groupedIssues).map(([cat, items]) => (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border',
                        CATEGORY_STYLES[cat] || CATEGORY_STYLES['其他']
                      )}
                    >
                      {cat}
                    </span>
                    <span className="text-brand-muted text-xs">{items.length} 条</span>
                    <div className="flex-1 h-px bg-brand-line" />
                  </div>
                  <div className="space-y-3">
                    {items.map((it) => (
                      <IssueItem
                        key={it.id}
                        item={it}
                        open={openIds.has(it.id)}
                        onToggle={() => toggleOpen(it.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'tips' && (
            <div className="grid md:grid-cols-2 gap-5">
              {filteredTips.length === 0 && (
                <div className="md:col-span-2">
                  <NoResult />
                </div>
              )}
              {filteredTips.map((t, i) => (
                <TipCard key={t.id} tip={t} index={i} />
              ))}
            </div>
          )}

          {!loading && tab === 'shops' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="relative">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="appearance-none cursor-pointer pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium text-brand-ink bg-white border border-brand-line hover:border-brand-lineStrong focus:outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 transition-all"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c} className="bg-white">
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                </div>
                <div className="text-brand-muted text-xs">
                  共 {filteredShops.length} 家商铺
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {filteredShops.length === 0 && (
                  <div className="md:col-span-2">
                    <NoResult />
                  </div>
                )}
                {filteredShops.map((s, i) => (
                  <ShopCard key={s.id} shop={s} index={i} />
                ))}
              </div>
            </div>
          )}

          {!loading && tab === 'brands' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  {BRAND_CATS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBrandCat(c)}
                      className={cn('btn-pill', brandCat === c && 'btn-pill-active')}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="text-brand-muted text-xs mr-1">
                  共 {filteredBrands.length} 个品牌
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBrands.length === 0 && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <NoResult />
                  </div>
                )}
                {filteredBrands.map((b, i) => (
                  <BrandCard key={b.id} brand={b} index={i} />
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-center mt-8">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
