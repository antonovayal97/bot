import { Controller, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/wipe')
@UseGuards(JwtAuthGuard)
export class WipeController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async wipe() {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany();
      await tx.subscription.deleteMany();
      await tx.user.updateMany({ data: { referredBy: null, assignedNodeId: null } });
      await tx.user.deleteMany();
      await tx.node.deleteMany();
      await tx.appSettings.deleteMany();
    });
    return { ok: true };
  }
}
