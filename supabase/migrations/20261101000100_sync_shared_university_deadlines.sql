create or replace function public.sync_shared_university_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.category <> 'دانشگاه' then
      return new;
    end if;

    insert into public.tasks (
      id, user_id, title, description, due, category, priority, status,
      reminders, created_at, source_guest_task_id
    )
    select
      'shared-' || gen_random_uuid()::text,
      subscribers.user_id,
      new.title,
      coalesce(new.description, ''),
      new.due,
      new.category,
      coalesce(new.priority, 'medium'),
      'todo',
      coalesce((
        select jsonb_agg(
          case when jsonb_typeof(reminder.value) = 'object'
            then jsonb_set(reminder.value, '{sent}', 'false'::jsonb, true)
            else reminder.value
          end
        )
        from jsonb_array_elements(coalesce(new.reminders, '[]'::jsonb)) as reminder(value)
      ), '[]'::jsonb),
      now(),
      new.id
    from (
      select distinct user_id
      from public.tasks
      where source_guest_task_id is not null
    ) subscribers
    on conflict (user_id, source_guest_task_id)
      where source_guest_task_id is not null
      do nothing;

  else
    update public.tasks shared
    set
      title = new.title,
      description = coalesce(new.description, ''),
      due = new.due,
      category = new.category,
      priority = coalesce(new.priority, 'medium'),
      reminders = coalesce((
        select jsonb_agg(
          case when jsonb_typeof(reminder.value) = 'object'
            then jsonb_set(reminder.value, '{sent}', 'false'::jsonb, true)
            else reminder.value
          end
        )
        from jsonb_array_elements(coalesce(new.reminders, '[]'::jsonb)) as reminder(value)
      ), '[]'::jsonb)
    where shared.source_guest_task_id = new.id
      and shared.user_id <> new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_shared_university_deadline() from public, anon, authenticated;

drop trigger if exists sync_shared_university_deadline_trigger on public.tasks;
create trigger sync_shared_university_deadline_trigger
after insert or update on public.tasks
for each row
execute function public.sync_shared_university_deadline();
