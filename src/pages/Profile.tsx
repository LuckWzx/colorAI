/**
 * 个人中心（个人主页）
 * - 用户信息展示：头像、昵称、会员、手机号、ID、注册时间
 * - 钱包摘要卡片 + 进入我的钱包入口（账单/充值提现在 Wallet 页）
 */
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { useAuthStore, getMaskedPhone } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { balance, transactions } = useWalletStore();

  if (!user) return null;

  const totalRecharge = transactions
    .filter((t) => t.type === 'recharge')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen pb-20 relative">
      {/* 顶部 CMYK 套色条（品牌标识） */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-cmyk-strip" />

      <div className="container max-w-3xl px-4 lg:px-8 relative z-10">
        {/* 页头 */}
        <div className="flex items-end justify-between pt-5 pb-6">
          <div>
            <span className="eyebrow mb-2">个人中心</span>
            <h1 className="font-serif text-2xl font-bold text-brand-ink tracking-wide">我的主页</h1>
          </div>
        </div>

        {/* 用户信息卡 */}
        <section className="glass-card p-6 sm:p-8 mb-4">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-brand-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="font-serif text-3xl sm:text-4xl font-bold text-white">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-brand-ink truncate">{user.username}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Sparkles className="w-2.5 h-2.5" />
                  体验会员
                </span>
              </div>
              <div className="mt-1 text-xs text-brand-muted">
                ID: {user.id.slice(2, 10)} · 注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-brand-line grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoRow icon={<Smartphone className="w-3.5 h-3.5" />} label="手机号" value={getMaskedPhone(user)} />
            <InfoRow icon={<UserIcon className="w-3.5 h-3.5" />} label="账号 ID" value={user.id.slice(2, 10)} mono />
            <InfoRow
              icon={<CalendarClock className="w-3.5 h-3.5" />}
              label="注册时间"
              value={new Date(user.createdAt).toLocaleDateString('zh-CN')}
            />
          </div>
        </section>

        {/* 钱包摘要卡 */}
        <section className="glass-card p-6 sm:p-8 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-brand-muted mb-2">
                <Wallet className="w-4 h-4" />
                我的钱包
              </div>
              <div className="text-3xl font-bold text-brand-ink tabular-nums">
                ¥{balance.toFixed(2)}
              </div>
              <div className="text-xs text-brand-muted mt-1.5">
                累计充值 ¥{totalRecharge.toFixed(2)} · 订单与交易明细在钱包页查看
              </div>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="shrink-0 btn-primary !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              进入我的钱包
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* 底部操作 */}
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-brand-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            所有数据均本地加密存储，不会上传服务器
          </p>
          <button
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
            className="px-3 py-2 rounded-lg text-sm text-brand-muted hover:text-rose-600 hover:bg-rose-50 transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ 信息行 ============ */
function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-brand-paper border border-brand-line px-3.5 py-2.5">
      <span className="text-brand-muted shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-brand-faint leading-none mb-1">{label}</div>
        <div className={`text-sm text-brand-ink truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
