create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, (subscription->>'endpoint'))
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.sent_push_reminders (
  id bigint generated always as identity primary key,
  marker text not null unique,
  task_id text not null,
  reminder_id text not null,
  sent_at timestamptz not null default now()
);
alter table public.sent_push_reminders enable row level security;
-- Only the service role used by the scheduled function can access this table.
