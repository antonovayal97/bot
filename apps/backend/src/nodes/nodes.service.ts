import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from 'ssh2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const now = new Date();
    const [nodes, devicesWithNode] = await Promise.all([
      this.prisma.node.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.subscriptionDevice.findMany({
        where: { subscription: { status: 'active', expiresAt: { gte: now } } },
        select: { subscription: { select: { nodeId: true } } },
      }),
    ]);
    const deviceCountByNode = new Map<string, number>();
    for (const d of devicesWithNode) {
      const nid = d.subscription.nodeId;
      deviceCountByNode.set(nid, (deviceCountByNode.get(nid) ?? 0) + 1);
    }
    return nodes.map((n) => ({
      ...n,
      _count: { activeSubscriptions: deviceCountByNode.get(n.id) ?? 0 },
    }));
  }

  async findActive() {
    const now = new Date();
    const [nodes, devicesWithNode] = await Promise.all([
      this.prisma.node.findMany({ where: { isActive: true } }),
      this.prisma.subscriptionDevice.findMany({
        where: { subscription: { status: 'active', expiresAt: { gte: now } } },
        select: { subscription: { select: { nodeId: true } } },
      }),
    ]);
    const deviceCountByNode = new Map<string, number>();
    for (const d of devicesWithNode) {
      const nid = d.subscription.nodeId;
      deviceCountByNode.set(nid, (deviceCountByNode.get(nid) ?? 0) + 1);
    }
    return nodes
      .map((n) => ({ ...n, activeSubs: deviceCountByNode.get(n.id) ?? 0 }))
      .filter((n) => n.activeSubs < (n.maxUsers ?? 2))
      .sort((a, b) => a.activeSubs - b.activeSubs);
  }

  async findById(id: string) {
    return this.prisma.node.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    country: string;
    ip: string;
    maxUsers?: number;
    sshPort?: number;
    sshUser?: string;
    sshPrivateKey?: string;
  }) {
    return this.prisma.node.create({
      data: {
        name: data.name,
        country: data.country,
        ip: data.ip,
        isActive: true,
        loadPercent: 0,
        maxUsers: data.maxUsers ?? 2,
        sshPort: data.sshPort ?? 22,
        sshUser: data.sshUser ?? null,
        sshPrivateKey: data.sshPrivateKey ?? null,
      },
    });
  }

  async update(
    id: string,
    data: {
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
    return this.prisma.node.update({
      where: { id },
      data,
    });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.node.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Удалить VPS-ноду. Возможно только если на ноде нет активных подписок (пользователей).
   */
  async delete(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) throw new BadRequestException('Нода не найдена');

    const now = new Date();
    const activeCount = await this.prisma.subscription.count({
      where: { nodeId: id, status: 'active', expiresAt: { gte: now } },
    });
    if (activeCount > 0) {
      throw new BadRequestException(
        `Невозможно удалить: на ноде ${activeCount} активных подписок. Сначала мигрируйте пользователей или дождитесь истечения подписок.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { assignedNodeId: id }, data: { assignedNodeId: null } }),
      this.prisma.node.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  async setLoad(id: string, loadPercent: number) {
    return this.prisma.node.update({
      where: { id },
      data: { loadPercent },
    });
  }

  async testSsh(nodeId: string): Promise<{ ok: boolean; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ ok: false, error: 'Таймаут подключения (10 с)' });
      }, 10000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          conn.end();
          resolve({ ok: true });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({ ok: false, error: err.message || 'Ошибка SSH' });
        })
        .connect({
          host: node.ip,
          port: node.sshPort ?? 22,
          username: node.sshUser!,
          privateKey: node.sshPrivateKey!,
          readyTimeout: 8000,
        });
    });
  }

  async reboot(nodeId: string): Promise<{ ok: boolean; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ ok: false, error: 'Таймаут подключения (10 с)' });
      }, 10000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          conn.exec('sudo reboot', (err: Error | undefined, stream) => {
            if (err) {
              conn.end();
              return resolve({ ok: false, error: err.message || 'Не удалось выполнить команду' });
            }
            resolve({ ok: true });
            conn.end();
          });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({ ok: false, error: err.message || 'Ошибка SSH' });
        })
        .connect({
          host: node.ip,
          port: node.sshPort ?? 22,
          username: node.sshUser!,
          privateKey: node.sshPrivateKey!,
          readyTimeout: 8000,
        });
    });
  }

  async createTestUser(
    nodeId: string,
  ): Promise<{ ok: boolean; config?: string; filename?: string; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ ok: false, error: 'Таймаут (120 с)' });
      }, 120000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);

          conn.exec('/root/add_user.sh', (err: Error | undefined, stream) => {
            if (err) {
              conn.end();
              return resolve({ ok: false, error: err.message || 'Не удалось запустить скрипт' });
            }

            let output = '';
            let filename: string | null = null;

            stream.on('data', (chunk: Buffer) => {
              const text = chunk.toString('utf8');
              output += text;
              const m = text.match(/Файл создан:\s*(\S+)/);
              if (!filename && m) filename = m[1];
            });

            stream.stderr?.on('data', (chunk: Buffer) => {
              output += chunk.toString('utf8');
              const m = chunk.toString('utf8').match(/Файл создан:\s*(\S+)/);
              if (!filename && m) filename = m[1];
            });

            stream.on('close', () => {
              if (!filename) {
                conn.end();
                return resolve({
                  ok: false,
                  error: 'Скрипт не вернул имя файла. Вывод: ' + (output.slice(-500) || '—'),
                });
              }

              const path = filename.startsWith('/') ? filename : `/root/${filename}`;

              conn.exec(`cat ${path}`, (err2: Error | undefined, stream2) => {
                if (err2) {
                  conn.end();
                  return resolve({ ok: false, error: 'Не удалось прочитать конфиг: ' + err2.message });
                }

                let config = '';
                stream2.on('data', (chunk: Buffer) => {
                  config += chunk.toString('utf8');
                });
                stream2.on('close', () => {
                  conn.end();
                  resolve({ ok: true, config, filename: filename ?? undefined });
                });
              });
            });
          });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({ ok: false, error: err.message || 'Ошибка SSH' });
        })
        .connect({
          host: node.ip,
          port: node.sshPort ?? 22,
          username: node.sshUser!,
          privateKey: node.sshPrivateKey!,
          readyTimeout: 8000,
        });
    });
  }

  async removeUserByIp(nodeId: string, clientIp: string): Promise<{ ok: boolean; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }
    const ip = clientIp.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      return { ok: false, error: 'Неверный формат IP (ожидается например 10.8.1.15)' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ ok: false, error: 'Таймаут (60 с)' });
      }, 60000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          conn.exec(`/root/remove_user.sh ${ip}`, (err: Error | undefined, stream) => {
            if (err) {
              conn.end();
              return resolve({ ok: false, error: err.message || 'Не удалось запустить скрипт' });
            }

            let output = '';
            stream.on('data', (chunk: Buffer) => {
              output += chunk.toString('utf8');
            });
            stream.stderr?.on('data', (chunk: Buffer) => {
              output += chunk.toString('utf8');
            });

            stream.on('close', (code: number) => {
              conn.end();
              if (code === 0) {
                resolve({ ok: true });
              } else {
                resolve({
                  ok: false,
                  error: output.trim() ? output.slice(-300) : `Код выхода: ${code}`,
                });
              }
            });
          });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({ ok: false, error: err.message || 'Ошибка SSH' });
        })
        .connect({
          host: node.ip,
          port: node.sshPort ?? 22,
          username: node.sshUser!,
          privateKey: node.sshPrivateKey!,
          readyTimeout: 8000,
        });
    });
  }
}
