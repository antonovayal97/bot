import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly apiBase: string;

  constructor(private config: ConfigService) {
    this.token = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    let apiUrl = this.config.get<string>('BOT_API_URL', '') || 'https://api.telegram.org';
    apiUrl = apiUrl.replace(/\/$/, '');
    this.apiBase = apiUrl.replace(/^http:\/\/localhost\b/i, 'http://127.0.0.1');
    if (this.token) {
      this.logger.log(`Telegram API: ${this.apiBase}`);
    }
  }

  /** Отправить сообщение пользователю в Telegram. Если токен не задан — не отправляет. */
  async sendMessage(telegramId: string, text: string): Promise<boolean> {
    if (!this.token || !text.trim()) {
      if (!this.token) this.logger.warn('sendMessage skipped: TELEGRAM_BOT_TOKEN not set');
      return false;
    }
    const chatId = /^-?\d+$/.test(String(telegramId).trim())
      ? parseInt(String(telegramId).trim(), 10)
      : String(telegramId).trim();
    try {
      const url = `${this.apiBase}/bot${this.token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.trim(),
          parse_mode: 'HTML',
        }),
      });
      const raw = await res.text();
      let data: { ok?: boolean; description?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        this.logger.warn(`sendMessage failed (${this.apiBase}) ${res.status}: ${raw.slice(0, 200)}`);
        return false;
      }
      if (!data.ok) {
        this.logger.warn(`sendMessage failed (${this.apiBase}): ${data.description ?? res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sendMessage error (${this.apiBase}): ${msg}`);
      return false;
    }
  }
}
