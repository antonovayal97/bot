import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NodesService } from '../nodes/nodes.service';
import { TelegramService } from '../telegram/telegram.service';
import { getCountryName } from '@vpn-v/shared-types';
import { SUBSCRIPTION_PLAN_DAYS } from '@vpn-v/shared-types';
import type { SubscriptionPlan } from '@vpn-v/shared-types';
import { Decimal } from '@prisma/client/runtime/library';

export const INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE';
export const NO_AVAILABLE_NODES_IN_COUNTRY = 'NO_AVAILABLE_NODES_IN_COUNTRY';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAddressIpFromConfig(configContent: string | null): string | null {
  if (!configContent) return null;
  const match = configContent.match(/^Address\s*=\s*([^\s/]+)/m);
  return match ? match[1].trim() : null;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private nodes: NodesService,
    private telegram: TelegramService,
  ) {}

  /**
   * Покупка новой подписки по стране за счёт внутреннего баланса.
   * Не продлевает — если в стране уже есть активная подписка, выбрасывает ALREADY_SUBSCRIBED_IN_COUNTRY.
   */
  async createFromBalance(userId: string, plan: SubscriptionPlan, price: number, country: string, deviceCount: number = 1): Promise<{ id: string; expiresAt: Date }> {
    const priceRub = Math.round(price);
    const days = SUBSCRIPTION_PLAN_DAYS[plan];
    const startedAt = new Date();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');
      if (user.balanceRub < priceRub) throw new BadRequestException(INSUFFICIENT_BALANCE);

      // Выбираем ноду в стране с минимальной загрузкой (активные подписки) и свободными слотами
      const nodes = await tx.node.findMany({
        where: { isActive: true, country },
        select: { id: true, maxUsers: true },
      });
      if (nodes.length === 0) throw new BadRequestException(NO_AVAILABLE_NODES_IN_COUNTRY);

      const counts = await Promise.all(
        nodes.map(async (n) => {
          const c = await tx.subscriptionDevice.count({
            where: { subscription: { nodeId: n.id, status: 'active', expiresAt: { gte: now } } },
          });
          return { nodeId: n.id, maxUsers: n.maxUsers ?? 2, active: c };
        }),
      );
      const needSlots = Math.max(1, Math.min(deviceCount, 10));
      const available = counts
        .filter((x) => x.active + needSlots <= x.maxUsers)
        .sort((a, b) => a.active - b.active);
      if (available.length === 0) {
        const totalSlots = counts.reduce((sum, x) => sum + x.maxUsers, 0);
        const usedSlots = counts.reduce((sum, x) => sum + x.active, 0);
        const freeSlots = totalSlots - usedSlots;
        throw new BadRequestException(
          `В этой стране сейчас нет свободных слотов. Свободно: ${freeSlots} мест (нужно ${needSlots}).`,
        );
      }

      const chosenNodeId = available[0].nodeId;

      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + days);

      const sub = await tx.subscription.create({
        data: {
          userId,
          nodeId: chosenNodeId,
          plan,
          price: new Decimal(price),
          startedAt,
          expiresAt,
          status: 'active',
        },
      });
      const subscriptionId = sub.id;

      await tx.user.update({
        where: { id: userId },
        data: {
          balanceRub: user.balanceRub - priceRub,
        },
      });

      await tx.payment.create({
        data: {
          userId,
          amount: new Decimal(price),
          status: 'completed',
        },
      });

      // Синхронизируем общую дату окончания как max по активным подпискам
      const latestActive = await tx.subscription.findFirst({
        where: { userId, status: 'active', expiresAt: { gte: now } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { subscriptionUntil: latestActive?.expiresAt ?? null },
      });

      return { id: sub.id, expiresAt };
    });
  }

  /**
   * Продление подписки: добавляет дни, не меняет количество устройств.
   * Списывает цену с баланса пользователя.
   */
  async extendFromBalance(userId: string, subscriptionId: string, plan: SubscriptionPlan, price: number): Promise<{ expiresAt: Date }> {
    const priceRub = Math.round(price);
    const days = SUBSCRIPTION_PLAN_DAYS[plan];
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');
      if (user.balanceRub < priceRub) throw new BadRequestException(INSUFFICIENT_BALANCE);

      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true },
      });
      if (!sub) throw new BadRequestException('Подписка не найдена');
      if (sub.userId !== userId) throw new BadRequestException('Подписка принадлежит другому пользователю');
      if (sub.status !== 'active') throw new BadRequestException('Подписка не активна');

      const baseUntil = sub.expiresAt > now ? new Date(sub.expiresAt) : now;
      const newExpiresAt = new Date(baseUntil);
      newExpiresAt.setDate(newExpiresAt.getDate() + days);

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { expiresAt: newExpiresAt },
      });

      await tx.user.update({
        where: { id: userId },
        data: { balanceRub: user.balanceRub - priceRub },
      });

      await tx.payment.create({
        data: {
          userId,
          amount: new Decimal(price),
          status: 'completed',
        },
      });

      const latestActive = await tx.subscription.findFirst({
        where: { userId, status: 'active', expiresAt: { gte: now } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { subscriptionUntil: latestActive?.expiresAt ?? null },
      });

      return { expiresAt: newExpiresAt };
    });
  }

  async create(userId: string, plan: SubscriptionPlan, price: number, nodeId: string): Promise<{ id: string; expiresAt: Date }> {
    const days = SUBSCRIPTION_PLAN_DAYS[plan];
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + days);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const now = new Date();
    const baseUntil = user?.subscriptionUntil && new Date(user.subscriptionUntil) > now
      ? new Date(user.subscriptionUntil)
      : now;
    const newUntil = new Date(baseUntil);
    newUntil.setDate(newUntil.getDate() + days);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        nodeId,
        plan,
        price: new Decimal(price),
        startedAt,
        expiresAt: newUntil,
        status: 'active',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: newUntil },
    });

    return { id: sub.id, expiresAt: newUntil };
  }

  /** Для теста cron: установить окончание подписки через 24 часа (напоминание expiring24h). */
  async setExpiresIn24Hours(subscriptionId: string): Promise<{ expiresAt: Date }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });
    if (!sub) throw new BadRequestException('Subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('Подписка не активна');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt, expiring24hReminderSentAt: null },
    });

    const now = new Date();
    const latestActive = await this.prisma.subscription.findFirst({
      where: { userId: sub.userId, status: 'active', expiresAt: { gte: now } },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { subscriptionUntil: latestActive?.expiresAt ?? expiresAt },
    });

    return { expiresAt };
  }

  /** Для теста cron: установить окончание подписки через 5 минут. */
  async setExpiresIn5Minutes(subscriptionId: string): Promise<{ expiresAt: Date }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });
    if (!sub) throw new BadRequestException('Subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('Подписка не активна');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt },
    });

    const now = new Date();
    const latestActive = await this.prisma.subscription.findFirst({
      where: { userId: sub.userId, status: 'active', expiresAt: { gte: now } },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { subscriptionUntil: latestActive?.expiresAt ?? expiresAt },
    });

    return { expiresAt };
  }

  /** Добавить дни к подписке (админ). Возвращает подписку и telegramId пользователя для уведомления. */
  async addDays(
    subscriptionId: string,
    days: number,
  ): Promise<{ subscription: { id: string; expiresAt: Date }; telegramId: string | null }> {
    if (days < 1 || days > 365) throw new BadRequestException('Укажите дни от 1 до 365');
    const now = new Date();
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, node: true },
    });
    if (!sub) throw new BadRequestException('Subscription not found');
    const baseUntil = sub.expiresAt > now ? new Date(sub.expiresAt) : now;
    const newExpiresAt = new Date(baseUntil);
    newExpiresAt.setDate(newExpiresAt.getDate() + days);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt: newExpiresAt },
    });

    const latestActive = await this.prisma.subscription.findFirst({
      where: { userId: sub.userId, status: 'active', expiresAt: { gte: now } },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { subscriptionUntil: latestActive?.expiresAt ?? null },
    });

    return {
      subscription: { id: sub.id, expiresAt: newExpiresAt },
      telegramId: sub.user.telegramId,
    };
  }

  async expireSubscription(subscriptionId: string): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'expired' },
    });
  }

  async getActiveByUserId(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'active', expiresAt: { gte: new Date() } },
      orderBy: { expiresAt: 'desc' },
    });
  }

  /** Все активные подписки пользователя с нодами и устройствами. */
  async getActiveSubscriptionsByUserId(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId, status: 'active', expiresAt: { gte: new Date() } },
      orderBy: { expiresAt: 'desc' },
      include: { node: true, devices: true },
    });
  }

  async getById(id: string) {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { node: true, devices: true },
    });
  }

  /** Добавить устройство к подписке (сохранить конфиг). */
  async setConfigContent(subscriptionId: string, configContent: string): Promise<void> {
    await this.prisma.subscriptionDevice.create({
      data: { subscriptionId, configContent },
    });
  }

  async deleteConfigContent(subscriptionId: string, adminMessage?: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { telegramId: true } }, node: { select: { name: true, country: true } }, devices: true },
    });
    if (!sub) throw new BadRequestException('Подписка не найдена');
    if (sub.nodeId && sub.devices.length > 0) {
      const ips = sub.devices
        .map((d) => parseAddressIpFromConfig(d.configContent))
        .filter((ip): ip is string => !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
      if (ips.length > 0) {
        const result = await this.nodes.removeUsersByIp(sub.nodeId, ips);
        if (!result.ok) {
          this.logger.warn(`deleteConfigContent: не удалось удалить устройства на VPS: ${result.error}`);
        }
      }
    }
    const countryLabel = sub.node ? (getCountryName(sub.node.country) || sub.node.country) : 'VPN';
    const telegramId = sub.user?.telegramId ?? (await this.prisma.user.findUnique({
      where: { id: sub.userId },
      select: { telegramId: true },
    }))?.telegramId;

    if (telegramId) {
      let text = `⚠️ <b>Подписка отменена</b>\n\nВаша подписка на VPN (${countryLabel}) была удалена администратором. Конфиг больше недействителен. Для нового доступа оформите подписку заново.`;
      if (adminMessage) {
        text += `\n\nСообщение от администратора:\n${adminMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
      }
      try {
        const sent = await this.telegram.sendMessage(String(telegramId), text);
        if (!sent) {
          this.logger.warn(`deleteConfigContent: не удалось отправить уведомление пользователю ${telegramId}`);
        }
      } catch (err) {
        this.logger.warn(`deleteConfigContent: ошибка отправки уведомления: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      this.logger.warn(`deleteConfigContent: у пользователя ${sub.userId} не найден telegramId`);
    }
    const userId = sub.userId;
    await this.prisma.subscription.delete({
      where: { id: subscriptionId },
    });

    const now = new Date();
    const latestActive = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active', expiresAt: { gte: now } },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: latestActive?.expiresAt ?? null },
    });
  }

  async migrateNodeToNode(
    sourceNodeId: string,
    targetNodeId: string,
    options?: { delayBetweenMs?: number; skipRemoveFromSource?: boolean },
  ): Promise<{ migrated: number; failed: { subscriptionId: string; error: string }[] }> {
    const failed: { subscriptionId: string; error: string }[] = [];
    let migrated = 0;
    const now = new Date();

    if (sourceNodeId === targetNodeId) {
      throw new BadRequestException('Исходная и целевая нода не могут совпадать');
    }

    const [sourceNode, targetNode] = await Promise.all([
      this.prisma.node.findUnique({ where: { id: sourceNodeId } }),
      this.prisma.node.findUnique({ where: { id: targetNodeId } }),
    ]);
    if (!sourceNode) throw new BadRequestException('Исходная нода не найдена');
    if (!targetNode) throw new BadRequestException('Целевая нода не найдена');
    if (!targetNode.sshUser || !targetNode.sshPrivateKey) {
      throw new BadRequestException('У целевой ноды должны быть указаны пользователь и ключ SSH');
    }

    const subs = await this.prisma.subscription.findMany({
      where: {
        nodeId: sourceNodeId,
        status: 'active',
        expiresAt: { gte: now },
        devices: { some: {} },
      },
      include: { user: { select: { telegramId: true } }, node: { select: { name: true, country: true } }, devices: true },
    });

    const totalDevices = subs.reduce((acc, s) => acc + s.devices.length, 0);
    const targetDeviceCount = await this.prisma.subscriptionDevice.count({
      where: { subscription: { nodeId: targetNodeId, status: 'active', expiresAt: { gte: now } } },
    });
    const maxUsers = targetNode.maxUsers ?? 2;
    if (targetDeviceCount + totalDevices > maxUsers) {
      throw new BadRequestException(
        `Недостаточно слотов на целевой ноде (свободно: ${maxUsers - targetDeviceCount}, мигрировать устройств: ${totalDevices})`,
      );
    }

    const skipRemove = options?.skipRemoveFromSource ?? false;
    const targetCountryLabel = getCountryName(targetNode.country) || targetNode.country;

    const allIps: string[] = [];
    if (!skipRemove) {
      for (const sub of subs) {
        const ips = sub.devices
          .map((d) => parseAddressIpFromConfig(d.configContent))
          .filter((ip): ip is string => !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
        if (ips.length !== sub.devices.length) {
          failed.push({ subscriptionId: sub.id, error: 'Не удалось извлечь IP из конфигов' });
        } else {
          allIps.push(...ips);
        }
      }
    }
    if (failed.length > 0) {
      return { migrated: 0, failed };
    }

    const createResult = await this.nodes.createUsers(targetNodeId, totalDevices);
    if (!createResult.ok || !createResult.clients?.length || createResult.clients.length !== totalDevices) {
      return { migrated: 0, failed: subs.map((s) => ({ subscriptionId: s.id, error: createResult.error ?? 'Ошибка создания на новом VPS' })) };
    }

    let clientIndex = 0;
    for (const sub of subs) {
      for (let i = 0; i < sub.devices.length; i++) {
        const c = createResult.clients![clientIndex++];
        await this.prisma.subscriptionDevice.create({
          data: { subscriptionId: sub.id, configContent: c.config },
        });
      }
    }

    if (!skipRemove && allIps.length > 0) {
      const removeResult = await this.nodes.removeUsersByIp(sourceNodeId, allIps);
      if (!removeResult.ok) {
        this.logger.warn(`migrateNodeToNode: не удалось удалить на старом VPS: ${removeResult.error}`);
      }
    }

    for (const sub of subs) {
      const oldDeviceIds = sub.devices.map((d) => d.id);
      await this.prisma.subscriptionDevice.deleteMany({ where: { id: { in: oldDeviceIds } } });
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { nodeId: targetNodeId } });
      migrated += sub.devices.length;

      const telegramId = sub.user?.telegramId ?? (await this.prisma.user.findUnique({
        where: { id: sub.userId },
        select: { telegramId: true },
      }))?.telegramId;
      if (telegramId) {
        const text =
          `🔄 <b>Обновление сервера VPN</b>\n\n` +
          `Ваш VPN переехал на новый сервер (${targetCountryLabel}). Старый конфиг больше не действует.\n\n` +
          `Получите новый конфиг в разделе «Мои конфиги». Подписка и срок действия не изменились.`;
        try {
          await this.telegram.sendMessage(String(telegramId), text);
        } catch (err) {
          this.logger.warn(`Миграция подписки ${sub.id}: ошибка отправки уведомления: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    return { migrated, failed };
  }

  /** Миграция одной подписки на другую ноду (все устройства). */
  async migrateSubscription(subscriptionId: string, targetNodeId: string): Promise<{ ok: boolean }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { telegramId: true } }, node: { select: { id: true, name: true, country: true } }, devices: true },
    });
    if (!sub) throw new BadRequestException('Подписка не найдена');
    if (sub.status !== 'active') throw new BadRequestException('Подписка не активна');
    if (sub.devices.length === 0) throw new BadRequestException('У подписки нет устройств');
    if (!sub.nodeId) throw new BadRequestException('Подписка не привязана к ноде');

    const sourceNodeId = sub.nodeId;
    if (sourceNodeId === targetNodeId) {
      throw new BadRequestException('Целевая нода совпадает с текущей');
    }

    const [sourceNode, targetNode] = await Promise.all([
      this.prisma.node.findUnique({ where: { id: sourceNodeId } }),
      this.prisma.node.findUnique({ where: { id: targetNodeId } }),
    ]);
    if (!sourceNode) throw new BadRequestException('Исходная нода не найдена');
    if (!targetNode) throw new BadRequestException('Целевая нода не найдена');
    if (!targetNode.sshUser || !targetNode.sshPrivateKey) {
      throw new BadRequestException('У целевой ноды должны быть указаны пользователь и ключ SSH');
    }

    const now = new Date();
    const targetDeviceCount = await this.prisma.subscriptionDevice.count({
      where: { subscription: { nodeId: targetNodeId, status: 'active', expiresAt: { gte: now } } },
    });
    const maxUsers = targetNode.maxUsers ?? 2;
    if (targetDeviceCount + sub.devices.length > maxUsers) {
      throw new BadRequestException(`Нет свободных слотов на целевой ноде (нужно ${sub.devices.length}, свободно ${maxUsers - targetDeviceCount})`);
    }

    const ips = sub.devices
      .map((d) => parseAddressIpFromConfig(d.configContent))
      .filter((ip): ip is string => !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
    if (ips.length !== sub.devices.length) {
      throw new BadRequestException('Не удалось извлечь IP из конфигов устройств');
    }

    const createResult = await this.nodes.createUsers(targetNodeId, sub.devices.length);
    if (!createResult.ok || !createResult.clients?.length) {
      throw new BadRequestException(createResult.error ?? 'Ошибка создания на новом VPS');
    }

    for (const c of createResult.clients) {
      await this.prisma.subscriptionDevice.create({
        data: { subscriptionId, configContent: c.config },
      });
    }

    const removeResult = await this.nodes.removeUsersByIp(sourceNodeId, ips);
    if (!removeResult.ok) {
      this.logger.warn(`migrateSubscription: не удалось удалить на старом VPS: ${removeResult.error}`);
    }

    const oldDeviceIds = sub.devices.map((d) => d.id);
    await this.prisma.subscriptionDevice.deleteMany({
      where: { id: { in: oldDeviceIds } },
    });
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { nodeId: targetNodeId },
    });

    const targetCountryLabel = getCountryName(targetNode.country) || targetNode.country;
    const telegramId = sub.user?.telegramId;
    if (telegramId) {
      const text =
        `🔄 <b>Обновление сервера VPN</b>\n\n` +
        `Ваш VPN переехал на новый сервер (${targetCountryLabel}). Старый конфиг больше не действует.\n\n` +
        `Получите новый конфиг в разделе «Мои конфиги». Подписка и срок действия не изменились.`;
      try {
        await this.telegram.sendMessage(String(telegramId), text);
      } catch (err) {
        this.logger.warn(`migrateSubscription: ошибка отправки уведомления: ${err instanceof Error ? err.message : err}`);
      }
    }

    return { ok: true };
  }

  async getHistoryByUserId(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { node: true },
    });
  }

  async getExpiredSubscriptions(skip: number = 0, take: number = 50) {
    const [list, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { status: 'expired' },
        orderBy: { expiresAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, telegramId: true, username: true } },
          node: { select: { name: true, country: true } },
        },
      }),
      this.prisma.subscription.count({ where: { status: 'expired' } }),
    ]);
    return { list, total };
  }

  async getExpiringInDays(days: number) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);
    return this.prisma.subscription.findMany({
      where: {
        status: 'active',
        expiresAt: { gte: from, lte: to },
      },
      include: { user: true, node: true },
    });
  }

  async getActiveCount(): Promise<number> {
    return this.prisma.subscription.count({
      where: { status: 'active', expiresAt: { gte: new Date() } },
    });
  }
}
