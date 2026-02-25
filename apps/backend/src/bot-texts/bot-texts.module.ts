import { Module } from '@nestjs/common';
import { BotTextsService } from './bot-texts.service';
import { BotTextsAdminController } from './bot-texts.controller';

@Module({
  controllers: [BotTextsAdminController],
  providers: [BotTextsService],
  exports: [BotTextsService],
})
export class BotTextsModule {}
