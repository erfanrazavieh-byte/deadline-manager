-- Atomically save a browser push endpoint for the currently authenticated user.
-- A browser endpoint is globally unique, so account changes must transfer ownership
-- instead of attempting a second INSERT under a different user_id.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_guest_owner_id uuid := '4b6ecd57-26b8-464f-bd24-dcda12ce4356';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(p_endpoint, '') is null
     or nullif(p_p256dh, '') is null
     or nullif(p_auth, '') is null then
    raise exception 'Invalid push subscription payload';
  end if;

  insert into public.push_subscriptions (
    user_id, guest_for_user_id, endpoint, p256dh, auth, updated_at
  )
  values (
    v_user_id,
    case when v_is_guest then v_guest_owner_id else null end,
    p_endpoint,
    p_p256dh,
    p_auth,
    now()
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      guest_for_user_id = excluded.guest_for_user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
