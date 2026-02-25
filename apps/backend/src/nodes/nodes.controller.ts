import { Controller, Delete, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/nodes')
@UseGuards(JwtAuthGuard)
export class NodesController {
  constructor(private nodes: NodesService) {}

  @Get()
  async list() {
    return this.nodes.findAll();
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      country: string;
      ip: string;
      maxUsers?: number;
      sshPort?: number;
      sshUser?: string;
      sshPrivateKey?: string;
    },
  ) {
    return this.nodes.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      country?: string;
      ip?: string;
      isActive?: boolean;
      loadPercent?: number;
      maxUsers?: number;
      sshPort?: number;
      sshUser?: string | null;
      sshPrivateKey?: string | null;
    },
  ) {
    return this.nodes.update(id, body);
  }

  @Put(':id/active')
  async setActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.nodes.setActive(id, body.isActive);
  }

  @Get(':id/ssh-test')
  async sshTest(@Param('id') id: string) {
    return this.nodes.testSsh(id);
  }

  @Post(':id/reboot')
  async reboot(@Param('id') id: string) {
    return this.nodes.reboot(id);
  }

  @Post(':id/test-user')
  async createTestUser(@Param('id') id: string) {
    return this.nodes.createTestUser(id);
  }

  @Post(':id/remove-user')
  async removeUserByIp(@Param('id') id: string, @Body() body: { ip: string }) {
    return this.nodes.removeUserByIp(id, body.ip ?? '');
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.nodes.delete(id);
  }
}
