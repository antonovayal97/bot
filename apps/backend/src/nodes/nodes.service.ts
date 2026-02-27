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

  private parseAddUserOutput(output: string): { status: string; message?: string; clients?: { ip: string; config_file: string }[] } | null {
    try {
      const parsed = JSON.parse(output.trim()) as { status: string; message?: string; clients?: { ip: string; config_file: string }[] };
      return parsed;
    } catch {
      return null;
    }
  }

  private parseRemoveUserOutput(output: string): { status: string; message?: string; removed?: string[]; removed_count?: number } | null {
    try {
      const parsed = JSON.parse(output.trim()) as { status: string; message?: string; removed?: string[]; removed_count?: number };
      return parsed;
    } catch {
      return null;
    }
  }

  private mapAddUserError(message?: string): string {
    if (!message) return 'Ошибка скрипта add_user.sh';
    if (message === 'container_not_running') return 'Контейнер VPN не запущен';
    if (message === 'no_free_ip') return 'Нет свободных IP-адресов';
    if (message.startsWith('requested_') && message.includes('_but_only_')) return 'Запрошено больше клиентов, чем доступно';
    return message;
  }

  private mapRemoveUserError(message?: string): string {
    switch (message) {
      case 'container_not_running':
        return 'Контейнер VPN не запущен';
      default:
        return message ?? 'Ошибка скрипта remove_user.sh';
    }
  }

  async createTestUser(
    nodeId: string,
  ): Promise<{ ok: boolean; config?: string; filename?: string; error?: string }> {
    const result = await this.createUsers(nodeId, 1);
    if (!result.ok || !result.clients?.length) {
      return { ok: false, error: result.error ?? 'Не удалось создать пользователя' };
    }
    return {
      ok: true,
      config: result.clients[0].config,
      filename: result.clients[0].config_file,
    };
  }

  /** Создать N пользователей на ноде. add_user.sh N — JSON API. */
  async createUsers(
    nodeId: string,
    count: number,
  ): Promise<{ ok: boolean; clients?: { ip: string; config: string; config_file: string }[]; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }
    if (count < 1 || count > 100) return { ok: false, error: 'Количество от 1 до 100' };

    return new Promise((resolve) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.destroy();
        resolve({ ok: false, error: 'Таймаут (120 с)' });
      }, 120000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          const cmd = count === 1 ? '/root/add_user.sh' : `/root/add_user.sh ${count}`;
          conn.exec(cmd, (err: Error | undefined, stream) => {
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

            stream.on('close', () => {
              const parsed = this.parseAddUserOutput(output);
              if (!parsed) {
                conn.end();
                return resolve({ ok: false, error: 'Скрипт вернул невалидный JSON: ' + (output.slice(-300) || '—') });
              }
              if (parsed.status === 'error') {
                conn.end();
                return resolve({ ok: false, error: this.mapAddUserError(parsed.message) });
              }
              const clients = parsed.clients ?? [];
              if (clients.length === 0) {
                conn.end();
                return resolve({ ok: false, error: 'Скрипт не вернул созданных клиентов' });
              }

              this.catConfigFiles(conn, clients, (err2, results) => {
                conn.end();
                if (err2) return resolve({ ok: false, error: err2 });
                resolve({ ok: true, clients: results ?? [] });
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

  private catConfigFiles(
    conn: Client,
    clients: { ip: string; config_file: string }[],
    callback: (err: string | null, results?: { ip: string; config: string; config_file: string }[]) => void,
  ): void {
    const results: { ip: string; config: string; config_file: string }[] = [];
    let i = 0;
    const next = () => {
      if (i >= clients.length) {
        callback(null, results);
        return;
      }
      const c = clients[i++];
      const path = c.config_file.startsWith('/') ? c.config_file : `/root/${c.config_file}`;
      conn.exec(`cat ${path}`, (err: Error | undefined, stream) => {
        if (err) {
          callback('Не удалось прочитать конфиг: ' + err.message);
          return;
        }
        let config = '';
        stream.on('data', (chunk: Buffer) => {
          config += chunk.toString('utf8');
        });
        stream.on('close', () => {
          results.push({ ip: c.ip, config, config_file: c.config_file });
          next();
        });
      });
    };
    next();
  }

  async removeUserByIp(nodeId: string, clientIp: string): Promise<{ ok: boolean; error?: string }> {
    return this.removeUsersByIp(nodeId, [clientIp.trim()]);
  }

  /** Удалить несколько пользователей по IP. remove_user.sh ip1 ip2 ... — JSON API. */
  async removeUsersByIp(nodeId: string, ips: string[]): Promise<{ ok: boolean; removed?: string[]; error?: string }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return { ok: false, error: 'Нода не найдена' };
    if (!node.sshUser || !node.sshPrivateKey) {
      return { ok: false, error: 'Укажите пользователя и приватный ключ SSH' };
    }
    const valid = ips.filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim()));
    if (valid.length === 0) {
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
          const cmd = `/root/remove_user.sh ${valid.join(' ')}`;
          conn.exec(cmd, (err: Error | undefined, stream) => {
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

            stream.on('close', () => {
              conn.end();
              const parsed = this.parseRemoveUserOutput(output);
              if (!parsed) {
                return resolve({
                  ok: false,
                  error: 'Скрипт вернул невалидный JSON: ' + (output.slice(-300) || '—'),
                });
              }
              if (parsed.status === 'error') {
                return resolve({ ok: false, error: this.mapRemoveUserError(parsed.message) });
              }
              resolve({ ok: true, removed: parsed.removed ?? [] });
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
