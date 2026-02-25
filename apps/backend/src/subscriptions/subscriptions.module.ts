import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { NodesModule } from '../nodes/nodes.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [NodesModule, TelegramModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
