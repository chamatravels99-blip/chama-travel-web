-- Gallery & Activities Management System: tables, RLS policies, and initial seed data.
-- Images are stored in the existing public 'website-assets' bucket under the
-- 'gallery/' and 'activities/' prefixes (bucket + admin storage policies were
-- created in 202611160001_destinations_management.sql).

-- =====================================================================
-- public.gallery_photos
-- =====================================================================
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  title text check (title is null or pg_catalog.char_length(title) <= 200),
  alt_text text not null check (pg_catalog.char_length(pg_catalog.btrim(alt_text)) between 1 and 300),
  category text not null default 'Journeys'
    check (pg_catalog.char_length(pg_catalog.btrim(category)) between 1 and 80),
  image_url text not null check (pg_catalog.char_length(pg_catalog.btrim(image_url)) > 0),
  layout_size text not null default 'standard'
    check (layout_size in ('standard', 'wide', 'featured')),
  is_featured_home boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_photos_active_order_idx
  on public.gallery_photos (is_active, display_order asc, created_at asc);

create index if not exists gallery_photos_featured_home_order_idx
  on public.gallery_photos (is_featured_home, display_order asc)
  where is_active = true;

create trigger gallery_photos_set_updated_at
before update on public.gallery_photos
for each row execute function private.set_updated_at();

alter table public.gallery_photos enable row level security;

revoke all on table public.gallery_photos
  from public, anon, authenticated, service_role;

grant select on table public.gallery_photos to anon, authenticated;
grant insert, update, delete on table public.gallery_photos to authenticated;
grant all on table public.gallery_photos to service_role;

create policy gallery_photos_public_read_active
  on public.gallery_photos
  for select
  to anon, authenticated
  using (is_active = true);

create policy gallery_photos_admin_all
  on public.gallery_photos
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.gallery_photos is
  'Public website photo gallery managed by Admin and Super Admin roles.';

-- =====================================================================
-- public.activities
-- =====================================================================
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (pg_catalog.char_length(pg_catalog.btrim(category)) between 1 and 80),
  location text,
  duration text,
  price_usd numeric check (price_usd is null or price_usd >= 0),
  price_lkr numeric check (price_lkr is null or price_lkr >= 0),
  description text not null check (pg_catalog.char_length(pg_catalog.btrim(description)) > 0),
  image_url text not null check (pg_catalog.char_length(pg_catalog.btrim(image_url)) > 0),
  image_alt text,
  highlights text[] not null default '{}'::text[],
  is_featured_home boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_active_order_idx
  on public.activities (is_active, display_order asc, created_at asc);

create index if not exists activities_featured_home_order_idx
  on public.activities (is_featured_home, display_order asc)
  where is_active = true;

create trigger activities_set_updated_at
before update on public.activities
for each row execute function private.set_updated_at();

alter table public.activities enable row level security;

revoke all on table public.activities
  from public, anon, authenticated, service_role;

grant select on table public.activities to anon, authenticated;
grant insert, update, delete on table public.activities to authenticated;
grant all on table public.activities to service_role;

create policy activities_public_read_active
  on public.activities
  for select
  to anon, authenticated
  using (is_active = true);

create policy activities_admin_all
  on public.activities
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.activities is
  'Public Sri Lanka activities & experiences managed by Admin and Super Admin roles.';

-- =====================================================================
-- Seed: gallery photos (Home Page mosaic first, then /gallery extras).
-- Seeds only when the table is empty so re-running never duplicates rows.
-- =====================================================================
insert into public.gallery_photos (
  title, alt_text, category, image_url, layout_size, is_featured_home, is_active, display_order
)
select seed.title, seed.alt_text, seed.category, seed.image_url, seed.layout_size,
       seed.is_featured_home, true, seed.display_order
