import { Context } from 'telegraf';
import { getText } from '../texts';

export async function handleHelp(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  await ctx.reply(getText('help_content'), { parse_mode: 'HTML' });
}
