import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Handshake,
  Search,
  MapPin,
  Users,
  Star,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  Briefcase,
  Palette,
  Brush,
  Printer,
  Factory,
  Shirt,
  Megaphone,
  Camera,
  GraduationCap,
  Building2,
  ArrowRight,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  sanitizeText,
  isValidPhone,
  maskPhone,
  maskName,
} from '@/lib/security';
import { useWalletStore } from '@/store/walletStore';

/* ============ 类型 ============ */
type IndustryKey =
  | 'all'
  | 'design'
  | 'brand'
  | 'printing'
  | 'coating'
  | 'textile'
  | 'advertising'
  | 'photography'
  | 'training'
  | 'other';

interface Industry {
  key: IndustryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

interface Shop {
  id: string;
  name: string;
  initial: string;
  gradient: string;
  industry: Exclude<IndustryKey, 'all'>;
  industryLabel: string;
  city: string;
  intro: string;
  tags: string[];
  rating: number;
  cooperationCount: number;
  staff: number;
  established: string;
}

/* ============ 行业导航 ============ */
const INDUSTRIES: Industry[] = [
  { key: 'all', label: '全部', icon: Briefcase, desc: '所有颜色相关行业' },
  { key: 'design', label: '设计公司', icon: Palette, desc: '品牌/视觉/包装设计' },
  { key: 'brand', label: '品牌方', icon: Sparkles, desc: '消费品牌色彩部门' },
  { key: 'printing', label: '印刷打样', icon: Printer, desc: '印厂/打样工作室' },
  { key: 'coating', label: '涂料化工', icon: Factory, desc: '工业颜色胶/涂料' },
  { key: 'textile', label: '纺织染整', icon: Shirt, desc: '染整/色牢度检测' },
  { key: 'advertising', label: '广告传媒', icon: Megaphone, desc: '广告/标识/喷绘' },
  { key: 'photography', label: '摄影后期', icon: Camera, desc: '商业摄影/修图' },
  { key: 'training', label: '培训机构', icon: GraduationCap, desc: '色彩教学/认证' },
  { key: 'other', label: '其他', icon: Building2, desc: '跨界色彩合作' },
];

const INDUSTRY_BADGE: Record<Exclude<IndustryKey, 'all'>, string> = {
  design: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  brand: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  printing: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  coating: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  textile: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  advertising: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  photography: 'bg-teal-500/15 text-teal-300 border-teal-400/30',
  training: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
  other: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
};

/* ============ Mock 商铺数据 ============ */
const SHOPS: Shop[] = [
  {
    id: 's1',
    name: '观色品牌设计',
    initial: '观',
    gradient: 'from-violet-600 to-fuchsia-500',
    industry: 'design',
    industryLabel: '设计公司',
    city: '深圳',
    intro:
      '专注品牌色彩系统搭建，为消费电子/美妆/食品品牌提供从色卡定义到落地的全流程色彩咨询服务，已服务 80+ 头部品牌。',
    tags: ['品牌色彩', '色彩系统', '包装设计'],
    rating: 4.9,
    cooperationCount: 32,
    staff: 25,
    established: '2018',
  },
  {
    id: 's2',
    name: '彩研视觉',
    initial: '彩',
    gradient: 'from-pink-600 to-rose-500',
    industry: 'design',
    industryLabel: '设计公司',
    city: '上海',
    intro:
      '商业视觉与色彩心理学研究机构，擅长用色彩影响消费者决策，提供色彩趋势报告 + 视觉全案。',
    tags: ['色彩心理', '视觉全案', '趋势报告'],
    rating: 4.8,
    cooperationCount: 21,
    staff: 18,
    established: '2016',
  },
  {
    id: 's3',
    name: '未央印务',
    initial: '未',
    gradient: 'from-blue-600 to-cyan-500',
    industry: 'printing',
    industryLabel: '印刷打样',
    city: '广州',
    intro:
      '20 年高端印刷打样经验，G7 色彩管理认证车间，专精 Pantone 专色匹配与 ΔE≤2 高精度打样。',
    tags: ['G7 认证', '专色匹配', '高精度打样'],
    rating: 4.7,
    cooperationCount: 45,
    staff: 60,
    established: '2004',
  },
  {
    id: 's4',
    name: '东方色纺染整',
    initial: '东',
    gradient: 'from-rose-600 to-orange-500',
    industry: 'textile',
    industryLabel: '纺织染整',
    city: '绍兴',
    intro:
      '大型纺织染整工厂，配套实验室级色牢度检测设备，提供从染料配方到大货生产的色彩一致性管控。',
    tags: ['色牢度', '染料配方', '大货管控'],
    rating: 4.6,
    cooperationCount: 18,
    staff: 200,
    established: '2008',
  },
  {
    id: 's5',
    name: '极色涂料实验室',
    initial: '极',
    gradient: 'from-emerald-600 to-teal-500',
    industry: 'coating',
    industryLabel: '涂料化工',
    city: '佛山',
    intro:
      '工业涂料色彩研发实验室，擅长来样配色与色差管控，配套 X-Rite 色差仪与恒温恒湿实验室。',
    tags: ['来样配色', '色差管控', '工业涂料'],
    rating: 4.8,
    cooperationCount: 27,
    staff: 35,
    established: '2015',
  },
  {
    id: 's6',
    name: '素颜人像摄影',
    initial: '素',
    gradient: 'from-teal-600 to-cyan-500',
    industry: 'photography',
    industryLabel: '摄影后期',
    city: '北京',
    intro:
      '高端商业人像摄影工作室，专注肤色还原与色彩叙事，配套 Spyder 校色屏与硬件校准显示器。',
    tags: ['肤色还原', '商业人像', '校色屏'],
    rating: 4.9,
    cooperationCount: 15,
    staff: 12,
    established: '2019',
  },
  {
    id: 's7',
    name: '色界广告',
    initial: '色',
    gradient: 'from-orange-600 to-amber-500',
    industry: 'advertising',
    industryLabel: '广告传媒',
    city: '杭州',
    intro:
      '户外广告色彩专家，擅长大型喷绘与灯箱色彩还原，配套色彩管理软件与户外耐候色卡库。',
    tags: ['户外喷绘', '灯箱色彩', '耐候色卡'],
    rating: 4.5,
    cooperationCount: 38,
    staff: 48,
    established: '2012',
  },
  {
    id: 's8',
    name: '研色学院',
    initial: '研',
    gradient: 'from-purple-600 to-violet-500',
    industry: 'training',
    industryLabel: '培训机构',
    city: '上海',
    intro:
      '色彩管理专业培训机构，提供 Pantone / X-Rite 认证课程、色彩工程师职业培训与企业内训。',
    tags: ['Pantone 认证', '企业内训', '职业培训'],
    rating: 4.9,
    cooperationCount: 12,
    staff: 15,
    established: '2017',
  },
  {
    id: 's9',
    name: '本色生活',
    initial: '本',
    gradient: 'from-amber-600 to-yellow-500',
    industry: 'brand',
    industryLabel: '品牌方',
    city: '深圳',
    intro:
      '家居生活品牌，自建色彩部门管理全产品线色彩系统，寻求色彩技术合作以优化供应链色彩一致性。',
    tags: ['家居品牌', '色彩部门', '供应链'],
    rating: 4.7,
    cooperationCount: 9,
    staff: 120,
    established: '2014',
  },
  {
    id: 's10',
    name: '光影工坊',
    initial: '光',
    gradient: 'from-cyan-600 to-blue-500',
    industry: 'photography',
    industryLabel: '摄影后期',
    city: '广州',
    intro:
      '美食与产品商业摄影工作室，色彩还原达 ΔE≤3，配套标准光源 viewing booth 与色彩管理流程。',
    tags: ['美食摄影', '产品摄影', '标准光源'],
    rating: 4.8,
    cooperationCount: 22,
    staff: 8,
    established: '2020',
  },
  {
    id: 's11',
    name: '印客数码',
    initial: '印',
    gradient: 'from-blue-600 to-indigo-500',
    industry: 'printing',
    industryLabel: '印刷打样',
    city: '东莞',
    intro:
      '数码快印与按需印刷服务商，支持小批量色彩打样与可变数据印刷，配套 inline 色差监测系统。',
    tags: ['数码快印', '小批量打样', '可变印刷'],
    rating: 4.4,
    cooperationCount: 28,
    staff: 40,
    established: '2015',
  },
  {
    id: 's12',
    name: '色域工场',
    initial: '色',
    gradient: 'from-slate-600 to-zinc-500',
    industry: 'other',
    industryLabel: '其他',
    city: '成都',
    intro:
      '跨界色彩艺术工作室，结合色彩与材料、装置艺术，为空间/展览提供色彩方案与互动体验设计。',
    tags: ['色彩艺术', '空间设计', '装置艺术'],
    rating: 4.6,
    cooperationCount: 16,
    staff: 10,
    established: '2021',
  },
];

/* ============ 申请合作 Modal ============ */
interface ApplyForm {
  contact: string;
  phone: string;
  intention: string;
}

function ApplyModal({
  shop,
  onClose,
  onSubmit,
}: {
  shop: Shop | null;
  onClose: () => void;
  onSubmit: (form: ApplyForm) => void;
}) {
  const [form, setForm] = useState<ApplyForm>({ contact: '', phone: '', intention: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ApplyForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  // 切换商铺时重置
  useEffect(() => {
    if (shop) {
      setForm({ contact: '', phone: '', intention: '' });
      setErrors({});
      setSubmitting(false);
    }
  }, [shop]);

  if (!shop) return null;

  const update = (k: keyof ApplyForm, v: string) => {
    const sanitized =
      k === 'phone'
        ? v.replace(/\D/g, '').slice(0, 11)
        : sanitizeText(v);
    setForm((p) => ({ ...p, [k]: sanitized }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.contact.trim()) e.contact = '请填写联系人姓名';
    if (!form.phone.trim()) e.phone = '请填写联系手机号';
    else if (!isValidPhone(form.phone)) e.phone = '手机号格式不正确';
    if (!form.intention.trim()) e.intention = '请简要描述合作意向';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit(form);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-brand-darker/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="glass-card relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 pb-safe">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-brand-muted hover:text-white transition-colors"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 商铺信息 */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br',
              shop.gradient
            )}
          >
            <span className="font-serif font-bold text-xl text-white drop-shadow">
              {shop.initial}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-brand-text truncate">{shop.name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-brand-muted mt-0.5">
              <span className={cn('px-1.5 py-0.5 rounded border', INDUSTRY_BADGE[shop.industry])}>
                {shop.industryLabel}
              </span>
              <span>· {shop.city}</span>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              联系人姓名 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.contact}
              onChange={(e) => update('contact', e.target.value)}
              placeholder="请填写您的真实姓名"
              className={cn(
                'w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none transition-colors',
                errors.contact
                  ? 'border-rose-400/50 focus:border-rose-400'
                  : 'border-white/10 focus:border-brand-accent/50 focus:bg-white/10'
              )}
            />
            {errors.contact && (
              <div className="mt-1 text-[11px] text-rose-400">· {errors.contact}</div>
            )}
          </div>

          <div>
            <label className="text-xs text-brand-muted mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              联系手机号 <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
              placeholder="11 位手机号"
              className={cn(
                'w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none transition-colors',
                errors.phone
                  ? 'border-rose-400/50 focus:border-rose-400'
                  : 'border-white/10 focus:border-brand-accent/50 focus:bg-white/10'
              )}
            />
            {errors.phone && (
              <div className="mt-1 text-[11px] text-rose-400">· {errors.phone}</div>
            )}
          </div>

          <div>
            <label className="text-xs text-brand-muted mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              合作意向 <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={form.intention}
              onChange={(e) => update('intention', e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="简要描述您希望的合作方向，例如：联合开发色彩课程、对接校色 API、联合营销活动…"
              className={cn(
                'w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none transition-colors resize-none',
                errors.intention
                  ? 'border-rose-400/50 focus:border-rose-400'
                  : 'border-white/10 focus:border-brand-accent/50 focus:bg-white/10'
              )}
            />
            <div className="text-right text-[10px] text-brand-muted mt-1">
              {form.intention.length}/300
            </div>
            {errors.intention && (
              <div className="mt-1 text-[11px] text-rose-400">· {errors.intention}</div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary !flex-1 !py-2.5 text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary !flex-1 !py-2.5 text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  提交中…
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  发送申请
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============ 在线聊天 Modal ============ */
interface ChatBubble {
  id: string;
  from: 'user' | 'shop';
  text: string;
  createdAt: number;
}

/**
 * 根据用户输入生成商家自动回复
 * 在线客服场景：报价、库存、产品介绍、下单确认
 */
function generateShopReply(userText: string, colorHex: string | null, shop: Shop): string {
  const t = userText.trim();
  if (!t) return '您好，欢迎咨询～请问需要了解哪款产品？';

  const has = (k: string[]) => k.some((kw) => t.includes(kw));

  if (has(['你好', 'hi', '在吗', '您好']) && t.length < 8) {
    const colorHint = colorHex ? `您要的色号 ${colorHex} 我们有现货，` : '';
    return `您好，欢迎光临「${shop.name}」！${colorHint}请问需要了解什么？我可以为您提供产品报价、规格说明、下单流程等。`;
  }
  if (has(['价格', '多少钱', '报价', '多少钱', '价位'])) {
    const price = (Math.floor(Math.random() * 80) + 60).toFixed(0);
    return `关于 ${colorHex || '该颜色胶'} 的报价：\n· 标准装（500g）：¥${price}\n· 大桶装（5kg）：¥${(Number(price) * 8).toFixed(0)}（更优惠）\n· 样品装（50g）：¥${(Number(price) * 0.2).toFixed(0)}（含色差检测报告）\n请问您需要哪种规格？我可以直接帮您下单～`;
  }
  if (has(['库存', '现货', '有货', '什么时候'])) {
    return `${colorHex ? `色号 ${colorHex} ` : ''}目前库存充足，可当天发货。\n支持顺丰/京东物流，长三角次日达，全国 2-3 天送达。\n如需大批量（>50kg）请提前 3 天预订。`;
  }
  if (has(['色差', '准不准', '一致', 'ΔE', '准确'])) {
    return `我们的颜色胶均经过 X-Rite 色差仪标定，ΔE ≤ 1.5（专业级标准）。\n如收到货后实测色差大于 3，可无条件退换货。\n${colorHex ? `您要的 ${colorHex} 我们已经用色卡比对过，与您取色高度匹配～` : ''}`;
  }
  if (has(['样品', '试色', '样板'])) {
    return `我们提供 ${colorHex || '该色号'} 的免费样品装（10g），仅需支付运费 ¥8。\n您可以先试样再决定大货下单。需要我帮您安排样品吗？`;
  }
  if (has(['下单', '购买', '买', '订', '付款', '支付'])) {
    return `好的，确认下单信息：\n· 商品：${colorHex ? `颜色胶 ${colorHex}` : shop.tags[0] || '颜色胶'}\n· 规格：标准装（500g）\n· 数量：1 件\n· 价格：¥${(Math.floor(Math.random() * 80) + 60).toFixed(0)}\n· 物流：顺丰快递\n\n请确认以上信息，确认后即可生成订单。`;
  }
  if (has(['确认', '好的', '可以', '行', '嗯', 'ok'])) {
    return `✅ 订单已生成！\n订单号：${Date.now().toString().slice(-8)}\n\n请留意收货地址：\n${shop.city}市·顺丰快递·预计 2 日内送达\n\n感谢您的支持！如有任何问题随时联系我们。`;
  }
  if (has(['色号', '颜色', '这个色', colorHex || ''].filter(Boolean) as string[])) {
    return `${colorHex ? `关于 ${colorHex}：` : ''}这是我们 ${shop.industryLabel} 类目下的热销颜色胶，主推产品。\n色牢度 4 级以上，耐候性优秀，适用 ${shop.tags.join('、')} 等场景。\n请问您是用于哪个项目？我可以推荐更匹配的型号。`;
  }
  return `感谢您的咨询！关于"${t}"，我需要确认一下具体需求。\n${shop.intro}\n您可以告诉我具体用途、用量、期望价位，我会为您精准推荐～`;
}

function ChatModal({
  shop,
  colorHex,
  onClose,
}: {
  shop: Shop | null;
  colorHex: string | null;
  onClose: () => void;
}) {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 切换商铺时重置 + 发欢迎语
  useEffect(() => {
    if (shop) {
      const welcome: ChatBubble = {
        id: Math.random().toString(36).slice(2, 10),
        from: 'shop',
        text: `您好，欢迎光临「${shop.name}」！${colorHex ? `我看到您要找色号 ${colorHex} 的颜色胶，我们有现货哦～` : '请问需要了解哪款产品？'}\n我是您的专属客服，可以为您提供报价、库存查询、下单等服务。`,
        createdAt: Date.now(),
      };
      setBubbles([welcome]);
      setInput('');
      setTyping(false);
      setOrdered(false);
    }
  }, [shop, colorHex]);

  // 自动滚动到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bubbles, typing]);

  if (!shop) return null;

  const send = () => {
    const text = sanitizeText(input.trim());
    if (!text) return;
    const userBubble: ChatBubble = {
      id: Math.random().toString(36).slice(2, 10),
      from: 'user',
      text,
      createdAt: Date.now(),
    };
    setBubbles((prev) => [...prev, userBubble]);
    setInput('');
    setTyping(true);

    // 1.2s 后商家自动回复
    setTimeout(() => {
      const reply = generateShopReply(text, colorHex, shop);
      const shopBubble: ChatBubble = {
        id: Math.random().toString(36).slice(2, 10),
        from: 'shop',
        text: reply,
        createdAt: Date.now(),
      };
      setBubbles((prev) => [...prev, shopBubble]);
      setTyping(false);

      // 检测是否触发下单流程（用户回复"确认"等且此前商家提到过下单）
      const historyText = bubbles.map((b) => b.text).join('');
      const userConfirming = /确认|好的|可以|行|嗯|ok/i.test(text);
      const shopOfferedOrder = /下单|购买|订|付款|支付/.test(historyText);
      if (userConfirming && shopOfferedOrder) {
        setOrdered(true);

        // 解析订单信息并保存到钱包
        const orderNo = Date.now().toString().slice(-8);
        // 从商家历史消息中解析价格（格式：价格：¥116 或 ¥82）
        const priceMatch = reply.match(/价格[：:]\s*¥(\d+(?:\.\d+)?)/)
          || historyText.match(/标准装（500g）[：:]\s*¥(\d+(?:\.\d+)?)/);
        const price = priceMatch ? Number(priceMatch[1]) : 0;
        const productLabel = colorHex ? `颜色胶 ${colorHex}` : shop.tags[0] || '颜色胶';

        useWalletStore.getState().addOrder({
          orderNo,
          shopName: shop.name,
          shopId: shop.id,
          product: productLabel,
          colorHex: colorHex || undefined,
          spec: '标准装（500g）',
          quantity: 1,
          price,
          status: 'pending',
        });
      }
    }, 1000 + Math.random() * 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-brand-darker/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="glass-card relative w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden pb-safe">
        {/* 头部 */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br',
              shop.gradient
            )}
          >
            <span className="font-serif font-bold text-lg text-white drop-shadow">
              {shop.initial}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-brand-text truncate flex items-center gap-1.5">
              {shop.name}
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                在线
              </span>
            </div>
            <div className="text-[11px] text-brand-muted mt-0.5">
              {shop.industryLabel} · {shop.city}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-brand-muted hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 颜色 banner */}
        {colorHex && (
          <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-md border border-white/20 shrink-0"
              style={{ background: colorHex, boxShadow: `0 0 16px ${colorHex}50` }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-brand-muted">您要购买的颜色胶</div>
              <div className="font-mono text-sm text-brand-text">{colorHex}</div>
            </div>
            <ShoppingBag className="w-4 h-4 text-brand-accent" />
          </div>
        )}

        {/* 聊天区 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[50vh]"
          style={{ scrollbarWidth: 'thin' }}
        >
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={cn(
                'flex animate-fade-in-up',
                b.from === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
                  b.from === 'user'
                    ? 'bg-spectrum-gradient text-white rounded-br-md shadow-glow-accent'
                    : 'bg-white/5 border border-white/10 text-brand-text rounded-tl-md'
                )}
              >
                {b.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* 下单成功条 */}
        {ordered && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            订单已生成，请保持手机畅通，商家将很快联系您确认收货
          </div>
        )}

        {/* 输入区 */}
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          <button
            onClick={() => {
              setInput('这个颜色多少钱？');
            }}
            className="shrink-0 text-[11px] px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-brand-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            询价
          </button>
          <button
            onClick={() => {
              setInput('有现货吗？');
            }}
            className="shrink-0 text-[11px] px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-brand-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            库存
          </button>
          <button
            onClick={() => {
              setInput('下单购买');
            }}
            className="shrink-0 text-[11px] px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-brand-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            下单
          </button>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
            <input
              value={input}
              onChange={(e) => setInput(sanitizeText(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入消息与商家沟通…"
              className="flex-1 min-w-0 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/70 focus:outline-none"
              maxLength={300}
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className={cn(
                'p-1.5 rounded-md transition-all shrink-0',
                input.trim()
                  ? 'bg-brand-accent text-white hover:scale-105'
                  : 'bg-white/5 text-brand-muted cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 商铺卡片 ============ */
function ShopCard({ shop, onChat, onApply }: { shop: Shop; onChat: () => void; onApply: () => void }) {
  return (
    <article className="glass-card p-5 hover:border-white/20 transition-all hover:-translate-y-0.5 group flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 bg-gradient-to-br',
            shop.gradient
          )}
        >
          <span className="font-serif font-bold text-xl text-white drop-shadow">
            {shop.initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-brand-text group-hover:text-brand-accentLight transition-colors">
              {shop.name}
            </h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', INDUSTRY_BADGE[shop.industry])}>
              {shop.industryLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-brand-muted">
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {shop.city}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {shop.staff} 人
            </span>
            <span>·</span>
            <span>成立于 {shop.established}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-xs font-semibold text-amber-300 tabular-nums">
            {shop.rating.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="text-sm text-brand-muted leading-relaxed mb-3 flex-1">{shop.intro}</p>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {shop.tags.map((t) => (
          <span
            key={t}
            className="text-[11px] text-brand-muted bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
          >
            #{t}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
        <div className="text-[11px] text-brand-muted">
          已促成 <span className="text-brand-accentLight font-semibold tabular-nums">{shop.cooperationCount}</span> 次合作
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onApply}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            title="提交合作意向表单"
          >
            <Handshake className="w-3.5 h-3.5" />
            合作意向
          </button>
          <button
            onClick={onChat}
            className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            预约购买
          </button>
        </div>
      </div>
    </article>
  );
}

/* ============ 主页面 ============ */
export default function PartnerCooperation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetColor = searchParams.get('color');
  const [activeIndustry, setActiveIndustry] = useState<IndustryKey>('all');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'rating' | 'cooperation'>('rating');
  const [applyTarget, setApplyTarget] = useState<Shop | null>(null);
  const [chatTarget, setChatTarget] = useState<Shop | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ shop: Shop; contact: string } | null>(null);

  // 当从工作流进入时（带 color 参数），默认筛选"涂料化工"行业
  useEffect(() => {
    if (targetColor) {
      setActiveIndustry('coating');
    }
  }, [targetColor]);

  const filtered = useMemo(() => {
    let list = SHOPS.filter((s) => {
      if (activeIndustry !== 'all' && s.industry !== activeIndustry) return false;
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(k) ||
          s.intro.toLowerCase().includes(k) ||
          s.tags.some((t) => t.toLowerCase().includes(k)) ||
          s.city.toLowerCase().includes(k)
        );
      }
      return true;
    });
    if (sort === 'rating') {
      list = [...list].sort((a, b) => b.rating - a.rating);
    } else {
      list = [...list].sort((a, b) => b.cooperationCount - a.cooperationCount);
    }
    return list;
  }, [activeIndustry, keyword, sort]);

  const activeInd = INDUSTRIES.find((i) => i.key === activeIndustry)!;

  const handleSubmit = (form: ApplyForm) => {
    if (!applyTarget) return;
    setSuccessInfo({ shop: applyTarget, contact: form.contact });
    setApplyTarget(null);
  };

  /* ============ 申请成功 Toast ============ */
  if (successInfo) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(168,85,247,0.15) 0%, transparent 60%)' }}
        />
        <div className="glass-card p-8 sm:p-10 max-w-md w-full text-center relative z-10">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-brand-accent flex items-center justify-center shadow-glow mb-5">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="font-serif text-2xl font-bold spectrum-text mb-2">合作申请已发送</h2>
          <p className="text-sm text-brand-muted leading-relaxed mb-6">
            感谢您 <span className="text-brand-accentLight font-medium">{maskName(successInfo.contact)}</span>！
            您向「<span className="text-brand-text font-medium">{sanitizeText(successInfo.shop.name)}</span>」的合作意向已发送，
            对方将在 <span className="text-brand-accentLight font-medium">3 个工作日</span> 内与您联系。
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setSuccessInfo(null)}
              className="btn-secondary !flex-1 !py-2.5 text-sm"
            >
              继续浏览
            </button>
            <button
              onClick={() => navigate('/community')}
              className="btn-primary !flex-1 !py-2.5 text-sm"
            >
              返回社区
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh pb-20">
      {/* 背景 */}
      <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
      <div
        className="fixed top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 60%)' }}
      />
      <div
        className="fixed bottom-0 -right-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
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
            <span className="text-brand-text">异业合作</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-brand-accent flex items-center justify-center shadow-glow">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold spectrum-text">异业合作生态</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                连接色彩相关行业的优质商铺与机构，共建 AI 色彩智能体合作生态。
              </p>
            </div>
          </div>

          {/* 数据条 */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '合作商铺', value: SHOPS.length, unit: '家' },
              { label: '覆盖行业', value: INDUSTRIES.length - 1, unit: '类' },
              { label: '已促成合作', value: SHOPS.reduce((s, x) => s + x.cooperationCount, 0), unit: '次' },
              { label: '平均评分', value: (SHOPS.reduce((s, x) => s + x.rating, 0) / SHOPS.length).toFixed(1), unit: '分' },
            ].map((s) => (
              <div key={s.label} className="glass-card p-3">
                <div className="text-xs text-brand-muted mb-1">{s.label}</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-xl font-bold spectrum-text">{s.value}</span>
                  <span className="text-[10px] text-brand-muted">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 工作流颜色匹配 Banner */}
          {targetColor && (
            <div className="mt-4 glass-card p-4 bg-gradient-to-br from-brand-accent/10 to-transparent border-brand-accent/30 flex items-center gap-3 animate-fade-in-up">
              <div
                className="w-12 h-12 rounded-xl border border-white/20 shrink-0"
                style={{ background: targetColor, boxShadow: `0 0 24px ${targetColor}60` }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-brand-text flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                  正在为您匹配颜色胶商家
                </div>
                <div className="text-xs text-brand-muted mt-0.5">
                  目标色号：<span className="font-mono text-brand-accentLight">{targetColor}</span>
                  <span className="mx-1.5">·</span>
                  下方商家均支持该色号颜色胶，点击「预约购买」即可在线沟通下单
                </div>
              </div>
              <button
                onClick={() => navigate('/workspace')}
                className="shrink-0 btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3 rotate-180" />
                返回工作台
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 行业导航 + 列表 */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-6xl mx-auto">
          {/* 行业标签 */}
          <div className="glass-card p-3 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {INDUSTRIES.map((i) => {
                const Icon = i.icon;
                const active = activeIndustry === i.key;
                return (
                  <button
                    key={i.key}
                    onClick={() => setActiveIndustry(i.key)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                      active
                        ? 'bg-brand-accent/15 text-brand-accentLight border border-brand-accent/30'
                        : 'text-brand-text/80 hover:bg-white/5 border border-transparent'
                    )}
                    title={i.desc}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {i.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
              <Search className="w-4 h-4 text-brand-muted shrink-0" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(sanitizeText(e.target.value))}
                placeholder="搜索商铺名称、行业关键词、城市…"
                className="flex-1 min-w-0 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/70 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              {(
                [
                  { k: 'rating', label: '评分' },
                  { k: 'cooperation', label: '合作数' },
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

          {/* 结果统计 */}
          <div className="mb-3 flex items-center gap-2 text-sm text-brand-muted">
            <span>
              当前：<span className="text-brand-text font-medium">{activeInd.label}</span>
            </span>
            <span>·</span>
            <span>共 <span className="text-brand-text">{filtered.length}</span> 家商铺</span>
          </div>

          {/* 商铺列表 */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((s) => (
                <ShopCard
                  key={s.id}
                  shop={s}
                  onChat={() => setChatTarget(s)}
                  onApply={() => setApplyTarget(s)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-brand-muted/60" />
              </div>
              <div className="text-brand-muted">没有匹配的商铺，换个关键词或行业试试～</div>
            </div>
          )}

          {/* 底部 CTA */}
          <div className="mt-8 glass-card p-5 bg-gradient-to-br from-violet-500/10 to-brand-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-serif text-base font-bold spectrum-text mb-1">
                没找到合适的合作方？
              </div>
              <p className="text-xs text-brand-muted">
                告诉我们您的需求，曲泉AI 团队将为您精准匹配合作方。
              </p>
            </div>
            <button
              onClick={() => navigate('/merchant-onboarding')}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5 shrink-0"
            >
              提交商户入驻
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 申请合作 Modal */}
      <ApplyModal
        shop={applyTarget}
        onClose={() => setApplyTarget(null)}
        onSubmit={handleSubmit}
      />

      {/* 预约购买 / 在线聊天 Modal */}
      <ChatModal
        shop={chatTarget}
        colorHex={targetColor}
        onClose={() => setChatTarget(null)}
      />
    </div>
  );
}
