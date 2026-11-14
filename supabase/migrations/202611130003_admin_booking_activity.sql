create table public.booking_internal_notes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  note text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint booking_internal_notes_note_length_check
    check (
      pg_catalog.char_length(pg_catalog.btrim(note)) between 1 and 2000
    )
);

create index booking_internal_notes_booking_created_idx
  on public.booking_internal_notes (booking_id, created_at desc);

alter table public.booking_internal_notes enable row level security;
revoke all on public.booking_internal_notes
  from public, anon, authenticated, service_role;

create trigger booking_internal_notes_append_only
before update or delete on public.booking_internal_notes
for each row execute function private.reject_append_only_mutation();

create or replace function private.record_booking_internal_note_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
  values (
    new.booking_id,
    'admin_internal_note_added',
    new.author_user_id,
    pg_catalog.jsonb_build_object('note_id', new.id),
    new.created_at
  );
  return null;
end;
$function$;

revoke all on function private.record_booking_internal_note_event()
  from public, anon, authenticated, service_role;

create trigger booking_internal_notes_record_event
after insert on public.booking_internal_notes
for each row execute function private.record_booking_internal_note_event();

create or replace function public.admin_add_booking_internal_note(
  p_booking_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_note_id uuid;
  v_note text := pg_catalog.btrim(coalesce(p_note, ''));
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

  if pg_catalog.char_length(v_note) not between 1 and 2000 then
    raise exception 'Internal note must contain 1 to 2000 characters';
  end if;

  perform 1
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found then
    raise exception 'Booking is unavailable';
  end if;

  insert into public.booking_internal_notes (
    booking_id, author_user_id, note
  )
  values (p_booking_id, v_actor, v_note)
  returning id into v_note_id;

  return v_note_id;
end;
$function$;

create or replace function public.admin_list_booking_activity(
  p_booking_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  if not exists (
    select 1 from public.bookings as b where b.id = p_booking_id
  ) then
    raise exception 'Booking activity is unavailable';
  end if;

  select pg_catalog.jsonb_build_object(
    'events',
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', recent.id,
          'event_type', recent.event_type,
          'from_status', recent.from_status,
          'to_status', recent.to_status,
          'actor_name', recent.actor_name,
          'details', recent.details,
          'created_at', recent.created_at
        ) order by recent.created_at desc
      )
        from (
          select
            e.id,
            e.event_type,
            e.from_status,
            e.to_status,
            p.full_name as actor_name,
            e.details,
            e.created_at
          from public.booking_events as e
          left join public.profiles as p on p.id = e.actor_user_id
          where e.booking_id = p_booking_id
          order by e.created_at desc
          limit 200
        ) as recent
    ), '[]'::jsonb),
    'internal_notes',
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', recent.id,
          'note', recent.note,
          'author_name', recent.author_name,
          'created_at', recent.created_at
        ) order by recent.created_at desc
      )
        from (
          select
            n.id,
            n.note,
            p.full_name as author_name,
            n.created_at
          from public.booking_internal_notes as n
          join public.profiles as p on p.id = n.author_user_id
          where n.booking_id = p_booking_id
          order by n.created_at desc
          limit 100
        ) as recent
    ), '[]'::jsonb)
  )
    into v_result;

  return v_result;
end;
$function$;

revoke all on function public.admin_add_booking_internal_note(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_booking_activity(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_add_booking_internal_note(uuid, text)
  to authenticated;
grant execute on function public.admin_list_booking_activity(uuid)
  to authenticated;

comment on table public.booking_internal_notes is
  'Append-only staff notes; direct client access is denied and notes are never included in customer booking DTOs.';
comment on function public.admin_add_booking_internal_note(uuid, text) is
  'Admin-only append-only booking note creation with a linked audit event.';
comment on function public.admin_list_booking_activity(uuid) is
  'Admin-only recent booking event and private-note history.';
