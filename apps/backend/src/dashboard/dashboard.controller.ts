import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('stats')
  async stats() {
    return this.dashboard.getStats();
  }

  @Get('registrations')
  async registrations(@Query('days') days?: string) {
    return this.dashboard.getRegistrationsByDay(days ? parseInt(days, 10) : 30);
  }
}
