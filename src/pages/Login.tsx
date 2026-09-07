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
    <div className="min-h-screen flex flex-col bg-brand-darker relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-noise-texture pointer-events-none opacity-40" />
      <div
        className="absolute -top-20 -left-20 w-[480px] h-[480px] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-[480px] h-[480px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4ECDC4 0%, transparent 60%)' }}
      />

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        返回首页
      </button>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift shadow-glow" />
              <span className="font-serif text-3xl font-bold tracking-wide bg-gradient-to-r from-brand-cream via-brand-accent to-brand-teal bg-clip-text text-transparent">
                曲泉AI
              </span>
            </div>
            <p className="text-sm text-brand-muted">专业色彩智能体 · 你的专属色彩管家</p>
          </div>

          {/* 卡片 */}
          <div className="glass-card p-6 sm:p-8">
            {/* Tab */}
            <div className="flex p-1 rounded-xl bg-white/5 mb-6">
              <button
                onClick={() => { setTab('login'); setError(''); }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'login'
                    ? 'bg-brand-accent text-white shadow-glow-accent'
                    : 'text-brand-muted hover:text-white'
                )}
              >
                登录
              </button>
              <button
                onClick={() => { setTab('register'); setError(''); }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'register'
                    ? 'bg-brand-accent text-white shadow-glow-accent'
                    : 'text-brand-muted hover:text-white'
                )}
              >
                注册
              </button>
            </div>

            <h2 className="text-xl font-semibold text-brand-text mb-1">
              {tab === 'login' ? '欢迎回来 👋' : '加入曲泉AI ✨'}
            </h2>
            <p className="text-xs text-brand-muted mb-6">
              {tab === 'login'
                ? '登录后体验完整的色彩工作流与商家服务'
                : '注册后即送 ¥1000 体验余额，畅享色彩服务'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'register' && (
                <Field
                  icon={<UserIcon className="w-4 h-4" />}
                  label="昵称"
                >
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="至少 2 个字符"
                    maxLength={20}
                    className="w-full bg-transparent text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none"
                  />
                </Field>
              )}

              <Field icon={<Smartphone className="w-4 h-4" />} label="手机号">
                <input
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入 11 位手机号"
                  className="w-full bg-transparent text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none"
                />
              </Field>

              <Field icon={<Lock className="w-4 h-4" />} label="密码">
                <div className="flex items-center">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.slice(0, 32))}
                    placeholder="至少 6 位"
                    className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="p-1 text-brand-muted hover:text-white transition-colors"
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs animate-fade-in-up">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  canSubmit && !loading
                    ? 'bg-spectrum-gradient text-white shadow-glow-accent hover:scale-[1.02] active:scale-95'
                    : 'bg-white/5 text-brand-muted cursor-not-allowed'
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
            <div className="mt-6 pt-5 border-t border-white/5 flex items-center gap-2 text-[11px] text-brand-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              所有数据均本地加密存储，不会上传服务器
            </div>
          </div>

          <p className="text-center text-xs text-brand-muted mt-6">
            登录即代表同意
            <Link to="/" className="text-brand-accentLight hover:underline mx-1">《用户协议》</Link>
            与
            <Link to="/" className="text-brand-accentLight hover:underline mx-1">《隐私政策》</Link>
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
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
        <span className="text-brand-muted shrink-0">{icon}</span>
        {children}
      </div>
    </div>
  );
}
