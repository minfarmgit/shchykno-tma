insert into public.courses (
  external_id,
  title,
  subtitle,
  cover_image_url,
  buy_url,
  access_url,
  is_published,
  sort_order
)
values
  (
    'base-home',
    'Курс Дом',
    'Тренировки для дома и питание',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    'https://shchykno.com/base-home',
    'https://t.me/+example-home-course',
    true,
    10
  ),
  (
    'base-gym',
    'Курс Зал',
    'Тренировки для зала и питание',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80',
    'https://shchykno.com/base-gym',
    'https://t.me/+example-gym-course',
    true,
    20
  )
on conflict (external_id) do update
set
  title = excluded.title,
  subtitle = excluded.subtitle,
  cover_image_url = excluded.cover_image_url,
  buy_url = excluded.buy_url,
  access_url = excluded.access_url,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  updated_at = now();
