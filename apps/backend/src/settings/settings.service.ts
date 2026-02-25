import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

const DEFAULT_REFERRAL_PERCENT = 10;
const DEFAULT_REFERRAL_BONUS_RUB = 20;
const DEFAULT_WELCOME_BONUS_RUB = 15;
const DEFAULT_PLAN_PRICES: Record<SubscriptionPlan, number> = {
  '3d': 60,
  '1m': 299,
  '3m': 799,
  '6m': 1499,
  '12m': 2499,
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private async getJson<T>(key: string, defaultValue: T): Promise<T> {
    const row = await this.prisma.appSettings.findUnique({ where: { key } });
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  private async setJson(key: string, value: unknown): Promise<void> {
    await this.prisma.appSettings.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }

  async getReferralPercent(): Promise<number> {
    return this.getJson<number>('referralPercent', DEFAULT_REFERRAL_PERCENT);
  }

  async setReferralPercent(percent: number): Promise<void> {
    await this.setJson('referralPercent', percent);
  }

  async getReferralBonusRub(): Promise<number> {
    return this.getJson<number>('referralBonusRub', DEFAULT_REFERRAL_BONUS_RUB);
  }

  async setReferralBonusRub(amount: number): Promise<void> {
    await this.setJson('referralBonusRub', amount);
  }

  async getWelcomeBonusRub(): Promise<number> {
    return this.getJson<number>('welcomeBonusRub', DEFAULT_WELCOME_BONUS_RUB);
  }

  async setWelcomeBonusRub(amount: number): Promise<void> {
    await this.setJson('welcomeBonusRub', amount);
  }

  async getPlanPrices(): Promise<Record<SubscriptionPlan, number>> {
    const prices = await this.getJson<Record<string, number>>('planPrices', DEFAULT_PLAN_PRICES);
    return { ...DEFAULT_PLAN_PRICES, ...prices };
  }

  async setPlanPrices(prices: Partial<Record<SubscriptionPlan, number>>): Promise<void> {
    const current = await this.getPlanPrices();
    await this.setJson('planPrices', { ...current, ...prices });
  }

  /** Цены по планам и количеству устройств. planDevicePrices[plan][devices] */
  async getPlanDevicePrices(): Promise<Record<SubscriptionPlan, Record<number, number>>> {
    const raw = await this.getJson<Record<string, Record<string, number>>>('planDevicePrices', {});
    const result: Record<string, Record<number, number>> = {};
    const plans: SubscriptionPlan[] = ['3d', '1m', '3m', '6m', '12m'];
    const basePrices = await this.getPlanPrices();
    for (const plan of plans) {
      const byDev = raw[plan];
      result[plan] = {};
      for (let d = 1; d <= 10; d++) {
        const v = byDev?.[String(d)] ?? byDev?.[d];
        result[plan][d] = typeof v === 'number' && v > 0 ? v : Math.round(basePrices[plan] * d);
      }
    }
    return result as Record<SubscriptionPlan, Record<number, number>>;
  }

  async setPlanDevicePrices(prices: Record<SubscriptionPlan, Record<number, number>>): Promise<void> {
    const current = await this.getPlanDevicePrices();
    const merged: Record<string, Record<string, number>> = {};
    for (const plan of ['3d', '1m', '3m', '6m', '12m'] as const) {
      merged[plan] = { ...current[plan], ...(prices[plan] || {}) };
    }
    await this.setJson('planDevicePrices', merged);
  }

  /** Цена для плана и количества устройств (для покупки). */
  async getPlanPriceForDevices(plan: SubscriptionPlan, deviceCount: number): Promise<number> {
    const map = await this.getPlanDevicePrices();
    const byDev = map[plan];
    return byDev?.[deviceCount] ?? (await this.getPlanPrices())[plan] * Math.max(1, deviceCount);
  }

  async getAll() {
    const [referralPercent, referralBonusRub, welcomeBonusRub, planPrices, planDevicePrices] = await Promise.all([
      this.getReferralPercent(),
      this.getReferralBonusRub(),
      this.getWelcomeBonusRub(),
      this.getPlanPrices(),
      this.getPlanDevicePrices(),
    ]);
    return { referralPercent, referralBonusRub, welcomeBonusRub, planPrices, planDevicePrices };
  }
}
