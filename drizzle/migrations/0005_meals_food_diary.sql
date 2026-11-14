create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_type text not null check (meal_type in ('desayuno','almuerzo','comida','merienda','cena','otro')),
  eaten_at timestamptz not null,
  local_date date not null,
  storage_path text unique,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total_kcal numeric(8,1) not null default 0 check (total_kcal >= 0),
  total_protein numeric(7,1) not null default 0 check (total_protein >= 0),
  total_carbs numeric(7,1) not null default 0 check (total_carbs >= 0),
  total_fat numeric(7,1) not null default 0 check (total_fat >= 0),
  kcal_low numeric(8,1) not null default 0 check (kcal_low >= 0),
  kcal_high numeric(8,1) not null default 0 check (kcal_high >= 0),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  ai_model text,
  created_at timestamptz not null default now(),
  constraint meals_path_owner check (storage_path is null or split_part(storage_path, '/', 1) = user_id::text)
);
create index meals_user_date_idx on public.meals (user_id, local_date desc, eaten_at desc);

grant select, insert, delete on public.meals to authenticated;
grant all on public.meals to service_role;
alter table public.meals enable row level security;
create policy "own meals select" on public.meals for select to authenticated using (auth.uid() = user_id);
create policy "own meals insert" on public.meals for insert to authenticated with check (auth.uid() = user_id);
create policy "own meals delete" on public.meals for delete to authenticated using (auth.uid() = user_id);