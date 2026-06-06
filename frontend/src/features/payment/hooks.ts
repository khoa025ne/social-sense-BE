import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import {
  getPlans,
  createOrder,
  getOrderStatus,
  getSubscription,
  getPaymentHistory,
} from './api';
import { useAuthStore } from '@/features/auth/store';
import { Config } from '@/constants/config';
import type { CreatePaymentRequest } from '@/types/api';

export const paymentKeys = {
  plans: ['payment', 'plans'] as const,
  orderStatus: (orderCode: number) => ['payment', 'order', orderCode] as const,
  subscription: ['payment', 'subscription'] as const,
  history: ['payment', 'history'] as const,
};

// ─── usePaymentPlans ──────────────────────────────────────────────────────────

export function usePaymentPlans() {
  return useQuery({
    queryKey: paymentKeys.plans,
    queryFn: getPlans,
    staleTime: Config.QUERY.STALE_TIME,
  });
}

// ─── useCreateOrder ───────────────────────────────────────────────────────────

export function useCreateOrder() {
  return useMutation({
    mutationFn: (data: CreatePaymentRequest) => createOrder(data),
  });
}

// ─── useOrderStatus (với polling) ─────────────────────────────────────────────

export function useOrderStatus(orderCode: number | null, enabled: boolean = false) {
  return useQuery({
    queryKey: paymentKeys.orderStatus(orderCode ?? 0),
    queryFn: () => getOrderStatus(orderCode!),
    enabled: enabled && orderCode !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Dừng polling khi đạt trạng thái cuối
      if (status === 'Paid' || status === 'Cancelled' || status === 'Expired') {
        return false;
      }
      return Config.QUERY.PAYMENT_POLL_INTERVAL;
    },
    staleTime: 0, // luôn fresh
  });
}

// ─── useSubscription ──────────────────────────────────────────────────────────

export function useSubscription() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: paymentKeys.subscription,
    queryFn: getSubscription,
    enabled: isAuthenticated,
    staleTime: Config.QUERY.STALE_TIME,
  });
}

// ─── usePaymentHistory ────────────────────────────────────────────────────────

export function usePaymentHistory() {
  const { isAuthenticated } = useAuthStore();

  return useInfiniteQuery({
    queryKey: paymentKeys.history,
    queryFn: ({ pageParam = 1 }) => getPaymentHistory(pageParam as number, 10),
    initialPageParam: 1,
    enabled: isAuthenticated,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.totalCount / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}
