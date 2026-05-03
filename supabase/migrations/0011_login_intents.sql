-- Two-step login when the account is already at the device limit.
-- The pending Supabase session is encrypted by the app before being stored here.

create table login_intents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pending_session_ciphertext text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index login_intents_user_consumed_idx
  on login_intents (user_id, consumed_at);

create index login_intents_expires_at_idx
  on login_intents (expires_at);

alter table login_intents enable row level security;

-- No public policies: only service role should create/read/consume intents.

create or replace function consume_login_intent_and_revoke_device(
  p_intent_id uuid,
  p_user_id uuid,
  p_device_row_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  update login_intents
    set consumed_at = now()
    where id = p_intent_id
      and user_id = p_user_id
      and consumed_at is null
      and expires_at > now();

  if not found then
    raise exception 'login_intent_invalid_or_consumed';
  end if;

  delete from user_devices
    where id = p_device_row_id
      and user_id = p_user_id
    returning session_id into v_session_id;

  if not found then
    raise exception 'device_not_found';
  end if;

  if v_session_id is not null then
    delete from auth.sessions
      where id = v_session_id
        and user_id = p_user_id;
  end if;
end;
$$;

revoke all on function consume_login_intent_and_revoke_device(uuid, uuid, uuid) from public;
grant execute on function consume_login_intent_and_revoke_device(uuid, uuid, uuid) to service_role;
