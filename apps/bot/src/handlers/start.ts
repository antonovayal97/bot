import { Context } from 'telegraf';
import { getCountryName } from '@vpn-v/shared-types';
import { api } from '../config';
import { mainReplyKeyboard } from '../keyboard';
import { getText } from '../texts';

export async function handleStart(ctx: Context) {
  const telegramId = String(ctx.from?.id);
  const username = ctx.from?.username ?? undefined;
  const startPayload = ctx.message && 'text' in ctx.message ? ctx.message.text?.trim().split(/\s+/)[1] : undefined;

  const res = await api('/webhook/register', {
    method: 'POST',
    body: JSON.stringify({ telegramId, username }),
  });
  if (!res.ok) {
    await ctx.reply(getText('start_error_registration'));
    return;
  }
  const data = (await res.json()) as { referralCode: string; welcomeBonusRub?: number };

  if (startPayload && startPayload !== data.referralCode) {
    const refRes = await api('/referral', {
      method: 'POST',
      body: JSON.stringify({ telegramId, referralCode: startPayload.toUpperCase() }),
    });
    const refData = (await refRes.json()) as {
      ok: boolean;
      message?: string;
      referrerTelegramId?: string;
      referrerPercent?: number;
      bonusRub?: number;
    };
    if (refData.ok) {
      const bonusText = refData.bonusRub
        ? getText('start_referral_success_bonus', { bonusRub: refData.bonusRub })
        : '';
      await ctx.reply(getText('start_referral_success') + bonusText);
      if (refData.referrerTelegramId) {
        try {
          const percentText =
            refData.referrerPercent != null
              ? getText('start_referrer_percent', { percent: refData.referrerPercent })
              : '';
          await ctx.telegram.sendMessage(
            refData.referrerTelegramId,
            getText('start_referrer_new_user') + percentText,
          );
        } catch {
          // реферер мог заблокировать бота
        }
      }
    }
  }

  const welcomeBonusLine =
    data.welcomeBonusRub && data.welcomeBonusRub > 0
      ? getText('start_welcome_bonus', { bonusRub: data.welcomeBonusRub })
      : '';
  await ctx.reply(getText('start_welcome', { referralCode: data.referralCode }) + welcomeBonusLine, {
    parse_mode: 'HTML',
    ...mainReplyKeyboard(),
  });
  await showMainMenu(ctx);
}

export async function showMainMenu(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const userRes = await api(`/user/${telegramId}`);
  if (!userRes.ok) {
    await ctx.reply(getText('start_error_data'));
    return;
  }
  const user = (await userRes.json()) as {
    subscriptionUntil: string | null;
    isActive: boolean;
    referralCode: string;
    balanceRub?: number;
    activeSubscriptions?: { node: { name: string; country: string } }[];
  };

  const untilStr = user.subscriptionUntil
    ? new Date(user.subscriptionUntil).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const status = user.isActive ? '✅ Есть активные подписки' : '❌ Нет активных подписок';
  const subs = user.activeSubscriptions ?? [];
  const countriesStr =
    subs.length > 0
      ? [...new Set(subs.map((s) => getCountryName(s.node.country) || s.node.country))].join(', ')
      : '—';

  const daysLeft =
    user.subscriptionUntil && user.isActive
      ? Math.max(
          0,
          Math.ceil((new Date(user.subscriptionUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : 0;

  const balanceRub = user.balanceRub ?? 0;
  const daysLeftLine = daysLeft > 0 ? getText('start_status_days_left', { days: daysLeft }) : '';
  await ctx.reply(
    getText('start_status', {
      status,
      untilStr,
      daysLeftLine,
      countriesStr,
      balanceRub,
      referralCode: user.referralCode,
    }),
    {
      parse_mode: 'HTML',
      ...mainReplyKeyboard(),
    },
  );
}
