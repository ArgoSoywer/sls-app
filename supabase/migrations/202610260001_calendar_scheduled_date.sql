alter table public.tasks
  add column if not exists scheduled_date date;

create index if not exists tasks_user_scheduled_date_idx
  on public.tasks (user_id, scheduled_date)
  where scheduled_date is not null;
