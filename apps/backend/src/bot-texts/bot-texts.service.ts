import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_BOT_TEXTS } from './bot-texts.constants';

const BOT_TEXTS_KEY = 'botTexts';

@Injectable()
export class BotTextsService {
  constructor(private prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const row = await this.prisma.appSettings.findUnique({ where: { key: BOT_TEXTS_KEY } });
    if (!row) return { ...DEFAULT_BOT_TEXTS };
    try {
      const custom = JSON.parse(row.value) as Record<string, string>;
      return { ...DEFAULT_BOT_TEXTS, ...custom };
    } catch {
      return { ...DEFAULT_BOT_TEXTS };
    }
  }

  async update(partial: Record<string, string>): Promise<Record<string, string>> {
    const current = await this.getAll();
    const merged = { ...current };
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined && v !== null) {
        if (typeof v === 'string' && v.trim() === '') {
          if (DEFAULT_BOT_TEXTS[k]) merged[k] = DEFAULT_BOT_TEXTS[k];
        } else {
          merged[k] = String(v);
        }
      }
    }
    await this.prisma.appSettings.upsert({
      where: { key: BOT_TEXTS_KEY },
      create: { key: BOT_TEXTS_KEY, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });
    return merged;
  }
}
