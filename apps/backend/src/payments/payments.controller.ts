import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get('user/:userId')
  async byUser(@Param('userId') userId: string) {
    return this.payments.getByUserId(userId);
  }

  @Get('revenue')
  async revenue(@Query('month') month?: string, @Query('year') year?: string) {
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return { total: await this.payments.getTotalRevenue(m, y) };
  }

  @Get('revenue-by-month')
  async revenueByMonth(@Query('months') months?: string) {
    return this.payments.getRevenueByMonth(months ? parseInt(months, 10) : 12);
  }
}
