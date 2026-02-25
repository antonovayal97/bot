import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  async get() {
    return this.settings.getAll();
  }

  @Put()
  async update(
    @Body()
    body: {
      referralPercent?: number;
      referralBonusRub?: number;
      welcomeBonusRub?: number;
      planPrices?: Partial<Record<SubscriptionPlan, number>>;
      planDevicePrices?: Partial<Record<SubscriptionPlan, Record<number, number>>>;
    },
  ) {
    if (body.referralPercent != null) await this.settings.setReferralPercent(body.referralPercent);
    if (body.referralBonusRub != null) await this.settings.setReferralBonusRub(body.referralBonusRub);
    if (body.welcomeBonusRub != null) await this.settings.setWelcomeBonusRub(body.welcomeBonusRub);
    if (body.planPrices != null) await this.settings.setPlanPrices(body.planPrices);
    if (body.planDevicePrices != null) await this.settings.setPlanDevicePrices(body.planDevicePrices as Record<SubscriptionPlan, Record<number, number>>);
    return this.settings.getAll();
  }
}
