import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { Decimal } from '@prisma/client/runtime/library';

const RIOPAY_API = 'https://api.riopay.online/v1';
const RIOPAY_WEBHOOK_IP = '82.146.51.110';

interface RioPayCreateOrderResponse {
  id?: string;
  paymentLink?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  message?: string;
}

interface RioPayWebhookPayload {
  id?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  externalUserId?: string;
  payedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable()
export class RioPayService {
  private readonly logger = new Logger(RioPayService.name);

  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private config: ConfigService,
    private telegram: TelegramService,
  ) {}

  private getApiToken(): string | null {
    return this.config.get<string>('RIOPAY_API_TOKEN') ?? null;
  }

  isEnabled(): boolean {
    return !!this.getApiToken();
  }

  /** Создать заказ на пополнение баланса. externalId = наш RioPayOrder.id */
  async createOrder(userId: string, amountRub: number, purpose?: string): Promise<{ paymentLink: string; orderId: string }> {
    const token = this.getApiToken();
    if (!token) throw new BadRequestException('Платёжная система не настроена');

    if (amountRub < 50 || amountRub > 100000) {
      throw new BadRequestException('Сумма от 50 до 100 000 ₽');
    }

    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Пользователь не найден');

    const crypto = require('crypto');
    const externalId = `vpntopup_${userId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const order = await this.prisma.rioPayOrder.create({
      data: {
        userId,
        externalId,
        amount: new Decimal(amountRub),
        status: 'pending',
      },
    });

    const successUrl = this.config.get<string>('RIOPAY_SUCCESS_URL') || '';
    const body = {
      amount: String(amountRub),
      externalId,
      externalUserId: user.telegramId,
      isFeeOnUser: false,
      purpose: purpose || `Пополнение баланса VPN`,
      successUrl: successUrl || undefined,
    };

    const res = await fetch(`${RIOPAY_API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': token,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as RioPayCreateOrderResponse;

    if (!res.ok || !data.paymentLink) {
      await this.prisma.rioPayOrder.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      this.logger.warn(`RioPay create order failed: ${res.status} ${JSON.stringify(data)}`);
      throw new BadRequestException(data.message || 'Не удалось создать платёж');
    }

    await this.prisma.rioPayOrder.update({
      where: { id: order.id },
      data: { riopayOrderId: data.id ?? undefined },
    });

    return { paymentLink: data.paymentLink, orderId: order.id };
  }

  /** Проверить IP отправителя webhook (поддержка IPv4-mapped: ::ffff:82.146.51.110) */
  verifyWebhookIp(ip: string): boolean {
    if (this.config.get<string>('RIOPAY_SKIP_IP_VERIFY') === '1') return true;
    const normalized = ip.replace(/^::ffff:/i, '');
    return normalized === RIOPAY_WEBHOOK_IP || ip === RIOPAY_WEBHOOK_IP;
  }

  /** Проверить подпись X-Signature (HMAC SHA512 hex) */
  verifySignature(body: string, signature: string | undefined): boolean {
    const token = this.getApiToken();
    if (!token || !signature) return false;

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha512', token);
    hmac.update(body);
    const expected = hmac.digest('hex');
    return expected === signature;
  }

  /** Обработать webhook от RioPay */
  async handleWebhook(payload: RioPayWebhookPayload): Promise<void> {
    const externalId = payload.externalId;
    if (!externalId) {
      this.logger.warn('RioPay webhook: missing externalId');
      return;
    }

    const order = await this.prisma.rioPayOrder.findUnique({
      where: { externalId },
      include: { user: true },
    });

    if (!order) {
      this.logger.warn(`RioPay webhook: order not found externalId=${externalId}`);
      return;
    }

    if (order.status === 'completed') {
      this.logger.log(`RioPay webhook: order ${externalId} already completed, skip`);
      return;
    }

    if (payload.status !== 'COMPLETED') {
      const failedStatus = payload.status || 'unknown';
      await this.prisma.rioPayOrder.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      this.logger.log(`RioPay webhook: order ${externalId} status=${failedStatus}, marked failed`);
      return;
    }

    const amountRub = Math.round(payload.amount ?? Number(order.amount) ?? 0);
    if (amountRub <= 0) {
      this.logger.warn(`RioPay webhook: invalid amount for order ${externalId}`);
      return;
    }

    await this.users.addBalanceRub(order.userId, amountRub, 'riopay');
    await this.prisma.payment.create({
      data: {
        userId: order.userId,
        amount: new Decimal(amountRub),
        status: 'completed',
      },
    });
    await this.prisma.rioPayOrder.update({
      where: { id: order.id },
      data: { status: 'completed', completedAt: new Date(), riopayOrderId: payload.id ?? order.riopayOrderId },
    });

    const telegramId = order.user?.telegramId;
    if (telegramId) {
      const text = `✅ <b>Баланс пополнен</b>\n\nНа ваш баланс зачислено ${amountRub} ₽.`;
      try {
        await this.telegram.sendMessage(String(telegramId), text);
      } catch (err) {
        this.logger.warn(`RioPay webhook: failed to notify user ${telegramId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.logger.log(`RioPay webhook: order ${externalId} completed, +${amountRub} RUB for user ${order.userId}`);
  }
}
