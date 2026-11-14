-- Invoice lifecycle (immutable, numbered, snapshot based) and receipt document
-- issuance tied to recorded customer payments.

create sequence private.invoice_number_seq;
revoke all on sequence private.invoice_number_seq
  from public, anon, authenticated, service_role;

create table public.invoices (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  invoice_number text not null unique,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  quote_id uuid not null,
  currency char(3) not null check (currency in ('LKR', 'USD')),
  total numeric(12, 2) not null check (total >= 0),
  revision integer not null default 1 check (revision > 0),
  invoice_status text not null default 'issued' check (invoice_status in ('issued', 'cancelled')),
  supersedes_invoice_id uuid references public.invoices (id) on delete restrict,
  issued_at timestamptz not null default pg_catalog.clock_timestamp(),
  issued_by uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  snapshot jsonb not null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancellation_reason text check (
    cancellation_reason is null
    or pg_catalog.char_length(cancellation_reason) between 3 and 500
  ),
  constraint invoices_quote_booking_currency_fk
    foreign key (quote_id, booking_id, currency)
    references public.booking_quotes (id, booking_id, currency) on delete restrict,
  constraint invoices_request_unique unique (issued_by, request_id),
  constraint invoices_cancellation_state check (
    (invoice_status = 'issued' and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (invoice_status = 'cancelled' and cancelled_at is not null and cancelled_by is not null and cancellation_reason is not null)
  ),
  constraint invoices_not_self_superseding check (supersedes_invoice_id is distinct from id)
);

-- At most one live invoice per accepted quote, even under concurrent issuance.
create unique index invoices_one_issued_per_quote
  on public.invoices (quote_id) where invoice_status = 'issued';
create unique index invoices_one_replacement_per_invoice
  on public.invoices (supersedes_invoice_id) where supersedes_invoice_id is not null;
create index invoices_booking_idx on public.invoices (booking_id, issued_at desc);

alter table public.invoices enable row level security;
revoke all on public.invoices from public, anon, authenticated, service_role;

create or replace function private.guard_invoice()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices cannot be deleted';
  end if;
  if old.invoice_status = 'issued' and new.invoice_status = 'cancelled'
     and new.cancelled_at is not null and new.cancelled_by is not null
     and (pg_catalog.to_jsonb(new) - 'invoice_status' - 'cancelled_at' - 'cancelled_by' - 'cancellation_reason')
         is not distinct from
         (pg_catalog.to_jsonb(old) - 'invoice_status' - 'cancelled_at' - 'cancelled_by' - 'cancellation_reason')
  then
    return new;
  end if;
  raise exception 'Issued invoices are immutable; cancel or replace them instead';
end;
$function$;
revoke all on function private.guard_invoice()
  from public, anon, authenticated, service_role;
create trigger invoices_guard
before update or delete on public.invoices
for each row execute function private.guard_invoice();

create or replace function private.reject_invoice_truncate()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Invoices cannot be truncated';
end;
$function$;
revoke all on function private.reject_invoice_truncate()
  from public, anon, authenticated, service_role;
create trigger invoices_no_truncate
before truncate on public.invoices
for each statement execute function private.reject_invoice_truncate();

alter table public.booking_documents
  add constraint booking_documents_invoice_fk
    foreign key (source_invoice_id) references public.invoices (id) on delete restrict,
  add constraint booking_documents_payment_fk
    foreign key (source_payment_id) references public.payments (id) on delete restrict;

-- A document can only be attached to a real invoice / recorded receipt of the same booking.
create or replace function private.validate_booking_document_source()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.document_type = 'invoice' then
    if not exists (
      select 1 from public.invoices as i
       where i.id = new.source_invoice_id and i.booking_id = new.booking_id
    ) then
      raise exception 'Invoice document must belong to its invoice booking';
    end if;
  elsif new.document_type = 'receipt' then
    if new.content_snapshot is null or not exists (
      select 1 from public.payments as p
       where p.id = new.source_payment_id
         and p.booking_id = new.booking_id
         and p.entry_type = 'receipt'
         and p.receipt_number is not null
    ) then
      raise exception 'Receipt document requires a recorded customer receipt payment';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.validate_booking_document_source()
  from public, anon, authenticated, service_role;
create trigger booking_documents_validate_source
before insert on public.booking_documents
for each row execute function private.validate_booking_document_source();

create or replace function private.quote_paid_total(p_quote_id uuid, p_until timestamptz default null)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    pg_catalog.sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end), 0
  )::numeric(12, 2)
    from public.payments as p
   where p.quote_id = p_quote_id
     and (p_until is null or p.created_at <= p_until);
