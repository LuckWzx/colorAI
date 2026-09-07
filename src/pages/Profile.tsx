/**
 * 个人中心
 * - 用户信息卡片
 * - 余额展示 + 充值/提现入口
 * - 订单列表（全部/待支付/已支付/已完成）
 * - 交易记录
 * - 充值/提现 Modal
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Wallet,
  ShoppingBag,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Loader2,
  X,
  User as UserIcon,
  Smartphone,
  CalendarClock,
  Receipt,
  Sparkles,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore, getMaskedPhone } from '@/store/authStore';
import { useWalletStore, type Order, type OrderStatus, type Transaction, type TxType } from '@/store/walletStore';
import { cn } from '@/lib/utils';

type Tab = 'orders' | 'transactions';
type OrderFilter = 'all' | 'pending' | 'paid' | 'completed';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { balance, orders, transactions, recharge, withdraw, payOrder, updateOrderStatus } = useWalletStore();
  const [tab, setTab] = useState<Tab>('orders');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2400);
  };

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20 relative">
      {/* 顶部背景 */}
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-br from-brand-accent/20 via-brand-teal/10 to-transparent pointer-events-none" />
      <div
        className="absolute top-10 right-0 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 60%)' }}
      />

      <div className="container max-w-5xl px-4 lg:px-8 relative z-10">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            返回首页
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
            className="px-3 py-2 rounded-lg text-sm text-brand-muted hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            退出登录
          </button>
        </div>

        {/* 用户信息卡片 */}
        <section className="glass-card p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift flex items-center justify-center shadow-glow shrink-0">
              <span className="font-serif text-2xl sm:text-3xl font-bold text-white drop-shadow">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-brand-text">{user.username}</h1>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  体验会员
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-brand-muted flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {getMaskedPhone(user)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  ID: {user.id.slice(2, 10)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 余额 + 快捷入口 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* 余额卡 */}
          <div className="lg:col-span-2 glass-card p-6 bg-gradient-to-br from-brand-accent/10 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-brand-muted">
                <Wallet className="w-4 h-4" />
                我的余额
              </div>
              <span className="text-[11px] text-brand-muted">可用余额（元）</span>
            </div>
            <div className="text-4xl font-bold text-brand-text tabular-nums mb-1">
              ¥{balance.toFixed(2)}
            </div>
            <div className="text-xs text-brand-muted mb-5">
              冻结金额 ¥0.00 · 累计充值 ¥
              {transactions.filter((t) => t.type === 'recharge').reduce((s, t) => s + t.amount, 0).toFixed(2)}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setRechargeOpen(true)}
                className="flex-1 btn-primary !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <ArrowDownToLine className="w-4 h-4" />
                充值
              </button>
              <button
                onClick={() => setWithdrawOpen(true)}
                className="flex-1 btn-secondary !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                提现
              </button>
            </div>
          </div>

          {/* 数据统计 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="订单总数" value={orders.length} />
              <StatBlock label="待支付" value={orders.filter((o) => o.status === 'pending').length} />
              <StatBlock label="已支付" value={orders.filter((o) => o.status === 'paid').length} />
              <StatBlock label="已完成" value={orders.filter((o) => o.status === 'completed').length} />
            </div>
          </div>
        </section>

        {/* Tab 区 */}
        <div className="glass-card overflow-hidden">
          <div className="flex border-b border-white/5">
            <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingBag className="w-4 h-4" />}>
              我的订单
              {orders.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accentLight">
                  {orders.length}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<Receipt className="w-4 h-4" />}>
              交易记录
              {transactions.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accentLight">
                  {transactions.length}
                </span>
              )}
            </TabBtn>
          </div>

          {tab === 'orders' ? (
            <OrdersTab
              orders={filteredOrders}
              filter={orderFilter}
              onFilter={setOrderFilter}
              balance={balance}
              onPay={async (orderId) => {
                const r = await payOrder(orderId);
                showToast(r.success ? 'success' : 'error', r.success ? '支付成功' : r.message || '支付失败');
              }}
              onComplete={(orderId) => {
                updateOrderStatus(orderId, 'completed');
                showToast('success', '已确认收货');
              }}
            />
          ) : (
            <TransactionsTab transactions={transactions} />
          )}
        </div>
      </div>

      {/* 充值 Modal */}
      <RechargeModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        onDone={async (amount, method) => {
          const r = await recharge(amount, method);
          if (r.success) {
            showToast('success', `充值 ¥${amount.toFixed(2)} 成功`);
            setRechargeOpen(false);
          } else {
            showToast('error', r.message || '充值失败');
          }
          return r.success;
        }}
      />

      {/* 提现 Modal */}
      <WithdrawModal
        open={withdrawOpen}
        balance={balance}
        onClose={() => setWithdrawOpen(false)}
        onDone={async (amount, method) => {
          const r = await withdraw(amount, method);
          if (r.success) {
            showToast('success', `提现 ¥${amount.toFixed(2)} 申请已提交`);
            setWithdrawOpen(false);
          } else {
            showToast('error', r.message || '提现失败');
          }
          return r.success;
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-glow-accent text-sm flex items-center gap-2 animate-fade-in-up',
            toast.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
              : 'bg-rose-500/20 border border-rose-400/40 text-rose-200'
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ============ 统计块 ============ */
function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 border border-white/5">
      <div className="text-xs text-brand-muted mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-brand-text tabular-nums">{value}</div>
    </div>
  );
}

