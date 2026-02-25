import { Context } from 'telegraf';
import { api } from '../config';
import { getText } from '../texts';

export async function handleReferrals(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const res = await api(`/referral-stats/${telegramId}`);
  if (!res.ok) {
    await ctx.reply(getText('referrals_error'));
    return;
  }
  const data = (await res.json()) as {
    referralCode: string;
    referralsCount: number;
    referralPercent?: number;
    referralBonusRub?: number;
  };
  const me = await ctx.telegram.getMe();
  const botUsername = me.username || 'your_bot';
  const inviteLink = `https://t.me/${botUsername}?start=${data.referralCode}`;
  const bonusRub = data.referralBonusRub ?? 20;
  const percent = data.referralPercent ?? 10;

  await ctx.reply(
    getText('referrals_content', {
      referralCode: data.referralCode,
      bonusRub,
      percent,
      inviteLink,
      referralsCount: data.referralsCount,
    }),
    { parse_mode: 'HTML' },
  );
}
