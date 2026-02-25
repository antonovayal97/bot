import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { BotTextsService } from './bot-texts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
@Controller('admin/bot-texts')
@UseGuards(JwtAuthGuard)
export class BotTextsAdminController {
  constructor(private botTexts: BotTextsService) {}

  @Get()
  async getAll() {
    return this.botTexts.getAll();
  }

  @Put()
  async update(@Body() body: Record<string, string>) {
    return this.botTexts.update(body);
  }
}
