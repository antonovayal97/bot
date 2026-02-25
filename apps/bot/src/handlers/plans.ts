import { Context } from 'telegraf';
import { api } from '../config';
import { getText } from '../texts';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  '3d': '3 дня',
  '1m': '1 месяц',
  '3m': '3 месяца',
  '6m': '6 месяцев',
  '12m': '12 месяцев',
};

export async function handleShowPlans(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const res = await api('/plans');
  if (!res.ok) {
    await ctx.reply(getText('plans_error'));
    return;
  }
  const plans = (await res.json()) as { plan: SubscriptionPlan; days: number; price: number }[];
  const lines = plans.map((p) => `• ${PLAN_LABELS[p.plan]} — ${p.price} ₽ (${p.days} дн.)`).join('\n');
  await ctx.reply(
    getText('plans_content', { lines: lines }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🔄 Купить/Продлить', callback_data: 'renew' }]],
      },
    },
  );
}