$function$;
revoke all on function private.quote_paid_total(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.issue_invoice(
  p_booking_id uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_request_id uuid,
  p_supersedes uuid,
  p_revision integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_number text;
  v_id uuid := pg_catalog.gen_random_uuid();
  v_doc_id uuid := pg_catalog.gen_random_uuid();
  v_lines jsonb;
  v_lines_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_old_number text;
  v_snapshot jsonb;
begin
  select b.* into v_booking from public.bookings as b where b.id = p_booking_id;
  if not found or v_booking.booking_status not in ('confirmed', 'assigned', 'in_progress', 'completed') then
    raise exception 'A confirmed booking is required to issue an invoice';
  end if;
  select q.* into v_quote
    from public.booking_quotes as q
   where q.id = p_quote_id and q.booking_id = p_booking_id and q.quote_status = 'accepted'
   for update;
  if not found then
    raise exception 'An accepted booking quote is required to issue an invoice';
  end if;

  select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'description', ql.description,
             'quantity', ql.quantity,
             'unit_amount', ql.unit_amount,
             'line_total', ql.line_total
           ) order by ql.created_at, ql.id
         ),
         coalesce(pg_catalog.sum(ql.line_total), 0)
    into v_lines, v_lines_total
    from public.booking_quote_lines as ql
   where ql.quote_id = v_quote.id;
  if v_lines is null or v_lines_total <> v_quote.total then
    raise exception 'Quote lines do not match the quote total';
  end if;

  v_paid := private.quote_paid_total(v_quote.id);
  if p_supersedes is not null then
    select i.invoice_number into v_old_number from public.invoices as i where i.id = p_supersedes;
  end if;

  v_number := 'CT-INV-'
    || pg_catalog.to_char(v_now at time zone 'Asia/Colombo', 'YYYY')
    || '-'
    || pg_catalog.lpad(
         pg_catalog.nextval('private.invoice_number_seq'::pg_catalog.regclass)::text, 6, '0'
       );

  v_snapshot := pg_catalog.jsonb_build_object(
    'invoice_number', v_number,
    'revision', p_revision,
    'issued_at', v_now,
    'supersedes_invoice_number', v_old_number,
    'currency', v_quote.currency,
    'total', v_quote.total,
    'quote_revision', v_quote.revision,
    'quote_accepted_at', v_quote.accepted_at,
    'customer', pg_catalog.jsonb_build_object(
      'name', v_booking.customer_name,
      'email', v_booking.customer_email,
      'phone', v_booking.customer_phone
    ),
    'booking', pg_catalog.jsonb_build_object(
      'booking_ref', v_booking.booking_ref,
      'service_type', v_booking.service_type,
      'journey_type', v_booking.journey_type,
      'passenger_count', v_booking.passenger_count,
      'luggage_count', v_booking.luggage_count
    ),
    'legs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sequence_no', bl.sequence_no,
          'pickup_location', bl.pickup_location,
          'dropoff_location', bl.dropoff_location,
          'pickup_at', bl.pickup_at,
          'planned_end_at', bl.planned_end_at
        ) order by bl.sequence_no
      )
        from public.booking_legs as bl
       where bl.booking_id = v_booking.id
    ), '[]'::jsonb),
    'lines', v_lines,
    'payment_status_at_issue', pg_catalog.jsonb_build_object(
      'paid', v_paid,
      'balance', greatest(v_quote.total - v_paid, 0),
      'status', case
        when v_paid <= 0 then 'unpaid'
        when v_paid < v_quote.total then 'partially_paid'
        else 'paid'
      end
    )
  );

  insert into public.invoices (
    id, invoice_number, booking_id, quote_id, currency, total, revision,
    supersedes_invoice_id, issued_at, issued_by, request_id, snapshot
  )
  values (
    v_id, v_number, p_booking_id, p_quote_id, v_quote.currency, v_quote.total, p_revision,
    p_supersedes, v_now, p_actor, p_request_id, v_snapshot
  );

  insert into public.booking_documents (
    id, booking_id, document_type, title, source_invoice_id, storage_path, mime_type,
    customer_visible, driver_visible, created_by
  )
  values (
    v_doc_id, p_booking_id, 'invoice', 'Invoice ' || v_number, v_id,
    'bookings/' || p_booking_id::text || '/invoice/' || v_doc_id::text || '.pdf',
    'application/pdf', true, false, p_actor
  );
  return v_id;
