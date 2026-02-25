import { Module } from '@nestjs/common';
import { SubscriptionCronService } from './subscription-cron.service';
import { NodesModule } from '../nodes/nodes.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BotTextsModule } from '../bot-texts/bot-texts.module';

@Module({
  imports: [NodesModule, TelegramModule, BotTextsModule],
  providers: [SubscriptionCronService],
})
export class SubscriptionCronModule {}
