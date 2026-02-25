import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

export type BroadcastFilter = 'with_subscriptions' | 'all' | 'without_subscriptions';

const DELAY_MS = 100; // ~10 msg/sec, под лимит Telegram

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async getTelegramIdsByFilter(filter: BroadcastFilter): Promise<string[]> {
    const now = new Date();
    const where: Record<string, unknown> = {};

    if (filter === 'with_subscriptions') {
      where.subscriptionUntil = { gte: now };
    } else if (filter === 'without_subscriptions') {
      where.OR = [{ subscriptionUntil: null }, { subscriptionUntil: { lt: now } }];
    }
    // filter === 'all' → where остаётся пустым

    const users = await this.prisma.user.findMany({
      where,
      select: { telegramId: true },
    });
    return users.map((u) => u.telegramId);
  }

  async getCountByFilter(filter: BroadcastFilter): Promise<number> {
    const ids = await this.getTelegramIdsByFilter(filter);
    return ids.length;
  }

  /** Отправить тестовое сообщение одному пользователю по Telegram ID. */
  async sendTest(telegramId: string, text: string): Promise<boolean> {
    const safeText = text.trim();
    if (!safeText) return false;
    return this.telegram.sendMessage(telegramId.trim(), safeText);
  }

  async send(text: string, filter: BroadcastFilter): Promise<{ sent: number; failed: number }> {
    const ids = await this.getTelegramIdsByFilter(filter);
    if (ids.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const safeText = text.trim();
    let sent = 0;
    let failed = 0;

    for (const telegramId of ids) {
      const ok = await this.telegram.sendMessage(telegramId, safeText);
      if (ok) sent++;
      else failed++;
      if (ids.length > 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    this.logger.log(`Broadcast (${filter}): sent=${sent}, failed=${failed}, total=${ids.length}`);
    return { sent, failed };
  }
}
