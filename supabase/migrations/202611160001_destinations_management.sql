-- Destinations Management System: table, RLS policies, storage bucket policies, and initial seed data.

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.has_active_role((select auth.uid()), array['admin', 'super_admin']);
$function$;

revoke all on function private.is_active_admin()
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_active_admin() to authenticated;

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  region text,
  tagline text,
  description text,
  image_url text not null check (pg_catalog.char_length(pg_catalog.btrim(image_url)) > 0),
  highlights text[] not null default '{}'::text[],
  best_time text,
  travel_duration text,
  is_featured_home boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists destinations_active_order_idx
  on public.destinations (is_active, display_order asc, created_at asc);

create index if not exists destinations_featured_home_order_idx
  on public.destinations (is_featured_home, display_order asc)
  where is_active = true;

create trigger destinations_set_updated_at
before update on public.destinations
for each row execute function private.set_updated_at();

alter table public.destinations enable row level security;

revoke all on table public.destinations
  from public, anon, authenticated, service_role;

grant select on table public.destinations to anon, authenticated;
grant insert, update, delete on table public.destinations to authenticated;
grant all on table public.destinations to service_role;

create policy destinations_public_read_active
  on public.destinations
  for select
  to anon, authenticated
  using (is_active = true);

create policy destinations_admin_all
  on public.destinations
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.destinations is
  'Public Sri Lanka destinations managed by Admin and Super Admin roles.';

do $storage$
begin
  if pg_catalog.to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      (
        'website-assets',
        'website-assets',
        true,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
      ),
      (
        'destinations',
        'destinations',
        true,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
      )
    on conflict (id) do update
      set public = true,
          file_size_limit = 10485760,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  end if;

  if pg_catalog.to_regclass('storage.objects') is not null then
    execute $policy$
      create policy website_assets_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id in ('website-assets', 'destinations'))
    $policy$;

    execute $policy$
      create policy website_assets_admin_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id in ('website-assets', 'destinations')
        and private.is_active_admin()
      )
    $policy$;

    execute $policy$
      create policy website_assets_admin_update on storage.objects
      for update to authenticated
      using (
        bucket_id in ('website-assets', 'destinations')
        and private.is_active_admin()
      )
      with check (
        bucket_id in ('website-assets', 'destinations')
        and private.is_active_admin()
      )
    $policy$;

    execute $policy$
      create policy website_assets_admin_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id in ('website-assets', 'destinations')
        and private.is_active_admin()
      )
    $policy$;
  end if;
end
$storage$;

