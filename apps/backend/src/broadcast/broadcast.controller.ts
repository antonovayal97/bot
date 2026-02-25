import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BroadcastService, BroadcastFilter } from './broadcast.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const VALID_FILTERS: BroadcastFilter[] = ['with_subscriptions', 'all', 'without_subscriptions'];

function parseFilter(v: string): BroadcastFilter {
  return VALID_FILTERS.includes(v as BroadcastFilter) ? (v as BroadcastFilter) : 'all';
}

@Controller('admin/broadcast')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private broadcast: BroadcastService) {}

  @Get('count')
  async getCount(@Query('filter') filter: string) {
    const f = parseFilter(filter ?? 'all');
    const count = await this.broadcast.getCountByFilter(f);
    return { count, filter: f };
  }

  @Post('test')
  async sendTest(@Body() body: { text: string; telegramId: string }) {
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const telegramId = typeof body?.telegramId === 'string' ? body.telegramId.trim() : '';
    if (!text) return { error: 'Введите текст сообщения' };
    if (!telegramId) return { error: 'Введите Telegram ID тестового пользователя' };
    const ok = await this.broadcast.sendTest(telegramId, text);
    if (!ok) return { error: 'Не удалось отправить (проверьте TELEGRAM_BOT_TOKEN или что пользователь не заблокировал бота)' };
    return { ok: true };
  }

  @Post()
  async send(@Body() body: { text: string; filter?: string }) {
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return { error: 'Введите текст сообщения' };
    const filter = parseFilter(body?.filter ?? 'all');
    return this.broadcast.send(text, filter);
  }
}
