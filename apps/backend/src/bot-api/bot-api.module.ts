import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotApiController } from './bot-api.controller';
import { BotApiService } from './bot-api.service';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NodesModule } from '../nodes/nodes.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { BotTextsModule } from '../bot-texts/bot-texts.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 400 }]),
    UsersModule,
    SubscriptionsModule,
    NodesModule,
    PaymentsModule,
    SettingsModule,
    BotTextsModule,
  ],
  controllers: [BotApiController],
  providers: [BotApiService],
  exports: [BotApiService],
})
export class BotApiModule {}
