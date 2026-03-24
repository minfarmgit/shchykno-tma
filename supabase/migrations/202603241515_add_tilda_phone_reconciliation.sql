alter table public.tilda_submissions
  add column if not exists normalized_phone_number text;

create index if not exists idx_tilda_submissions_normalized_phone_number
  on public.tilda_submissions(normalized_phone_number);

update public.telegram_users
set phone_number = regexp_replace(phone_number, '\D', '', 'g')
where phone_number is not null;

update public.tilda_submissions
set normalized_phone_number = nullif(
  regexp_replace(
    coalesce(
      raw_payload->>'Phone',
      raw_payload->>'phone',
      raw_payload->>'phone_number',
      raw_payload->>'phonenumber',
      raw_payload->>'Телефон'
    ),
    '\D',
    '',
    'g'
  ),
  ''
)
where normalized_phone_number is null;
