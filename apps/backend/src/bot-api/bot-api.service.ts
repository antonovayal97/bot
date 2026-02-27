import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { INSUFFICIENT_BALANCE, NO_AVAILABLE_NODES_IN_COUNTRY } from '../subscriptions/subscriptions.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NodesService } from '../nodes/nodes.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import type { SubscriptionPlan } from '@vpn-v/shared-types';
import { SUBSCRIPTION_PLAN_DAYS } from '@vpn-v/shared-types';

@Injectable()
export class BotApiService {
  constructor(
    private users: UsersService,
    private subscriptions: SubscriptionsService,
    private nodes: NodesService,
    private payments: PaymentsService,
    private settings: SettingsService,
  ) {}

  async registerUser(telegramId: string, username?: string) {
    const { user, welcomeBonusRub } = await this.users.createOrGetByTelegram(telegramId, username);
    return { id: user.id, referralCode: user.referralCode, welcomeBonusRub };
  }

  async getUserByTelegram(telegramId: string) {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return null;
    const activeSubs = await this.subscriptions.getActiveSubscriptionsByUserId(user.id);
    const isActive = activeSubs.length > 0;
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      subscriptionUntil: user.subscriptionUntil,
      isActive,
      referralCode: user.referralCode,
      balance: user.balance,
      balanceRub: user.balanceRub,
      activeSubscriptions: activeSubs.map((s) => ({
        id: s.id,
        plan: s.plan,
        expiresAt: s.expiresAt,
        devicesCount: s.devices?.length ?? 0,
        node: { id: s.node.id, name: s.node.name, country: s.node.country },
      })),
    };
  }

  /** Список стран, где есть хотя бы одна нода со свободными слотами. */
  async getAvailableCountriesForBot(): Promise<{ country: string; nodesAvailable: number }[]> {
    const nodes = await this.nodes.findActive(); // только ноды со свободными слотами
    const byCountry = new Map<string, number>();
    for (const n of nodes) byCountry.set(n.country, (byCountry.get(n.country) ?? 0) + 1);
    return [...byCountry.entries()]
      .map(([country, nodesAvailable]) => ({ country, nodesAvailable }))
      .sort((a, b) => a.country.localeCompare(b.country));
  }

  async getPlansWithPrices(deviceCount?: number): Promise<{ plan: SubscriptionPlan; days: number; price: number }[]> {
    const plans: SubscriptionPlan[] = ['3d', '1m', '3m', '6m', '12m'];
    if (deviceCount != null && deviceCount >= 1) {
      const prices = await Promise.all(
        plans.map(async (plan) => this.settings.getPlanPriceForDevices(plan, deviceCount)),
      );
      return plans.map((plan, i) => ({
        plan,
        days: SUBSCRIPTION_PLAN_DAYS[plan],
        price: prices[i],
      }));
    }
    const basePrices = await this.settings.getPlanPrices();
    return plans.map((plan) => ({
      plan,
      days: SUBSCRIPTION_PLAN_DAYS[plan],
      price: basePrices[plan],
    }));
  }

  async applyReferral(telegramId: string, referralCode: string): Promise<{ ok: boolean; message?: string; referrerTelegramId?: string; referrerPercent?: number; bonusRub?: number }> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return { ok: false, message: 'User not found' };
    if (user.referredBy) return { ok: false, message: 'Already referred' };
    const referrer = await this.users.findByReferralCode(referralCode);
    if (!referrer || referrer.id === user.id) return { ok: false, message: 'Invalid referral code' };
    const globalBonus = await this.settings.getReferralBonusRub();
    const globalPercent = await this.settings.getReferralPercent();
    const bonusRub = referrer.referralBonusRubOverride ?? globalBonus;
    const referrerPercent = referrer.referralPercentOverride ?? globalPercent;
    await this.users.setReferredBy(user.id, referrer.id);
    if (bonusRub > 0) {
      await this.users.addBalanceRub(user.id, bonusRub, 'referral_bonus');
    }
    return { ok: true, referrerTelegramId: referrer.telegramId, referrerPercent, bonusRub };
  }

  async getConfigForUser(telegramId: string, nodeId?: string, deviceId?: string): Promise<{ config: string | null; nodeName?: string; filename?: string; configs?: { deviceId?: string; nodeId: string; nodeName: string; country: string; config: string | null; expiresAt: string }[] }> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return { config: null };
    const activeSubs = await this.subscriptions.getActiveSubscriptionsByUserId(user.id);
    if (activeSubs.length === 0) return { config: null };
    const configs: { deviceId?: string; nodeId: string; nodeName: string; country: string; config: string | null; expiresAt: string }[] = [];
    for (const s of activeSubs) {
      for (const dev of s.devices) {
        configs.push({
          deviceId: dev.id,
          nodeId: s.node.id,
          nodeName: s.node.name,
          country: s.node.country,
          expiresAt: s.expiresAt.toISOString(),
          config: dev.configContent ?? null,
        });
      }
    }
    if (deviceId) {
      let one = configs.find((c) => c.deviceId === deviceId);
      if (!one) one = configs.find((c) => c.nodeId === deviceId);
      if (one) return { config: one.config, nodeName: one.nodeName, configs };
      return { config: null, configs };
    }
    if (nodeId) {
      const one = configs.find((c) => c.nodeId === nodeId);
      if (one) return { config: one.config, nodeName: one.nodeName, configs };
      return { config: null, configs };
    }
    return {
      config: configs[0]?.config ?? null,
      nodeName: configs[0]?.nodeName,
      configs,
    };
  }

  async createSubscription(telegramId: string, plan: SubscriptionPlan, country: string, deviceCount: number = 1): Promise<{ ok: boolean; expiresAt?: Date; paymentId?: string; insufficientBalance?: boolean; error?: string }> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return { ok: false };
    const devicesToCreate = Math.max(1, Math.min(deviceCount ?? 1, 10));
    const price = await this.settings.getPlanPriceForDevices(plan, devicesToCreate);
    try {
      const { id: subscriptionId, expiresAt } = await this.subscriptions.createFromBalance(user.id, plan, price, country, devicesToCreate);
      const sub = await this.subscriptions.getById(subscriptionId);
      if (sub && sub.nodeId && devicesToCreate > 0) {
        const result = await this.nodes.createUsers(sub.nodeId, devicesToCreate);
        if (result.ok && result.clients?.length) {
          for (const c of result.clients) {
            await this.subscriptions.setConfigContent(subscriptionId, c.config);
          }
        }
      }
      return { ok: true, expiresAt };
    } catch (e) {
      if (e instanceof BadRequestException) {
        const res = e.getResponse();
        const msg = typeof res === 'object' && res != null && 'message' in res ? (res as { message: string }).message : res;
        const errStr = typeof msg === 'string' ? msg : String(msg);
        if (msg === INSUFFICIENT_BALANCE) return { ok: false, insufficientBalance: true };
        if (msg === NO_AVAILABLE_NODES_IN_COUNTRY || errStr.includes('нет свободных слотов')) {
          return { ok: false, error: errStr.includes('Свободно:') ? errStr : 'В этой стране сейчас нет свободных слотов.' };
        }
        if (errStr.includes('уже есть активная подписка')) return { ok: false, error: errStr };
        return { ok: false, error: errStr };
      }
      throw e;
    }
  }

  async extendSubscription(telegramId: string, subscriptionId: string, plan: SubscriptionPlan): Promise<{ ok: boolean; expiresAt?: string; insufficientBalance?: boolean; error?: string }> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return { ok: false };
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) return { ok: false, error: 'Подписка не найдена' };
    const deviceCount = Math.max(1, sub.devices?.length ?? 0);
    const price = await this.settings.getPlanPriceForDevices(plan, deviceCount);
    try {
      const { expiresAt } = await this.subscriptions.extendFromBalance(user.id, subscriptionId, plan, price);
      return { ok: true, expiresAt: expiresAt.toISOString() };
    } catch (e) {
      if (e instanceof BadRequestException) {
        const res = e.getResponse();
        const msg = typeof res === 'object' && res != null && 'message' in res ? (res as { message: string }).message : res;
        if (msg === INSUFFICIENT_BALANCE) return { ok: false, insufficientBalance: true };
        return { ok: false, error: String(msg) };
      }
      throw e;
    }
  }

  async getExpiringSoonTelegramIds(days: number = 3): Promise<string[]> {
    const subs = await this.subscriptions.getExpiringInDays(days);
    const users = await this.users.findAll({});
    const userIdToTelegram = new Map(users.list.map((u: { id: string; telegramId: string }) => [u.id, u.telegramId]));
    return subs.map((s: { userId: string }) => userIdToTelegram.get(s.userId)).filter(Boolean) as string[];
  }

  async getReferralStats(telegramId: string): Promise<{ referralCode: string; referralsCount: number; referralPercent: number; referralBonusRub: number; inviteLink?: string } | null> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return null;
    const [referralsCount, globalPercent, globalBonus] = await Promise.all([
      this.users.countReferrals(user.id),
      this.settings.getReferralPercent(),
      this.settings.getReferralBonusRub(),
    ]);
    const referralPercent = user.referralPercentOverride ?? globalPercent;
    const referralBonusRub = user.referralBonusRubOverride ?? globalBonus;
    return {
      referralCode: user.referralCode,
      referralsCount,
      referralPercent,
      referralBonusRub,
      inviteLink: undefined,
    };
  }
}
