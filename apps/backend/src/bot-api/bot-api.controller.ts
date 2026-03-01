import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BotApiService } from './bot-api.service';
import { BotTextsService } from '../bot-texts/bot-texts.service';
import { BotApiKeyGuard } from './guards/bot-api-key.guard';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

@Controller('bot')
@UseGuards(ThrottlerGuard)
export class BotApiController {
  constructor(
    private botApi: BotApiService,
    private botTexts: BotTextsService,
  ) {}

  @Post('webhook/register')
  @UseGuards(BotApiKeyGuard)
  async register(@Body() body: { telegramId: string; username?: string }) {
    const result = await this.botApi.registerUser(body.telegramId, body.username);
    return { id: result.id, referralCode: result.referralCode, welcomeBonusRub: result.welcomeBonusRub };
  }

  @Get('user/:telegramId')
  @UseGuards(BotApiKeyGuard)
  async getUser(@Param('telegramId') telegramId: string) {
    const user = await this.botApi.getUserByTelegram(telegramId);
    if (!user) return { error: 'User not found' };
    return user;
  }

  @Get('plans')
  @UseGuards(BotApiKeyGuard)
  async getPlans(@Query('devices') devices?: string) {
    const deviceCount = devices ? parseInt(devices, 10) : undefined;
    return this.botApi.getPlansWithPrices(Number.isFinite(deviceCount) ? deviceCount! : undefined);
  }

  @Post('referral')
  @UseGuards(BotApiKeyGuard)
  async applyReferral(@Body() body: { telegramId: string; referralCode: string }) {
    return this.botApi.applyReferral(body.telegramId, body.referralCode);
  }

  @Get('config/:telegramId')
  @UseGuards(BotApiKeyGuard)
  async getConfig(@Param('telegramId') telegramId: string, @Query('nodeId') nodeId?: string, @Query('deviceId') deviceId?: string) {
    return this.botApi.getConfigForUser(telegramId, nodeId, deviceId);
  }

  @Get('nodes')
  @UseGuards(BotApiKeyGuard)
  async getNodes() {
    // backward-compat: раньше возвращались ноды, теперь — страны с доступными слотами
    return this.botApi.getAvailableCountriesForBot();
  }

  @Get('countries')
  @UseGuards(BotApiKeyGuard)
  async getCountries() {
    return this.botApi.getAvailableCountriesForBot();
  }

  @Post('subscribe')
  @UseGuards(BotApiKeyGuard)
  async subscribe(@Body() body: { telegramId: string; plan: SubscriptionPlan; country: string; deviceCount?: number }) {
    return this.botApi.createSubscription(body.telegramId, body.plan, body.country, body.deviceCount);
  }

  @Post('extend')
  @UseGuards(BotApiKeyGuard)
  async extend(@Body() body: { telegramId: string; subscriptionId: string; plan: SubscriptionPlan }) {
    return this.botApi.extendSubscription(body.telegramId, body.subscriptionId, body.plan);
  }

  @Get('texts')
  @UseGuards(BotApiKeyGuard)
  async getTexts() {
    return this.botTexts.getAll();
  }

  @Get('expiring-soon')
  @UseGuards(BotApiKeyGuard)
  async expiringSoon(@Query('days') days?: string) {
    const telegramIds = await this.botApi.getExpiringSoonTelegramIds(days ? parseInt(days, 10) : 3);
    return { telegramIds };
  }

  @Get('referral-stats/:telegramId')
  @UseGuards(BotApiKeyGuard)
  async referralStats(@Param('telegramId') telegramId: string) {
    const stats = await this.botApi.getReferralStats(telegramId);
    if (!stats) return { error: 'User not found' };
    return stats;
  }

  @Post('topup')
  @UseGuards(BotApiKeyGuard)
  async createTopupOrder(@Body() body: { telegramId: string; amount: number; gateway?: 'riopay' | 'maxelpay' }) {
    return this.botApi.createTopupOrder(body.telegramId, body.amount, body.gateway);
  }

  @Get('topup/enabled')
  @UseGuards(BotApiKeyGuard)
  async topupEnabled() {
    const gateways = this.botApi.getTopupGateways();
    return { enabled: gateways.length > 0, gateways };
  }
}
