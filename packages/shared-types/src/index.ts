// Countries for VPN nodes (user can choose country when selecting VPN)
// ISO 3166-1 alpha-2 codes + русские названия
export const VPN_COUNTRIES: { code: string; name: string }[] = [
  // Европа
  { code: 'AL', name: 'Албания' },
  { code: 'AD', name: 'Андорра' },
  { code: 'AT', name: 'Австрия' },
  { code: 'BY', name: 'Беларусь' },
  { code: 'BE', name: 'Бельгия' },
  { code: 'BA', name: 'Босния и Герцеговина' },
  { code: 'BG', name: 'Болгария' },
  { code: 'HR', name: 'Хорватия' },
  { code: 'CY', name: 'Кипр' },
  { code: 'CZ', name: 'Чехия' },
  { code: 'DK', name: 'Дания' },
  { code: 'EE', name: 'Эстония' },
  { code: 'FI', name: 'Финляндия' },
  { code: 'FR', name: 'Франция' },
  { code: 'DE', name: 'Германия' },
  { code: 'GR', name: 'Греция' },
  { code: 'HU', name: 'Венгрия' },
  { code: 'IS', name: 'Исландия' },
  { code: 'IE', name: 'Ирландия' },
  { code: 'IT', name: 'Италия' },
  { code: 'LV', name: 'Латвия' },
  { code: 'LI', name: 'Лихтенштейн' },
  { code: 'LT', name: 'Литва' },
  { code: 'LU', name: 'Люксембург' },
  { code: 'MT', name: 'Мальта' },
  { code: 'MD', name: 'Молдова' },
  { code: 'MC', name: 'Монако' },
  { code: 'ME', name: 'Черногория' },
  { code: 'NL', name: 'Нидерланды' },
  { code: 'MK', name: 'Северная Македония' },
  { code: 'NO', name: 'Норвегия' },
  { code: 'PL', name: 'Польша' },
  { code: 'PT', name: 'Португалия' },
  { code: 'RO', name: 'Румыния' },
  { code: 'RU', name: 'Россия' },
  { code: 'SM', name: 'Сан-Марино' },
  { code: 'RS', name: 'Сербия' },
  { code: 'SK', name: 'Словакия' },
  { code: 'SI', name: 'Словения' },
  { code: 'ES', name: 'Испания' },
  { code: 'SE', name: 'Швеция' },
  { code: 'CH', name: 'Швейцария' },
  { code: 'TR', name: 'Турция' },
  { code: 'UA', name: 'Украина' },
  { code: 'GB', name: 'Великобритания' },
  { code: 'VA', name: 'Ватикан' },

  // Северная Америка
  { code: 'US', name: 'США' },
  { code: 'CA', name: 'Канада' },
  { code: 'MX', name: 'Мексика' },

  // Центральная и Южная Америка
  { code: 'AR', name: 'Аргентина' },
  { code: 'BO', name: 'Боливия' },
  { code: 'BR', name: 'Бразилия' },
  { code: 'CL', name: 'Чили' },
  { code: 'CO', name: 'Колумбия' },
  { code: 'CR', name: 'Коста-Рика' },
  { code: 'CU', name: 'Куба' },
  { code: 'DO', name: 'Доминиканская Республика' },
  { code: 'EC', name: 'Эквадор' },
  { code: 'SV', name: 'Сальвадор' },
  { code: 'GT', name: 'Гватемала' },
  { code: 'HN', name: 'Гондурас' },
  { code: 'JM', name: 'Ямайка' },
  { code: 'NI', name: 'Никарагуа' },
  { code: 'PA', name: 'Панама' },
  { code: 'PY', name: 'Парагвай' },
  { code: 'PE', name: 'Перу' },
  { code: 'UY', name: 'Уругвай' },
  { code: 'VE', name: 'Венесуэла' },

  // Азия
  { code: 'AF', name: 'Афганистан' },
  { code: 'AM', name: 'Армения' },
  { code: 'AZ', name: 'Азербайджан' },
  { code: 'BH', name: 'Бахрейн' },
  { code: 'BD', name: 'Бангладеш' },
  { code: 'BT', name: 'Бутан' },
  { code: 'BN', name: 'Бруней' },
  { code: 'KH', name: 'Камбоджа' },
  { code: 'CN', name: 'Китай' },
  { code: 'GE', name: 'Грузия' },
  { code: 'HK', name: 'Гонконг' },
  { code: 'IN', name: 'Индия' },
  { code: 'ID', name: 'Индонезия' },
  { code: 'IR', name: 'Иран' },
  { code: 'IQ', name: 'Ирак' },
  { code: 'IL', name: 'Израиль' },
  { code: 'JP', name: 'Япония' },
  { code: 'JO', name: 'Иордания' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'KW', name: 'Кувейт' },
  { code: 'KG', name: 'Киргизия' },
  { code: 'LA', name: 'Лаос' },
  { code: 'LB', name: 'Ливан' },
  { code: 'MY', name: 'Малайзия' },
  { code: 'MV', name: 'Мальдивы' },
  { code: 'MN', name: 'Монголия' },
  { code: 'MM', name: 'Мьянма' },
  { code: 'NP', name: 'Непал' },
  { code: 'PK', name: 'Пакистан' },
  { code: 'PH', name: 'Филиппины' },
  { code: 'QA', name: 'Катар' },
  { code: 'SA', name: 'Саудовская Аравия' },
  { code: 'SG', name: 'Сингапур' },
  { code: 'KR', name: 'Южная Корея' },
  { code: 'LK', name: 'Шри-Ланка' },
  { code: 'SY', name: 'Сирия' },
  { code: 'TW', name: 'Тайвань' },
  { code: 'TJ', name: 'Таджикистан' },
  { code: 'TH', name: 'Таиланд' },
  { code: 'TM', name: 'Туркменистан' },
  { code: 'AE', name: 'ОАЭ' },
  { code: 'UZ', name: 'Узбекистан' },
  { code: 'VN', name: 'Вьетнам' },
  { code: 'YE', name: 'Йемен' },

  // Африка
  { code: 'DZ', name: 'Алжир' },
  { code: 'AO', name: 'Ангола' },
  { code: 'BJ', name: 'Бенин' },
  { code: 'BW', name: 'Ботсвана' },
  { code: 'BF', name: 'Буркина-Фасо' },
  { code: 'BI', name: 'Бурунди' },
  { code: 'CM', name: 'Камерун' },
  { code: 'CV', name: 'Кабо-Верде' },
  { code: 'CF', name: 'ЦАР' },
  { code: 'TD', name: 'Чад' },
  { code: 'KM', name: 'Коморы' },
  { code: 'CG', name: 'Конго' },
  { code: 'CD', name: 'ДР Конго' },
  { code: 'CI', name: 'Кот-д’Ивуар' },
  { code: 'DJ', name: 'Джибути' },
  { code: 'EG', name: 'Египет' },
  { code: 'ER', name: 'Эритрея' },
  { code: 'ET', name: 'Эфиопия' },
  { code: 'GA', name: 'Габон' },
  { code: 'GM', name: 'Гамбия' },
  { code: 'GH', name: 'Гана' },
  { code: 'GN', name: 'Гвинея' },
  { code: 'GW', name: 'Гвинея-Бисау' },
  { code: 'KE', name: 'Кения' },
  { code: 'LS', name: 'Лесото' },
  { code: 'LR', name: 'Либерия' },
  { code: 'LY', name: 'Ливия' },
  { code: 'MG', name: 'Мадагаскар' },
  { code: 'MW', name: 'Малави' },
  { code: 'ML', name: 'Мали' },
  { code: 'MR', name: 'Мавритания' },
  { code: 'MU', name: 'Маврикий' },
  { code: 'MA', name: 'Марокко' },
  { code: 'MZ', name: 'Мозамбик' },
  { code: 'NA', name: 'Намибия' },
  { code: 'NE', name: 'Нигер' },
  { code: 'NG', name: 'Нигерия' },
  { code: 'RW', name: 'Руанда' },
  { code: 'ST', name: 'Сан-Томе и Принсипи' },
  { code: 'SN', name: 'Сенегал' },
  { code: 'SC', name: 'Сейшелы' },
  { code: 'SL', name: 'Сьерра-Леоне' },
  { code: 'SO', name: 'Сомали' },
  { code: 'ZA', name: 'ЮАР' },
  { code: 'SS', name: 'Южный Судан' },
  { code: 'SD', name: 'Судан' },
  { code: 'SZ', name: 'Эсватини' },
  { code: 'TZ', name: 'Танзания' },
  { code: 'TG', name: 'Того' },
  { code: 'TN', name: 'Тунис' },
  { code: 'UG', name: 'Уганда' },
  { code: 'ZM', name: 'Замбия' },
  { code: 'ZW', name: 'Зимбабве' },

  // Океания
  { code: 'AU', name: 'Австралия' },
  { code: 'NZ', name: 'Новая Зеландия' },
  { code: 'FJ', name: 'Фиджи' },
  { code: 'PG', name: 'Папуа — Новая Гвинея' },
  { code: 'WS', name: 'Самоа' },
  { code: 'TO', name: 'Тонга' },
  { code: 'SB', name: 'Соломоновы Острова' },
  { code: 'VU', name: 'Вануату' },
];

export function getCountryName(code: string): string {
  if (code == null || code === '') return '';
  return VPN_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// Subscription plans
export type SubscriptionPlan = '3d' | '1m' | '3m' | '6m' | '12m';

export const SUBSCRIPTION_PLAN_DAYS: Record<SubscriptionPlan, number> = {
  '3d': 3,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '12m': 365,
};

// Subscription status
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

// Payment status
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// API responses
export interface UserDto {
  id: string;
  telegramId: string;
  username: string | null;
  subscriptionUntil: Date | null;
  isActive: boolean;
  referralCode: string;
  referredBy: string | null;
  balance: number;
  createdAt: Date;
}

export interface SubscriptionDto {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  price: number;
  startedAt: Date;
  expiresAt: Date;
  status: SubscriptionStatus;
}

export interface NodeDto {
  id: string;
  name: string;
  country: string;
  ip: string;
  isActive: boolean;
  loadPercent: number;
}

export interface PaymentDto {
  id: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
}

// Settings
export interface AppSettingsDto {
  referralPercent: number;
  planPrices: Record<SubscriptionPlan, number>;
}