end;
$function$;
revoke all on function private.issue_invoice(uuid, uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function public.admin_issue_invoice(
  p_booking_id uuid,
  p_quote_id uuid,
  p_request_id uuid
)
returns table (invoice_id uuid, invoice_number text, created boolean, document_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.invoices%rowtype;
  v_id uuid;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if p_booking_id is null or p_quote_id is null or p_request_id is null then
    raise exception 'Invoice details are invalid';
  end if;

  -- Serialize all billing operations for the booking.
  perform 1 from public.bookings as b where b.id = p_booking_id for update;
  if not found then
    raise exception 'Booking is unavailable';
  end if;

  select i.* into v_existing
    from public.invoices as i
   where i.issued_by = v_actor and i.request_id = p_request_id;
  if found then
    if v_existing.booking_id <> p_booking_id or v_existing.quote_id <> p_quote_id then
      raise exception 'Invoice request identifier was already used with different details';
    end if;
    return query select v_existing.id, v_existing.invoice_number, false,
      (select d.id from public.booking_documents as d where d.source_invoice_id = v_existing.id);
    return;
  end if;

  if exists (
    select 1 from public.invoices as i
     where i.quote_id = p_quote_id and i.invoice_status = 'issued'
  ) then
    raise exception 'An issued invoice already exists for this quote';
  end if;
  if exists (select 1 from public.invoices as i where i.quote_id = p_quote_id) then
    raise exception 'Use the replacement workflow to correct an existing invoice';
  end if;

  v_id := private.issue_invoice(p_booking_id, p_quote_id, v_actor, p_request_id, null, 1);
  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (p_booking_id, 'invoice_issued', v_actor, pg_catalog.jsonb_build_object('invoice_id', v_id));

  return query select i.id, i.invoice_number, true,
    (select d.id from public.booking_documents as d where d.source_invoice_id = i.id)
    from public.invoices as i where i.id = v_id;
end;
$function$;

create or replace function public.admin_replace_invoice(
  p_invoice_id uuid,
  p_reason text,
  p_request_id uuid
)
returns table (invoice_id uuid, invoice_number text, created boolean, document_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_old public.invoices%rowtype;
  v_booking_id uuid;
  v_existing public.invoices%rowtype;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_id uuid;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if p_invoice_id is null or p_request_id is null
     or pg_catalog.char_length(v_reason) not between 3 and 500 then
    raise exception 'Invoice correction details are invalid';
  end if;

  select i.booking_id into v_booking_id from public.invoices as i where i.id = p_invoice_id;
  if not found then
    raise exception 'Invoice is unavailable';
  end if;
  perform 1 from public.bookings as b where b.id = v_booking_id for update;

  select i.* into v_existing
    from public.invoices as i
   where i.issued_by = v_actor and i.request_id = p_request_id;
  if found then
    if v_existing.supersedes_invoice_id is distinct from p_invoice_id then
      raise exception 'Invoice request identifier was already used with different details';
    end if;
    return query select v_existing.id, v_existing.invoice_number, false,
      (select d.id from public.booking_documents as d where d.source_invoice_id = v_existing.id);
    return;
  end if;

  select i.* into v_old from public.invoices as i where i.id = p_invoice_id for update;
  if v_old.invoice_status <> 'issued' then
    raise exception 'Only an issued invoice can be replaced';
  end if;

  update public.invoices
     set invoice_status = 'cancelled', cancelled_at = v_now,
         cancelled_by = v_actor, cancellation_reason = v_reason
   where id = v_old.id;

  v_id := private.issue_invoice(
    v_old.booking_id, v_old.quote_id, v_actor, p_request_id, v_old.id, v_old.revision + 1
  );
  insert into public.booking_events (booking_id, event_type, actor_user_id, reason, details)
  values (
    v_old.booking_id, 'invoice_replaced', v_actor, v_reason,
    pg_catalog.jsonb_build_object('invoice_id', v_id, 'replaced_invoice_id', v_old.id)
  );

  return query select i.id, i.invoice_number, true,
    (select d.id from public.booking_documents as d where d.source_invoice_id = i.id)
    from public.invoices as i where i.id = v_id;
end;
$function$;

create or replace function public.admin_cancel_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_invoice public.invoices%rowtype;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(v_reason) not between 3 and 500 then
    raise exception 'A cancellation reason is required';
  end if;
  select i.* into v_invoice from public.invoices as i where i.id = p_invoice_id for update;
  if not found or v_invoice.invoice_status <> 'issued' then
    raise exception 'Only an issued invoice can be cancelled';
  end if;
  update public.invoices
     set invoice_status = 'cancelled', cancelled_at = pg_catalog.clock_timestamp(),
         cancelled_by = v_actor, cancellation_reason = v_reason
   where id = p_invoice_id;
  insert into public.booking_events (booking_id, event_type, actor_user_id, reason, details)
  values (
    v_invoice.booking_id, 'invoice_cancelled', v_actor, v_reason,
    pg_catalog.jsonb_build_object('invoice_id', v_invoice.id)
  );
end;
$function$;

create or replace function public.admin_issue_payment_receipt_document(p_payment_id uuid)
returns table (document_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_booking_id uuid;
  v_quote_total numeric(12, 2);
  v_existing uuid;
  v_id uuid := pg_catalog.gen_random_uuid();
  v_paid numeric(12, 2);
  v_invoice public.invoices%rowtype;
  v_snapshot jsonb;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select p.booking_id into v_booking_id from public.payments as p where p.id = p_payment_id;
  if not found then
    raise exception 'A recorded customer payment is required';
  end if;
  perform 1 from public.bookings as b where b.id = v_booking_id for update;

  select d.id into v_existing
    from public.booking_documents as d
   where d.document_type = 'receipt' and d.source_payment_id = p_payment_id;
  if found then
    return query select v_existing, false;
    return;
  end if;

  select p.* into v_payment from public.payments as p where p.id = p_payment_id;
  if v_payment.entry_type <> 'receipt' or v_payment.receipt_number is null then
    raise exception 'A recorded customer payment is required';
  end if;
  select b.* into v_booking from public.bookings as b where b.id = v_payment.booking_id;
  select q.total into v_quote_total from public.booking_quotes as q where q.id = v_payment.quote_id;
  v_paid := private.quote_paid_total(v_payment.quote_id, v_payment.created_at);
  select i.* into v_invoice
    from public.invoices as i
   where i.quote_id = v_payment.quote_id and i.invoice_status = 'issued';

  v_snapshot := pg_catalog.jsonb_build_object(
    'receipt_number', v_payment.receipt_number,
    'payment_id', v_payment.id,
    'payment_date', v_payment.payment_date,
    'recorded_at', v_payment.verified_at,
    'amount', v_payment.amount,
    'currency', v_payment.currency,
    'method', v_payment.method,
    'reference', v_payment.provider_reference,
    'customer', pg_catalog.jsonb_build_object(
      'name', v_booking.customer_name,
      'email', v_booking.customer_email,
      'phone', v_booking.customer_phone
    ),
    'booking_ref', v_booking.booking_ref,
    'invoice_number', v_invoice.invoice_number,
    'quote_total', v_quote_total,
    'paid_to_date', v_paid,
    'balance_after', greatest(v_quote_total - v_paid, 0),
    'is_partial_payment', v_paid < v_quote_total
  );

  insert into public.booking_documents (
    id, booking_id, document_type, title, source_payment_id, storage_path, mime_type,
    customer_visible, driver_visible, content_snapshot, created_by
  )
  values (
    v_id, v_payment.booking_id, 'receipt', 'Receipt ' || v_payment.receipt_number, v_payment.id,
    'bookings/' || v_payment.booking_id::text || '/receipt/' || v_id::text || '.pdf',
    'application/pdf', true, false, v_snapshot, v_actor
  );

  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (
    v_payment.booking_id, 'receipt_document_issued', v_actor,
    pg_catalog.jsonb_build_object('payment_id', v_payment.id, 'document_id', v_id)
  );
  return query select v_id, true;
end;
$function$;

create or replace function public.admin_list_booking_billing_documents(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  return pg_catalog.jsonb_build_object(
    'invoices', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', i.id,
          'invoice_number', i.invoice_number,
          'revision', i.revision,
          'status', i.invoice_status,
          'currency', i.currency,
          'total', i.total,
          'issued_at', i.issued_at,
          'cancelled_at', i.cancelled_at,
          'cancellation_reason', i.cancellation_reason,
          'supersedes_invoice_id', i.supersedes_invoice_id,
          'paid_now', private.quote_paid_total(i.quote_id),
          'document_id', d.id,
          'file_status', d.file_status
        ) order by i.issued_at desc
      )
        from public.invoices as i
        left join public.booking_documents as d
          on d.source_invoice_id = i.id and d.document_type = 'invoice'
       where i.booking_id = p_booking_id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'payment_id', p.id,
          'receipt_number', p.receipt_number,
          'amount', p.amount,
          'currency', p.currency,
          'payment_date', p.payment_date,
          'document_id', d.id,
          'file_status', d.file_status
        ) order by p.created_at desc
      )
        from public.payments as p
        left join public.booking_documents as d
          on d.source_payment_id = p.id and d.document_type = 'receipt'
       where p.booking_id = p_booking_id
         and p.entry_type = 'receipt'
         and p.receipt_number is not null
    ), '[]'::jsonb),
    'documents', coalesce((
      select pg_catalog.jsonb_agg(private.document_summary(d) order by d.created_at desc)
        from public.booking_documents as d
       where d.booking_id = p_booking_id
         and d.document_type = 'booking_document'
         and d.file_status = 'stored'
         and d.superseded_at is null
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.admin_issue_invoice(uuid, uuid, uuid),
  public.admin_replace_invoice(uuid, text, uuid),
  public.admin_cancel_invoice(uuid, text),
  public.admin_issue_payment_receipt_document(uuid),
  public.admin_list_booking_billing_documents(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_issue_invoice(uuid, uuid, uuid),
  public.admin_replace_invoice(uuid, text, uuid),
  public.admin_cancel_invoice(uuid, text),
  public.admin_issue_payment_receipt_document(uuid),
  public.admin_list_booking_billing_documents(uuid)
  to authenticated;

comment on table public.invoices is
  'Immutable invoice snapshots. Corrections cancel the invoice and issue a numbered replacement revision.';
