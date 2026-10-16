create table if not exists public.periodic_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  message text not null check (length(trim(message)) > 0),
  schedule_type text not null check (schedule_type in ('interval', 'daily')),
  interval_minutes integer,
  daily_time time without time zone,
  timezone text not null default 'Asia/Tehran',
  next_run_at timestamptz not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint periodic_reminders_schedule_check check (
    (schedule_type = 'interval' and interval_minutes between 1 and 525600 and daily_time is null)
    or
    (schedule_type = 'daily' and interval_minutes is null and daily_time is not null)
  )
);

create index if not exists periodic_reminders_due_idx
  on public.periodic_reminders (enabled, next_run_at);
create index if not exists periodic_reminders_user_idx
  on public.periodic_reminders (user_id, created_at desc);

alter table public.periodic_reminders enable row level security;

drop policy if exists "Users can read their periodic reminders" on public.periodic_reminders;
create policy "Users can read their periodic reminders"
  on public.periodic_reminders for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their periodic reminders" on public.periodic_reminders;
create policy "Users can create their periodic reminders"
  on public.periodic_reminders for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their periodic reminders" on public.periodic_reminders;
create policy "Users can update their periodic reminders"
  on public.periodic_reminders for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their periodic reminders" on public.periodic_reminders;
create policy "Users can delete their periodic reminders"
  on public.periodic_reminders for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.periodic_reminders to authenticated;
grant select, insert, update, delete on public.periodic_reminders to service_role;
