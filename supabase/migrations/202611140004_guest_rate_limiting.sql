-- Persistent, distributed rate limiting for guest access routes. Buckets are
-- keyed by an opaque SHA-256 digest computed by the server (endpoint + token
-- hash or client IP + server secret); no raw tokens or addresses are stored.

create table private.rate_limit_buckets (
  bucket_hash bytea not null check (pg_catalog.octet_length(bucket_hash) = 32),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket_hash, window_start)
);
create index rate_limit_buckets_window_idx on private.rate_limit_buckets (window_start);
alter table private.rate_limit_buckets enable row level security;
revoke all on private.rate_limit_buckets from public, anon, authenticated, service_role;

create or replace function public.check_rate_limit(
  p_bucket_hash bytea,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_epoch bigint := pg_catalog.floor(pg_catalog.date_part('epoch', v_now))::bigint;
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_bucket_hash is null or pg_catalog.octet_length(p_bucket_hash) <> 32
     or p_limit is null or p_limit not between 1 and 10000
     or p_window_seconds is null or p_window_seconds not between 1 and 86400
  then
    raise exception 'Rate limit parameters are invalid';
  end if;

  v_window_start := pg_catalog.to_timestamp(v_epoch - (v_epoch % p_window_seconds));

  insert into private.rate_limit_buckets as b (bucket_hash, window_start, hits)
  values (p_bucket_hash, v_window_start, 1)
  on conflict (bucket_hash, window_start)
  do update set hits = b.hits + 1
  returning b.hits into v_hits;

  if pg_catalog.random() < 0.01 then
    delete from private.rate_limit_buckets as old
     where old.window_start < v_now - interval '2 days';
  end if;

  return query select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    greatest(
      pg_catalog.ceil(
        pg_catalog.date_part('epoch', v_window_start + pg_catalog.make_interval(secs => p_window_seconds) - v_now)
      )::integer,
      1
    );
end;
$function$;

revoke all on function public.check_rate_limit(bytea, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.check_rate_limit(bytea, integer, integer) to service_role;

-- Guest token operations must go through the rate-limited server routes, so
-- they are no longer directly callable with the public anon key.
revoke all on function public.accept_guest_quote(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_guest_booking_tracker(text)
  from public, anon, authenticated;
grant execute on function public.accept_guest_quote(uuid, text) to service_role;
grant execute on function public.get_guest_booking_tracker(text) to service_role;

comment on function public.check_rate_limit(bytea, integer, integer) is
  'Atomic fixed-window counter for server-side guest route rate limiting; executable by service_role only.';
