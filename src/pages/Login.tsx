/**
 * 登录/注册页面
 * - Tab 切换登录/注册
 * - 表单校验（手机号、密码、昵称）
 * - 接入 useAuthStore
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Smartphone,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { isValidPhone } from '@/lib/security';
import { cn } from '@/lib/utils';

type Tab = 'login' | 'register';

/** 2×2 CMYK 四色块（品牌标识） */
function CmykMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl ring-1 ring-brand-line/70 shadow-card',
        className
      )}
    >
      <span className="bg-[#009EE0]" />
      <span className="bg-[#E4007E]" />
      <span className="bg-[#FFD200]" />
      <span className="bg-[#1F1F1F]" />
    </span>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<Tab>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phoneRef = useRef<HTMLInputElement | null>(null);

  // 已登录则跳转
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: string })?.from || '/profile';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    setTimeout(() => phoneRef.current?.focus(), 100);
  }, []);

  // 切换 Tab 时重置整个表单，避免登录/注册字段互相承接（否则注册框会带着登录态的手机号密码）
  const switchTab = (next: Tab) => {
    setTab(next);
    setError('');
    setUsername('');
    setPhone('');
    setPassword('');
    setShowPwd(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result =
        tab === 'login'
          ? await login(phone, password)
          : await register(username, phone, password);
      if (!result.success) {
        setError(result.message || '操作失败');
      }
      // 成功则 useEffect 会自动跳转
    } finally {
      setLoading(false);
    }
  };

  const phoneValid = isValidPhone(phone);
  const pwdValid = password.length >= 6;
  const nameValid = username.trim().length >= 2;
  const canSubmit =
    tab === 'login' ? phoneValid && pwdValid : phoneValid && pwdValid && nameValid;

  return (
    <div className="min-h-screen flex flex-col bg-brand-paper relative overflow-hidden">
      {/* 顶部 CMYK 套色条（品牌标识） */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-cmyk-strip" />

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-surface transition-colors text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        返回首页
      </button>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <CmykMark className="w-12 h-12" />
              <span className="font-serif text-3xl font-bold tracking-wide text-brand-ink">
                曲泉AI
              </span>
            </div>
            <p className="text-sm text-brand-muted">专业色彩智能体 · 你的专属色彩管家</p>
          </div>

          {/* 卡片 */}
          <div className="glass-card p-6 sm:p-8">
            {/* Tab */}
            <div className="flex p-1 rounded-xl bg-brand-paper border border-brand-line mb-6">
              <button
                onClick={() => switchTab('login')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'login'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-ink'
                )}
              >
                登录
              </button>
              <button
                onClick={() => switchTab('register')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'register'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-ink'
                )}
              >
                注册
              </button>
            </div>

            <h2 className="text-xl font-semibold text-brand-ink mb-1">
              {tab === 'login' ? '欢迎回来' : '加入曲泉AI'}
            </h2>
            <p className="text-xs text-brand-muted mb-6">
              {tab === 'login'
                ? '登录后体验完整的色彩工作流与商家服务'
                : '注册后即送 ¥1000 体验余额，畅享色彩服务'}
            </p>

            {/* autoComplete 组合用于阻止浏览器凭据自动填充：
                表单级 off + 密码框 new-password（Chrome 对已保存凭据的登录表单会强制填充，仅靠 off 不够） */}
            <form
              onSubmit={handleSubmit}
              autoComplete="off"
              className="space-y-4"
            >
              {tab === 'register' && (
                <Field
                  icon={<UserIcon className="w-4 h-4" />}
                  label="昵称"
                >
                  <input
                    type="text"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="至少 2 个字符"
                    maxLength={20}
                    className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
                  />
                </Field>
              )}

              <Field icon={<Smartphone className="w-4 h-4" />} label="手机号">
                <input
                  ref={phoneRef}
                  type="tel"
                  autoComplete="off"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入 11 位手机号"
                  className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
                />
              </Field>

              <Field icon={<Lock className="w-4 h-4" />} label="密码">
                <div className="flex items-center">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 32);
                      setPassword(v);
                      // 清空密码时同步复位为密文模式（眼睛按钮已隐藏，避免明文残留）
                      if (!v) setShowPwd(false);
                    }}
                    placeholder="至少 6 位"
                    className="flex-1 bg-transparent text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
                  />
                  {/* 未输入密码时隐藏眼睛按钮（无可查看内容） */}
                  {password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="p-1 text-brand-muted hover:text-brand-primary transition-colors"
                      aria-label={showPwd ? '隐藏密码' : '显示密码'}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </Field>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs animate-fade-in-up">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2',
                  canSubmit && !loading
                    ? 'bg-brand-primary text-white shadow-sm hover:bg-brand-primaryLight hover:shadow-card active:scale-[0.99]'
                    : 'bg-brand-line text-brand-faint cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : tab === 'login' ? (
                  '登录'
                ) : (
                  '注册并登录'
                )}
              </button>
            </form>

            {/* 安全提示 */}
            <div className="mt-6 pt-5 border-t border-brand-line flex items-center gap-2 text-[11px] text-brand-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              所有数据均本地加密存储，不会上传服务器
            </div>
          </div>

          <p className="text-center text-xs text-brand-muted mt-6">
            登录即代表同意
            <Link to="/" className="text-brand-primary hover:underline mx-1">《用户协议》</Link>
            与
            <Link to="/" className="text-brand-primary hover:underline mx-1">《隐私政策》</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ 输入字段封装 ============ */
function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-brand-muted mb-1.5 px-1 block">{label}</label>
      <div
        style={{ '--autofill-bg': '#F4F5F3' } as React.CSSProperties}
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-brand-paper border border-brand-line focus-within:border-brand-primary/60 focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all"
      >
        <span className="text-brand-muted shrink-0">{icon}</span>
        {children}
      </div>
    </div>
  );
}