from (
  values
    ('Happy Travelers', 'Happy travelers exploring Sri Lanka with Chama Travels', 'Happy Guests', '/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg', 'featured', true, 1),
    ('Scenic Moments', 'Scenic travel moments and sightseeing in Sri Lanka', 'Journeys', '/images/2024_07_26_21_27_56_47FA4CFD-FCDD-4AC3-94BF-AC5FD4CE820F.jpg', 'standard', true, 2),
    ('Private Transport', 'Tourists enjoying private transport across Sri Lankan destinations', 'Journeys', '/images/2024_03_30_11_21_19_IMG_1200.jpg', 'standard', true, 3),
    ('Cultural Landmark', 'Cultural landmark visit with Chama Travels chauffeur guide', 'Culture & Heritage', '/images/2024_10_12_15_22_52_IMG_3436.jpg', 'featured', true, 4),
    ('Highlands & Tea', 'Travelers visiting Sri Lanka highlands and tea plantations', 'Hill Country', '/images/2024_11_28_09_44_28_IMG_4455.jpg', 'standard', true, 5),
    ('Holiday Memories', 'Memorable holiday moments with local Sri Lankan driver guide', 'Happy Guests', '/images/2024_12_18_10_08_44_IMG_4962.jpg', 'standard', true, 6),
    ('Sigiriya Viewpoint', 'Sigiriya Rock Fortress panoramic viewpoint in Sri Lanka', 'Culture & Heritage', '/images/2025_07_23_06_19_23_IMG_0757.jpg', 'standard', true, 7),
    ('Family Heritage Tour', 'Family touring iconic Sri Lanka heritage sites', 'Culture & Heritage', '/images/2025_10_01_10_59_58_IMG_2604(1).jpg', 'wide', true, 8),
    ('Wildlife & Coast', 'Island wildlife and coastal adventure with Chama Travels', 'Wildlife', '/images/2026_02_27_10_52_34_IMG_5805.jpg', 'standard', true, 9),
    ('Chama Travels Journey', 'Chama Travels journey across Sri Lanka', 'Journeys', '/images/1307254.jpg', 'standard', false, 10),
    ('Sri Lanka Beach', 'Sri Lanka beach tour with Chama Travels', 'Beaches', '/images/beach.jpg', 'standard', false, 11),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2024_11_06_10_35_25_IMG_3959.jpg', 'standard', false, 12),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2024_11_07_00_48_21_IMG_4030.jpg', 'standard', false, 13),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2024_11_30_06_50_30_IMG_4470.jpg', 'standard', false, 14),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2025_05_27_10_49_29_IMG_9935.jpg', 'standard', false, 15),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2025_09_06_13_09_56_IMG_2081.jpg', 'standard', false, 16),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2025_10_10_12_45_43_IMG_2800.jpg', 'standard', false, 17),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2025_10_11_08_51_11_IMG_2829.jpg', 'standard', false, 18),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2026_01_11_18_33_10_IMG_5149.jpg', 'standard', false, 19),
    (null, 'Chama Travels tour moment in Sri Lanka', 'Journeys', '/images/2026_03_05_17_43_47_IMG_5910.jpg', 'standard', false, 20),
    ('About Chama Travels', 'About Chama Travels', 'Journeys', '/images/aboutimage.jpg', 'standard', false, 21),
    (null, 'Happy guests travelling with Chama Travels', 'Happy Guests', '/images/WhatsApp Image 2024-12-29 at 13.02.42_b9b4dbaa.jpg', 'standard', false, 22),
    (null, 'Happy guests travelling with Chama Travels', 'Happy Guests', '/images/WhatsApp Image 2024-12-29 at 13.05.37_9e691c01.jpg', 'standard', false, 23),
    (null, 'Happy guests travelling with Chama Travels', 'Happy Guests', '/images/WhatsApp Image 2024-12-29 at 13.05.48_c650a197.jpg', 'standard', false, 24)
) as seed(title, alt_text, category, image_url, layout_size, is_featured_home, display_order)
where not exists (select 1 from public.gallery_photos);

