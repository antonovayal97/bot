# VPN-V — Production-ready MVP VPN сервис

Сервис состоит из: **Telegram Bot**, **Backend API**, **Admin Panel**, **PostgreSQL**, **Redis**.

## Структура проекта

```
/apps
  /backend   — NestJS API (Prisma, Redis, JWT, cron)
  /bot       — Telegram бот (Telegraf, webhook/polling)
  /admin     — Next.js админ-панель (Tailwind, JWT)
/packages
  /shared-types — общие типы (планы, DTO)
/docker
  Dockerfile.backend, Dockerfile.bot, Dockerfile.admin
docker-compose.yml
```

## Требования

- Node.js 20+
- PostgreSQL 16
- Redis 7

## Быстрый старт (локально)

### 1. Переменные окружения

```bash
cp .env.example .env
# Отредактируйте .env: DATABASE_URL, REDIS_URL, JWT_SECRET, ADMIN_*, BOT_API_KEY, TELEGRAM_BOT_TOKEN
```

### 2. Установка зависимостей (из корня)

```bash
npm install
```

### 3. База данных и миграции

Prisma читает `.env` из каталога `apps/backend`. Варианты:

**Вариант A — из корня (рекомендуется):**

```bash
npm run prisma:migrate
npm run prisma:seed
```

**Вариант B — из apps/backend:** положите `.env` в `apps/backend` или сделайте симлинк:

```bash
ln -sf ../../.env apps/backend/.env
cd apps/backend
npx prisma migrate deploy
npx prisma db seed
```

### 4. Сборка shared-types и backend (если ещё не собирали)

```bash
npm run build -w @vpn-v/shared-types
npm run build -w @vpn-v/backend
```

### 5. Запуск

В разных терминалах:

```bash
# PostgreSQL и Redis (или через docker-compose только эти сервисы)
docker-compose up -d postgres redis

# Backend
npm run dev:backend

# Бот (polling)
npm run dev:bot

# Админ-панель
npm run dev:admin
```

- **Backend API:** http://localhost:3000
- **Admin Panel:** http://localhost:3001
- **Логин админки:** из `ADMIN_LOGIN` / `ADMIN_PASSWORD` (по умолчанию admin/admin)

### Локальная разработка бота (если Telegram заблокирован)

Чтобы разрабатывать бота локально, нужен доступ к api.telegram.org. Два варианта:

**Вариант 1 — прокси в .env (проще всего)**

1. Запустите Tor или VPN с SOCKS5 (порт смотрите в настройках, у Tor обычно 9050).
2. В корневой `.env` добавьте:
   ```env
   TELEGRAM_PROXY=socks5://127.0.0.1:9050
   ```
   (для Tor; для VPN подставьте свой порт, например 1080).
3. Запуск бота: `npm run dev:bot`.

**Вариант 2 — локальный Bot API сервер**

Бот обращается к вашему localhost, а к Telegram ходит уже сервер (в нём один раз настраиваете прокси).

1. Поднимите [Telegram Bot API server](https://github.com/tdlib/telegram-bot-api) локально (Docker или бинарник), с прокси в его конфиге. По умолчанию слушает порт 8081.
2. В `.env` добавьте:
   ```env
   BOT_API_URL=http://127.0.0.1:8081
   ```
3. Запуск бота: `npm run dev:bot` — прокси в коде бота не нужен.

## Запуск через Docker

```bash
cp .env.example .env
# Заполните TELEGRAM_BOT_TOKEN, при необходимости JWT_SECRET, BOT_API_KEY, ADMIN_*

docker-compose up -d postgres redis
# Первый запуск: миграции и сид
docker-compose run --rm backend npx prisma migrate deploy
docker-compose run --rm backend npx prisma db seed

docker-compose up -d
```

- Backend: http://localhost:3000
- Admin: http://localhost:3001

Бот в Docker по умолчанию работает в режиме **polling**. Для webhook (рекомендуется при 1–2k+ пользователей): задайте `WEBHOOK_DOMAIN`, `WEBHOOK_PATH`, `BOT_USE_WEBHOOK=1` и настройте reverse proxy (nginx/traefik) на порт 3002.

## Функционал

### Telegram Bot

- `/start` — регистрация, выдача реферального кода, главное меню
- Статус подписки, дата окончания, активная нода
- Кнопки: **Мои конфиги**, **Продлить** (тарифы 1/3/6/12 мес)
- `/referral КОД` — применение реферального кода (бонусные дни)
- За 3 дня до окончания подписки — уведомление (cron на бэкенде + при интеграции с ботом)

### Backend

- **Модели:** User, Subscription, Node, Payment, AppSettings
- **API для бота:** регистрация, пользователь по telegram, планы/цены, реферал, конфиг, оформление подписки (MVP: авто-завершение платежа)
- **Admin API:** JWT, пользователи, подписки, ноды, платежи, настройки (процент рефералки, цены тарифов), дашборд (статистика, регистрации)
- **Cron:** раз в час — протухшие подписки в статус `expired`, сброс `subscriptionUntil` у пользователей без активной подписки

### Admin Panel

- **Dashboard:** кол-во пользователей, активные подписки, доход за месяц, график регистраций
- **Users:** таблица, фильтр по активным, поиск, переход в детали
- **User detail:** история платежей, подписок, назначенная нода, всего заплатил
- **Nodes:** список, нагрузка, вкл/выкл
- **Settings:** процент рефералки, цены тарифов

## Масштабирование (1–2k+ пользователей)

- **Throttler** — лимит Bot API 400 req/min (при необходимости увеличьте в `bot-api.module.ts`)
- **Webhook** — вместо polling: `WEBHOOK_DOMAIN`, `BOT_USE_WEBHOOK=1`, reverse proxy на порт 3002
- **PostgreSQL** — в `DATABASE_URL` добавлен `?connection_limit=20`
- **Node.maxUsers** — увеличьте слоты на нодах или добавьте ноды при росте

## Безопасность

- Admin: только JWT (логин/пароль из env)
- Bot API: заголовок `X-Bot-Api-Key` (или query `apiKey`)
- Rate limit на эндпоинты бота (Throttler)
- Валидация (class-validator) на backend
- Логирование (Winston)

## Seed

В БД создаются: настройки (реферальный % и цены), тестовая нода **Node NL**, тестовый пользователь `telegramId: 123456789` с активной подпиской на 1 месяц.

## Интеграция VPN (AmneziaVPN)

Сейчас конфиг для пользователя — заглушка (текст с нодой и комментарием «AmneziaVPN integration - coming soon»). Дальнейшие шаги: интеграция с AmneziaVPN API на бэкенде и выдача реальных конфигов через бота.
