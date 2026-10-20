create extension if not exists pg_cron;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  path text not null check (path in ('profession', 'academics', 'survival', 'mentality', 'family')),
  category text not null check (category in ('everyday', 'challenge', 'planned')),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  xp_value integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_category_xp_check check (
    (category = 'everyday' and xp_value = 10)
    or (category = 'challenge' and xp_value = 30)
    or (category = 'planned' and xp_value = 50)
  )
);

create index if not exists tasks_user_path_active_idx
  on public.tasks (user_id, path, is_active);

create table if not exists public.xp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  task_category text not null check (task_category in ('everyday', 'challenge', 'planned')),
  xp_delta integer not null check (xp_delta > 0),
  local_date date not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint xp_logs_user_idempotency_unique unique (user_id, idempotency_key)
);

create unique index if not exists xp_logs_everyday_once_per_day_idx
  on public.xp_logs (user_id, task_id, local_date)
  where task_category = 'everyday';
create unique index if not exists xp_logs_one_time_task_idx
  on public.xp_logs (user_id, task_id)
  where task_category in ('challenge', 'planned');
create index if not exists xp_logs_user_date_idx
  on public.xp_logs (user_id, local_date);

create table if not exists public.daily_stats (
  user_id uuid not null references public.users (id) on delete cascade,
  local_date date not null,
  xp_total integer not null default 0 check (xp_total >= 0),
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, timezone)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''), 'UTC')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sls on auth.users;
create trigger on_auth_user_created_sls
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.xp_logs enable row level security;
alter table public.daily_stats enable row level security;

drop policy if exists "profile owner reads profile" on public.users;
create policy "profile owner reads profile" on public.users
for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profile owner updates profile" on public.users;
create policy "profile owner updates profile" on public.users
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "owner manages tasks" on public.tasks;
create policy "owner manages tasks" on public.tasks
for all to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "owner reads xp logs" on public.xp_logs;
create policy "owner reads xp logs" on public.xp_logs
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "owner reads daily stats" on public.daily_stats;
create policy "owner reads daily stats" on public.daily_stats
for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.complete_task(
  p_task_id uuid,
  p_idempotency_key uuid,
  p_local_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_local_date date;
  v_task public.tasks%rowtype;
  v_log public.xp_logs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to complete a task.';
  end if;

  select * into v_log
  from public.xp_logs
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'xp', v_log.xp_delta,
      'local_date', v_log.local_date,
      'log_id', v_log.id
    );
  end if;

  select timezone into v_timezone
  from public.users where id = v_user_id;
  if not found then
    raise exception 'Player profile was not found.';
  end if;

  begin
    v_local_date := timezone(v_timezone, now())::date;
  exception when invalid_parameter_value then
    raise exception 'The saved profile timezone is invalid: %.', v_timezone;
  end;
  if p_local_date is null or p_local_date > v_local_date then
    raise exception 'Completion date cannot be in the future.';
  end if;
  v_local_date := p_local_date;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = v_user_id and is_active
  for update;
  if not found then
    raise exception 'Task was not found or is inactive.';
  end if;

  select * into v_log
  from public.xp_logs
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'xp', v_log.xp_delta,
      'local_date', v_log.local_date,
      'log_id', v_log.id
    );
  end if;

  if (v_task.category = 'everyday' and v_task.xp_value <> 10)
    or (v_task.category = 'challenge' and v_task.xp_value <> 30)
    or (v_task.category = 'planned' and v_task.xp_value <> 50) then
    raise exception 'Task category and XP value do not match.';
  end if;

  if v_task.category = 'everyday' and exists (
    select 1 from public.xp_logs
    where user_id = v_user_id
      and task_id = p_task_id
      and task_category = 'everyday'
      and local_date = v_local_date
  ) then
    raise exception 'This Everyday task has already been completed today.';
  elsif v_task.category in ('challenge', 'planned') and exists (
    select 1 from public.xp_logs
    where user_id = v_user_id
      and task_id = p_task_id
      and task_category in ('challenge', 'planned')
  ) then
    raise exception 'This task has already been completed.';
  end if;

  insert into public.xp_logs (
    user_id, task_id, task_category, xp_delta, local_date, idempotency_key
  ) values (
    v_user_id, v_task.id, v_task.category, v_task.xp_value, v_local_date, p_idempotency_key
  ) returning * into v_log;

  insert into public.daily_stats (user_id, local_date, xp_total, tasks_completed)
  values (v_user_id, v_local_date, v_task.xp_value, 1)
  on conflict (user_id, local_date) do update
  set xp_total = public.daily_stats.xp_total + excluded.xp_total,
      tasks_completed = public.daily_stats.tasks_completed + 1,
      updated_at = now();

  return jsonb_build_object(
    'duplicate', false,
    'xp', v_log.xp_delta,
    'local_date', v_log.local_date,
    'log_id', v_log.id
  );
end;
$$;

revoke all on function public.complete_task(uuid, uuid, date) from public;
grant execute on function public.complete_task(uuid, uuid, date) to authenticated;

create or replace function public.reconcile_local_midnight()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_local_now timestamp;
  v_previous_date date;
begin
  for v_profile in
    select id, timezone from public.users
  loop
    begin
      v_local_now := timezone(v_profile.timezone, now());
    exception when invalid_parameter_value then
      continue;
    end;

    if date_trunc('minute', v_local_now)::time = time '00:00' then
      v_previous_date := v_local_now::date - 1;
      insert into public.daily_stats (user_id, local_date, xp_total, tasks_completed)
      select
        v_profile.id,
        v_previous_date,
        coalesce(sum(xp_delta), 0)::integer,
        count(*)::integer
      from public.xp_logs
      where user_id = v_profile.id and local_date = v_previous_date
      on conflict (user_id, local_date) do update
      set xp_total = excluded.xp_total,
          tasks_completed = excluded.tasks_completed,
          updated_at = now();
    end if;
  end loop;
end;
$$;

revoke all on function public.reconcile_local_midnight() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'sls-local-midnight-reconcile';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'sls-local-midnight-reconcile',
    '* * * * *',
    'select public.reconcile_local_midnight();'
  );
end;
$$;
