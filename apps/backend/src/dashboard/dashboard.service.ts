import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private payments: PaymentsService,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [usersCount, activeSubscriptions, revenueMonth] = await Promise.all([
      this.prisma.user.count(),
      this.subscriptions.getActiveCount(),
      this.payments.getTotalRevenue(now.getMonth() + 1, now.getFullYear()),
    ]);
    return {
      usersCount,
      activeSubscriptions,
      revenueMonth,
    };
  }

  async getRegistrationsByDay(days: number = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    });
    const byDay: Record<string, number> = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    for (const u of users) {
      const key = new Date(u.createdAt).toISOString().slice(0, 10);
      if (key in byDay) byDay[key]++;
    }
    return byDay;
  }
}
