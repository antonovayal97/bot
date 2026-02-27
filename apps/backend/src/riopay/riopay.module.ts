import { Module } from '@nestjs/common';
import { RioPayService } from './riopay.service';
import { RioPayController } from './riopay.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [RioPayController],
  providers: [RioPayService],
  exports: [RioPayService],
})
export class RioPayModule {}
