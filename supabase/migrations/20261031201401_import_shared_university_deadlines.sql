create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.shared_deadline_access_codes (
  code_hash bytea primary key,
  enabled boolean not null default true
);
revoke all on private.shared_deadline_access_codes from public, anon, authenticated;

insert into private.shared_deadline_access_codes (code_hash, enabled)
values (extensions.digest(convert_to('GAMZ', 'UTF8'), 'sha256'), true)
on conflict (code_hash) do update set enabled = excluded.enabled;

alter table public.tasks
  add column if not exists source_guest_task_id text;

create unique index if not exists tasks_user_source_guest_task_uidx
  on public.tasks (user_id, source_guest_task_id)
  where source_guest_task_id is not null;

create or replace function public.import_university_deadlines(p_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_imported integer := 0;
begin
  if v_user_id is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'ورود با حساب کاربری لازم است.';
  end if;

  if p_code is null or length(trim(p_code)) = 0
     or not exists (
       select 1
       from private.shared_deadline_access_codes c
       where c.enabled
         and c.code_hash = extensions.digest(convert_to(upper(trim(p_code)), 'UTF8'), 'sha256')
     ) then
    raise exception 'کد دسترسی معتبر نیست.';
  end if;

  insert into public.tasks (
    id, user_id, title, description, due, category, priority, status,
    reminders, created_at, source_guest_task_id
  )
  select
    'shared-' || gen_random_uuid()::text,
    v_user_id,
    source.title,
    coalesce(source.description, ''),
    source.due,
    'دانشگاه',
    coalesce(source.priority, 'medium'),
    'todo',
    coalesce((
      select jsonb_agg(
        case when jsonb_typeof(reminder.value) = 'object'
          then jsonb_set(reminder.value, '{sent}', 'false'::jsonb, true)
          else reminder.value
        end
      )
      from jsonb_array_elements(coalesce(source.reminders, '[]'::jsonb)) as reminder(value)
    ), '[]'::jsonb),
    now(),
    source.id
  from public.tasks source
  where source.user_id = '4b6ecd57-26b8-464f-bd24-dcda12ce4356'::uuid
    and source.category = 'دانشگاه'
  on conflict (user_id, source_guest_task_id)
    where source_guest_task_id is not null
    do nothing;

  get diagnostics v_imported = row_count;
  return v_imported;
end;
$$;

revoke all on function public.import_university_deadlines(text) from public, anon;
grant execute on function public.import_university_deadlines(text) to authenticated;
