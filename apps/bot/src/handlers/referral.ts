import { Context } from 'telegraf';
import { api } from '../config';
import { getText } from '../texts';

export async function handleReferralCommand(ctx: Context) {
  const msg = ctx.message;
  const text = (msg && 'text' in msg ? msg.text : '')?.trim() ?? '';
  const parts = text.split(/\s+/);
  const code = parts[1];
  if (!code) {
    await ctx.reply(getText('referral_usage'));
    return;
  }
  const telegramId = String(ctx.from?.id);
  const res = await api('/referral', {
    method: 'POST',
    body: JSON.stringify({ telegramId, referralCode: code.toUpperCase() }),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; referrerTelegramId?: string; referrerPercent?: number; bonusRub?: number };
  if (data.ok) {
    const bonusText = data.bonusRub ? getText('referral_success_bonus', { bonusRub: data.bonusRub }) : '';
    await ctx.reply(getText('referral_success') + bonusText);
  } else {
    await ctx.reply(data.message || getText('referral_error'));
  }
}
