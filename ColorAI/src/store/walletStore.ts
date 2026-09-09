/**
 * 钱包 Store
 * - 余额、订单、充值/提现记录
 * - 使用 localStorage 持久化
 * - 订单来自工作流中的聊天下单（ChatModal 确认下单时调用 addOrder）
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sanitizeText } from '@/lib/security';

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  orderNo: string;
  shopName: string;
  product: string;
  colorHex?: string;
  spec?: string;
  quantity: number;
  price: number;
  status: OrderStatus;
  createdAt: number;
  /** 关联的聊天商家 ID（可选，用于追溯） */
  shopId?: string;
}

export type TxType = 'recharge' | 'withdraw' | 'payment' | 'refund';
export type TxStatus = 'success' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  description: string;
  createdAt: number;
  /** 充值/提现方式：alipay/wechat/bank */
  method?: string;
}

interface WalletState {
  balance: number;
  /** 冻结金额（提现中） */
  frozen: number;
  orders: Order[];
  transactions: Transaction[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'status'> & Partial<Pick<Order, 'status'>>) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  recharge: (amount: number, method: string) => Promise<{ success: boolean; message?: string }>;
  withdraw: (amount: number, method: string) => Promise<{ success: boolean; message?: string }>;
  payOrder: (orderId: string) => Promise<{ success: boolean; message?: string }>;
}

/** 生成订单号 */
function genOrderNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString().slice(2, 8);
  return `${ymd}${rand}`;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 初始赠送余额（演示用） */
const INITIAL_BALANCE = 1000;

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,
      frozen: 0,
      orders: [],
      transactions: [],

      addOrder: (order) => {
        const id = genId('ord');
        const newOrder: Order = {
          id,
          orderNo: order.orderNo || genOrderNo(),
          shopName: sanitizeText(order.shopName),
          product: sanitizeText(order.product),
          colorHex: order.colorHex,
          spec: order.spec ? sanitizeText(order.spec) : undefined,
          quantity: order.quantity,
          price: order.price,
          status: order.status || 'pending',
          createdAt: Date.now(),
          shopId: order.shopId,
        };
        set((state) => ({ orders: [newOrder, ...state.orders] }));
        return id;
      },

      updateOrderStatus: (orderId, status) => {
        set((state) => ({
          orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
        }));
      },

      recharge: async (amount, method) => {
        if (!Number.isFinite(amount) || amount <= 0) {
          return { success: false, message: '充值金额必须大于 0' };
        }
        if (amount > 50000) {
          return { success: false, message: '单笔充值不超过 50000 元' };
        }
        // 模拟支付网关延迟
        await new Promise((r) => setTimeout(r, 600));
        const tx: Transaction = {
          id: genId('tx'),
          type: 'recharge',
          amount,
          status: 'success',
          description: `充值 ¥${amount.toFixed(2)}`,
          createdAt: Date.now(),
          method: sanitizeText(method),
        };
        set((state) => ({
          balance: state.balance + amount,
          transactions: [tx, ...state.transactions],
        }));
        return { success: true };
      },

      withdraw: async (amount, method) => {
        if (!Number.isFinite(amount) || amount <= 0) {
          return { success: false, message: '提现金额必须大于 0' };
        }
        if (amount < 10) {
          return { success: false, message: '单笔提现不低于 10 元' };
        }
        const state = get();
        if (amount > state.balance) {
          return { success: false, message: '余额不足' };
        }
        await new Promise((r) => setTimeout(r, 800));
        const tx: Transaction = {
          id: genId('tx'),
          type: 'withdraw',
          amount,
          status: 'success',
          description: `提现 ¥${amount.toFixed(2)}`,
          createdAt: Date.now(),
          method: sanitizeText(method),
        };
        set((s) => ({
          balance: s.balance - amount,
          transactions: [tx, ...s.transactions],
        }));
        return { success: true };
      },

      payOrder: async (orderId) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { success: false, message: '订单不存在' };
        if (order.status !== 'pending') return { success: false, message: '订单状态不允许支付' };
        if (order.price > state.balance) return { success: false, message: '余额不足，请先充值' };

        await new Promise((r) => setTimeout(r, 500));
        const tx: Transaction = {
          id: genId('tx'),
          type: 'payment',
          amount: order.price,
          status: 'success',
          description: `支付订单 ${order.orderNo}`,
          createdAt: Date.now(),
        };
        set((s) => ({
          balance: s.balance - order.price,
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: 'paid' } : o)),
          transactions: [tx, ...s.transactions],
        }));
        return { success: true };
      },
    }),
    {
      name: 'colorai_wallet',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useWalletStore;
