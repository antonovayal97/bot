import { Markup } from 'telegraf';

export const REPLY_KEYS = {
  MENU: '📊 Статус',
  CONFIGS: '📁 Мои конфиги',
  RENEW: '🔄 Купить/Продлить',
  MORE: '📚 Ещё',
} as const;

export const mainReplyKeyboard = () =>
  Markup.keyboard([
    [REPLY_KEYS.MENU, REPLY_KEYS.CONFIGS],
    [REPLY_KEYS.RENEW, REPLY_KEYS.MORE],
  ])
    .resize()
    .persistent();
