create table public.pricing_packages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique,
  name text not null,
  service_type text not null,
  currency char(3) not null,
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pricing_packages_currency_check check (currency in ('LKR', 'USD')),
  constraint pricing_packages_validity_check
    check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create index pricing_packages_service_active_idx
  on public.pricing_packages (service_type, is_active, valid_from);

create trigger pricing_packages_set_updated_at
before update on public.pricing_packages
for each row execute function private.set_updated_at();

create table public.pricing_rules (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  package_id uuid not null references public.pricing_packages (id) on delete restrict,
  category_id uuid references public.vehicle_categories (id) on delete restrict,
  rule_type text not null,
  unit text not null,
  amount numeric(12, 2) not null,
  min_quantity numeric(10, 2),
  max_quantity numeric(10, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint pricing_rules_amount_nonnegative check (amount >= 0),
  constraint pricing_rules_min_quantity_check
    check (min_quantity is null or min_quantity >= 0),
  constraint pricing_rules_max_quantity_check
    check (max_quantity is null or max_quantity >= 0),
  constraint pricing_rules_quantity_bounds_check
    check (
      min_quantity is null
      or max_quantity is null
      or max_quantity >= min_quantity
    )
);

create index pricing_rules_package_category_active_idx
  on public.pricing_rules (package_id, category_id, is_active);

create trigger pricing_rules_set_updated_at
before update on public.pricing_rules
for each row execute function private.set_updated_at();

alter table public.pricing_packages enable row level security;
alter table public.pricing_rules enable row level security;

revoke all on public.pricing_packages, public.pricing_rules
  from public, anon, authenticated, service_role;

comment on table public.pricing_packages is
  'Versionable server-side pricing packages, limited to LKR and USD.';
comment on table public.pricing_rules is
  'Declarative pricing inputs; never executable expressions or client-authoritative totals.';
