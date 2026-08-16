import { api } from "./client"

// ─── Types ───
export interface PaymentPlan {
  tier: string
  name: string
  price: number
  quota: number
  features: string[]
}

export interface CreatePaymentResponse {
  orderId: number
  orderCode: number
  tier: string
  amount: number
  description: string
  checkoutUrl: string
  qrCodeUrl: string
  bankTransfer: {
    bankName: string
    accountNumber: string
    accountName: string
    amount: number
    description: string
  }
  expiresAt: string
}

export interface OrderStatusResponse {
  orderId: number
  orderCode: number
  status: "Pending" | "Paid" | "Cancelled" | "Expired"
  tier: string
  amount: number
  paidAt: string | null
  createdAt: string
}

export interface SubscriptionInfo {
  userId: number
  tier: string
  status: string
  startedAt: string
  expiresAt: string
  daysRemaining: number
  isActive: boolean
}

export interface PaymentHistoryItem {
  orderId: number
  orderCode: number
  tier: string
  amount: number
  status: string
  createdAt: string
  paidAt: string | null
}

// ─── API calls ───
export const paymentApi = {
  getPlans: () =>
    api.get<PaymentPlan[]>("/payment/plans"),

  createPayment: (tier: string, returnUrl?: string, cancelUrl?: string) =>
    api.post<CreatePaymentResponse>("/payment/create", { tier, returnUrl, cancelUrl }),

  getOrderStatus: (orderCode: number) =>
    api.get<OrderStatusResponse>(`/payment/orders/${orderCode}/status`),

  getSubscription: () =>
    api.get<SubscriptionInfo>("/payment/subscription"),

  getHistory: (page = 1, pageSize = 10) =>
    api.get<{ page: number; pageSize: number; data: PaymentHistoryItem[] }>(
      `/payment/history?page=${page}&pageSize=${pageSize}`
    ),
}
