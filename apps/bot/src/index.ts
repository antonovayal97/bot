import { Telegraf } from 'telegraf';
import { config } from './config';
import { loadTexts, getText } from './texts';
import { handleStart, showMainMenu } from './handlers/start';
import { handleMyConfigs, handleConfigNode, handleConfigQr } from './handlers/configs';
import {
  handleRenew,
  handleRenewBuy,
  handleRenewCountry,
  handleRenewDevices,
  handleRenewExtend,
  handleExtendSub,
  handleExtendPlan,
  handleSubscribePlan,
  handleTopup,
  handleTopupAmount,
  handleTopupCustom,
  handleTopupCancel,
  validateTopupAmount,
} from './handlers/renew';
import { getAndClearWaiting } from './state';
import { handleReferralCommand } from './handlers/referral';
import { handleHelp } from './handlers/help';
import { handleReferrals } from './handlers/referrals';
import { handleShowPlans } from './handlers/plans';
import { handleSupport } from './handlers/support';
import { handleInstructions } from './handlers/instructions';
import { handleAbout } from './handlers/about';
import { REPLY_KEYS } from './keyboard';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

if (!config.telegramToken) {
  console.error('[Bot] TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(config.telegramToken, {
  telegram: { apiRoot: config.botApiUrl },
});

bot.start(handleStart);
bot.command('referral', handleReferralCommand);
bot.command('help', handleHelp);
bot.action('status', showMainMenu);
bot.action('plans', handleShowPlans);
bot.action('my_configs', handleMyConfigs);
bot.action(/^config_node_(.+)$/, (ctx) => {
  const nodeId = ctx.match[1];
  return handleConfigNode(ctx, nodeId);
});
bot.action(/^config_qr_(.+)$/, (ctx) => {
  const nodeId = ctx.match[1];
  return handleConfigQr(ctx, nodeId);
});
bot.action('renew', handleRenew);
bot.action('topup', handleTopup);
bot.action('topup_custom', handleTopupCustom);
bot.action('topup_cancel', handleTopupCancel);
bot.action(/^topup_amount_(\d+)$/, (ctx) => {
  const amount = parseInt(ctx.match[1], 10);
  return handleTopupAmount(ctx, amount);
});
bot.action('renew_buy', handleRenewBuy);
bot.action('renew_extend', handleRenewExtend);
bot.action(/^renew_country_([^_]+)$/, (ctx) => {
  const country = ctx.match[1];
  return handleRenewCountry(ctx, country);
});
bot.action(/^renew_devices_([^_]+)_(\d+)$/, (ctx) => {
  const country = ctx.match[1];
  const deviceCount = parseInt(ctx.match[2], 10);
  return handleRenewDevices(ctx, country, deviceCount);
});
bot.action(/^extend_sub_(.+?)_(\d+)$/, (ctx) => {
  const subscriptionId = ctx.match[1];
  const deviceCount = parseInt(ctx.match[2], 10) || 1;
  return handleExtendSub(ctx, subscriptionId, deviceCount);
});
bot.action(/^extend_plan_(.+)_(3d|1m|3m|6m|12m)$/, (ctx) => {
  const subscriptionId = ctx.match[1];
  const plan = ctx.match[2] as SubscriptionPlan;
  return handleExtendPlan(ctx, subscriptionId, plan);
});
bot.action('referrals', handleReferrals);
bot.action('instructions', handleInstructions);
bot.action('about', handleAbout);
bot.action('help', handleHelp);
bot.action('support', handleSupport);
bot.action(/^subscribe_([^_]+)_(3d|1m|3m|6m|12m)(?:_(\d+))?$/, (ctx) => {
  const country = ctx.match[1];
  const plan = ctx.match[2] as SubscriptionPlan;
  const deviceCount = ctx.match[3] ? parseInt(ctx.match[3], 10) : 1;
  return handleSubscribePlan(ctx, country, plan, deviceCount);
});
bot.command('menu', showMainMenu);
bot.command('status', showMainMenu);
bot.on('message', async (ctx) => {
  const text = (ctx.message as { text?: string })?.text;
  if (!text || text.startsWith('/')) return;
  const telegramId = String(ctx.from?.id);
  const waitingData = getAndClearWaiting(telegramId);
  if (waitingData?.state === 'topup_amount') {
    const cancelled = /^(отмена|cancel|выход)$/i.test(text.trim());
    if (cancelled) {
      return ctx.reply(getText('topup_cancelled'));
    }
    const amount = parseInt(text.replace(/\s/g, ''), 10);
    const valid = validateTopupAmount(amount);
    if (!valid.ok) {
      const { setWaiting } = await import('./state');
      setWaiting(telegramId, 'topup_amount');
      return ctx.reply(valid.error ?? 'Сумма должна быть от 50 до 5000 ₽. Введите число:');
    }
    return handleTopupAmount(ctx, amount);
  }
  switch (text) {
    case REPLY_KEYS.MENU:
      return showMainMenu(ctx);
    case REPLY_KEYS.CONFIGS:
      return handleMyConfigs(ctx);
    case REPLY_KEYS.RENEW:
      return handleRenew(ctx);
    case REPLY_KEYS.MORE:
      return ctx.reply('Дополнительные разделы:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👥 Рефералы', callback_data: 'referrals' }],
            [
              { text: '📖 Инструкция', callback_data: 'instructions' },
              { text: '❓ Помощь', callback_data: 'help' },
            ],
            [
              { text: '💬 Поддержка', callback_data: 'support' },
              { text: 'ℹ️ О сервисе', callback_data: 'about' },
            ],
          ],
        },
      });
    default:
      return showMainMenu(ctx);
  }
});

const useWebhook = config.webhookDomain && (process.argv.includes('webhook') || process.env.BOT_USE_WEBHOOK === '1');

async function run() {
  await loadTexts();
  if (useWebhook) {
    const path = config.webhookPath || '/webhook';
    await bot.telegram.setWebhook(`${config.webhookDomain}${path}`);
    const express = await import('express');
    const app = express.default();
    app.use(express.json());
    app.post(path, (req: import('express').Request, res: import('express').Response) => {
      bot.handleUpdate(req.body, res).then(() => res.sendStatus(200)).catch(() => res.sendStatus(500));
    });
    const port = process.env.BOT_PORT || 3002;
    app.listen(port, () => console.log(`[Bot] Webhook на порту ${port}`));
    return;
  }

  const me = await bot.telegram.getMe();
  console.log('[Bot] Запущен: @' + me.username, '(' + config.botApiUrl + ')');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  bot.launch().catch((err) => console.error('[Bot] Polling:', err));
}

run().catch((err) => {
  console.error('[Bot] Ошибка:', err.message || err);
  process.exit(1);
});
