create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  subtitle text,
  cover_image_url text,
  buy_url text not null,
  access_url text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  first_name text not null,
  last_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.browser_sessions (
  session_id text primary key,
  telegram_user_id uuid references public.telegram_users(id) on delete set null,
  bound_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tilda_submissions (
  id uuid primary key default gen_random_uuid(),
  tranid text not null unique,
  formid text,
  session_id text not null references public.browser_sessions(session_id) on delete cascade,
  course_external_id text not null,
  course_title text,
  raw_payload jsonb not null,
  match_status text not null check (match_status in ('matched', 'unmatched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courses_sort_order on public.courses(sort_order);
create index if not exists idx_browser_sessions_telegram_user_id on public.browser_sessions(telegram_user_id);
create index if not exists idx_tilda_submissions_session_id on public.tilda_submissions(session_id);
create index if not exists idx_tilda_submissions_course_external_id on public.tilda_submissions(course_external_id);
create index if not exists idx_tilda_submissions_match_status on public.tilda_submissions(match_status);
