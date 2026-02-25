import { Context } from 'telegraf';
import QRCode from 'qrcode';
import { api } from '../config';
import { getCountryName } from '@vpn-v/shared-types';
import { getText } from '../texts';

type ConfigItem = { deviceId?: string; nodeId: string; nodeName: string; country: string; config: string | null; expiresAt?: string };

const INSTRUCTIONS_BUTTON = { text: '📖 Инструкция по установке', callback_data: 'instructions' };
const QR_BUTTON = (selector: string) => ({ text: '📱 QR-код', callback_data: `config_qr_${selector || '0'}` });

function getInlineKeyboard(selector: string) {
  return { inline_keyboard: [[INSTRUCTIONS_BUTTON, QR_BUTTON(selector)]] };
}

function formatExpiryCaption(expiresAt?: string | null): string {
  if (!expiresAt) return '';
  const date = new Date(expiresAt);
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((date.getTime() - now) / (24 * 60 * 60 * 1000)));
  const dateTimeStr = date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `\n\nОкончание: ${dateTimeStr}. Остаток: ${daysLeft} дн.`;
}

function sendConfigAsFile(
  ctx: Context,
  config: string,
  countryCode: string,
  selector: string = '',
  expiresAt?: string | null,
) {
  const filename = `amneziawg-${countryCode || 'config'}.conf`;
  const caption = getText('configs_caption') + formatExpiryCaption(expiresAt);
  return ctx.replyWithDocument(
    { source: Buffer.from(config, 'utf8'), filename },
    {
      caption,
      parse_mode: 'HTML',
      reply_markup: getInlineKeyboard(selector),
    },
  );
}

export async function handleMyConfigs(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const res = await api(`/config/${telegramId}`);
  if (!res.ok) {
    await ctx.reply(getText('configs_error'));
    return;
  }
  const data = (await res.json()) as {
    config: string | null;
    nodeName?: string;
    configs?: ConfigItem[];
  };

  const configs = data.configs ?? (data.config != null ? [{ deviceId: undefined, nodeId: '', nodeName: data.nodeName ?? '', country: '', config: data.config }] : []);
  if (configs.length === 0) {
    await ctx.reply(getText('configs_no_subscriptions'));
    return;
  }
  if (configs.length === 1) {
    const c = configs[0];
    if (!c.config) {
      await ctx.reply(getText('configs_preparing'));
      return;
    }
    const selector = c.deviceId ?? c.nodeId ?? '';
    await sendConfigAsFile(ctx, c.config, c.country || '', selector, c.expiresAt);
    return;
  }
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const buttons = configs.map((c, idx) => {
    const countryLabel = (c.country ? getCountryName(c.country) : null) || c.country || 'Страна';
    const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
    const dateStr = expiresAt ? expiresAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / dayMs)) : 0;
    const subtitle = dateStr ? ` до ${dateStr}, ост. ${daysLeft} дн.` : '';
    const deviceHint = configs.filter((x) => x.nodeId === c.nodeId && x.country === c.country).length > 1
      ? ` · устр. ${idx + 1}`
      : '';
    const selector = ('deviceId' in c && c.deviceId) ? c.deviceId : c.nodeId;
    return [
      {
        text: `${countryLabel}${deviceHint}${subtitle}`,
        callback_data: `config_node_${selector}`,
      },
    ];
  });
  await ctx.reply(getText('configs_choose_country'), {
    reply_markup: { inline_keyboard: [...buttons, [INSTRUCTIONS_BUTTON]] },
  });
}

export async function handleConfigNode(ctx: Context, selector: string) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) await ctx.telegram.sendChatAction(chatId, 'upload_document');
  const telegramId = String(ctx.from?.id);
  const res = await api(`/config/${telegramId}?deviceId=${encodeURIComponent(selector)}`);
  if (!res.ok) {
    await ctx.reply(getText('configs_error'));
    return;
  }
  const data = (await res.json()) as { config: string | null; nodeName?: string; configs?: (ConfigItem & { deviceId?: string })[] };
  if (!data.config) {
    await ctx.reply(getText('configs_preparing_retry'));
    return;
  }
  const selected = data.configs?.find((c) => (c.deviceId && c.deviceId === selector) || c.nodeId === selector);
  const countryCode = selected?.country ?? '';
  const keyboardSelector = selected?.deviceId ?? selected?.nodeId ?? selector;
  const expiresAt = selected?.expiresAt;
  await sendConfigAsFile(ctx, data.config, countryCode, keyboardSelector, expiresAt);
}

export async function handleConfigQr(ctx: Context, selector: string) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const url =
    selector && selector !== '0'
      ? `/config/${telegramId}?deviceId=${encodeURIComponent(selector)}`
      : `/config/${telegramId}`;
  const res = await api(url);
  if (!res.ok) {
    await ctx.reply(getText('configs_error'));
    return;
  }
  const data = (await res.json()) as { config: string | null; configs?: ConfigItem[] };
  if (!data.config) {
    await ctx.reply(getText('configs_preparing_retry'));
    return;
  }
  const selected =
    selector && selector !== '0'
      ? data.configs?.find((c) => c.deviceId === selector || c.nodeId === selector)
      : data.configs?.[0];
  const caption = getText('configs_caption') + formatExpiryCaption(selected?.expiresAt);
  const qrBuffer = await QRCode.toBuffer(data.config, { type: 'png', margin: 2 });
  await ctx.replyWithPhoto(
    { source: qrBuffer },
    {
      caption,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[INSTRUCTIONS_BUTTON]] },
    },
  );
}
