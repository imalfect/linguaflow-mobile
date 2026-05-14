-- =============================================================================
-- Linguaflow mobile schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  learning_language text not null default 'en',
  english_accent text default 'us',
  detected_level text not null default 'A1',
  total_xp int not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_activity_date date,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- modules + module_tasks (10 tasks per module)
-- ---------------------------------------------------------------------------
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_code text not null,
  level text not null default 'A1',
  topic text not null,
  title text not null,
  description text not null,
  emoji text not null default '📚',
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_task_index int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index modules_user_active_idx on public.modules (user_id, status, created_at desc);

create table public.module_tasks (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  task_index int not null check (task_index between 0 and 9),
  kind text not null check (kind in ('vocabulary', 'phrase', 'free_speech')),
  title text not null,
  prompt text not null,
  target_sentence text not null,
  translation text not null,
  ipa text,
  reading text,
  vocabulary jsonb,
  completed boolean not null default false,
  best_accuracy float,
  attempts int not null default 0,
  completed_at timestamptz,
  unique (module_id, task_index)
);

create index module_tasks_module_idx on public.module_tasks (module_id, task_index);

-- ---------------------------------------------------------------------------
-- pronunciation_sessions (per-attempt history for analytics + replay)
-- ---------------------------------------------------------------------------
create table public.pronunciation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_task_id uuid references public.module_tasks (id) on delete set null,
  language_code text not null,
  target_sentence text not null,
  transcript text,
  accuracy_score float,
  fluency_score float,
  completeness_score float,
  prosody_score float,
  word_data jsonb,
  ai_tips jsonb,
  xp_earned int not null default 0,
  created_at timestamptz not null default now()
);

create index pronunciation_sessions_user_idx on public.pronunciation_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- level_test_results (allow anonymous + authenticated)
-- ---------------------------------------------------------------------------
create table public.level_test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  session_token text,
  language_code text not null,
  detected_level text not null,
  score_breakdown jsonb,
  summary text,
  focus_areas jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on profile changes
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Award XP + maintain streak. Called from clients via RPC; runs as definer.
create or replace function public.award_xp(p_user_id uuid, p_xp int)
returns table (total_xp int, current_streak int, longest_streak int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
  v_today date := (now() at time zone 'UTC')::date;
  v_new_streak int;
  v_new_longest int;
begin
  select last_activity_date, current_streak, longest_streak
    into v_last, v_new_streak, v_new_longest
  from public.profiles where id = p_user_id;

  if v_last is null or v_last < v_today - interval '1 day' then
    v_new_streak := 1;
  elsif v_last = v_today - interval '1 day' then
    v_new_streak := v_new_streak + 1;
  end if;
  v_new_longest := greatest(v_new_longest, v_new_streak);

  update public.profiles
    set total_xp = total_xp + p_xp,
        current_streak = v_new_streak,
        longest_streak = v_new_longest,
        last_activity_date = v_today
    where id = p_user_id
  returning total_xp, current_streak, longest_streak
    into total_xp, current_streak, longest_streak;
  return next;
end;
$$;

grant execute on function public.award_xp(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.module_tasks enable row level security;
alter table public.pronunciation_sessions enable row level security;
alter table public.level_test_results enable row level security;

create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);
create policy "insert_own_profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id);

create policy "select_own_modules" on public.modules
  for select using (auth.uid() = user_id);
create policy "modify_own_modules" on public.modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "select_own_module_tasks" on public.module_tasks
  for select using (
    exists (select 1 from public.modules m where m.id = module_id and m.user_id = auth.uid())
  );
create policy "modify_own_module_tasks" on public.module_tasks
  for all using (
    exists (select 1 from public.modules m where m.id = module_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.modules m where m.id = module_id and m.user_id = auth.uid())
  );

create policy "select_own_pronunciation" on public.pronunciation_sessions
  for select using (auth.uid() = user_id);
create policy "insert_own_pronunciation" on public.pronunciation_sessions
  for insert with check (auth.uid() = user_id);

create policy "level_test_anon_insert" on public.level_test_results
  for insert with check (true);
create policy "level_test_select_own_or_anon" on public.level_test_results
  for select using (user_id is null or auth.uid() = user_id);
