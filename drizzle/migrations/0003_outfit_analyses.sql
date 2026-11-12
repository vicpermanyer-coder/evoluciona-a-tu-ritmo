create table public.outfit_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  occasion text check (occasion is null or char_length(occasion) <= 300),
  status text not null default 'analyzing' check (status in ('analyzing','completed','failed')),
  summary text,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  error_message text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfit_analyses_path_owner check (split_part(storage_path, '/', 1) = user_id::text)
);
create index outfit_analyses_user_created_idx on public.outfit_analyses (user_id, created_at desc);

-- Users may read and delete their own analyses. Results are written only by the server
-- after verifying the photo belongs to the caller, so they cannot be forged from the browser.
grant select, delete on public.outfit_analyses to authenticated;
grant all on public.outfit_analyses to service_role;
alter table public.outfit_analyses enable row level security;
create policy "own outfit analyses select" on public.outfit_analyses for select to authenticated using (auth.uid() = user_id);
create policy "own outfit analyses delete" on public.outfit_analyses for delete to authenticated using (auth.uid() = user_id);