import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WipeController } from './wipe.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WipeController],
})
export class WipeModule {}
