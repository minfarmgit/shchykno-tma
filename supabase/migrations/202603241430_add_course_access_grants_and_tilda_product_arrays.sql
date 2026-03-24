alter table public.courses
  add column if not exists tilda_product_name text;

create unique index if not exists idx_courses_tilda_product_name
  on public.courses(tilda_product_name)
  where tilda_product_name is not null;

create table if not exists public.course_access_grants (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint,
  session_id text references public.browser_sessions(session_id) on delete cascade,
  course_external_id text not null references public.courses(external_id) on delete cascade,
  source text not null check (source in ('tilda', 'manual', 'admin')),
  tilda_tranid text,
  product_name text,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_access_grants_subject_check check (
    telegram_user_id is not null or session_id is not null
  ),
  constraint course_access_grants_session_course_key unique (session_id, course_external_id),
  constraint course_access_grants_telegram_course_key unique (telegram_user_id, course_external_id)
);

create index if not exists idx_course_access_grants_telegram_user_id
  on public.course_access_grants(telegram_user_id);

create index if not exists idx_course_access_grants_session_id
  on public.course_access_grants(session_id);

create index if not exists idx_course_access_grants_course_external_id
  on public.course_access_grants(course_external_id);

alter table public.tilda_submissions
  alter column session_id drop not null;

alter table public.tilda_submissions
  alter column course_external_id drop not null;

alter table public.tilda_submissions
  add column if not exists product_names text[] not null default '{}'::text[];

alter table public.tilda_submissions
  add column if not exists matched_course_external_ids text[] not null default '{}'::text[];
