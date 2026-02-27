import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NodesService } from '../nodes/nodes.service';
import { TelegramService } from '../telegram/telegram.service';
import { BotTextsService } from '../bot-texts/bot-texts.service';
import { getCountryName } from '@vpn-v/shared-types';

function parseAddressIpFromConfig(configContent: string | null): string | null {
  if (!configContent) return null;
  const match = configContent.match(/^Address\s*=\s*([^\s/]+)/m);
  return match ? match[1].trim() : null;
}

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(
    private prisma: PrismaService,
    private nodes: NodesService,
    private telegram: TelegramService,
    private botTexts: BotTextsService,
  ) {}

  @Cron('0 */15 * * * *') // каждые 15 минут
  async sendExpiring24hReminders() {
    const now = new Date();
    const in24h = new Date(now);
    in24h.setHours(in24h.getHours() + 24);

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        expiresAt: { gte: now, lte: in24h },
        expiring24hReminderSentAt: null,
      },
      include: { user: { select: { telegramId: true } } },
    });

    const texts = await this.botTexts.getAll();
    const reminderText = texts.expiring_reminder ?? '⏰ Напоминание: осталось менее 24 часов до окончания подписки. Нажмите «Купить/Продлить» или «Статус» в меню бота.';

    for (const sub of subs) {
      const telegramId = sub.user?.telegramId;
      if (telegramId) {
        try {
          await this.telegram.sendMessage(String(telegramId), reminderText);
        } catch (err) {
          this.logger.warn(
            `sendExpiring24hReminders: ошибка отправки пользователю ${telegramId}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { expiring24hReminderSentAt: now },
      });
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireSubscriptions() {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { status: 'active', expiresAt: { lt: now } },
      include: { user: { select: { telegramId: true } }, node: { select: { name: true, country: true } }, devices: true },
    });
    const affectedUserIds = new Set(expired.map((s) => s.userId));

    for (const sub of expired) {
      if (sub.nodeId && sub.devices.length > 0) {
        const ips = sub.devices
          .map((d) => parseAddressIpFromConfig(d.configContent))
          .filter((ip): ip is string => !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
        if (ips.length > 0) {
          const result = await this.nodes.removeUsersByIp(sub.nodeId, ips);
          if (!result.ok) {
            this.logger.warn(`expireSubscriptions: не удалось удалить на VPS подписку ${sub.id}: ${result.error}`);
          }
        }
      }

      const countryLabel = sub.node ? (getCountryName(sub.node.country) || sub.node.country) : 'VPN';
      const telegramId =
        sub.user?.telegramId ??
        (await this.prisma.user.findUnique({
          where: { id: sub.userId },
          select: { telegramId: true },
        }))?.telegramId;

      if (telegramId) {
        const text = `⏰ <b>Подписка истекла</b>\n\nВаша подписка на VPN (${countryLabel}) завершилась. Конфиг больше недействителен. Для продления нажмите «Купить/Продлить» в меню бота.`;
        try {
          const sent = await this.telegram.sendMessage(String(telegramId), text);
          if (!sent) {
            this.logger.warn(`expireSubscriptions: не удалось отправить уведомление пользователю ${telegramId}`);
          }
        } catch (err) {
          this.logger.warn(`expireSubscriptions: ошибка отправки уведомления: ${err instanceof Error ? err.message : err}`);
        }
      }

      await this.prisma.subscriptionDevice.deleteMany({ where: { subscriptionId: sub.id } });
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
    }

    const usersToSync = await this.prisma.user.findMany({
      where: {
        OR: [{ id: { in: [...affectedUserIds] } }, { subscriptionUntil: { lt: now } }],
      },
      select: { id: true },
    });
    for (const u of usersToSync) {
      const latest = await this.prisma.subscription.findFirst({
        where: { userId: u.id, status: 'active', expiresAt: { gte: now } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      });
      await this.prisma.user.update({
        where: { id: u.id },
        data: { subscriptionUntil: latest?.expiresAt ?? null },
      });
    }
  }
}
