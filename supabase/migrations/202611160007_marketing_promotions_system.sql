-- Marketing & Promotions Management System:
-- 1. public.promo_codes
-- 2. public.marketing_banners
-- 3. public.marketing_templates
-- Includes RLS policies and realistic starter seed records.

-- =====================================================================
-- 1. public.promo_codes
-- =====================================================================
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (
      pg_catalog.char_length(pg_catalog.btrim(code)) between 2 and 40
      and code = pg_catalog.upper(pg_catalog.btrim(code))
      and code ~ '^[A-Z0-9_-]+$'
    ),
  title text not null
    check (pg_catalog.char_length(pg_catalog.btrim(title)) between 2 and 200),
  discount_type text not null
    check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null
    check (
      discount_value > 0
      and (discount_type <> 'percentage' or discount_value <= 100)
    ),
  currency text not null default 'USD'
    check (currency in ('USD', 'LKR', 'ALL')),
  min_booking_amount numeric(12, 2) not null default 0
    check (min_booking_amount >= 0),
  applicable_service text not null default 'all'
    check (applicable_service in ('all', 'round_tour', 'airport_transfer', 'day_trip', 'vehicle_hire', 'custom')),
  max_uses integer
    check (max_uses is null or max_uses > 0),
  used_count integer not null default 0
    check (used_count >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_active_code_idx
  on public.promo_codes (is_active, code);

create trigger promo_codes_set_updated_at
before update on public.promo_codes
for each row execute function private.set_updated_at();

alter table public.promo_codes enable row level security;

revoke all on table public.promo_codes
  from public, anon, authenticated, service_role;

grant select on table public.promo_codes to anon, authenticated;
grant insert, update, delete on table public.promo_codes to authenticated;
grant all on table public.promo_codes to service_role;

create policy promo_codes_public_read_active
  on public.promo_codes
  for select
  to anon, authenticated
  using (
    is_active = true
    and (valid_until is null or valid_until > now())
  );

create policy promo_codes_admin_all
  on public.promo_codes
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.promo_codes is
  'Promotional and discount codes managed by Admin and Super Admin roles.';

-- =====================================================================
-- 2. public.marketing_banners
-- =====================================================================
create table if not exists public.marketing_banners (
  id uuid primary key default gen_random_uuid(),
  badge_text text
    check (badge_text is null or pg_catalog.char_length(badge_text) <= 80),
  headline text not null
    check (pg_catalog.char_length(pg_catalog.btrim(headline)) between 2 and 400),
  cta_label text
    check (cta_label is null or pg_catalog.char_length(cta_label) <= 80),
  cta_link text
    check (cta_link is null or pg_catalog.char_length(cta_link) <= 300),
  promo_code text
    check (promo_code is null or pg_catalog.char_length(promo_code) <= 40),
  theme_variant text not null default 'emerald'
    check (theme_variant in ('emerald', 'amber', 'slate')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_banners_active_idx
  on public.marketing_banners (is_active, updated_at desc);

create trigger marketing_banners_set_updated_at
before update on public.marketing_banners
for each row execute function private.set_updated_at();

alter table public.marketing_banners enable row level security;

revoke all on table public.marketing_banners
  from public, anon, authenticated, service_role;

grant select on table public.marketing_banners to anon, authenticated;
grant insert, update, delete on table public.marketing_banners to authenticated;
grant all on table public.marketing_banners to service_role;

create policy marketing_banners_public_read_active
  on public.marketing_banners
  for select
  to anon, authenticated
  using (is_active = true);

create policy marketing_banners_admin_all
  on public.marketing_banners
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.marketing_banners is
  'Website top special offer banners managed by Admin and Super Admin roles.';

-- =====================================================================
-- 3. public.marketing_templates
-- =====================================================================
create table if not exists public.marketing_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null
    check (pg_catalog.char_length(pg_catalog.btrim(title)) between 2 and 200),
  category text not null default 'seasonal_offer'
    check (category in ('seasonal_offer', 'review_request', 'airport_promo', 'follow_up')),
  message_body text not null
    check (pg_catalog.char_length(pg_catalog.btrim(message_body)) between 5 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_templates_category_idx
  on public.marketing_templates (category, created_at desc);

create trigger marketing_templates_set_updated_at
before update on public.marketing_templates
for each row execute function private.set_updated_at();

alter table public.marketing_templates enable row level security;

revoke all on table public.marketing_templates
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.marketing_templates to authenticated;
grant all on table public.marketing_templates to service_role;

create policy marketing_templates_admin_all
  on public.marketing_templates
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.marketing_templates is
  'Admin-only WhatsApp campaign and review request message templates.';

-- =====================================================================
-- 4. Seed Starter Promo Codes, Banner, and WhatsApp Templates
-- =====================================================================
insert into public.promo_codes (
  code,
  title,
  discount_type,
  discount_value,
  currency,
  min_booking_amount,
  applicable_service,
  max_uses,
  used_count,
  valid_from,
  valid_until,
  is_active
)
values
  (
    'WELCOME10',
    'First-Time Guest Welcome Discount (10% OFF)',
    'percentage',
    10,
    'ALL',
    0,
    'all',
    null,
    0,
    now(),
    null,
    true
  ),
  (
    'AIRPORT15',
    'Airport Transfer Special ($15 OFF)',
    'fixed',
    15,
    'USD',
    50,
    'airport_transfer',
    100,
    0,
    now(),
    null,
    true
  )
on conflict (code) do update
set
  title = excluded.title,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  currency = excluded.currency,
  min_booking_amount = excluded.min_booking_amount,
  applicable_service = excluded.applicable_service,
  updated_at = now();

insert into public.marketing_banners (
  badge_text,
  headline,
  cta_label,
  cta_link,
  promo_code,
  theme_variant,
  is_active
)
select
  'LIMITED OFFER',
  'Get 10% OFF on 7+ Day Sri Lanka Round Tours — Use Code: WELCOME10',
  'Claim Offer',
  '/tours',
  'WELCOME10',
  'emerald',
  false
where not exists (
  select 1 from public.marketing_banners
);

insert into public.marketing_templates (
  title,
  category,
  message_body
)
select
  seed.title,
  seed.category,
  seed.message_body
from (
  values
    (
      'Post-Trip Google & TripAdvisor Review Request',
      'review_request',
      E'Ayubowan {customer_name}! \U0001F64F\U0001F334\n\nThank you for traveling across Sri Lanka with *Chama Travels*. It was a pleasure hosting your journey!\n\nIf you enjoyed our service, could you spare 60 seconds to share a quick review on TripAdvisor or Google? Your feedback helps fellow travelers discover us:\n\n\u2B50 *TripAdvisor:* https://www.tripadvisor.com/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html\n\u2B50 *Website:* {website_url}\n\nAs a thank-you, enjoy code *{promo_code}* on your next visit or share it with friends & family. Safe travels!'
    ),
    (
      'Returning Guest & Referral VIP Offer',
      'seasonal_offer',
      E'Hello {customer_name}! \U0001F31F\n\nWarm greetings from *Chama Travels — Sri Lanka*. We are offering an exclusive VIP discount for our valued guests and their friends this season.\n\nUse promo code *{promo_code}* when booking your next private chauffeur tour or airport transfer at {website_url} for instant savings.\n\nReply to this message anytime if you would like a custom Sri Lanka itinerary!'
    ),
    (
      'Airport Transfer Quick Promo ($15 OFF)',
      'airport_promo',
      E'Hello {customer_name}! \u2708\uFE0F\U0001F697\n\nArriving in Sri Lanka soon? Book your private Bandaranaike Airport (BIA) pickup or drop-off with *Chama Travels* and use promo code *{promo_code}* for a special discount.\n\n\u2705 Flight tracking included\n\u2705 Air-conditioned private vehicle & English-speaking chauffeur\n\u2705 Book online: {website_url}/booking'
    )
) as seed(title, category, message_body)
where not exists (
  select 1
    from public.marketing_templates as existing
   where existing.title = seed.title
);
