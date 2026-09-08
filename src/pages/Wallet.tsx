/**
 * 我的钱包页
 * - 余额展示 + 充值/提现入口
 * - 订单列表（全部/待支付/已支付/已完成）
 * - 交易记录
 * - 充值/提现 Modal
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Wallet as WalletIcon,
  ShoppingBag,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Loader2,
  X,
  Receipt,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { useWalletStore, type Order, type OrderStatus, type Transaction, type TxType } from '@/store/walletStore';
import { cn } from '@/lib/utils';

type Tab = 'orders' | 'transactions';
type OrderFilter = 'all' | 'pending' | 'paid' | 'completed';

export default function Wallet() {
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

  return (
    <div className="min-h-screen pb-20 relative">
      {/* 顶部 CMYK 套色条（品牌标识） */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-cmyk-strip" />

      <div className="container max-w-5xl px-4 lg:px-8 relative z-10">
        {/* 页头 */}
        <div className="flex items-center justify-between pt-5 pb-6">
          <Link
            to="/profile"
            className="flex items-center gap-1.5 px-3 py-2 -ml-3 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-surface transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            返回个人中心
          </Link>
          <span className="eyebrow">我的钱包</span>
        </div>

        {/* 余额 + 快捷入口 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* 余额卡 */}
          <div className="lg:col-span-2 glass-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-brand-muted">
                <WalletIcon className="w-4 h-4" />
                可用余额
              </div>
              <span className="text-[11px] text-brand-muted">单位（元）</span>
            </div>
            <div className="text-4xl font-bold text-brand-ink tabular-nums mb-1">
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
          <div className="flex border-b border-brand-line">
            <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingBag className="w-4 h-4" />}>
              我的订单
              {orders.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">
                  {orders.length}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<Receipt className="w-4 h-4" />}>
              交易记录
              {transactions.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">
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
            'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lift text-sm flex items-center gap-2 animate-fade-in-up',
            toast.type === 'success'
              ? 'bg-brand-surface border border-emerald-200 text-emerald-700'
              : 'bg-brand-surface border border-rose-200 text-rose-600'
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
    <div className="rounded-lg bg-brand-paper p-3 border border-brand-line">
      <div className="text-xs text-brand-muted mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-brand-ink tabular-nums">{value}</div>
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
        'flex-1 py-3.5 px-4 text-sm font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 -mb-px',
        active
          ? 'text-brand-ink font-semibold border-brand-primary'
          : 'text-brand-muted border-transparent hover:text-brand-ink hover:bg-brand-paper/60'
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
  pending: { label: '待支付', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  paid: { label: '已支付', color: 'text-sky-700 bg-sky-50 border-sky-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  shipped: { label: '已发货', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: <Truck className="w-3 h-3" /> },
  completed: { label: '已完成', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: '已取消', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: <XCircle className="w-3 h-3" /> },
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
      <div className="flex gap-1.5 p-3 border-b border-brand-line overflow-x-auto">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all border',
              filter === f.key
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'text-brand-muted hover:text-brand-ink hover:bg-brand-paper border-transparent'
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
        <div className="divide-y divide-brand-line">
          {orders.map((order) => {
            const st = ORDER_STATUS_MAP[order.status];
            return (
              <div key={order.id} className="p-4 sm:p-5 hover:bg-brand-paper/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-brand-ink truncate">{order.shopName}</span>
                      <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', st.color)}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-brand-muted font-mono">订单号 {order.orderNo}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-brand-ink tabular-nums">¥{order.price.toFixed(2)}</div>
                    <div className="text-[11px] text-brand-muted">{new Date(order.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-brand-muted bg-brand-paper/70 rounded-lg px-3 py-2 mb-3">
                  {order.colorHex && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded border border-brand-lineStrong" style={{ background: order.colorHex }} />
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
                            : 'bg-brand-line text-brand-faint cursor-not-allowed'
                        )}
                      >
                        <CreditCard className="w-3 h-3" />
                        {order.price > balance ? '余额不足' : '立即支付'}
                      </button>
                      <button
                        onClick={() => {/* TODO: 取消订单 */}}
                        className="text-xs px-3 py-1.5 rounded-md text-brand-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                    <span className="text-xs text-emerald-600/80 inline-flex items-center gap-1">
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
  recharge: { label: '充值', sign: '+', color: 'text-emerald-600' },
  withdraw: { label: '提现', sign: '-', color: 'text-rose-600' },
  payment: { label: '支付订单', sign: '-', color: 'text-amber-600' },
  refund: { label: '退款', sign: '+', color: 'text-sky-600' },
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
    <div className="divide-y divide-brand-line">
      {transactions.map((tx) => {
        const tm = TX_TYPE_MAP[tx.type];
        return (
          <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-brand-paper/50 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border', tm.color, 'bg-brand-paper border-brand-line')}>
                <span className="text-base font-bold">{tm.sign}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-brand-ink truncate">{tx.description}</div>
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
      <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-paper border border-brand-line items-center justify-center text-brand-muted mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-brand-ink mb-1">{title}</div>
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
                    ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/40'
                    : 'bg-brand-paper text-brand-ink border-brand-line hover:border-brand-lineStrong'
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
          <div
            style={{ '--autofill-bg': '#F4F5F3' } as React.CSSProperties}
            className="flex items-center px-3.5 py-2.5 rounded-xl bg-brand-paper border border-brand-line focus-within:border-brand-primary/60 focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all"
          >
            <span className="text-brand-muted text-sm mr-1">¥</span>
            <input
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="输入金额（最高 50000）"
              min={1}
              max={50000}
              className="flex-1 bg-transparent text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
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
                    ? 'bg-brand-primary/10 border-brand-primary/40'
                    : 'bg-brand-paper border-brand-line hover:border-brand-lineStrong'
                )}
              >
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm text-brand-ink">{m.label}</div>
                  <div className="text-[11px] text-brand-muted">{m.desc}</div>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2', method === m.key ? 'border-brand-primary bg-brand-primary' : 'border-brand-lineStrong')} />
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
              ? 'bg-brand-primary text-white shadow-sm hover:bg-brand-primaryLight active:scale-[0.99]'
              : 'bg-brand-line text-brand-faint cursor-not-allowed'
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
        <div className="rounded-xl bg-brand-paper border border-brand-line p-4">
          <div className="text-xs text-brand-muted mb-1">可提现余额</div>
          <div className="text-2xl font-bold text-brand-ink tabular-nums">¥{balance.toFixed(2)}</div>
        </div>

        {/* 金额输入 */}
        <div>
          <div className="text-xs text-brand-muted mb-2 px-1">提现金额（最低 ¥10）</div>
          <div
            style={{ '--autofill-bg': '#F4F5F3' } as React.CSSProperties}
            className="flex items-center px-3.5 py-2.5 rounded-xl bg-brand-paper border border-brand-line focus-within:border-brand-primary/60 focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all"
          >
            <span className="text-brand-muted text-sm mr-1">¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`最多可提现 ${balance.toFixed(2)}`}
              min={10}
              max={balance}
              className="flex-1 bg-transparent text-sm text-brand-ink placeholder:text-brand-faint focus:outline-none"
            />
            <button
              onClick={() => setAmount(String(balance))}
              className="text-[11px] px-2 py-1 rounded-md bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
            >
              全部
            </button>
          </div>
          {insufficient && (
            <div className="mt-1.5 text-[11px] text-rose-600 px-1">余额不足</div>
          )}
          {tooSmall && !insufficient && (
            <div className="mt-1.5 text-[11px] text-amber-600 px-1">单笔提现不低于 ¥10</div>
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
                    ? 'bg-brand-primary/10 border-brand-primary/40'
                    : 'bg-brand-paper border-brand-line hover:border-brand-lineStrong'
                )}
              >
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm text-brand-ink">{m.label}</div>
                  <div className="text-[11px] text-brand-muted">{m.desc}</div>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2', method === m.key ? 'border-brand-primary bg-brand-primary' : 'border-brand-lineStrong')} />
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
              ? 'bg-brand-primary text-white shadow-sm hover:bg-brand-primaryLight active:scale-[0.99]'
              : 'bg-brand-line text-brand-faint cursor-not-allowed'
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
      <div className="absolute inset-0 bg-brand-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-brand-ink">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-brand-paper text-brand-muted hover:text-brand-ink transition-colors"
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
