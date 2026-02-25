import { Context } from 'telegraf';
import { getText } from '../texts';

export async function handleInstructions(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  await ctx.reply(getText('instructions_content'), { parse_mode: 'HTML' });
}
