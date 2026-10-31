alter table public.push_subscriptions
  add column if not exists guest_for_user_id uuid references auth.users(id) on delete cascade;

create index if not exists push_subscriptions_guest_for_user_id_idx
  on public.push_subscriptions (guest_for_user_id)
  where guest_for_user_id is not null;

drop policy if exists "University tasks are visible to anonymous viewers" on public.tasks;
create policy "University tasks are visible to anonymous viewers"
  on public.tasks
  for select
  to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = true
    and user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid
    and category = 'دانشگاه'
  );

drop policy if exists "Deny anonymous task inserts" on public.tasks;
create policy "Deny anonymous task inserts"
  on public.tasks as restrictive
  for insert to authenticated
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Deny anonymous task updates" on public.tasks;
create policy "Deny anonymous task updates"
  on public.tasks as restrictive
  for update to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Deny anonymous task deletes" on public.tasks;
create policy "Deny anonymous task deletes"
  on public.tasks as restrictive
  for delete to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Restrict guest push subscription inserts" on public.push_subscriptions;
create policy "Restrict guest push subscription inserts"
  on public.push_subscriptions as restrictive
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (
        coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
        and guest_for_user_id is null
      )
      or
      (
        coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = true
        and guest_for_user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid
      )
    )
  );

drop policy if exists "Restrict guest push subscription updates" on public.push_subscriptions;
create policy "Restrict guest push subscription updates"
  on public.push_subscriptions as restrictive
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false and guest_for_user_id is null)
      or
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = true and guest_for_user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid)
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false and guest_for_user_id is null)
      or
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = true and guest_for_user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid)
    )
  );

drop policy if exists "Restrict guest push subscription deletes" on public.push_subscriptions;
create policy "Restrict guest push subscription deletes"
  on public.push_subscriptions as restrictive
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false and guest_for_user_id is null)
      or
      (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = true and guest_for_user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid)
    )
  );
 
drop policy if exists "Deny anonymous periodic reminder inserts" on public.periodic_reminders;
create policy "Deny anonymous periodic reminder inserts"
  on public.periodic_reminders as restrictive
  for insert to authenticated
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Deny anonymous periodic reminder updates" on public.periodic_reminders;
create policy "Deny anonymous periodic reminder updates"
  on public.periodic_reminders as restrictive
  for update to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Deny anonymous periodic reminder deletes" on public.periodic_reminders;
create policy "Deny anonymous periodic reminder deletes"
  on public.periodic_reminders as restrictive
  for delete to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);