-- =====================================================================
-- Seed: activities (/activities page + Home Page "Things to Do").
-- =====================================================================
insert into public.activities (
  title, slug, category, location, duration, price_usd, price_lkr, description,
  image_url, image_alt, highlights, is_featured_home, is_active, display_order
)
values
  (
    'Sri Lankan Village & Food Experience',
    'sri-lankan-village-food-experience',
    'Culture & Culinary',
    'Sigiriya / Habarana',
    'Half Day',
    null, null,
    'Experience authentic rural life, traditional cooking in clay pots, bullock cart rides, and boat tours through lotus lagoons. Enjoy genuine hospitality from local villagers and taste organic delicacies.',
    '/images/village_tour.jpg',
    'Outdoor cooking in a Sri Lankan village',
    array['Clay-pot cooking demonstration', 'Bullock cart ride', 'Lotus lagoon catamaran ride'],
    true, true, 1
  ),
  (
    'Ella Hiking & Mountain Adventure',
    'ella-hiking-mountain-adventure',
    'Adventure & Nature',
    'Ella',
    'Full Day / Multi-Day',
    null, null,
    'Hike through lush green tea plantations, climb Little Adam’s Peak and Ella Rock, and marvel at the breathtaking Nine Arches Bridge surrounded by misty mountains.',
    '/images/Ella_adventure.JPG',
    'Green hills and valleys in Ella, Sri Lanka',
    array['Little Adam''s Peak hike', 'Ella Rock trail', 'Nine Arches Bridge'],
    true, true, 2
  ),
  (
    'Yala National Park Safari',
    'yala-national-park-safari',
    'Wildlife',
    'Yala',
    '3 - 4 Hours',
    null, null,
    'Embark on an exciting 4x4 jeep safari in Sri Lanka''s premier wildlife park, famed for having one of the highest leopard densities in the world, alongside elephants and sloth bears.',
    '/images/yala-leopard.jpg',
    'Elephants in Yala National Park',
    array['4x4 jeep safari', 'Leopard tracking', 'Elephants & sloth bears'],
    true, true, 3
  ),
  (
    'Udawalawe Elephant Transit Safari',
    'udawalawe-elephant-transit-safari',
    'Wildlife',
    'Udawalawe',
    '3 Hours',
    null, null,
    'Witness majestic wild elephant herds roaming freely across vast grasslands, plus deer, water buffaloes, and exotic bird species in their natural sanctuary.',
    '/images/udawalawe.jpg',
    'Sri Lankan elephant in Udawalawe National Park',
    array['Wild elephant herds', 'Open grassland safari', 'Exotic bird watching'],
    true, true, 4
  ),
  (
    'Mirissa Whale & Dolphin Watching',
    'mirissa-whale-dolphin-watching',
    'Coastal Adventure',
    'Mirissa',
    '4 - 5 Hours',
    null, null,
    'Sail into the Indian Ocean from Mirissa harbor to spot magnificent blue whales, sperm whales, and playful pods of dolphins in the tropical waters.',
    '/images/whale.jpg',
    'Blue whale diving in the ocean near Sri Lanka',
    array['Blue & sperm whales', 'Spinner dolphin pods', 'Morning ocean cruise'],
    true, true, 5
  ),
  (
    'Kithulgala Whitewater Rafting',
    'kithulgala-whitewater-rafting',
    'Adventure & Nature',
    'Kithulgala',
    '2 - 3 Hours',
    null, null,
    'Navigate the thrilling rapids of the Kelani River surrounded by lush tropical rainforests. Perfect for adventure seekers looking for an adrenaline rush!',
    '/images/kithulgala_rafting.jpg',
    'Rafters navigating whitewater on a tropical river',
    array['Kelani River rapids', 'Rainforest scenery', 'Professional safety guides'],
    true, true, 6
  ),
  (
    'Madu River Mangrove Boat Safari',
    'madu-river-mangrove-boat-safari',
    'Nature & Relaxation',
    'Balapitiya / Bentota',
    '2 Hours',
    null, null,
    'Cruise calm river waters through dense mangrove tunnels, visit cinnamon island, and experience natural fish massage therapy in a tranquil wetland setting.',
    '/images/madu_river.jpg',
    'Boat travelling through calm mangrove waterways',
    array['Mangrove tunnels', 'Cinnamon island visit', 'Natural fish therapy'],
    true, true, 7
  ),
  (
    'Ceylon Tea Plantation & Factory Tour',
    'ceylon-tea-plantation-factory-tour',
    'Heritage & Nature',
    'Nuwara Eliya',
    '2 Hours',
    null, null,
    'Walk amidst emerald tea bushes, learn about hand-picking techniques from local pluckers, and taste world-famous Ceylon tea at a historic factory.',
    '/images/Tea-Plantation.jpg',
    'Lush tea plantation in Sri Lanka highlands',
    array['Tea estate walk', 'Factory process tour', 'Fresh Ceylon tea tasting'],
    true, true, 8
  ),
  (
    'Bentota Water Sports',
    'bentota-water-sports',
    'Coastal Adventure',
    'Bentota',
    '1 - 3 Hours',
    null, null,
    'Try beachside water activities along Sri Lanka’s western coast, from jet skiing and banana boat rides to windsurfing and calm lagoon kayaking.',
    'https://images.pexels.com/photos/10825335/pexels-photo-10825335.jpeg?auto=compress&cs=tinysrgb&w=800',
    'Windsurfer on Sri Lankan coastal waters',
    array['Jet skiing', 'Banana boat rides', 'Lagoon kayaking'],
    true, true, 9
  ),
  (
    'Surfing in Sri Lanka',
    'surfing-in-sri-lanka',
    'Coastal Adventure',
    'Weligama',
    '2 Hours',
    null, null,
    'Catch a wave at one of Sri Lanka’s well-known surf beaches, with beginner-friendly lessons and board rentals in sheltered southern bays.',
    'https://images.pexels.com/photos/34714740/pexels-photo-34714740.jpeg?auto=compress&cs=tinysrgb&w=800',
    'Surfer walking along Weligama Beach at sunset',
    array['Beginner surf lessons', 'Board rental', 'Sunset sessions'],
    true, true, 10
  )
on conflict (slug) do nothing;
