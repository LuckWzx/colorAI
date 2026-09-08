import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Store,
  Building2,
  User,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  Hash,
  CheckCircle2,
  Sparkles,
  Image as ImageIcon,
  Camera,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  sanitizeText,
  isValidPhone,
  isValidLicense,
  maskPhone,
  maskLicense,
  maskName,
  maskAddress,
} from '@/lib/security';

/* ============ 类型 ============ */
interface MerchantForm {
  name: string;
  contact: string;
  phone: string;
  category: string;
  city: string;
  address: string;
  license: string;
  description: string;
}

interface FormErrors {
  name?: string;
  contact?: string;
  phone?: string;
  category?: string;
  city?: string;
  address?: string;
  license?: string;
}

const CATEGORIES = [
  '色胶/冲印店',
  '艺术微喷工作室',
  '摄影工作室',
  '调色师/后期',
  '印刷打样',
  '广告/设计公司',
  '涂料/化工',
  '纺织/染整',
  '其他',
];

const CITIES = [
  '深圳', '广州', '上海', '北京', '杭州', '成都', '武汉',
  '南京', '西安', '重庆', '苏州', '天津', '长沙', '青岛',
  '其他',
];

/* ============ 主页面 ============ */
export default function MerchantOnboarding() {
  const navigate = useNavigate();
  const [form, setForm] = useState<MerchantForm>({
    name: '',
    contact: '',
    phone: '',
    category: '',
    city: '',
    address: '',
    license: '',
    description: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof MerchantForm>(key: K, value: MerchantForm[K]) => {
    const sanitized =
      key === 'phone'
        ? String(value).replace(/\D/g, '').slice(0, 11)
        : sanitizeText(String(value));
    setForm((prev) => ({ ...prev, [key]: sanitized as MerchantForm[K] }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = '请填写店铺/品牌名称';
    if (!form.contact.trim()) e.contact = '请填写联系人姓名';
    if (!form.phone.trim()) e.phone = '请填写联系手机号';
    else if (!isValidPhone(form.phone)) e.phone = '手机号格式不正确';
    if (!form.category) e.category = '请选择经营品类';
    if (!form.city) e.city = '请选择所在城市';
    if (!form.address.trim()) e.address = '请填写详细地址';
    if (form.license && !isValidLicense(form.license)) e.license = '营业执照编号格式不正确';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  const resetAndBack = () => {
    setSubmitted(false);
    setForm({
      name: '', contact: '', phone: '', category: '',
      city: '', address: '', license: '', description: '',
    });
    navigate('/community');
  };

  /* ============ 提交成功态 ============ */
  if (submitted) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,107,53,0.12) 0%, transparent 60%)' }}
        />
        <div className="glass-card p-8 sm:p-10 max-w-md w-full text-center relative z-10">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-brand-accent to-brand-teal flex items-center justify-center shadow-glow mb-5">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="font-serif text-2xl font-bold spectrum-text mb-2">入驻申请已提交</h2>
          <p className="text-sm text-brand-muted leading-relaxed mb-6">
            感谢您 <span className="text-brand-accentLight font-medium">{maskName(form.contact)}</span>
            ！我们已收到「<span className="text-brand-text font-medium">{sanitizeText(form.name)}</span>」的入驻申请，
            联系手机 <span className="text-brand-text font-medium tabular-nums">{maskPhone(form.phone)}</span>，
            曲泉AI 运营团队将在 <span className="text-brand-accentLight font-medium">3 个工作日</span> 内与您联系沟通。
          </p>

          <div className="glass-card !bg-white/5 !border-white/10 p-4 text-left mb-6 text-xs">
            <div className="flex items-center gap-2 mb-2 text-brand-accentLight">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold">您将获得的权益</span>
            </div>
            <ul className="space-y-1.5 text-brand-muted">
              <li>· 入驻曲泉AI色卡库与商户地图，面向全平台用户曝光</li>
              <li>· AI 色彩校正能力对接，为您的客户提供专业色彩服务</li>
              <li>· 社区推荐位曝光 + 品牌专栏采访机会</li>
              <li>· 首批入驻商户享 6 个月免费权益</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={resetAndBack} className="btn-secondary !flex-1 !py-2.5 text-sm">
              返回社区
            </button>
            <button
              onClick={() => setSubmitted(false)}
              className="btn-primary !flex-1 !py-2.5 text-sm"
            >
              继续编辑
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ 表单 ============ */
  return (
    <div className="relative min-h-dvh pb-20">
      {/* 背景 */}
      <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
      <div
        className="fixed top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4ECDC4 0%, transparent 60%)' }}
      />
      <div
        className="fixed bottom-0 -right-20 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
      />

      {/* Hero */}
      <section className="relative pt-16 pb-6 px-4 lg:px-8">
        <div className="container max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-brand-muted mb-3">
            <button onClick={() => navigate('/community')} className="hover:text-brand-accentLight transition-colors">
              曲泉AI
            </button>
            <span>/</span>
            <button onClick={() => navigate('/community')} className="hover:text-brand-accentLight transition-colors">
              色研社区
            </button>
            <span>/</span>
            <span className="text-brand-text">商户入驻</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-teal to-emerald-500 flex items-center justify-center shadow-glow">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold spectrum-text">商户入驻申请</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                加入曲泉AI生态，为色彩从业者与爱好者提供专业服务。所有信息仅用于审核，严格保密。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 表单主体 */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="glass-card p-5 sm:p-7 space-y-6">
            {/* 基本信息 */}
            <div>
              <SectionTitle icon={<Building2 className="w-3.5 h-3.5 text-brand-accentLight" />} title="基本信息" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field
                  label="店铺/品牌名称"
                  required
                  icon={<Store className="w-4 h-4" />}
                  error={errors.name}
                >
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="例：色彩实验室 Color Lab"
                    className={inputCls(!!errors.name)}
                  />
                </Field>

                <Field
                  label="联系人姓名"
                  required
                  icon={<User className="w-4 h-4" />}
                  error={errors.contact}
                >
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) => update('contact', e.target.value)}
                    placeholder="请填写您的真实姓名"
                    className={inputCls(!!errors.contact)}
                  />
                </Field>

                <Field
                  label="联系手机号"
                  required
                  icon={<Phone className="w-4 h-4" />}
                  error={errors.phone}
                >
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
                    placeholder="11 位手机号，我们将在 3 个工作日内联系您"
                    className={inputCls(!!errors.phone)}
                  />
                </Field>

                <Field
                  label="经营品类"
                  required
                  icon={<Briefcase className="w-4 h-4" />}
                  error={errors.category}
                >
                  <select
                    value={form.category}
                    onChange={(e) => update('category', e.target.value)}
                    className={inputCls(!!errors.category)}
                  >
                    <option value="">请选择经营品类</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* 店铺位置 */}
            <div>
              <SectionTitle icon={<MapPin className="w-4 h-4" />} title="店铺位置" />
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 mt-4">
                <Field
                  label="所在城市"
                  required
                  icon={<MapPin className="w-4 h-4" />}
                  error={errors.city}
                >
                  <select
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    className={inputCls(!!errors.city)}
                  >
                    <option value="">请选择城市</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="详细地址"
                  required
                  icon={<MapPin className="w-4 h-4" />}
                  error={errors.address}
                >
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                    placeholder="街道、门牌号、楼层等详细位置"
                    className={inputCls(!!errors.address)}
                  />
                </Field>
              </div>
            </div>

            {/* 资质与简介 */}
            <div>
              <SectionTitle icon={<FileText className="w-4 h-4" />} title="资质与简介" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field
                  label="营业执照编号"
                  icon={<Hash className="w-4 h-4" />}
                  hint="选填，个体工商户可填身份证号后 6 位"
                  error={errors.license}
                >
                  <input
                    type="text"
                    value={form.license}
                    onChange={(e) => update('license', e.target.value)}
                    placeholder="统一社会信用代码（选填）"
                    className={inputCls(!!errors.license)}
                  />
                </Field>

                <Field
                  label="店铺简介"
                  icon={<Sparkles className="w-4 h-4" />}
                  hint="简要介绍您的主营方向、特色、服务能力"
                >
                  <textarea
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder="例：专注人像摄影 8 年，擅长肤色还原与色彩管理...（最多 200 字）"
                    className={cn(inputCls(false), 'resize-none')}
                  />
                  <div className="text-right text-[10px] text-brand-muted mt-1">
                    {form.description.length}/200
                  </div>
                </Field>
              </div>
            </div>

            {/* 资质说明 */}
            <div className="glass-card !bg-brand-accent/5 !border-brand-accent/20 p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
              <div className="text-xs text-brand-accentLight leading-relaxed">
                <div className="font-semibold mb-1">您的信息将被严格保密</div>
                所有商家信息仅用于曲泉AI 内部审核与服务对接，不会对外公开，不会用于任何第三方营销。
                审核通过后，我们将提供完整的商户运营指南与权益开通说明。
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/community')}
                className="btn-secondary !flex-1 sm:!flex-initial !py-2.5 !px-5 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                返回社区
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary !flex-1 !py-2.5 !px-6 text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    提交中…
                  </>
                ) : (
                  <>
                    提交入驻申请
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* 权益说明 */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: ImageIcon,
                title: 'AI 色彩能力开放',
                desc: '为您的客户提供校色、取色、转换等专业服务',
              },
              {
                icon: Camera,
                title: '商户地图曝光',
                desc: '上架曲泉AI商户地图，精准触达色彩从业者',
              },
              {
                icon: Sparkles,
                title: '社区资源对接',
                desc: '参与社区共建，获得品牌专栏与联合活动机会',
              },
            ].map((b) => (
              <div key={b.title} className="glass-card !p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center shrink-0">
                  <b.icon className="w-4 h-4 text-brand-accentLight" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-brand-text">{b.title}</div>
                  <div className="text-[11px] text-brand-muted mt-0.5 leading-snug">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============ 辅助组件 ============ */
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-accent/20 to-brand-teal/20 border border-white/10 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold text-brand-text text-sm">{title}</h3>
      <div className="flex-1 h-px bg-white/5 ml-1" />
    </div>
  );
}

function Field({
  label,
  required,
  icon,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-brand-muted mb-1.5">
        {icon}
        <span>{label}</span>
        {required && <span className="text-rose-400">*</span>}
      </label>
      <div className="relative">
        {children}
      </div>
      {error ? (
        <div className="mt-1 text-[11px] text-rose-400 flex items-center gap-1">
          <span>· {error}</span>
        </div>
      ) : hint ? (
        <div className="mt-1 text-[10px] text-brand-muted">{hint}</div>
      ) : null}
    </div>
  );
}

function inputCls(hasError: boolean): string {
  return cn(
    'w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none transition-colors appearance-none',
    hasError
      ? 'border-rose-400/50 focus:border-rose-400'
      : 'border-white/10 focus:border-brand-accent/50 focus:bg-white/10'
  );
}
