alter table public.telegram_users
  add column if not exists phone_number text,
  add column if not exists phone_number_confirmed_at timestamptz;

create index if not exists idx_telegram_users_phone_number
  on public.telegram_users(phone_number);
