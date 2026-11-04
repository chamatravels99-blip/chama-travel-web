create table public.vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  max_passengers smallint not null,
  max_luggage smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint vehicle_categories_passengers_positive check (max_passengers > 0),
  constraint vehicle_categories_luggage_nonnegative check (max_luggage >= 0)
);

create trigger vehicle_categories_set_updated_at
before update on public.vehicle_categories
for each row execute function private.set_updated_at();

create index vehicle_categories_active_idx
  on public.vehicle_categories (is_active, display_name);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.vehicle_categories (id) on delete restrict,
  display_name text not null,
  registration_number text,
  operational_status text not null default 'active',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint vehicles_operational_status_check
    check (operational_status in ('active', 'inactive', 'maintenance'))
);

create unique index vehicles_registration_number_unique
  on public.vehicles (pg_catalog.upper(pg_catalog.btrim(registration_number)))
  where registration_number is not null;
create index vehicles_category_status_idx
  on public.vehicles (category_id, operational_status);

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function private.set_updated_at();

alter table public.vehicle_categories enable row level security;
alter table public.vehicles enable row level security;

create policy vehicle_categories_read_active
  on public.vehicle_categories for select to anon, authenticated
  using (is_active);

revoke all on public.vehicle_categories, public.vehicles
  from public, anon, authenticated, service_role;
grant select (id, code, display_name, max_passengers, max_luggage, is_active)
  on public.vehicle_categories to anon, authenticated;

comment on table public.vehicle_categories is
  'Configurable vehicle types and capacity limits used to validate bookings and assignments.';
comment on table public.vehicles is
  'Operational fleet records; never exposed to anonymous users.';
