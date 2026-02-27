import { Context } from 'telegraf';
import { api } from '../config';
import { getCountryName } from '@vpn-v/shared-types';
import { getText } from '../texts';
import type { SubscriptionPlan } from '@vpn-v/shared-types';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  '3d': '3 дня',
  '1m': '1 месяц',
  '3m': '3 месяца',
  '6m': '6 месяцев',
  '12m': '12 месяцев',
};

type NodeOption = { id: string; name: string; country: string };
type CountryOption = { country: string; nodesAvailable: number };

export async function handleRenew(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const [userRes, topupRes] = await Promise.all([
    api(`/user/${telegramId}`),
    api('/topup/enabled'),
  ]);
  const balanceRub = userRes.ok
    ? ((await userRes.json()) as { balanceRub?: number }).balanceRub ?? 0
    : 0;
  const topupEnabled = topupRes.ok && ((await topupRes.json()) as { enabled?: boolean }).enabled === true;

  const buttons = [
    [{ text: '🛒 Купить', callback_data: 'renew_buy' }],
    [{ text: '🔄 Продлить', callback_data: 'renew_extend' }],
  ];
  if (topupEnabled) {
    buttons.push([{ text: '💳 Пополнить баланс', callback_data: 'topup' }]);
  }

  await ctx.reply(
    getText('renew_choose_action', { balanceRub: String(balanceRub) }),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

const TOPUP_AMOUNTS = [100, 300, 500, 1000];

export async function handleTopup(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const buttons = TOPUP_AMOUNTS.map((a) => [{ text: `${a} ₽`, callback_data: `topup_amount_${a}` }]);
  await ctx.reply(getText('topup_choose_amount'), {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleTopupAmount(ctx: Context, amount: number) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const chatId = ctx.chat?.id;

  if (chatId) await ctx.telegram.sendChatAction(chatId, 'typing');
  const loadingMsg = await ctx.reply(getText('topup_creating'));

  const res = await api('/topup', {
    method: 'POST',
    body: JSON.stringify({ telegramId, amount }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    paymentLink?: string;
    error?: string;
  };

  const editOrReply = async (text: string, parseMode?: 'HTML') => {
    if (!chatId) {
      await ctx.reply(text, parseMode ? { parse_mode: parseMode } : {});
      return;
    }
    try {
      await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, text, {
        parse_mode: parseMode,
      });
    } catch {
      await ctx.reply(text, parseMode ? { parse_mode: parseMode } : {});
    }
  };

  if (!res.ok || !data.ok) {
    await editOrReply(data.error || getText('topup_error'));
    return;
  }
  const link = data.paymentLink;
  if (!link) {
    await editOrReply(getText('topup_error'));
    return;
  }
  await editOrReply(
    `${getText('topup_success')}\n\n<a href="${link}">Перейти к оплате →</a>`,
    'HTML',
  );
}

export async function handleRenewBuy(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const nodesRes = await api('/countries');
  if (!nodesRes.ok) {
    await ctx.reply(getText('renew_error_countries'));
    return;
  }
  const countries = (await nodesRes.json()) as CountryOption[];
  if (countries.length === 0) {
    await ctx.reply(getText('renew_no_countries'));
    return;
  }

  const buttons = countries.map((c) => {
    const code = c?.country ?? '';
    const label = code ? (getCountryName(code) || code) : 'Страна';
    return [{ text: label, callback_data: `renew_country_${code}` }];
  });

  await ctx.reply(getText('renew_buy_prompt'), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleRenewExtend(ctx: Context) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const userRes = await api(`/user/${telegramId}`);
  if (!userRes.ok) {
    await ctx.reply(getText('renew_error_subscribe'));
    return;
  }
  const user = (await userRes.json()) as {
    activeSubscriptions?: { id: string; expiresAt: string; devicesCount?: number; node: { country: string } }[];
  };
  const subs = user.activeSubscriptions ?? [];
  if (subs.length === 0) {
    await ctx.reply(getText('renew_extend_no_subs'));
    return;
  }

  const buttons = subs.map((s) => {
    const countryLabel = s.node?.country ? (getCountryName(s.node.country) || s.node.country) : 'Страна';
    const expDate = s.expiresAt
      ? new Date(s.expiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    const devCount = s.devicesCount ?? 0;
    const devLabel =
      devCount === 1 ? '1 устройство' : devCount >= 2 && devCount <= 4 ? `${devCount} устройства` : `${devCount} устройств`;
    const label = `${countryLabel} · до ${expDate} · ${devLabel}`;
    const deviceCount = Math.max(1, devCount);
    return [{ text: label, callback_data: `extend_sub_${s.id}_${deviceCount}` }];
  });

  await ctx.reply(getText('renew_extend_choose'), {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleExtendSub(ctx: Context, subscriptionId: string, deviceCount: number) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);

  // Обновляем предыдущее сообщение (выбор подписки для продления):
  // дописываем выбранную подписку в скобках и убираем кнопки.
  try {
    const userRes = await api(`/user/${telegramId}`);
    if (userRes.ok) {
      const user = (await userRes.json()) as {
        activeSubscriptions?: { id: string; expiresAt: string; devicesCount?: number; node: { country: string } }[];
      };
      const subs = user.activeSubscriptions ?? [];
      const sub = subs.find((s) => s.id === subscriptionId);
      if (sub) {
        const countryLabel = sub.node?.country ? (getCountryName(sub.node.country) || sub.node.country) : 'Страна';
        const expDate = sub.expiresAt
          ? new Date(sub.expiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '—';
        const devCount = sub.devicesCount ?? deviceCount;
        const devLabel =
          devCount === 1 ? '1 устройство' : devCount >= 2 && devCount <= 4 ? `${devCount} устройства` : `${devCount} устройств`;
        const summary = `${countryLabel} · до ${expDate} · ${devLabel}`;

        const msg = ctx.callbackQuery?.message as { text?: string } | undefined;
        if (msg?.text) {
          const baseText = msg.text.replace(/\s*\(.+\)$/, '');
          const newText = `${baseText} (${summary})`;
          try {
            await ctx.editMessageText(newText, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: [] },
            });
          } catch {
            // игнорируем ошибки редактирования
          }
        }
      }
    }
  } catch {
    // игнорируем ошибки запроса /user
  }

  const plansRes = await api(`/plans?devices=${deviceCount}`);
  if (!plansRes.ok) {
    await ctx.reply(getText('renew_error_plans'));
    return;
  }
  const plans = (await plansRes.json()) as { plan: SubscriptionPlan; days: number; price: number }[];
  const buttons = plans.map((p) => [
    {
      text: `${PLAN_LABELS[p.plan]} — ${p.price} ₽`,
      callback_data: `extend_plan_${subscriptionId}_${p.plan}`,
    },
  ]);

  await ctx.reply(getText('renew_choose_plan_extend'), {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleExtendPlan(ctx: Context, subscriptionId: string, plan: SubscriptionPlan) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const chatId = ctx.chat?.id;

  // Обновляем предыдущее сообщение «Выберите срок продления»:
  // дописываем выбранный срок в скобках и убираем кнопки.
  const prevMsg = ctx.callbackQuery?.message as { text?: string } | undefined;
  if (prevMsg?.text) {
    const baseText = prevMsg.text.replace(/\s*\(.+\)$/, '');
    const planLabel = PLAN_LABELS[plan];
    const newText = `${baseText} (${planLabel})`;
    try {
      await ctx.editMessageText(newText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // игнорируем ошибки редактирования
    }
  }

  if (chatId) await ctx.telegram.sendChatAction(chatId, 'typing');
  const loadingMsg = await ctx.reply(getText('renew_extending'));
  const res = await api('/extend', {
    method: 'POST',
    body: JSON.stringify({ telegramId, subscriptionId, plan }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; expiresAt?: string; insufficientBalance?: boolean; error?: string };

  const editOrReply = async (text: string, parseMode: 'HTML' | undefined = undefined) => {
    if (!chatId) {
      await ctx.reply(text, { parse_mode: parseMode });
      return;
    }
    try {
      await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, text, {
        parse_mode: parseMode,
      });
    } catch {
      await ctx.reply(text, { parse_mode: parseMode });
    }
  };

  if (!res.ok) {
    await editOrReply(getText('renew_error_subscribe'));
    return;
  }
  if (!data.ok) {
    const errText = data.insufficientBalance
      ? getText('renew_insufficient_balance')
      : (data.error || 'Не удалось продлить подписку.');
    await editOrReply(errText);
    return;
  }
  const untilStr = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  await editOrReply(getText('renew_success', { untilStr }), 'HTML');
}

const MAX_DEVICE_CHOICE = 5;

export async function handleRenewCountry(ctx: Context, country: string) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const countriesRes = await api('/countries');
  const countries = countriesRes.ok ? (await countriesRes.json()) as CountryOption[] : [];
  const exists = countries.some((c) => c.country === country);
  if (!exists) {
    await ctx.reply(getText('renew_no_slots'));
    return;
  }

  const countryLabel = country ? (getCountryName(country) || country) : 'страны';

  // Обновляем предыдущее сообщение (выбор страны): добавляем выбранную страну в скобках и убираем кнопки.
  const msg = ctx.callbackQuery?.message as { text?: string } | undefined;
  if (msg?.text) {
    const baseText = msg.text.replace(/\s*\(.+\)$/, '');
    const newText = `${baseText} (${countryLabel})`;
    try {
      await ctx.editMessageText(newText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // игнорируем ошибку редактирования (сообщение уже изменено и т.п.)
    }
  }

  const deviceButtons = Array.from({ length: MAX_DEVICE_CHOICE }, (_, i) => i + 1).map((n) => ({
    text: `${n} ${n === 1 ? 'устройство' : n < 5 ? 'устройства' : 'устройств'}`,
    callback_data: `renew_devices_${country}_${n}`,
  }));

  await ctx.reply(getText('renew_choose_devices', { countryLabel }), {
    reply_markup: { inline_keyboard: deviceButtons.map((b) => [b]) },
  });
}

export async function handleRenewDevices(ctx: Context, country: string, deviceCount: number) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const [plansRes, countriesRes] = await Promise.all([
    api(`/plans?devices=${deviceCount}`),
    api('/countries'),
  ]);
  if (!plansRes.ok) {
    await ctx.reply(getText('renew_error_plans'));
    return;
  }
  const plans = (await plansRes.json()) as { plan: SubscriptionPlan; days: number; price: number }[];
  const countries = (await countriesRes.json()) as CountryOption[];
  const exists = countries.some((c) => c.country === country);
  if (!exists) {
    await ctx.reply(getText('renew_no_slots'));
    return;
  }

  // Обновляем предыдущее сообщение (выбор количества устройств): добавляем выбранное число устройств и убираем кнопки.
  const msg = ctx.callbackQuery?.message as { text?: string } | undefined;
  if (msg?.text) {
    const baseText = msg.text.replace(/\s*\(.+\)$/, '');
    const devLabel =
      deviceCount === 1
        ? '1 устройство'
        : deviceCount >= 2 && deviceCount <= 4
        ? `${deviceCount} устройства`
        : `${deviceCount} устройств`;
    const newText = `${baseText} (${devLabel})`;
    try {
      await ctx.editMessageText(newText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // игнорируем ошибку редактирования
    }
  }

  const buttons = plans.map((p) => [
    {
      text: `${PLAN_LABELS[p.plan]} — ${p.price} ₽`,
      callback_data: `subscribe_${country}_${p.plan}_${deviceCount}`,
    },
  ]);

  const countryLabel = country ? (getCountryName(country) || country) : 'страны';
  await ctx.reply(
    getText('renew_choose_plan', { countryLabel }),
    { reply_markup: { inline_keyboard: buttons } },
  );
}

export async function handleSubscribePlan(ctx: Context, country: string, plan: SubscriptionPlan, deviceCount: number = 1) {
  if ('callback_query' in ctx.update) await ctx.answerCbQuery();
  const telegramId = String(ctx.from?.id);
  const chatId = ctx.chat?.id;
  if (chatId) {
    await ctx.telegram.sendChatAction(chatId, 'typing');
  }

  // Обновляем предыдущее сообщение (выбор тарифа): добавляем выбранный срок и цену, убираем кнопки.
  const msg = ctx.callbackQuery?.message as { text?: string } | undefined;
  if (msg?.text) {
    try {
      const plansRes = await api(`/plans?devices=${deviceCount}`);
      if (plansRes.ok) {
        const plans = (await plansRes.json()) as { plan: SubscriptionPlan; days: number; price: number }[];
        const chosen = plans.find((p) => p.plan === plan);
        const planLabel = PLAN_LABELS[plan];
        const selectionText = chosen ? `${planLabel} — ${chosen.price} ₽` : planLabel;
        const baseText = msg.text.replace(/\s*\(.+\)$/, '');
        const newText = `${baseText} (${selectionText})`;
        await ctx.editMessageText(newText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] },
        });
      }
    } catch {
      // игнорируем ошибку редактирования/запроса тарифов
    }
  }

  const loadingMsg = await ctx.reply(getText('renew_creating'));
  const res = await api('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ telegramId, plan, country, deviceCount }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; expiresAt?: string; insufficientBalance?: boolean; error?: string };

  const editOrReply = async (text: string, parseMode: 'HTML' | undefined = undefined) => {
    if (!chatId) {
      await ctx.reply(text, { parse_mode: parseMode });
      return;
    }
    try {
      await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, text, {
        parse_mode: parseMode,
      });
    } catch {
      await ctx.reply(text, { parse_mode: parseMode });
    }
  };

  if (!res.ok) {
    await editOrReply(getText('renew_error_subscribe'));
    return;
  }
  if (!data.ok) {
    const errText = data.insufficientBalance
      ? getText('renew_insufficient_balance')
      : (data.error || 'Не удалось оформить подписку.');
    await editOrReply(errText);
    return;
  }
  const untilStr = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  await editOrReply(getText('renew_success', { untilStr }), 'HTML');
}
