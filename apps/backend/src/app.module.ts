import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NodesModule } from './nodes/nodes.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { BotApiModule } from './bot-api/bot-api.module';
import { SubscriptionCronModule } from './subscription-cron/subscription-cron.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WipeModule } from './wipe/wipe.module';
import { TelegramModule } from './telegram/telegram.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { BotTextsModule } from './bot-texts/bot-texts.module';
import { RioPayModule } from './riopay/riopay.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegramModule,
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            }),
          ),
        }),
        ...(process.env.NODE_ENV === 'production'
          ? [
              new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
              new winston.transports.File({ filename: 'logs/combined.log' }),
            ]
          : []),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    UsersModule,
    SubscriptionsModule,
    NodesModule,
    PaymentsModule,
    SettingsModule,
    AuthModule,
    BotApiModule,
    SubscriptionCronModule,
    DashboardModule,
    WipeModule,
    BroadcastModule,
    BotTextsModule,
    RioPayModule,
  ],
})
export class AppModule {}
