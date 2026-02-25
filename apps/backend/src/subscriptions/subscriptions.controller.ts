import { BadRequestException, Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private subscriptions: SubscriptionsService,
    private telegram: TelegramService,
  ) {}

  @Post(':id/extend')
  async extend(
    @Param('id') id: string,
    @Body() body: { days: number; adminMessage?: string },
  ) {
    const days = Number(body.days) || 0;
    const adminMessage = typeof body.adminMessage === 'string' ? body.adminMessage.trim() : '';
    const { subscription, telegramId } = await this.subscriptions.addDays(id, days);
    const dateStr = new Date(subscription.expiresAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let text = `Подписка продлена на ${days} дн. Новая дата окончания: <b>${dateStr}</b>.`;
    if (adminMessage) {
      text += `\n\nСообщение от администратора:\n${escapeHtml(adminMessage)}`;
    }
    if (telegramId) {
      await this.telegram.sendMessage(telegramId, text);
    }
    return { ok: true, expiresAt: subscription.expiresAt };
  }

  @Post(':id/set-expires-in-24h')
  async setExpiresIn24h(@Param('id') id: string) {
    const result = await this.subscriptions.setExpiresIn24Hours(id);
    return { ok: true, expiresAt: result.expiresAt };
  }

  @Post(':id/set-expires-in-5min')
  async setExpiresIn5Min(@Param('id') id: string) {
    const result = await this.subscriptions.setExpiresIn5Minutes(id);
    return { ok: true, expiresAt: result.expiresAt };
  }

  @Post(':id/migrate')
  async migrateSubscription(
    @Param('id') id: string,
    @Body() body: { targetNodeId: string },
  ) {
    const targetNodeId = typeof body?.targetNodeId === 'string' ? body.targetNodeId.trim() : '';
    if (!targetNodeId) throw new BadRequestException('targetNodeId required');
    return this.subscriptions.migrateSubscription(id, targetNodeId);
  }

  @Post(':id/delete-config')
  async deleteConfig(@Param('id') id: string, @Body() body: { adminMessage?: string }) {
    const adminMessage = typeof body?.adminMessage === 'string' ? body.adminMessage.trim() : '';
    await this.subscriptions.deleteConfigContent(id, adminMessage);
    return { ok: true };
  }

  @Get('user/:userId')
  async byUser(@Param('userId') userId: string) {
    return this.subscriptions.getHistoryByUserId(userId);
  }

  @Get('expired')
  async expired(@Query('skip') skip?: string, @Query('take') take?: string) {
    const s = skip ? parseInt(skip, 10) : 0;
    const t = take ? parseInt(take, 10) : 50;
    return this.subscriptions.getExpiredSubscriptions(s, t);
  }

  @Get('expiring')
  async expiring() {
    return this.subscriptions.getExpiringInDays(3);
  }

  @Get('active-count')
  async activeCount() {
    return { count: await this.subscriptions.getActiveCount() };
  }

  @Post('migrate-node')
  async migrateNode(
    @Body() body: { sourceNodeId: string; targetNodeId: string; delayBetweenMs?: number; skipRemoveFromSource?: boolean },
  ) {
    return this.subscriptions.migrateNodeToNode(
      body.sourceNodeId,
      body.targetNodeId,
      { delayBetweenMs: body.delayBetweenMs ?? 3000, skipRemoveFromSource: body.skipRemoveFromSource ?? false },
    );
  }
}
