-- Run this entire file in Supabase Dashboard > SQL Editor.
-- The existing public.tasks table is expected to contain:
-- id, user_id, title, status, reminders (JSONB array with {id, at}).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their push subscriptions" on public.push_subscriptions;
create policy "Users can view their push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their push subscriptions" on public.push_subscriptions;
create policy "Users can add their push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.push_delivery_log (
  task_id text not null,
  reminder_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1,
  locked_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  primary key (task_id, reminder_id)
);

alter table public.push_delivery_log enable row level security;
-- No client policies: only the server's service-role key may access the delivery log.
revoke all on public.push_delivery_log from anon, authenticated;
grant all on public.push_delivery_log to service_role;

create or replace function public.claim_due_push_reminders()
returns table (
  task_id text,
  reminder_id text,
  user_id uuid,
  task_title text,
  scheduled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due_rows as (
    select
      t.id::text as task_id,
      t.user_id as user_id,
      t.title::text as task_title,
      r.item ->> 'id' as reminder_id,
      ((r.item ->> 'at')::timestamp without time zone at time zone 'UTC') as scheduled_at
    from public.tasks t
    cross join lateral jsonb_array_elements(coalesce(t.reminders::jsonb, '[]'::jsonb)) as r(item)
    where t.status <> 'done'
      and coalesce(r.item ->> 'id', '') <> ''
      and coalesce(r.item ->> 'at', '') <> ''
      and ((r.item ->> 'at')::timestamp without time zone at time zone 'UTC') <= now()
  ),
  claimed as (
    insert into public.push_delivery_log as log
      (task_id, reminder_id, user_id, scheduled_at, status, attempts, locked_at, last_error)
    select d.task_id, d.reminder_id, d.user_id, d.scheduled_at, 'processing', 1, now(), null
    from due_rows d
    on conflict (task_id, reminder_id) do update
      set status = 'processing',
          attempts = log.attempts + 1,
          locked_at = now(),
          scheduled_at = excluded.scheduled_at,
          last_error = null
      where log.attempts < 5
        and (
          log.status = 'failed'
          or (log.status = 'processing' and log.locked_at < now() - interval '5 minutes')
        )
    returning log.task_id, log.reminder_id, log.user_id, log.scheduled_at
  )
  select c.task_id, c.reminder_id, c.user_id, d.task_title, c.scheduled_at
  from claimed c
  join due_rows d
    on d.task_id = c.task_id and d.reminder_id = c.reminder_id;
end;
$$;

revoke all on function public.claim_due_push_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_push_reminders() to service_role;
