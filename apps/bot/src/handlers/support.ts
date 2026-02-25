import { Context } from 'telegraf';
import { config } from '../config';
import { getText } from '../texts';

export async function handleSupport(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  if (config.supportLink) {
    await ctx.reply(getText('support_text'), {
      reply_markup: {
        inline_keyboard: [[{ text: getText('support_button'), url: config.supportLink }]],
      },
    });
  } else {
    await ctx.reply(getText('support_text'));
  }
}
