// Countries for VPN nodes (user can choose country when selecting VPN)
export const VPN_COUNTRIES: { code: string; name: string }[] = [
  { code: 'NL', name: 'Нидерланды' },
  { code: 'DE', name: 'Германия' },
  { code: 'FI', name: 'Финляндия' },
  { code: 'FR', name: 'Франция' },
  { code: 'PL', name: 'Польша' },
  { code: 'US', name: 'США' },
  { code: 'SG', name: 'Сингапур' },
  { code: 'GB', name: 'Великобритания' },
  { code: 'CA', name: 'Канада' },
  { code: 'CH', name: 'Швейцария' },
  { code: 'SE', name: 'Швеция' },
  { code: 'NO', name: 'Норвегия' },
  { code: 'RO', name: 'Румыния' },
  { code: 'ES', name: 'Испания' },
  { code: 'IT', name: 'Италия' },
  { code: 'AT', name: 'Австрия' },
  { code: 'CZ', name: 'Чехия' },
  { code: 'JP', name: 'Япония' },
  { code: 'KR', name: 'Южная Корея' },
  { code: 'AU', name: 'Австралия' },
];

export function getCountryName(code: string): string {
  if (code == null || code === '') return '';
  return VPN_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// Subscription plans
export type SubscriptionPlan = '3d' | '1m' | '3m' | '6m' | '12m';

export const SUBSCRIPTION_PLAN_DAYS: Record<SubscriptionPlan, number> = {
  '3d': 3,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '12m': 365,
};

// Subscription status
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

// Payment status
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// API responses
export interface UserDto {
  id: string;
  telegramId: string;
  username: string | null;
  subscriptionUntil: Date | null;
  isActive: boolean;
  referralCode: string;
  referredBy: string | null;
  balance: number;
  createdAt: Date;
}

export interface SubscriptionDto {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  price: number;
  startedAt: Date;
  expiresAt: Date;
  status: SubscriptionStatus;
}

export interface NodeDto {
  id: string;
  name: string;
  country: string;
  ip: string;
  isActive: boolean;
  loadPercent: number;
}

export interface PaymentDto {
  id: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
}

// Settings
export interface AppSettingsDto {
  referralPercent: number;
  planPrices: Record<SubscriptionPlan, number>;
}
