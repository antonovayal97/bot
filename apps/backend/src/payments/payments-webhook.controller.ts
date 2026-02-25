import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

const logger = new Logger('PaymentsWebhook');

/**
 * Webhook для приёма уведомлений от платёжной системы (YooKassa, Stripe и т.д.).
 * В production: проверять подпись/секрет, идемпотентность, статус оплаты.
 *
 * Пример payload YooKassa:
 * { event: 'payment.succeeded', object: { id: '...', status: 'succeeded', amount: { value: '299' }, metadata: { userId: '...', plan: '1m' } } }
 */
@Controller('payments/webhook')
export class PaymentsWebhookController {
  constructor(
    private payments: PaymentsService,
    private subscriptions: SubscriptionsService,
    private users: UsersService,
    private settings: SettingsService,
  ) {}

  @Post()
  async handleWebhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
    logger.log('Webhook received: ' + JSON.stringify(body).slice(0, 200));

    // Заглушка: при необходимости подключите YooKassa и раскомментируйте логику ниже
    // const event = body.event;
    // const obj = body.object as { id?: string; status?: string; amount?: { value: string }; metadata?: { userId?: string; plan?: SubscriptionPlan } };
    // if (event === 'payment.succeeded' && obj?.status === 'succeeded' && obj.metadata?.userId && obj.metadata?.plan) {
    //   const userId = obj.metadata.userId;
    //   const plan = obj.metadata.plan as SubscriptionPlan;
    //   const amount = parseFloat(obj.amount?.value ?? '0');
    //   const payment = await this.payments.create(userId, amount, 'completed');
    //   const prices = await this.settings.getPlanPrices();
    //   await this.subscriptions.create(userId, plan, prices[plan]);
    // }

    return { received: true };
  }
}
