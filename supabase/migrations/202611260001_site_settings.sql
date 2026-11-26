-- System & Business Settings Portal: singleton public.site_settings table, RLS policies, and seed row.

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.has_active_role((select auth.uid()), array['super_admin']);
$function$;

revoke all on function private.is_super_admin()
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_super_admin() to authenticated;

create table if not exists public.site_settings (
  id text primary key default 'default' check (id = 'default'),
  business_name text not null default 'Chama Travel & Tours',
  tagline text not null default 'Discover Sri Lanka With Chama Travels',
  primary_phone text not null default '+94 77 000 0000',
  whatsapp_number text not null default '94770000000',
  contact_email text not null default 'info@chamatravels.com',
  office_address text not null default 'Colombo, Sri Lanka',
  registration_number text,
  facebook_url text,
  instagram_url text,
  tripadvisor_url text,
  google_review_url text,
  default_currency text not null default 'USD' check (default_currency in ('USD', 'LKR')),
  default_quote_validity_hours integer not null default 48 check (default_quote_validity_hours between 1 and 720),
  bank_account_details text,
  invoice_footer_note text not null default 'Thank you for travelling with Chama Travel & Tours.',
  hero_badge text not null default 'Explore Sri Lanka',
  hero_title text not null default 'Discover Sri Lanka With Chama Travels',
  hero_subtitle text not null default 'Experience beautiful places, unforgettable adventures and comfortable journeys across Sri Lanka with friendly local service.',
  hero_image_url text not null default '/images/beach.jpg',
  accepting_public_bookings boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function private.set_updated_at();

alter table public.site_settings enable row level security;

revoke all on table public.site_settings
  from public, anon, authenticated, service_role;

grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;
grant all on table public.site_settings to service_role;

create policy site_settings_public_read
  on public.site_settings
  for select
  to anon, authenticated
  using (id = 'default');

create policy site_settings_admin_insert
  on public.site_settings
  for insert
  to authenticated
  with check (id = 'default' and private.is_active_admin());

create policy site_settings_admin_update
  on public.site_settings
  for update
  to authenticated
  using (id = 'default' and private.is_active_admin())
  with check (id = 'default' and private.is_active_admin());

comment on table public.site_settings is
  'Singleton business, contact, billing, and website configuration managed by Admin and Super Admin roles.';

insert into public.site_settings (
  id,
  business_name,
  tagline,
  primary_phone,
  whatsapp_number,
  contact_email,
  office_address,
  facebook_url,
  instagram_url,
  tripadvisor_url,
  google_review_url
)
values (
  'default',
  'Chama Travel & Tours',
  'Discover Sri Lanka With Chama Travels',
  '+94 71 111 4901',
  '94711114901',
  'info@chamatravels.com',
  '152/1 Kahambilihena, Udathuththiripitiya, Gampaha 11054, Sri Lanka',
  'https://www.facebook.com/share/14sG15NeKV3/?mibextid=wwXIfr',
  'https://www.instagram.com/chamatravels99?stkn=eGY2aW52MTJhY2V5&utm_source=qr',
  'https://www.tripadvisor.com/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html',
  'https://www.google.com/maps/place/Chama+Travel+%26+Tours/data=!4m7!3m6!1s0x2554543128f9092d:0x2780ba119100211a!8m2!3d7.0815764!4d80.0870175!16s%2Fg%2F11lypjsjpg!19sChIJLQn5KDFUVCURGiEAkRG6gCc'
)
on conflict (id) do nothing;
