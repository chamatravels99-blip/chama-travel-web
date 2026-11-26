-- Forward-only migration:
-- 1. Ensure manual WhatsApp/Admin quote confirmation column, trigger, and RPC exist
--    (repairs missing 202611130001 on live DB).
-- 2. Add customer-facing quote message column (customer_message) on booking_quotes
--    so Admin inclusions/notes can be shown on the guest quotation page without
--    ever exposing confidential booking_internal_notes.
-- 3. Add secure service_role RPCs for guest quotation preview (get_guest_quote_details)
--    and guest quotation decline/cancellation (decline_guest_quote).

alter table public.booking_quotes
  add column if not exists confirmation_method text,
  add column if not exists customer_message text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.booking_quotes'::regclass
       and conname = 'booking_quotes_confirmation_method_check'
  ) then
    alter table public.booking_quotes
      add constraint booking_quotes_confirmation_method_check
        check (
          confirmation_method is null
          or confirmation_method in ('guest_link', 'registered_account', 'whatsapp')
        );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.booking_quotes'::regclass
       and conname = 'booking_quotes_customer_message_length_check'
  ) then
    alter table public.booking_quotes
      add constraint booking_quotes_customer_message_length_check
        check (
          customer_message is null
          or pg_catalog.char_length(customer_message) <= 1000
        );
  end if;
end $$;

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

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.booking_quotes'::regclass
       and tgname = 'booking_quotes_set_confirmation_method'
  ) then
    create trigger booking_quotes_set_confirmation_method
    before update on public.booking_quotes
    for each row execute function private.set_quote_confirmation_method();
  end if;
end $$;

create or replace function private.guard_booking_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.quote_status = 'draft' then
    if new.quote_status not in ('draft', 'sent', 'expired', 'superseded') then
      raise exception 'Invalid draft quote transition';
    end if;
    return new;
  end if;

  if old.quote_status = 'sent'
     and new.quote_status = 'sent'
  then
    if new.booking_id is distinct from old.booking_id
       or new.revision is distinct from old.revision
       or new.currency is distinct from old.currency
       or new.total is distinct from old.total
       or new.issued_at is distinct from old.issued_at
       or new.expires_at is distinct from old.expires_at
       or new.issued_by is distinct from old.issued_by
       or new.accepted_at is distinct from old.accepted_at
       or new.acceptance_token_hash is distinct from old.acceptance_token_hash
       or new.token_expires_at is distinct from old.token_expires_at
       or new.token_consumed_at is distinct from old.token_consumed_at
       or new.created_at is distinct from old.created_at
       or new.quote_source is distinct from old.quote_source
    then
      raise exception 'Issued quote terms are immutable';
    end if;

    if old.token_revoked_at is null
       and new.token_revoked_at is not null
       and new.customer_message is not distinct from old.customer_message
    then
      return new;
    end if;

    if old.customer_message is null
       and new.customer_message is not null
       and new.token_revoked_at is not distinct from old.token_revoked_at
    then
      return new;
    end if;

    raise exception 'A sent quote only permits a one-time guest-link revocation or initial customer message';
  end if;

  if old.quote_status <> 'sent'
     or new.quote_status not in ('accepted', 'expired', 'superseded', 'rejected')
     or new.booking_id is distinct from old.booking_id
     or new.revision is distinct from old.revision
     or new.currency is distinct from old.currency
     or new.total is distinct from old.total
     or new.issued_at is distinct from old.issued_at
     or new.expires_at is distinct from old.expires_at
     or new.issued_by is distinct from old.issued_by
     or new.acceptance_token_hash is distinct from old.acceptance_token_hash
     or new.token_expires_at is distinct from old.token_expires_at
     or new.token_revoked_at is distinct from old.token_revoked_at
     or new.created_at is distinct from old.created_at
     or new.quote_source is distinct from old.quote_source
     or new.customer_message is distinct from old.customer_message
  then
    raise exception 'Issued quote terms are immutable';
  end if;

  if new.quote_status = 'accepted' then
    if new.accepted_at is null then
      raise exception 'Accepted quote requires accepted_at';
    end if;
    if old.acceptance_token_hash is not null
       and new.token_consumed_at is null then
      raise exception 'Guest quote acceptance must consume its token';
    end if;
  elsif new.accepted_at is not null or new.token_consumed_at is not null then
    raise exception 'Only an accepted quote may have acceptance metadata';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_booking_quote_update()
  from public, anon, authenticated, service_role;

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

