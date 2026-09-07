import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Tag,
  FileText,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Palette,
  GitCompare,
  Smartphone,
  HelpCircle,
  Briefcase,
  Flame,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeText, isNonEmpty, truncate } from '@/lib/security';

/* ============ 类型 ============ */
interface DiscussionForm {
  title: string;
  category: string;
  content: string;
  tags: string;
}

interface FormErrors {
  title?: string;
  category?: string;
  content?: string;
  tags?: string;
}

type CategoryKey =
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
  { key: 'correct', label: 'AI 校色', icon: ImageIcon, desc: '一键校正相关讨论' },
  { key: 'pick', label: '智能取色', icon: Palette, desc: '取色器使用与案例' },
  { key: 'convert', label: '色彩转换', icon: Sparkles, desc: 'HEX/RGB/CMYK/Lab 互转' },
  { key: 'compare', label: '颜色对比', icon: GitCompare, desc: '相似度与 ΔE 量化' },
  { key: 'phone', label: '手机拍照', icon: Smartphone, desc: '手机拍摄校色技巧' },
  { key: 'diagnose', label: '偏色诊断', icon: HelpCircle, desc: '发红/发黄/发蓝等问题' },
  { key: 'industry', label: '行业应用', icon: Briefcase, desc: '印刷/涂料/纺织/设计' },
  { key: 'free', label: '自由讨论', icon: Flame, desc: '聊聊色彩一切' },
];

const CATEGORY_BADGE: Record<CategoryKey, string> = {
  correct: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  pick: 'bg-teal-500/15 text-teal-300 border-teal-400/30',
  convert: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  compare: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  phone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  diagnose: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  industry: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
  free: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
};

const MAX_TITLE_LEN = 50;
const MAX_CONTENT_LEN = 500;
const MAX_TAG_LEN = 10;
const MAX_TAGS = 5;

