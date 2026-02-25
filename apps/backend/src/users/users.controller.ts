import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { TelegramService } from '../telegram/telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private users: UsersService,
    private telegram: TelegramService,
  ) {}

  @Post(':id/send-message')
  async sendMessage(@Param('id') id: string, @Body() body: { text: string }) {
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return { error: 'Введите текст сообщения' };
    const user = await this.users.findById(id);
    if (!user) return { error: 'User not found' };
    const sent = await this.telegram.sendMessage(user.telegramId, text);
    if (!sent) return { error: 'Не удалось отправить сообщение (проверьте TELEGRAM_BOT_TOKEN или что пользователь не заблокировал бота)' };
    return { ok: true };
  }

  @Post(':id/referral-overrides')
  async updateReferralOverrides(@Param('id') id: string, @Body() body: { referralBonusRubOverride?: number | null; referralPercentOverride?: number | null }) {
    const user = await this.users.updateReferralOverrides(id, {
      referralBonusRubOverride: body.referralBonusRubOverride,
      referralPercentOverride: body.referralPercentOverride,
    });
    return { ok: true, referralBonusRubOverride: user.referralBonusRubOverride, referralPercentOverride: user.referralPercentOverride };
  }

  @Post(':id/balance')
  async addBalanceRub(@Param('id') id: string, @Body() body: { amount: number }) {
    const amount = Math.round(Number(body.amount) || 0);
    if (amount < 1) return { error: 'Укажите сумму пополнения от 1 ₽' };
    const user = await this.users.addBalanceRub(id, amount);
    return { ok: true, balanceRub: user.balanceRub };
  }

  @Get()
  async list(
    @Query('activeOnly') activeOnly?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.users.findAll({
      activeOnly: activeOnly === 'true',
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) return { error: 'User not found' };
    return user;
  }
}