insert into public.destinations (
  name,
  slug,
  region,
  tagline,
  description,
  image_url,
  highlights,
  best_time,
  travel_duration,
  is_featured_home,
  is_active,
  display_order
)
values
  (
    'Sigiriya',
    'sigiriya',
    'Cultural Triangle',
    'Ancient Lions Rock Fortress & Royal Heritage',
    'A UNESCO World Heritage site featuring a 5th-century palace fortress built atop a 200-meter sheer rock, surrounded by lush water gardens and ancient frescoes.',
    '/images/Sigiriya.jpeg',
    array[
      'Climb Sigiriya Rock at sunrise or sunset',
      'Panoramic views from Pidurangala Rock',
      'Explore Polonnaruwa and Dambulla Cave Temple'
    ],
    'December to April',
    '2 - 3 Days (4 hrs from Airport)',
    true,
    true,
    1
  ),
  (
    'Ella',
    'ella',
    'Hill Country',
    'Misty Mountains, Tea Trails & Iconic Railway Bridges',
    'A peaceful mountain village famed for its breathtaking views, hiking trails through tea gardens, waterfalls, and the iconic Nine Arches Bridge.',
    '/images/Ella_adventure.JPG',
    array[
      'Watch train crossing Nine Arches Bridge',
      'Hike Little Adam''s Peak & Ella Rock',
      'Scenic train ride from Kandy to Ella'
    ],
    'January to May',
    '2 - 3 Days (5.5 hrs from Airport)',
    true,
    true,
    2
  ),
  (
    'Kandy',
    'kandy',
    'Cultural Triangle',
    'Sacred Tooth Relic, Royal Botanical Gardens & Tradition',
    'Sri Lanka''s last royal kingdom nestled among green hills, home to the Temple of the Sacred Tooth Relic and traditional Kandyan dance performances.',
    '/images/temple-of-the-tooth.jpg',
    array[
      'Temple of the Sacred Tooth Relic (Sri Dalada Maligawa)',
      'Royal Botanical Gardens Peradeniya',
      'Kandyan Cultural Dance Show'
    ],
    'December to April',
    '1 - 2 Days (3 hrs from Airport)',
    true,
    true,
    3
  ),
  (
    'Mirissa',
    'mirissa',
    'South Coast',
    'Golden Beaches, Whale Watching & Palm Rope Swings',
    'A vibrant coastal paradise known for its laid-back beach vibe, blue whale safaris, Coconut Tree Hill, and fresh seafood dining on the sand.',
    '/images/mirissa_turtle.jpg',
    array[
      'Blue Whale & Dolphin Watching Safaris',
      'Sunset view at Coconut Tree Hill',
      'Surfing & beach relaxation in Weligama'
    ],
    'November to April',
    '2 - 4 Days (2.5 hrs from Airport)',
    true,
    true,
    4
  ),
  (
    'Yala',
    'yala',
    'Wildlife & Nature',
    'Wild Leopards, Elephants & Coastal Wilderness',
    'Sri Lanka’s most famous wildlife sanctuary, possessing one of the highest leopard densities in the world alongside wild elephants and sloth bears.',
    '/images/leopard-yala-national-park.jpg',
    array[
      'Jeep Safari targeting Leopard tracking',
      'Wild Elephant herds near waterholes',
      'Coastal wilderness & bird watching'
    ],
    'February to July',
    '1 - 2 Days (4.5 hrs from Airport)',
    true,
    true,
    5
  ),
  (
    'Galle',
    'galle',
    'South Coast',
    '17th Century Dutch Fortification & Colonial Charm',
    'A historic fortified enclave where European colonial architecture blends seamlessly with tropical ocean views, boutique cafes, and artisan shops.',
    '/images/galle_fort.JPG',
    array[
      'Sunset walk on Galle Fort Ramparts',
      'Galle Lighthouse & colonial streets',
      'Boutique shopping & artisan coffee'
    ],
    'December to April',
    '1 - 2 Days (2 hrs from Airport)',
    true,
    true,
    6
  ),
  (
    'Nuwara Eliya',
    'nuwara-eliya',
    'Hill Country',
    'Little England & Emerald Tea Estates',
    'Perched high in the central highlands, Nuwara Eliya charms visitors with cool mountain air, colonial bungalows, Gregory Lake, and rolling Ceylon tea plantations.',
    '/images/nuwaraeliya.jpg',
    array[
      'Ceylon Tea Factory tour & tasting',
      'Boat ride & stroll around Gregory Lake',
      'Horton Plains & World''s End trek'
    ],
    'January to May',
    '1 - 2 Days (4.5 hrs from Airport)',
    true,
    true,
    7
  ),
  (
    'Bentota',
    'bentota',
    'South Coast',
    'Golden Beaches, Mangroves & Water Sports',
    'A premier resort town on the southwest coast offering calm golden beaches, thrilling lagoon water sports, sea turtle hatcheries, and Madu River boat safaris.',
    '/images/benthota_water_sport.jpg',
    array[
      'Jet skiing & lagoon water sports',
      'Madu River mangrove boat safari',
      'Kosgoda Sea Turtle Hatchery visit'
    ],
    'November to April',
    '1 - 3 Days (1.5 hrs from Airport)',
    true,
    true,
    8
  ),
  (
    'Colombo',
    'colombo',
    'Heritage & Cities',
    'The Bustling Oceanfront Capital City',
    'Sri Lanka’s vibrant commercial capital where historic colonial landmarks, Gangaramaya Temple, colourful Pettah markets, and Galle Face Green meet modern dining.',
    '/images/colombo-sri-lanka.jpg',
    array[
      'Gangaramaya Temple & Seema Malaka',
      'Sunset street food at Galle Face Green',
      'Lotus Tower & historic Pettah bazaar'
    ],
    'Year-round (Best Dec - Apr)',
    '1 - 2 Days (45 mins from Airport)',
    true,
    true,
    9
  ),
  (
    'Negombo',
    'negombo',
    'Heritage & Cities',
    'Coastal Charm, Dutch Canals & Lagoon Sunsets',
    'Located just minutes from the international airport, Negombo welcomes travelers with wide sandy beaches, historic Dutch canals, and traditional catamarans.',
    '/images/negombo-heritance.jpg',
    array[
      'Negombo Lagoon boat safari',
      'Historic Dutch Canal & fish markets',
      'Relaxing sunset beach walk'
    ],
    'December to April',
    '1 Day (20 mins from Airport)',
    true,
    true,
    10
  )
on conflict (slug) do update
  set name = excluded.name,
      region = excluded.region,
      tagline = excluded.tagline,
      description = excluded.description,
      image_url = excluded.image_url,
      highlights = excluded.highlights,
      best_time = excluded.best_time,
      travel_duration = excluded.travel_duration,
      is_featured_home = excluded.is_featured_home,
      is_active = excluded.is_active,
      display_order = excluded.display_order,
      updated_at = now();