/* ============ Tab 按钮 ============ */
function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-3.5 px-4 text-sm font-medium transition-all flex items-center justify-center gap-1.5 border-b-2',
        active
          ? 'text-brand-accentLight border-brand-accent bg-white/[0.03]'
          : 'text-brand-muted border-transparent hover:text-white hover:bg-white/[0.02]'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ============ 订单 Tab 内容 ============ */
const ORDER_FILTERS: Array<{ key: OrderFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'completed', label: '已完成' },
];

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待支付', color: 'text-amber-300 bg-amber-500/15 border-amber-400/30', icon: <Clock className="w-3 h-3" /> },
  paid: { label: '已支付', color: 'text-sky-300 bg-sky-500/15 border-sky-400/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  shipped: { label: '已发货', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-400/30', icon: <Truck className="w-3 h-3" /> },
  completed: { label: '已完成', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: '已取消', color: 'text-rose-300 bg-rose-500/15 border-rose-400/30', icon: <XCircle className="w-3 h-3" /> },
};

function OrdersTab({
  orders,
  filter,
  onFilter,
  balance,
  onPay,
  onComplete,
}: {
  orders: Order[];
  filter: OrderFilter;
  onFilter: (f: OrderFilter) => void;
  balance: number;
  onPay: (orderId: string) => void;
  onComplete: (orderId: string) => void;
}) {
  return (
    <div>
      {/* 筛选 */}
      <div className="flex gap-1.5 p-3 border-b border-white/5 overflow-x-auto">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              filter === f.key
                ? 'bg-brand-accent/20 text-brand-accentLight border border-brand-accent/30'
                : 'text-brand-muted hover:text-white hover:bg-white/5 border border-transparent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      {orders.length === 0 ? (
        <EmptyHint
          icon={<ShoppingBag className="w-10 h-10" />}
          title="暂无订单"
          subtitle="去工作台完成色彩工作流，下单后这里会显示订单"
        />
      ) : (
        <div className="divide-y divide-white/5">
          {orders.map((order) => {
            const st = ORDER_STATUS_MAP[order.status];
            return (
              <div key={order.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-brand-text truncate">{order.shopName}</span>
                      <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', st.color)}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-brand-muted font-mono">订单号 {order.orderNo}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-brand-text tabular-nums">¥{order.price.toFixed(2)}</div>
                    <div className="text-[11px] text-brand-muted">{new Date(order.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-brand-muted bg-white/[0.03] rounded-lg px-3 py-2 mb-3">
                  {order.colorHex && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded border border-white/20" style={{ background: order.colorHex }} />
                      <span className="font-mono">{order.colorHex}</span>
                    </span>
                  )}
                  <span>·</span>
                  <span>{order.product}</span>
                  {order.spec && (
                    <>
                      <span>·</span>
                      <span>{order.spec}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>×{order.quantity}</span>
                </div>

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onPay(order.id)}
                        disabled={order.price > balance}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1 transition-all',
                          order.price <= balance
                            ? 'btn-primary !py-1.5'
                            : 'bg-white/5 text-brand-muted cursor-not-allowed'
                        )}
                      >
                        <CreditCard className="w-3 h-3" />
                        {order.price > balance ? '余额不足' : '立即支付'}
                      </button>
                      <button
                        onClick={() => {/* TODO: 取消订单 */}}
                        className="text-xs px-3 py-1.5 rounded-md text-brand-muted hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        取消订单
                      </button>
                    </>
                  )}
                  {order.status === 'paid' && (
                    <button
                      onClick={() => onComplete(order.id)}
                      className="text-xs px-3 py-1.5 rounded-md btn-secondary !py-1.5 inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      确认收货
                    </button>
                  )}
                  {order.status === 'completed' && (
                    <span className="text-xs text-emerald-300/70 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      交易已完成
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ 交易记录 Tab ============ */
const TX_TYPE_MAP: Record<TxType, { label: string; sign: string; color: string }> = {
  recharge: { label: '充值', sign: '+', color: 'text-emerald-300' },
  withdraw: { label: '提现', sign: '-', color: 'text-rose-300' },
  payment: { label: '支付订单', sign: '-', color: 'text-amber-300' },
  refund: { label: '退款', sign: '+', color: 'text-sky-300' },
};

function TransactionsTab({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyHint
        icon={<Receipt className="w-10 h-10" />}
        title="暂无交易记录"
        subtitle="充值、提现、支付订单后，交易明细会显示在这里"
      />
    );
  }
  return (
    <div className="divide-y divide-white/5">
      {transactions.map((tx) => {
        const tm = TX_TYPE_MAP[tx.type];
        return (
          <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border', tm.color, 'bg-white/5 border-white/10')}>
                <span className="text-base font-bold">{tm.sign}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-brand-text truncate">{tx.description}</div>
                <div className="text-[11px] text-brand-muted mt-0.5">
                  {tm.label} · {new Date(tx.createdAt).toLocaleString('zh-CN')}
                  {tx.method && ` · ${tx.method}`}
                </div>
              </div>
            </div>
            <div className={cn('text-base font-semibold tabular-nums', tm.color)}>
              {tm.sign}¥{tx.amount.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ 空状态 ============ */
function EmptyHint({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex w-16 h-16 rounded-2xl bg-white/5 items-center justify-center text-brand-muted mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-brand-text mb-1">{title}</div>
      <div className="text-xs text-brand-muted px-8">{subtitle}</div>
    </div>
  );
}

/* ============ 充值 Modal ============ */
const RECHARGE_PRESETS = [50, 100, 200, 500, 1000, 2000];
const PAY_METHODS = [
  { key: 'alipay', label: '支付宝', icon: '💰', desc: '实时到账' },
  { key: 'wechat', label: '微信支付', icon: '💚', desc: '实时到账' },
  { key: 'bank', label: '银行卡', icon: '🏦', desc: '1-3 个工作日' },
];

function RechargeModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (amount: number, method: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState('alipay');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const finalAmount = custom ? Math.max(0, Number(custom) || 0) : amount;

  const submit = async () => {
    if (finalAmount <= 0) return;
    setLoading(true);
    try {
      await onDone(finalAmount, PAY_METHODS.find((m) => m.key === method)?.label || method);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="充值" onClose={onClose}>
      <div className="space-y-5">
        {/* 金额预设 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">选择充值金额</div>
          <div className="grid grid-cols-3 gap-2">
            {RECHARGE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => { setAmount(v); setCustom(''); }}
                className={cn(
                  'py-2.5 rounded-lg text-sm font-medium border transition-all',
                  !custom && amount === v
                    ? 'bg-brand-accent/15 text-brand-accentLight border-brand-accent/40'
                    : 'bg-white/5 text-brand-text border-white/10 hover:border-white/20'
                )}
              >
                ¥{v}
              </button>
            ))}
          </div>
        </div>

        {/* 自定义金额 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">或输入自定义金额</div>
          <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
            <span className="text-brand-muted text-sm mr-1">¥</span>
            <input
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="输入金额（最高 50000）"
              min={1}
              max={50000}
              className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none"
            />
          </div>
        </div>

        {/* 支付方式 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">支付方式</div>
          <div className="space-y-1.5">
            {PAY_METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                  method === m.key
                    ? 'bg-brand-accent/10 border-brand-accent/40'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                )}
              >
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm text-brand-text">{m.label}</div>
                  <div className="text-[11px] text-brand-muted">{m.desc}</div>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2', method === m.key ? 'border-brand-accent bg-brand-accent' : 'border-white/20')} />
              </button>
            ))}
          </div>
        </div>

        {/* 提交 */}
        <button
          onClick={submit}
          disabled={loading || finalAmount <= 0}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            !loading && finalAmount > 0
              ? 'bg-spectrum-gradient text-white shadow-glow-accent hover:scale-[1.01]'
              : 'bg-white/5 text-brand-muted cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
          {loading ? '处理中...' : `充值 ¥${finalAmount.toFixed(2)}`}
        </button>
      </div>
    </ModalShell>
  );
}

/* ============ 提现 Modal ============ */
function WithdrawModal({
  open,
  balance,
  onClose,
  onDone,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
  onDone: (amount: number, method: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('alipay');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const amt = Number(amount) || 0;
  const insufficient = amt > balance;
  const tooSmall = amt > 0 && amt < 10;
  const canSubmit = amt > 0 && !insufficient && !tooSmall;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const ok = await onDone(amt, PAY_METHODS.find((m) => m.key === method)?.label || method);
      if (ok) setAmount('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="提现" onClose={onClose}>
      <div className="space-y-5">
        {/* 余额提示 */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <div className="text-xs text-brand-muted mb-1">可提现余额</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">¥{balance.toFixed(2)}</div>
        </div>

        {/* 金额输入 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">提现金额（最低 ¥10）</div>
          <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-brand-accent/40 transition-colors">
            <span className="text-brand-muted text-sm mr-1">¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`最多可提现 ${balance.toFixed(2)}`}
              min={10}
              max={balance}
              className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none"
            />
            <button
              onClick={() => setAmount(String(balance))}
              className="text-[11px] px-2 py-1 rounded-md bg-brand-accent/15 text-brand-accentLight hover:bg-brand-accent/25 transition-colors"
            >
              全部
            </button>
          </div>
          {insufficient && (
            <div className="mt-1.5 text-[11px] text-rose-300 px-1">余额不足</div>
          )}
          {tooSmall && !insufficient && (
            <div className="mt-1.5 text-[11px] text-amber-300 px-1">单笔提现不低于 ¥10</div>
          )}
        </div>

        {/* 方式 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">提现到</div>
          <div className="space-y-1.5">
            {PAY_METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                  method === m.key
                    ? 'bg-brand-accent/10 border-brand-accent/40'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                )}
              >
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm text-brand-text">{m.label}</div>
                  <div className="text-[11px] text-brand-muted">{m.desc}</div>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2', method === m.key ? 'border-brand-accent bg-brand-accent' : 'border-white/20')} />
              </button>
            ))}
          </div>
        </div>

        {/* 提交 */}
        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            canSubmit && !loading
              ? 'bg-spectrum-gradient text-white shadow-glow-accent hover:scale-[1.01]'
              : 'bg-white/5 text-brand-muted cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
          {loading ? '处理中...' : `提现 ¥${amt.toFixed(2)}`}
        </button>

        <div className="text-[11px] text-brand-muted text-center">
          提现申请提交后，款项将在 1-3 个工作日内到账
        </div>
      </div>
    </ModalShell>
  );
}

/* ============ Modal 容器 ============ */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-brand-darker/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-brand-text">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-brand-muted hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
