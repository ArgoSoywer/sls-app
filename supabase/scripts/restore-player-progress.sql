-- One-time recovery for progress left under an old anonymous Supabase user ID.
-- Replace both NULL values below with UUIDs from Authentication > Users,
-- then run this entire script in the Supabase SQL Editor.
-- This script never deletes rows. It aborts before updating if IDs are invalid
-- or if the destination already has conflicting XP logs or daily-stat dates.

begin;

do $restore_progress$
declare
  old_user_id uuid := null; -- Set to the old anonymous auth.users.id
  new_user_id uuid := null; -- Set to the current account auth.users.id
  moved_tasks integer;
  moved_xp_logs integer;
  moved_daily_stats integer;
begin
  if old_user_id is null or new_user_id is null then
    raise exception 'Set old_user_id and new_user_id in supabase/scripts/restore-player-progress.sql before running it.';
  end if;

  if old_user_id = new_user_id then
    raise exception 'The old and new user IDs are identical; no ownership change is needed.';
  end if;

  if not exists (select 1 from auth.users where id = old_user_id) then
    raise exception 'Old auth user % does not exist in this Supabase project.', old_user_id;
  end if;

  if not exists (select 1 from auth.users where id = new_user_id) then
    raise exception 'New auth user % does not exist in this Supabase project.', new_user_id;
  end if;

  if not exists (select 1 from public.users where id = old_user_id) then
    raise exception 'Old player profile % does not exist.', old_user_id;
  end if;

  if not exists (select 1 from public.users where id = new_user_id) then
    raise exception 'New player profile % does not exist.', new_user_id;
  end if;

  if exists (
    select 1
    from public.xp_logs old_log
    join public.xp_logs new_log using (idempotency_key)
    where old_log.user_id = old_user_id
      and new_log.user_id = new_user_id
  ) then
    raise exception 'Both profiles contain an XP log with the same idempotency key. No rows were changed; review those logs before retrying.';
  end if;

  if exists (
    select 1
    from public.daily_stats old_stats
    join public.daily_stats new_stats using (local_date)
    where old_stats.user_id = old_user_id
      and new_stats.user_id = new_user_id
  ) then
    raise exception 'Both profiles have daily stats for at least one same date. No rows were changed; reconcile those stats before retrying.';
  end if;

  update public.tasks
  set user_id = new_user_id
  where user_id = old_user_id;
  get diagnostics moved_tasks = row_count;

  update public.xp_logs
  set user_id = new_user_id
  where user_id = old_user_id;
  get diagnostics moved_xp_logs = row_count;

  update public.daily_stats
  set user_id = new_user_id
  where user_id = old_user_id;
  get diagnostics moved_daily_stats = row_count;

  raise notice 'Progress ownership updated: % tasks, % XP logs, % daily-stat rows moved from % to %.',
    moved_tasks, moved_xp_logs, moved_daily_stats, old_user_id, new_user_id;
end;
$restore_progress$;

commit;
