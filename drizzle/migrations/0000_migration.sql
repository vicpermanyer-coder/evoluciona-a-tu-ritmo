
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  intensity text not null default 'media' check (intensity in ('suave','media','intensa')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile delete" on public.profiles for delete to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null check (goal in ('fitness','nutricion','estilo','confianza','habitos')),
  created_at timestamptz not null default now(),
  unique (user_id, goal)
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null,
  template_key text not null,
  title text not null,
  description text not null,
  category text not null,
  xp integer not null check (xp > 0 and xp <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date, template_key)
);
grant select, insert, delete on public.daily_challenges to authenticated;
grant all on public.daily_challenges to service_role;
alter table public.daily_challenges enable row level security;
create policy "own challenges select" on public.daily_challenges for select to authenticated using (auth.uid() = user_id);
create policy "own challenges insert" on public.daily_challenges for insert to authenticated with check (auth.uid() = user_id);
create policy "own challenges delete" on public.daily_challenges for delete to authenticated using (auth.uid() = user_id);

create table public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null unique references public.daily_challenges(id) on delete cascade,
  completed_date date not null,
  created_at timestamptz not null default now()
);
grant select on public.challenge_completions to authenticated;
grant all on public.challenge_completions to service_role;
alter table public.challenge_completions enable row level security;
create policy "own completions select" on public.challenge_completions for select to authenticated using (auth.uid() = user_id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.habits to authenticated;
grant all on public.habits to service_role;
alter table public.habits enable row level security;
create policy "own habits" on public.habits for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
grant select, delete on public.habit_logs to authenticated;
grant all on public.habit_logs to service_role;
alter table public.habit_logs enable row level security;
create policy "own logs select" on public.habit_logs for select to authenticated using (auth.uid() = user_id);
create policy "own logs delete" on public.habit_logs for delete to authenticated using (auth.uid() = user_id);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('challenge','habit')),
  source_id uuid not null,
  amount integer not null check (amount > 0),
  event_date date not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);
grant select on public.xp_events to authenticated;
grant all on public.xp_events to service_role;
alter table public.xp_events enable row level security;
create policy "own xp select" on public.xp_events for select to authenticated using (auth.uid() = user_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "own convs" on public.conversations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "own msgs select" on public.messages for select to authenticated using (auth.uid() = user_id);
create policy "own msgs insert" on public.messages for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "own msgs delete" on public.messages for delete to authenticated using (auth.uid() = user_id);

create table public.image_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('outfit','comida','ejercicio')),
  storage_path text not null,
  analysis_status text not null default 'pendiente',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.image_uploads to authenticated;
grant all on public.image_uploads to service_role;
alter table public.image_uploads enable row level security;
create policy "own uploads" on public.image_uploads for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- XP-awarding RPCs (only path to write completions / logs / xp)
create or replace function public.complete_challenge(p_challenge_id uuid, p_local_date date)
returns json language plpgsql security definer set search_path = public as $$
declare c public.daily_challenges; inserted int;
begin
  select * into c from public.daily_challenges where id = p_challenge_id and user_id = auth.uid();
  if not found then raise exception 'Reto no encontrado'; end if;
  if c.challenge_date <> p_local_date then raise exception 'Este reto no es de hoy'; end if;
  insert into public.challenge_completions (user_id, challenge_id, completed_date)
    values (auth.uid(), c.id, p_local_date) on conflict (challenge_id) do nothing;
  get diagnostics inserted = row_count;
  insert into public.xp_events (user_id, source_type, source_id, amount, event_date)
    values (auth.uid(), 'challenge', c.id, c.xp, p_local_date) on conflict (source_type, source_id) do nothing;
  return json_build_object('awarded', inserted > 0, 'xp', c.xp);
end; $$;

create or replace function public.toggle_habit(p_habit_id uuid, p_local_date date)
returns json language plpgsql security definer set search_path = public as $$
declare log_id uuid;
begin
  if not exists (select 1 from public.habits where id = p_habit_id and user_id = auth.uid()) then
    raise exception 'Hábito no encontrado'; end if;
  if p_local_date > current_date + 1 or p_local_date < current_date - 1 then
    raise exception 'Fecha no válida'; end if;
  select id into log_id from public.habit_logs where habit_id = p_habit_id and log_date = p_local_date;
  if log_id is not null then
    delete from public.habit_logs where id = log_id;
    return json_build_object('checked', false);
  end if;
  insert into public.habit_logs (user_id, habit_id, log_date) values (auth.uid(), p_habit_id, p_local_date) returning id into log_id;
  -- XP once per habit per day: source id derived deterministically
  insert into public.xp_events (user_id, source_type, source_id, amount, event_date)
    values (auth.uid(), 'habit', md5(p_habit_id::text || p_local_date::text)::uuid, 5, p_local_date)
    on conflict (source_type, source_id) do nothing;
  return json_build_object('checked', true);
end; $$;

revoke all on function public.complete_challenge(uuid, date) from public, anon;
revoke all on function public.toggle_habit(uuid, date) from public, anon;
grant execute on function public.complete_challenge(uuid, date) to authenticated;
grant execute on function public.toggle_habit(uuid, date) to authenticated;
