alter table public.booking_quotes
  add column confirmation_method text,
  add constraint booking_quotes_confirmation_method_check
    check (
      confirmation_method is null
      or confirmation_method in ('guest_link', 'registered_account', 'whatsapp')
    );

create or replace function private.set_quote_confirmation_method()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.quote_status is distinct from 'accepted'
     and new.quote_status = 'accepted'
  then
    if new.confirmation_method is null then
      new.confirmation_method := case
        when old.acceptance_token_hash is null then 'registered_account'
        else 'guest_link'
      end;
    end if;
    if new.confirmation_method not in ('guest_link', 'registered_account', 'whatsapp') then
      raise exception 'Quote confirmation method is invalid';
    end if;
  elsif new.confirmation_method is distinct from old.confirmation_method then
    raise exception 'Quote confirmation method is immutable';
  end if;

  return new;
end;
$function$;

revoke all on function private.set_quote_confirmation_method()
  from public, anon, authenticated, service_role;

create trigger booking_quotes_set_confirmation_method
before update on public.booking_quotes
for each row execute function private.set_quote_confirmation_method();

create or replace function public.admin_record_whatsapp_quote_acceptance(
  p_quote_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_booking_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_token_hash bytea;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;
  if not found then
    raise exception 'Quote confirmation is unavailable';
  end if;

  select b.booking_status
    into v_booking_status
    from public.bookings as b
   where b.id = v_booking_id
   for update;
  if not found then
    raise exception 'Quote confirmation is unavailable';
  end if;

  select q.quote_status, q.expires_at, q.acceptance_token_hash
    into v_quote_status, v_expires_at, v_token_hash
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  if not found
     or v_booking_status is distinct from 'quoted'
     or v_quote_status is distinct from 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
  then
    raise exception 'Quote confirmation is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'accepted',
         accepted_at = v_now,
         confirmation_method = 'whatsapp',
         token_consumed_at = case
           when v_token_hash is null then null
           else v_now
         end
   where id = p_quote_id;

  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = v_booking_id
     and id <> p_quote_id
     and quote_status = 'sent';

  update public.bookings
     set booking_status = 'confirmed'
   where id = v_booking_id;

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
  values (
    v_booking_id,
    'customer_whatsapp_confirmation_recorded',
    v_actor,
    pg_catalog.jsonb_build_object(
      'quote_id', p_quote_id,
      'confirmation_method', 'whatsapp'
    ),
    v_now
  );
end;
$function$;

revoke all on function public.admin_record_whatsapp_quote_acceptance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_record_whatsapp_quote_acceptance(uuid)
  to authenticated;

comment on column public.booking_quotes.confirmation_method is
  'Immutable method recorded when a quote is accepted; accepted_at stores the confirmation timestamp.';
comment on function public.admin_record_whatsapp_quote_acceptance(uuid) is
  'Admin-only manual WhatsApp acceptance that consumes any guest acceptance token, confirms the booking and appends an audit event.';