create or replace function public.admin_set_quote_customer_message(
  p_quote_id uuid,
  p_customer_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_message text := nullif(pg_catalog.btrim(coalesce(p_customer_message, '')), '');
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

  if v_message is null then
    return;
  end if;
  if pg_catalog.char_length(v_message) > 1000 then
    v_message := pg_catalog.left(v_message, 1000);
  end if;

  update public.booking_quotes
     set customer_message = v_message
   where id = p_quote_id
     and quote_status = 'sent'
     and customer_message is null;
end;
$function$;

revoke all on function public.admin_set_quote_customer_message(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_quote_customer_message(uuid, text)
  to authenticated;

create or replace function public.get_guest_quote_details(
  p_quote_id uuid,
  p_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_token_hash bytea;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_quote public.booking_quotes%rowtype;
  v_booking public.bookings%rowtype;
  v_vehicle_preference text;
  v_legs jsonb;
  v_is_expired boolean;
  v_can_respond boolean;
begin
  if p_quote_id is null
     or p_token is null
     or pg_catalog.char_length(p_token) < 32
     or pg_catalog.char_length(p_token) > 256
  then
    raise exception 'Quote details are unavailable';
  end if;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(p_token, 'UTF8'),
    'sha256'
  );

  select q.*
    into v_quote
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.acceptance_token_hash is not null
     and q.acceptance_token_hash = v_token_hash;

  if not found then
    raise exception 'Quote details are unavailable';
  end if;

  select b.*
    into v_booking
    from public.bookings as b
   where b.id = v_quote.booking_id;

  if not found then
    raise exception 'Quote details are unavailable';
  end if;

  select vc.display_name
    into v_vehicle_preference
    from public.vehicle_categories as vc
   where vc.id = v_booking.requested_category_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'sequence_no', bl.sequence_no,
        'pickup_location', bl.pickup_location,
        'dropoff_location', bl.dropoff_location,
        'pickup_at', bl.pickup_at,
        'planned_end_at', bl.planned_end_at,
        'flight_number', bl.flight_number,
        'trip_notes', bl.trip_notes
      ) order by bl.sequence_no
    ),
    '[]'::jsonb
  )
    into v_legs
    from public.booking_legs as bl
   where bl.booking_id = v_booking.id;

  v_is_expired := (
    v_quote.expires_at is null
    or v_quote.expires_at <= v_now
    or v_quote.token_expires_at is null
    or v_quote.token_expires_at <= v_now
  );

  v_can_respond := (
    v_booking.customer_user_id is null
    and v_booking.booking_status = 'quoted'
    and v_quote.quote_status = 'sent'
    and not v_is_expired
    and v_quote.token_consumed_at is null
    and v_quote.token_revoked_at is null
  );

  return pg_catalog.jsonb_build_object(
    'quote', pg_catalog.jsonb_build_object(
      'id', v_quote.id,
      'revision', v_quote.revision,
      'currency', pg_catalog.btrim(v_quote.currency),
      'total', v_quote.total,
      'quote_status', v_quote.quote_status,
      'issued_at', v_quote.issued_at,
      'expires_at', v_quote.expires_at,
      'accepted_at', v_quote.accepted_at,
      'customer_message', v_quote.customer_message,
      'token_revoked_at', v_quote.token_revoked_at,
      'is_expired', v_is_expired,
      'can_respond', v_can_respond
    ),
    'booking', pg_catalog.jsonb_build_object(
      'booking_ref', v_booking.booking_ref,
      'customer_name', v_booking.customer_name,
      'service_type', v_booking.service_type,
      'journey_type', v_booking.journey_type,
      'booking_status', v_booking.booking_status,
      'passenger_count', v_booking.passenger_count,
      'luggage_count', v_booking.luggage_count,
      'vehicle_preference', v_vehicle_preference,
      'customer_notes', v_booking.customer_notes,
      'legs', v_legs
    )
  );
