import { Context } from 'telegraf';
import { getText } from '../texts';

export async function handleAbout(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  await ctx.reply(getText('about_content'), { parse_mode: 'HTML' });
}