/* ============ 主页面 ============ */
export default function StartDiscussion() {
  const navigate = useNavigate();
  const [form, setForm] = useState<DiscussionForm>({
    title: '',
    category: '',
    content: '',
    tags: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof DiscussionForm>(key: K, value: DiscussionForm[K]) => {
    let sanitized = sanitizeText(String(value));
    if (key === 'title') sanitized = truncate(sanitized, MAX_TITLE_LEN);
    if (key === 'content') sanitized = truncate(sanitized, MAX_CONTENT_LEN);
    if (key === 'tags') sanitized = truncate(sanitized, MAX_TAG_LEN * MAX_TAGS);
    setForm((prev) => ({ ...prev, [key]: sanitized as DiscussionForm[K] }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!isNonEmpty(form.title)) e.title = '请填写讨论标题';
    else if (form.title.length < 5) e.title = '标题至少 5 个字，让大家更好地理解';
    if (!form.category) e.category = '请选择讨论分类';
    if (!isNonEmpty(form.content)) e.content = '请填写讨论内容';
    else if (form.content.length < 20) e.content = '内容至少 20 个字，详细描述你的问题或观点';
    if (form.tags) {
      const tagList = form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      if (tagList.length > MAX_TAGS) e.tags = `最多添加 ${MAX_TAGS} 个标签`;
      if (tagList.some((t) => t.length > MAX_TAG_LEN)) e.tags = `单个标签不超过 ${MAX_TAG_LEN} 个字`;
    }
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
    setForm({ title: '', category: '', content: '', tags: '' });
    navigate('/community');
  };

  const addNewPost = () => {
    setSubmitted(false);
    setForm({ title: '', category: '', content: '', tags: '' });
  };

  const parsedTags = form.tags
    ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    : [];

  const selectedCat = CATEGORIES.find((c) => c.key === form.category);

  /* ============ 提交成功态 ============ */
  if (submitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-noise-texture pointer-events-none opacity-40" />
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(78,205,196,0.12) 0%, transparent 60%)' }}
        />
        <div className="glass-card p-8 sm:p-10 max-w-md w-full text-center relative z-10">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-brand-teal to-brand-accent flex items-center justify-center shadow-glow mb-5">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="font-serif text-2xl font-bold spectrum-text mb-2">讨论已发布</h2>
          <p className="text-sm text-brand-muted leading-relaxed mb-6">
            您的讨论
            <span className="text-brand-text font-medium">「{sanitizeText(form.title)}」</span>
            已发布到社区，快来看看大家的回复吧！
          </p>

          <div className="glass-card !bg-white/5 !border-white/10 p-4 text-left mb-6 text-xs space-y-2">
            <div className="flex items-center gap-2 text-brand-accentLight">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold">发布建议</span>
            </div>
            <ul className="space-y-1 text-brand-muted leading-relaxed">
              <li>· 添加相关标签，让更多同好发现你的讨论</li>
              <li>· 附上截图或参数说明，获得更精准的回复</li>
              <li>· 参与他人讨论，积累社区声望</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={resetAndBack} className="btn-secondary !flex-1 !py-2.5 text-sm">
              返回社区
            </button>
            <button
              onClick={addNewPost}
              className="btn-primary !flex-1 !py-2.5 text-sm"
            >
              继续发帖
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ 表单 ============ */
  return (
    <div className="relative min-h-screen pb-20">
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
            <span className="text-brand-text">发起讨论</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-accent to-rose-500 flex items-center justify-center shadow-glow">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold spectrum-text">发起讨论</h1>
              <p className="text-xs text-brand-muted mt-0.5">
                分享你的校色实测、取色技巧或行业观察，与色彩从业者一起交流。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 表单主体 */}
      <section className="relative px-4 lg:px-8">
        <div className="container max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="glass-card p-5 sm:p-7 space-y-6">
            {/* 标题 */}
            <div>
              <SectionTitle icon={<FileText className="w-3.5 h-3.5 text-brand-accentLight" />} title="讨论标题" />
              <Field
                label="标题"
                required
                icon={<MessageSquare className="w-4 h-4" />}
                error={errors.title}
              >
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="简明扼要描述你的问题或观点（5-50 字）"
                  className={inputCls(!!errors.title)}
                />
                <div className="text-right text-[10px] text-brand-muted mt-1">
                  {form.title.length}/{MAX_TITLE_LEN}
                </div>
              </Field>
            </div>

            {/* 分类 */}
            <div>
              <SectionTitle icon={<Sparkles className="w-3.5 h-3.5 text-brand-accentLight" />} title="选择分类" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = form.category === c.key;
                  const badge = CATEGORY_BADGE[c.key];
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => update('category', c.key)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all',
                        active
                          ? `bg-white/10 ${badge} border-current`
                          : 'bg-white/5 border-white/10 text-brand-muted hover:text-brand-text hover:border-white/20'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{c.label}</span>
                      <span className="text-[10px] opacity-70 line-clamp-1">{c.desc}</span>
                    </button>
                  );
                })}
              </div>
              {errors.category && (
                <div className="mt-1 text-[11px] text-rose-400">· {errors.category}</div>
              )}
            </div>

            {/* 内容 */}
            <div>
              <SectionTitle icon={<FileText className="w-3.5 h-3.5 text-brand-accentLight" />} title="详细内容" />
              <Field
                label="内容"
                required
                icon={<FileText className="w-4 h-4" />}
                hint="详细描述你的问题、案例或观点，支持文字与代码片段（20-500 字）"
                error={errors.content}
              >
                <textarea
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  rows={6}
                  maxLength={MAX_CONTENT_LEN}
                  placeholder="详细描述你的问题或分享，例如：使用了什么设备、遇到什么情况、尝试过哪些方法..."
                  className={cn(inputCls(!!errors.content), 'resize-none font-mono text-[13px] leading-relaxed')}
                />
                <div className="text-right text-[10px] text-brand-muted mt-1">
                  {form.content.length}/{MAX_CONTENT_LEN}
                </div>
              </Field>
            </div>

            {/* 标签 */}
            <div>
              <SectionTitle icon={<Tag className="w-3.5 h-3.5 text-brand-accentLight" />} title="添加标签" />
              <Field
                label="标签"
                icon={<Tag className="w-4 h-4" />}
                hint={`选填，用逗号分隔，最多 ${MAX_TAGS} 个标签`}
                error={errors.tags}
              >
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => update('tags', e.target.value)}
                  placeholder="例：人像, 白平衡, 偏色修复"
                  className={inputCls(!!errors.tags)}
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parsedTags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-md border bg-brand-accent/10 text-brand-accentLight border-brand-accent/30"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </div>

            {/* 提示 */}
            <div className="glass-card !bg-brand-accent/5 !border-brand-accent/20 p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
              <div className="text-xs text-brand-accentLight leading-relaxed">
                <div className="font-semibold mb-1">发帖小贴士</div>
                · 描述清楚问题背景（设备、场景、参数），获得更精准的回复<br />
                · 使用图文结合的方式，附上对比图和参数<br />
                · 尊重社区规范，理性交流，共建友好讨论环境
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
                    发布中…
                  </>
                ) : (
                  <>
                    发布讨论
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* 预览 */}
          {(form.title || form.content || selectedCat) && (
            <div className="mt-4 glass-card p-5">
              <div className="flex items-center gap-2 mb-3 text-xs text-brand-muted">
                <Sparkles className="w-3.5 h-3.5" />
                <span>实时预览</span>
              </div>
              <div className="space-y-3">
                {form.title && (
                  <h3 className="font-serif text-lg font-bold text-brand-text">
                    {sanitizeText(form.title)}
                  </h3>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedCat && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium',
                        CATEGORY_BADGE[selectedCat.key]
                      )}
                    >
                      <selectedCat.icon className="w-3 h-3" />
                      {selectedCat.label}
                    </span>
                  )}
                  {parsedTags.map((t) => (
                    <span
                      key={t}
                      className="text-[11px] text-brand-muted bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
                    >
                      #{sanitizeText(t)}
                    </span>
                  ))}
                </div>
                {form.content && (
                  <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-wrap">
                    {sanitizeText(form.content)}
                  </p>
                )}
              </div>
            </div>
          )}
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
