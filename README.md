# Shchykno Telegram Mini App

Telegram Mini App на Next.js для показа купленных и доступных курсов. Источник покупок: webhook из Tilda. Источник каталога и связей пользователей: Supabase.

## Что внутри

- `POST /api/tilda-webhook?token=...` принимает `application/x-www-form-urlencoded` submit из Tilda, сохраняет raw payload и фиксирует покупку по `tranid`.
- `POST /api/telegram/bootstrap` валидирует `Telegram WebApp initData`, привязывает `session_id` к Telegram-пользователю и возвращает списки `ownedCourses` и `availableCourses`.
- `supabase/migrations/*` содержит SQL-схему для `courses`, `telegram_users`, `browser_sessions`, `tilda_submissions`.
- `supabase/seed.sql` заполняет стартовый каталог примерами курсов.
- `docs/tilda-session-bridge.js` пример скрипта для сайта/Tilda, который создает `session_id` в `localStorage` и пишет его в hidden field формы.

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TILDA_WEBHOOK_SECRET=
```

`NEXT_PUBLIC_SUPABASE_URL` используется только как URL проекта Supabase. Доступ к таблицам идет только через `SUPABASE_SERVICE_ROLE_KEY` на сервере.

## Локальный запуск

```bash
npm install
npm run dev
```

Проверки:

```bash
npm run lint
npm run typecheck
npm run build
```

## Supabase

1. Выполните `supabase/migrations/202603241120_init_shchykno_tma.sql`.
2. Выполните `supabase/seed.sql`.
3. Убедитесь, что `external_id` курса в Supabase совпадает с `externalid` товара из Tilda.

### MCP шаблон для Codex

Фактическая настройка требует ваш `project_ref` и авторизацию, поэтому в репозиторий вынесен только шаблон команды:

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>&features=database,development,docs,debugging"
codex mcp login supabase
```

## Настройка Tilda

- Tilda должна слать формы на `https://your-domain.com/api/tilda-webhook?token=<TILDA_WEBHOOK_SECRET>`.
- В форму нужно добавить hidden field `session_id`.
- В каталоге или товаре Tilda нужно передавать `externalid`, чтобы webhook мог стабильно сопоставить курс.
- Сейчас предполагается один курс на один submit. Если в одном заказе будет несколько разных курсов, схему надо расширять.

## Настройка Telegram

- Создайте бота через BotFather.
- Укажите URL Mini App на домен этого Next.js приложения.
- Открывайте приложение ссылкой вида:

```text
https://t.me/<bot_username>/<app_short_name>?startapp=<session_id>
```

При первом открытии Mini App конкретный `session_id` закрепляется за одним Telegram-аккаунтом. Повторный вход из другого аккаунта вернет конфликт и не перенесет покупки.
