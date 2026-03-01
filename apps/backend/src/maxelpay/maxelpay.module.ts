import { Module } from '@nestjs/common';
import { MaxelPayService } from './maxelpay.service';
import { MaxelPayController } from './maxelpay.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [MaxelPayController],
  providers: [MaxelPayService],
  exports: [MaxelPayService],
})
export class MaxelPayModule {}