end;
$function$;

revoke all on function public.get_guest_quote_details(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_guest_quote_details(uuid, text)
  to service_role;

create or replace function public.decline_guest_quote(
  p_quote_id uuid,
  p_token text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_booking_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_token_hash bytea;
  v_stored_hash bytea;
  v_token_expires_at timestamptz;
  v_token_consumed_at timestamptz;
  v_token_revoked_at timestamptz;
  v_now timestamptz;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if p_quote_id is null
     or p_token is null
     or pg_catalog.char_length(p_token) < 32
     or pg_catalog.char_length(p_token) > 256
  then
    raise exception 'Quote decline is unavailable';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    v_reason := pg_catalog.left(v_reason, 500);
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;

  if not found then
    raise exception 'Quote decline is unavailable';
  end if;

  select b.customer_user_id, b.booking_status
    into v_customer_user_id, v_booking_status
    from public.bookings as b
   where b.id = v_booking_id
   for update;

  select
    q.quote_status,
    q.expires_at,
    q.acceptance_token_hash,
    q.token_expires_at,
    q.token_consumed_at,
    q.token_revoked_at
    into
    v_quote_status,
    v_expires_at,
    v_stored_hash,
    v_token_expires_at,
    v_token_consumed_at,
    v_token_revoked_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(p_token, 'UTF8'),
    'sha256'
  );
  v_now := pg_catalog.clock_timestamp();

  if v_customer_user_id is not null
     or v_booking_status is distinct from 'quoted'
     or v_quote_status is distinct from 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
     or v_token_expires_at is null
     or v_token_expires_at <= v_now
     or v_token_consumed_at is not null
     or v_token_revoked_at is not null
     or v_stored_hash is null
     or v_stored_hash <> v_token_hash
  then
    raise exception 'Quote decline is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'rejected'
   where id = p_quote_id;

  update public.booking_quotes
     set quote_status = 'expired'
   where booking_id = v_booking_id
     and id <> p_quote_id
     and quote_status in ('draft', 'sent');

  update public.bookings
     set booking_status = 'cancelled'
   where id = v_booking_id;

  update public.booking_legs
     set trip_status = 'cancelled'
   where booking_id = v_booking_id
     and trip_status <> 'completed';

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, reason, details, created_at
  )
  values (
    v_booking_id,
    'guest_quote_declined',
    null,
    v_reason,
    pg_catalog.jsonb_build_object(
      'quote_id', p_quote_id,
      'reason', v_reason
    ),
    v_now
  );
end;
$function$;

revoke all on function public.decline_guest_quote(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.decline_guest_quote(uuid, text, text)
  to service_role;

comment on column public.booking_quotes.confirmation_method is
  'Immutable method recorded when a quote is accepted; accepted_at stores the confirmation timestamp.';
comment on column public.booking_quotes.customer_message is
  'Optional customer-facing quotation inclusions or message shown on the guest quotation review page.';
comment on function public.admin_record_whatsapp_quote_acceptance(uuid) is
  'Admin-only manual quote confirmation that consumes any guest acceptance token, confirms the booking, and appends an audit event.';
comment on function public.admin_set_quote_customer_message(uuid, text) is
  'Admin-only one-time setter for customer-facing quotation inclusions/notes on a sent quote.';
comment on function public.get_guest_quote_details(uuid, text) is
  'Service-role-only lookup returning customer-facing trip and quotation details for a valid guest acceptance token (never exposes internal admin notes).';
comment on function public.decline_guest_quote(uuid, text, text) is
  'Service-role-only guest quotation decline that marks the quote rejected, cancels the quoted booking and legs, and records an audit event.';
