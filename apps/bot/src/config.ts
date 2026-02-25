import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const cwdEnv = resolve(process.cwd(), '.env');
const rootEnv = resolve(process.cwd(), '..', '..', '.env');
if (existsSync(cwdEnv)) loadEnv({ path: cwdEnv });
else if (existsSync(rootEnv)) loadEnv({ path: rootEnv });

// По умолчанию — официальный API. Для обхода блокировок задайте BOT_API_URL (например локальный Bot API сервер).
const botApiUrlRaw = process.env.BOT_API_URL?.replace(/\/$/, '') || 'https://api.telegram.org';
const botApiUrl = botApiUrlRaw.replace(/^http:\/\/localhost\b/i, 'http://127.0.0.1');

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  botApiKey: process.env.BOT_API_KEY || '',
  botApiUrl,
  webhookDomain: process.env.WEBHOOK_DOMAIN || '',
  webhookPath: process.env.WEBHOOK_PATH || '/webhook',
  supportLink: process.env.BOT_SUPPORT_LINK || '',
};

export function api(path: string, options: RequestInit = {}) {
  const base = config.backendUrl.replace(/\/$/, '');
  const url = `${base}/bot${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Api-Key': config.botApiKey,
      ...(options.headers as Record<string, string>),
    },
  });
}
