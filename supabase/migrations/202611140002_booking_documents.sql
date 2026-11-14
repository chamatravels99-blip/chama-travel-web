-- Private booking document metadata, guest document access, and the private
-- Supabase Storage bucket. Documents are never public: every download is
-- authorized in SQL first, then served by a server route with the service role.

create table private.guest_document_access_state (
  booking_id uuid not null references public.bookings (id) on delete restrict,
  audience text not null check (audience in ('customer', 'driver')),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (booking_id, audience),
  constraint guest_document_access_revocation_state
    check ((revoked_at is null) = (revoked_by is null))
);
alter table private.guest_document_access_state enable row level security;
revoke all on private.guest_document_access_state
  from public, anon, authenticated, service_role;

create table public.booking_documents (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  document_type text not null
    check (document_type in ('invoice', 'receipt', 'booking_document')),
  title text not null check (pg_catalog.char_length(title) between 1 and 160),
  source_invoice_id uuid,
  source_payment_id uuid,
  revision integer not null default 1 check (revision > 0),
  supersedes_document_id uuid references public.booking_documents (id) on delete restrict,
  superseded_at timestamptz,
  storage_bucket text not null default 'booking-documents'
    check (storage_bucket = 'booking-documents'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  declared_byte_size bigint check (declared_byte_size is null or declared_byte_size between 1 and 5242880),
  byte_size bigint check (byte_size is null or byte_size between 1 and 5242880),
  sha256 bytea check (sha256 is null or pg_catalog.octet_length(sha256) = 32),
  file_status text not null default 'pending' check (file_status in ('pending', 'stored')),
  stored_at timestamptz,
  customer_visible boolean not null default false,
  driver_visible boolean not null default false,
  content_snapshot jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint booking_documents_path_format check (
    storage_path ~ '^bookings/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(invoice|receipt|booking_document)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$'
    and storage_path like 'bookings/' || booking_id::text || '/' || document_type || '/' || id::text || '.%'
  ),
  constraint booking_documents_source_check check (
    (document_type = 'invoice' and source_invoice_id is not null and source_payment_id is null)
    or (document_type = 'receipt' and source_payment_id is not null and source_invoice_id is null)
    or (document_type = 'booking_document' and source_invoice_id is null and source_payment_id is null)
  ),
  constraint booking_documents_financial_pdf check (
    document_type = 'booking_document' or mime_type = 'application/pdf'
  ),
  constraint booking_documents_financial_scope check (
    document_type = 'booking_document'
    or (customer_visible and not driver_visible)
  ),
  constraint booking_documents_stored_state check (
    (file_status = 'pending' and stored_at is null and sha256 is null and byte_size is null)
    or (file_status = 'stored' and stored_at is not null and sha256 is not null and byte_size is not null)
  ),
  constraint booking_documents_supersession_state check (
    supersedes_document_id is distinct from id
  )
);

create unique index booking_documents_one_per_invoice
  on public.booking_documents (source_invoice_id) where document_type = 'invoice';
create unique index booking_documents_one_per_payment
  on public.booking_documents (source_payment_id) where document_type = 'receipt';
create index booking_documents_booking_idx
  on public.booking_documents (booking_id, created_at desc);

alter table public.booking_documents enable row level security;
revoke all on public.booking_documents from public, anon, authenticated, service_role;

-- Issued documents are immutable. The only permitted changes are the one-time
-- pending -> stored transition and marking an uploaded document superseded.
create or replace function private.guard_booking_document()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Booking documents cannot be deleted';
  end if;

  if (pg_catalog.to_jsonb(new) - 'file_status' - 'stored_at' - 'sha256' - 'byte_size' - 'superseded_at')
     is distinct from
     (pg_catalog.to_jsonb(old) - 'file_status' - 'stored_at' - 'sha256' - 'byte_size' - 'superseded_at')
  then
    raise exception 'Booking document metadata is immutable';
  end if;

  if old.file_status = 'pending' and new.file_status = 'stored'
     and new.superseded_at is not distinct from old.superseded_at
  then
    return new;
  end if;

  if old.document_type = 'booking_document'
     and old.superseded_at is null and new.superseded_at is not null
     and new.file_status is not distinct from old.file_status
     and new.stored_at is not distinct from old.stored_at
     and new.sha256 is not distinct from old.sha256
     and new.byte_size is not distinct from old.byte_size
  then
    return new;
  end if;

  raise exception 'Booking document is immutable';
end;
$function$;
revoke all on function private.guard_booking_document()
  from public, anon, authenticated, service_role;

create trigger booking_documents_guard
before update or delete on public.booking_documents
for each row execute function private.guard_booking_document();

create or replace function private.reject_booking_document_truncate()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Booking documents cannot be truncated';
end;
$function$;
revoke all on function private.reject_booking_document_truncate()
  from public, anon, authenticated, service_role;
create trigger booking_documents_no_truncate
before truncate on public.booking_documents
for each statement execute function private.reject_booking_document_truncate();

-- Non-locking invitation lookup used by read-only guest-driver document access.
create or replace function private.resolve_driver_invitation(p_token text)
returns private.driver_assignment_invitations
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Document is unavailable';
  end if;
  select i.* into v_invitation
    from private.driver_assignment_invitations as i
   where i.token_hash = private.hash_access_token(p_token)
     and i.revoked_at is null
     and i.consumed_at is null
     and i.expires_at > pg_catalog.clock_timestamp();
  if not found then
    raise exception 'Document is unavailable';
  end if;
  return v_invitation;
end;
$function$;
revoke all on function private.resolve_driver_invitation(text)
  from public, anon, authenticated, service_role;

create or replace function private.guest_customer_booking_id(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Document is unavailable';
  end if;
  select t.booking_id into v_booking_id
    from private.guest_booking_access_tokens as t
    join public.bookings as b on b.id = t.booking_id
   where t.token_hash = private.hash_access_token(p_token)
     and t.expires_at > pg_catalog.clock_timestamp()
     and t.revoked_at is null
     and t.claimed_at is null
     and b.customer_user_id is null
     and not exists (
       select 1 from private.guest_document_access_state as s
        where s.booking_id = t.booking_id
          and s.audience = 'customer' and s.revoked_at is not null
     );
  if v_booking_id is null then
    raise exception 'Document is unavailable';
  end if;
  return v_booking_id;
end;
$function$;
revoke all on function private.guest_customer_booking_id(text)
  from public, anon, authenticated, service_role;

-- Single definition of "may this authenticated user read this document".
create or replace function private.user_can_read_document(p_user_id uuid, p_document_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_doc public.booking_documents%rowtype;
begin
  if p_user_id is null then
    return false;
  end if;
  select d.* into v_doc from public.booking_documents as d where d.id = p_document_id;
  if not found or v_doc.file_status <> 'stored' then
    return false;
  end if;

  if private.has_active_role(p_user_id, array['admin', 'super_admin']) then
    return true;
  end if;
  if v_doc.superseded_at is not null then
    return false;
  end if;

  if v_doc.customer_visible
     and private.has_active_role(p_user_id, array['customer'])
     and exists (
       select 1 from public.bookings as b
        where b.id = v_doc.booking_id and b.customer_user_id = p_user_id
     )
     and (v_doc.document_type <> 'invoice' or exists (
       select 1 from public.invoices as i
        where i.id = v_doc.source_invoice_id and i.invoice_status = 'issued'
     ))
  then
    return true;
  end if;

  if v_doc.driver_visible
     and v_doc.document_type = 'booking_document'
     and private.has_active_role(p_user_id, array['driver'])
     and exists (
       select 1 from public.booking_assignments as ba
        where ba.booking_id = v_doc.booking_id
          and ba.driver_user_id = p_user_id
          and ba.assignment_status in ('accepted', 'in_progress', 'completed')
     )
  then
    return true;
  end if;
  return false;
end;
$function$;
revoke all on function private.user_can_read_document(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.document_summary(p_doc public.booking_documents)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'id', p_doc.id,
    'booking_id', p_doc.booking_id,
    'document_type', p_doc.document_type,
    'title', p_doc.title,
    'revision', p_doc.revision,
    'mime_type', p_doc.mime_type,
    'byte_size', p_doc.byte_size,
    'created_at', p_doc.created_at
  );
$function$;
revoke all on function private.document_summary(public.booking_documents)
  from public, anon, authenticated, service_role;

create or replace function private.record_document_access(
  p_booking_id uuid, p_document_id uuid, p_actor uuid, p_audience text
)
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (
    p_booking_id, 'booking_document_accessed', p_actor,
    pg_catalog.jsonb_build_object('document_id', p_document_id, 'audience', p_audience)
  );
$function$;
revoke all on function private.record_document_access(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.list_my_booking_documents(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in to continue';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(private.document_summary(d) order by d.created_at desc)
      from public.booking_documents as d
     where d.booking_id = p_booking_id
       and private.user_can_read_document(v_actor, d.id)
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.authorize_booking_document(p_document_id uuid)
returns table (storage_path text, mime_type text, title text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_doc public.booking_documents%rowtype;
begin
  if not private.user_can_read_document(v_actor, p_document_id) then
    raise exception 'Document is unavailable';
  end if;
  select d.* into v_doc from public.booking_documents as d where d.id = p_document_id;
  perform private.record_document_access(v_doc.booking_id, v_doc.id, v_actor, 'user');
  return query select v_doc.storage_path, v_doc.mime_type, v_doc.title;
end;
$function$;

create or replace function public.guest_customer_list_documents(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid := private.guest_customer_booking_id(p_token);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(private.document_summary(d) order by d.created_at desc)
      from public.booking_documents as d
     where d.booking_id = v_booking_id
       and d.file_status = 'stored'
       and d.superseded_at is null
       and d.customer_visible
       and (d.document_type <> 'invoice' or exists (
         select 1 from public.invoices as i
          where i.id = d.source_invoice_id and i.invoice_status = 'issued'
       ))
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.guest_customer_authorize_document(
  p_token text, p_document_id uuid
)
returns table (storage_path text, mime_type text, title text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid := private.guest_customer_booking_id(p_token);
  v_doc public.booking_documents%rowtype;
begin
  select d.* into v_doc
    from public.booking_documents as d
   where d.id = p_document_id
     and d.booking_id = v_booking_id
     and d.file_status = 'stored'
     and d.superseded_at is null
     and d.customer_visible
     and (d.document_type <> 'invoice' or exists (
       select 1 from public.invoices as i
        where i.id = d.source_invoice_id and i.invoice_status = 'issued'
     ));
  if not found then
    raise exception 'Document is unavailable';
  end if;
  perform private.record_document_access(v_doc.booking_id, v_doc.id, null, 'guest_customer');
  return query select v_doc.storage_path, v_doc.mime_type, v_doc.title;
end;
$function$;

create or replace function private.guest_driver_booking_id(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
begin
  v_invitation := private.resolve_driver_invitation(p_token);
  if not exists (
       select 1 from public.booking_assignments as ba
        where ba.id = v_invitation.assignment_id
          and ba.booking_id = v_invitation.booking_id
          and ba.driver_user_id = v_invitation.driver_user_id
          and ba.assignment_status in ('accepted', 'in_progress', 'completed')
     )
     or exists (
       select 1 from private.guest_document_access_state as s
        where s.booking_id = v_invitation.booking_id
          and s.audience = 'driver' and s.revoked_at is not null
     )
  then
    raise exception 'Document is unavailable';
  end if;
  return v_invitation.booking_id;
end;
$function$;
revoke all on function private.guest_driver_booking_id(text)
  from public, anon, authenticated, service_role;

create or replace function public.guest_driver_list_documents(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid := private.guest_driver_booking_id(p_token);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(private.document_summary(d) order by d.created_at desc)
      from public.booking_documents as d
     where d.booking_id = v_booking_id
       and d.document_type = 'booking_document'
       and d.file_status = 'stored'
       and d.superseded_at is null
       and d.driver_visible
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.guest_driver_authorize_document(
  p_token text, p_document_id uuid
)
returns table (storage_path text, mime_type text, title text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid := private.guest_driver_booking_id(p_token);
  v_doc public.booking_documents%rowtype;
begin
  select d.* into v_doc
    from public.booking_documents as d
   where d.id = p_document_id
     and d.booking_id = v_booking_id
     and d.document_type = 'booking_document'
     and d.file_status = 'stored'
     and d.superseded_at is null
     and d.driver_visible;
  if not found then
    raise exception 'Document is unavailable';
  end if;
  perform private.record_document_access(v_doc.booking_id, v_doc.id, null, 'guest_driver');
  return query select v_doc.storage_path, v_doc.mime_type, v_doc.title;
end;
$function$;

create or replace function public.admin_set_guest_document_access(
  p_booking_id uuid, p_audience text, p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if p_audience is null or p_audience not in ('customer', 'driver') or p_enabled is null then
    raise exception 'Document access details are invalid';
  end if;
  perform 1 from public.bookings as b where b.id = p_booking_id for update;
  if not found then
    raise exception 'Booking is unavailable';
  end if;

  insert into private.guest_document_access_state as s (booking_id, audience, revoked_at, revoked_by)
  values (
    p_booking_id, p_audience,
    case when p_enabled then null else pg_catalog.clock_timestamp() end,
    case when p_enabled then null else v_actor end
  )
  on conflict (booking_id, audience) do update
    set revoked_at = excluded.revoked_at,
        revoked_by = excluded.revoked_by,
        updated_at = pg_catalog.clock_timestamp();

  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (
    p_booking_id,
    case when p_enabled then 'guest_document_access_restored' else 'guest_document_access_revoked' end,
    v_actor,
    pg_catalog.jsonb_build_object('audience', p_audience)
  );
end;
$function$;

create or replace function public.admin_create_document_upload(
  p_booking_id uuid,
  p_title text,
  p_mime_type text,
  p_byte_size bigint,
  p_customer_visible boolean,
  p_driver_visible boolean
)
returns table (document_id uuid, storage_path text, revision integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid := pg_catalog.gen_random_uuid();
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_ext text;
  v_path text;
  v_prev public.booking_documents%rowtype;
  v_revision integer := 1;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(v_title) not between 1 and 160
     or p_mime_type is null or p_mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
     or p_byte_size is null or p_byte_size not between 1 and 5242880
     or p_customer_visible is null or p_driver_visible is null
  then
    raise exception 'Document details are invalid';
  end if;
  perform 1 from public.bookings as b where b.id = p_booking_id for update;
  if not found then
    raise exception 'Booking is unavailable';
  end if;

  v_ext := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/png' then 'png'
    else 'jpg'
  end;
  v_path := 'bookings/' || p_booking_id::text || '/booking_document/' || v_id::text || '.' || v_ext;

  select d.* into v_prev
    from public.booking_documents as d
   where d.booking_id = p_booking_id
     and d.document_type = 'booking_document'
     and d.title = v_title
     and d.superseded_at is null
     and d.file_status = 'stored'
   order by d.revision desc
   limit 1
   for update;
  if found then
    v_revision := v_prev.revision + 1;
  end if;

  insert into public.booking_documents (
    id, booking_id, document_type, title, revision, supersedes_document_id,
    storage_path, mime_type, declared_byte_size, customer_visible, driver_visible, created_by
  )
  values (
    v_id, p_booking_id, 'booking_document', v_title, v_revision,
    case when v_revision > 1 then v_prev.id end,
    v_path, p_mime_type, p_byte_size, p_customer_visible, p_driver_visible, v_actor
  );

  return query select v_id, v_path, v_revision;
end;
$function$;

create or replace function public.admin_mark_document_stored(
  p_document_id uuid, p_sha256_hex text, p_byte_size bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_doc public.booking_documents%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if p_sha256_hex is null or p_sha256_hex !~ '^[0-9a-f]{64}$'
     or p_byte_size is null or p_byte_size not between 1 and 5242880
  then
    raise exception 'Document details are invalid';
  end if;

  select d.* into v_doc from public.booking_documents as d
   where d.id = p_document_id for update;
  if not found or v_doc.file_status <> 'pending'
     or (v_doc.declared_byte_size is not null and v_doc.declared_byte_size <> p_byte_size)
  then
    raise exception 'Document is unavailable';
  end if;

  update public.booking_documents
     set file_status = 'stored', stored_at = v_now,
         sha256 = pg_catalog.decode(p_sha256_hex, 'hex'), byte_size = p_byte_size
   where id = p_document_id;

  if v_doc.supersedes_document_id is not null then
    update public.booking_documents
       set superseded_at = v_now
     where id = v_doc.supersedes_document_id and superseded_at is null;
  end if;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_doc.booking_id, 'booking_document_stored', v_actor,
    pg_catalog.jsonb_build_object(
      'document_id', v_doc.id, 'document_type', v_doc.document_type, 'revision', v_doc.revision
    ),
    v_now
  );
end;
$function$;

-- Returns what the server needs to (re)generate a PDF for a pending document.
create or replace function public.admin_get_document_for_render(p_document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_doc public.booking_documents%rowtype;
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  select d.* into v_doc from public.booking_documents as d where d.id = p_document_id;
  if not found then
    raise exception 'Document is unavailable';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_doc.id,
    'document_type', v_doc.document_type,
    'storage_path', v_doc.storage_path,
    'file_status', v_doc.file_status,
    'snapshot', case v_doc.document_type
      when 'invoice' then (select i.snapshot from public.invoices as i where i.id = v_doc.source_invoice_id)
      when 'receipt' then v_doc.content_snapshot
    end
  );
end;
$function$;

revoke all on function public.list_my_booking_documents(uuid),
  public.authorize_booking_document(uuid),
  public.guest_customer_list_documents(text),
  public.guest_customer_authorize_document(text, uuid),
  public.guest_driver_list_documents(text),
  public.guest_driver_authorize_document(text, uuid),
  public.admin_set_guest_document_access(uuid, text, boolean),
  public.admin_create_document_upload(uuid, text, text, bigint, boolean, boolean),
  public.admin_mark_document_stored(uuid, text, bigint),
  public.admin_get_document_for_render(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.list_my_booking_documents(uuid),
  public.authorize_booking_document(uuid),
  public.admin_set_guest_document_access(uuid, text, boolean),
  public.admin_create_document_upload(uuid, text, text, bigint, boolean, boolean),
  public.admin_mark_document_stored(uuid, text, bigint),
  public.admin_get_document_for_render(uuid)
  to authenticated;
grant execute on function public.guest_customer_list_documents(text),
  public.guest_customer_authorize_document(text, uuid),
  public.guest_driver_list_documents(text),
  public.guest_driver_authorize_document(text, uuid)
  to service_role;

-- Private storage bucket. No storage.objects policy grants client access; the
-- restrictive policy keeps this bucket closed even if a permissive policy for
-- another bucket is added later. Server routes use the service role only after
-- the authorize_* functions above succeed.
do $storage$
begin
  if pg_catalog.to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'booking-documents', 'booking-documents', false, 5242880,
      array['application/pdf', 'image/png', 'image/jpeg']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = 5242880,
          allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'];
  end if;
  if pg_catalog.to_regclass('storage.objects') is not null then
    execute 'drop policy if exists booking_documents_deny_client_access on storage.objects';
    execute $policy$
      create policy booking_documents_deny_client_access on storage.objects
      as restrictive for all to anon, authenticated
      using (bucket_id <> 'booking-documents')
      with check (bucket_id <> 'booking-documents')
    $policy$;
  end if;
end
$storage$;
