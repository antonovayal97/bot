import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

const MAXELPAY_API = 'https://api.maxelpay.com/api/v1';

interface MaxelPayCreateSessionResponse {
  success?: boolean;
  message?: string;
  data?: {
    sessionId?: string;
    paymentUrl?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    expiresAt?: string;
  };
}

interface MaxelPayWebhookPayload {
  event?: string;
  timestamp?: string;
  data?: {
    sessionId?: string;
    orderId?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paidAmount?: number;
    totalPaidUsd?: number;
    metadata?: Record<string, unknown>;
  };
}

@Injectable()
export class MaxelPayService {
  private readonly logger = new Logger(MaxelPayService.name);

  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private config: ConfigService,
    private telegram: TelegramService,
  ) {}

  private getApiKey(): string | null {
    return this.config.get<string>('MAXELPAY_API_KEY') ?? null;
  }

  /** Секрет для проверки webhook. Если не задан — используется API_KEY (MaxelPay может выдавать один ключ на оба). */
  private getSecretKey(): string | null {
    return this.config.get<string>('MAXELPAY_SECRET_KEY') ?? this.getApiKey();
  }

  isEnabled(): boolean {
    return !!this.getApiKey();
  }

  /** Создать платёжную сессию для пополнения баланса */
  async createOrder(userId: string, amountRub: number, purpose?: string): Promise<{ paymentLink: string; orderId: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new BadRequestException('Платёжная система не настроена');

    if (amountRub < 50 || amountRub > 5000) {
      throw new BadRequestException('Сумма от 50 до 5000 ₽');
    }

    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Пользователь не найден');

    const orderId = `vpntopup_${userId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await this.prisma.maxelPayOrder.create({
      data: {
        userId,
        orderId,
        amount: new Decimal(amountRub),
        status: 'pending',
      },
    });

    const successUrl = this.config.get<string>('MAXELPAY_SUCCESS_URL') || '';
    let callbackUrl = this.config.get<string>('MAXELPAY_CALLBACK_URL') || '';
    if (!callbackUrl) {
      const base = this.config.get<string>('BACKEND_PUBLIC_URL') || this.config.get<string>('APP_URL') || '';
      callbackUrl = base ? `${base.replace(/\/$/, '')}/payments/maxelpay/webhook` : '';
    }

    const body = {
      orderId,
      amount: amountRub,
      currency: 'RUB',
      description: purpose || 'Пополнение баланса VPN',
      metadata: { userId, telegramId: user.telegramId },
      successUrl: successUrl || undefined,
      cancelUrl: successUrl || undefined,
      callbackUrl: callbackUrl || undefined,
      expirationMinutes: 30,
    };

    const res = await fetch(`${MAXELPAY_API}/payments/sessions`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as MaxelPayCreateSessionResponse;

    if (!res.ok || !data.success || !data.data?.paymentUrl) {
      await this.prisma.maxelPayOrder.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      this.logger.warn(`MaxelPay create session failed: ${res.status} ${JSON.stringify(data)}`);
      throw new BadRequestException(data.message || 'Не удалось создать платёж');
    }

    await this.prisma.maxelPayOrder.update({
      where: { id: order.id },
      data: { sessionId: data.data.sessionId ?? undefined },
    });

    return { paymentLink: data.data.paymentUrl, orderId: order.id };
  }

  /** Проверить подпись webhook (HMAC SHA256 hex) */
  verifySignature(rawBody: string, signature: string | undefined): boolean {
    const secret = this.getSecretKey();
    if (!secret || !signature) return false;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /** Обработать webhook от MaxelPay */
  async handleWebhook(payload: MaxelPayWebhookPayload): Promise<void> {
    const event = payload.event;
    const data = payload.data;
    const orderId = data?.orderId;

    if (!orderId) {
      this.logger.warn('MaxelPay webhook: missing orderId');
      return;
    }

    const order = await this.prisma.maxelPayOrder.findUnique({
      where: { orderId },
      include: { user: true },
    });

    if (!order) {
      this.logger.warn(`MaxelPay webhook: order not found orderId=${orderId}`);
      return;
    }

    if (order.status === 'completed') {
      this.logger.log(`MaxelPay webhook: order ${orderId} already completed, skip`);
      return;
    }

    if (event === 'payment.completed' || event === 'payment.overpaid') {
      const amountRub = Math.round(data?.paidAmount ?? data?.amount ?? Number(order.amount) ?? 0);
      if (amountRub <= 0) {
        this.logger.warn(`MaxelPay webhook: invalid amount for order ${orderId}`);
        return;
      }

      await this.users.addBalanceRub(order.userId, amountRub, 'maxelpay');
      await this.prisma.payment.create({
        data: {
          userId: order.userId,
          amount: new Decimal(amountRub),
          status: 'completed',
        },
      });
      await this.prisma.maxelPayOrder.update({
        where: { id: order.id },
        data: { status: 'completed', completedAt: new Date(), sessionId: data?.sessionId ?? order.sessionId },
      });

      const telegramId = order.user?.telegramId;
      if (telegramId) {
        const text = `✅ <b>Баланс пополнен</b>\n\nНа ваш баланс зачислено ${amountRub} ₽.`;
        try {
          await this.telegram.sendMessage(String(telegramId), text);
        } catch (err) {
          this.logger.warn(`MaxelPay webhook: failed to notify user ${telegramId}: ${err instanceof Error ? err.message : err}`);
        }
      }

      this.logger.log(`MaxelPay webhook: order ${orderId} completed, +${amountRub} RUB for user ${order.userId}`);
      return;
    }

    if (event === 'payment.expired' || event === 'payment.partial') {
      await this.prisma.maxelPayOrder.update({
        where: { id: order.id },
        data: { status: event === 'payment.expired' ? 'expired' : 'failed' },
      });
      this.logger.log(`MaxelPay webhook: order ${orderId} status=${event}`);
    }
  }
}
