import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, amount: number, status: string = 'pending') {
    return this.prisma.payment.create({
      data: {
        userId,
        amount: new Decimal(amount),
        status,
      },
    });
  }

  async setCompleted(paymentId: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed' },
    });
  }

  async getByUserId(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTotalRevenue(month?: number, year?: number): Promise<number> {
    const where: { status: string; createdAt?: { gte: Date; lte: Date } } = { status: 'completed' };
    if (month != null && year != null) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.createdAt = { gte: start, lte: end };
    }
    const result = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    });
    return Number(result._sum?.amount ?? 0);
  }

  async getRevenueByMonth(months: number = 12) {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true, createdAt: true },
    });
    const byMonth: Record<string, number> = {};
    for (let i = 0; i <= months; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = 0;
    }
    for (const p of payments) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in byMonth) byMonth[key] += Number(p.amount);
    }
    return byMonth;
  }
}
