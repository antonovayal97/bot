import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { User } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private generateReferralCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        assignedNode: true,
        subscriptions: { include: { node: true, devices: true }, orderBy: { startedAt: 'desc' } },
        payments: true,
        balanceTopUps: {
          orderBy: { createdAt: 'desc' },
          include: { relatedUser: { select: { id: true, telegramId: true, username: true } } },
        },
        referredByUser: { select: { id: true, telegramId: true, username: true, referralCode: true } },
        referrals: { select: { id: true, telegramId: true, username: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async createOrGetByTelegram(
    telegramId: string,
    username?: string,
  ): Promise<{ user: User; welcomeBonusRub: number }> {
    const existing = await this.findByTelegramId(telegramId);
    if (existing) return { user: existing, welcomeBonusRub: 0 };

    let referralCode = this.generateReferralCode();
    while (await this.prisma.user.findUnique({ where: { referralCode } })) {
      referralCode = this.generateReferralCode();
    }

    const user = await this.prisma.user.create({
      data: {
        telegramId,
        username: username ?? null,
        referralCode,
      },
    });

    const welcomeBonusRub = await this.settings.getWelcomeBonusRub();
    if (welcomeBonusRub > 0) {
      await this.addBalanceRub(user.id, welcomeBonusRub, 'welcome_bonus');
      const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      return { user: updated, welcomeBonusRub };
    }

    return { user, welcomeBonusRub: 0 };
  }

  async updateSubscriptionUntil(userId: string, until: Date | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: until },
    });
  }

  async assignNode(userId: string, nodeId: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { assignedNodeId: nodeId },
      include: { assignedNode: true },
    });
  }

  async addBalance(userId: string, days: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const current = user.subscriptionUntil ? new Date(user.subscriptionUntil) : new Date();
    const newUntil = new Date(current);
    newUntil.setDate(newUntil.getDate() + days);
    return this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: newUntil, balance: user.balance + days },
    });
  }

  /** source: admin | referral_commission | referral_bonus | payment_gateway */
  async addBalanceRub(userId: string, amountRub: number, source: string = 'admin'): Promise<User> {
    if (amountRub <= 0) throw new Error('Amount must be positive');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { balanceRub: user.balanceRub + amountRub },
    });
    await this.prisma.balanceTopUp.create({
      data: { userId, amount: amountRub, source },
    });
    if (user.referredBy) {
      const referrer = await this.prisma.user.findUnique({ where: { id: user.referredBy } });
      if (referrer) {
        const globalPercent = await this.settings.getReferralPercent();
        const percent = referrer.referralPercentOverride ?? globalPercent;
        const commission = Math.round((amountRub * percent) / 100);
        if (commission > 0) {
          await this.prisma.user.update({
            where: { id: user.referredBy },
            data: { balanceRub: referrer.balanceRub + commission },
          });
          await this.prisma.balanceTopUp.create({
            data: { userId: user.referredBy, amount: commission, source: 'referral_commission', relatedUserId: userId },
          });
        }
      }
    }
    return updated;
  }

  async updateReferralOverrides(
    userId: string,
    data: { referralBonusRubOverride?: number | null; referralPercentOverride?: number | null },
  ): Promise<User> {
    const update: { referralBonusRubOverride?: number | null; referralPercentOverride?: number | null } = {};
    if (data.referralBonusRubOverride !== undefined) update.referralBonusRubOverride = data.referralBonusRubOverride;
    if (data.referralPercentOverride !== undefined) update.referralPercentOverride = data.referralPercentOverride;
    return this.prisma.user.update({ where: { id: userId }, data: update });
  }

  async setReferredBy(userId: string, referredByUserId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { referredBy: referredByUserId },
    });
  }

  async findAll(params: { activeOnly?: boolean; search?: string; skip?: number; take?: number }) {
    const where: Record<string, unknown> = {};
    if (params.activeOnly) {
      where.subscriptionUntil = { gte: new Date() };
    }
    if (params.search) {
      where.OR = [
        { telegramId: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
        { referralCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: { assignedNode: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { list, total };
  }

  async findByReferralCode(code: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { referralCode: code.toUpperCase() } });
  }

  async countReferrals(referrerId: string): Promise<number> {
    return this.prisma.user.count({ where: { referredBy: referrerId } });
  }
}
