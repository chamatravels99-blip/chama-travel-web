-- Tour Packages Management System: table, RLS policies, and initial seed data.

create table if not exists public.tour_packages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text,
  duration text not null check (pg_catalog.char_length(pg_catalog.btrim(duration)) > 0),
  days_count integer not null default 1 check (days_count >= 1),
  price_usd numeric,
  price_lkr numeric,
  price_note text,
  tagline text,
  description text,
  image_url text not null check (pg_catalog.char_length(pg_catalog.btrim(image_url)) > 0),
  destinations_covered text[] not null default '{}'::text[],
  highlights text[] not null default '{}'::text[],
  included text[] not null default '{}'::text[],
  itinerary jsonb not null default '[]'::jsonb,
  is_featured_home boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tour_packages_active_order_idx
  on public.tour_packages (is_active, display_order asc, created_at asc);

create index if not exists tour_packages_featured_home_order_idx
  on public.tour_packages (is_featured_home, display_order asc)
  where is_active = true;

create trigger tour_packages_set_updated_at
before update on public.tour_packages
for each row execute function private.set_updated_at();

alter table public.tour_packages enable row level security;

revoke all on table public.tour_packages
  from public, anon, authenticated, service_role;

grant select on table public.tour_packages to anon, authenticated;
grant insert, update, delete on table public.tour_packages to authenticated;
grant all on table public.tour_packages to service_role;

create policy tour_packages_public_read_active
  on public.tour_packages
  for select
  to anon, authenticated
  using (is_active = true);

create policy tour_packages_admin_all
  on public.tour_packages
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.tour_packages is
  'Public Sri Lanka tour packages and itineraries managed by Admin and Super Admin roles.';

insert into public.tour_packages (
  title,
  slug,
  category,
  duration,
  days_count,
  price_usd,
  price_lkr,
  price_note,
  tagline,
  description,
  image_url,
  destinations_covered,
  highlights,
  included,
  itinerary,
  is_featured_home,
  is_active,
  display_order
)
values
  (
    '8-Day Highlights of Sri Lanka',
    '8-day-highlights-of-sri-lanka',
    'Multi-Day Round Tours',
    '8 Days / 7 Nights',
    8,
    550,
    165000,
    'per vehicle',
    'Bestseller • Ancient Sigiriya, Royal Kandy, Scenic Ella Train & Yala Safari',
    'The definitive Sri Lankan circuit: climb ancient Sigiriya, explore royal Kandy, ride the scenic mountain train to Ella, spot wild leopards in Yala, and unwind on Mirissa''s palm-lined beaches.',
    '/images/Seema-Malaka-Temple-colombo-sri-lanka.jpg',
    array['Sigiriya', 'Kandy', 'Nuwara Eliya', 'Ella', 'Yala', 'Mirissa'],
    array[
      'Climb UNESCO Sigiriya Lion Rock Fortress & Dambulla Golden Temple',
      'Kandy Temple of the Sacred Tooth Relic & Royal Botanical Gardens',
      'World-famous scenic blue train journey through misty tea plantations',
      'Exciting 4x4 wildlife safari in Yala National Park for leopards & elephants',
      'Sunset at Mirissa''s Coconut Tree Hill & optional ocean whale watching'
    ],
    array[
      'Private air-conditioned vehicle exclusively for your party throughout the tour',
      'Experienced, polite, English-speaking driver/chauffeur guide',
      'All fuel costs, expressway tolls, highway fees, and parking charges',
      'Driver''s meals, overnight accommodation, and daily allowances',
      'Bandaranaike International Airport (CMB) pickup and drop-off',
      'Complimentary cold bottled water throughout journeys',
      'Flexible photo stops, coconut water breaks, and route adjustments',
      '24/7 dedicated travel support via phone and WhatsApp'
    ],
    '[
      {
        "day": 1,
        "title": "Airport Welcome & Journey to the Cultural Triangle",
        "route": "Airport (CMB) → Pinnawala / Dambulla → Sigiriya",
        "description": "Warm traditional meet-and-greet at Colombo Airport by your personal Chama Travels chauffeur. Travel inland through tropical countryside, visit the Pinnawala Elephant sanctuary, and explore the ancient Dambulla Royal Cave Temple adorned with 150+ Buddha statues.",
        "activities": [
          "Airport greeting with cold refreshments",
          "Scenic countryside drive towards Cultural Triangle",
          "Visit UNESCO World Heritage Dambulla Cave Temple",
          "Evening check-in at your Sigiriya hotel & relaxation"
        ],
        "overnightLocation": "Sigiriya / Habarana",
        "travelTime": "~3.5 - 4 hours driving"
      },
      {
        "day": 2,
        "title": "Sigiriya Lion Rock & Traditional Village Safari",
        "route": "Sigiriya → Hiriwadunna Village → Sigiriya",
        "description": "Rise early to beat the heat and climb King Kashyapa''s dramatic 5th-century Sigiriya Rock Fortress. In the afternoon, enjoy an authentic rural village catamaran ride, bullock cart ride, and traditional clay-pot home cooking demonstration.",
        "activities": [
          "Early morning Sigiriya Lion Rock Fortress ascent",
          "Panoramic 360-degree views from the palace summit",
          "Traditional village safari with catamaran lake cruise",
          "Authentic Sri Lankan rice & curry lunch cooked on firewood"
        ],
        "overnightLocation": "Sigiriya / Habarana",
        "travelTime": "Local transfers (~30 mins)"
      },
      {
        "day": 3,
        "title": "Spice Gardens & The Royal Kingdom of Kandy",
        "route": "Sigiriya → Matale Spice Garden → Kandy",
        "description": "Drive south into the central hills. Stop at an aromatic Matale spice garden to learn about Ceylon cinnamon, cardamom, and natural remedies. Reach the sacred hill capital of Kandy, visit the Golden Temple of the Sacred Tooth Relic, and witness a vibrant cultural dance performance.",
        "activities": [
          "Herbal & Spice sanctuary guided walk in Matale",
          "Kandy city tour & walk around scenic Kandy Lake",
          "Visit the sacred Temple of the Tooth Relic (Sri Dalada Maligawa)",
          "Witness a live traditional Kandyan drumming and fire-walking show"
        ],
        "overnightLocation": "Kandy",
        "travelTime": "~2.5 - 3 hours driving"
      },
      {
        "day": 4,
        "title": "Misty Tea Estates & Little England",
        "route": "Kandy → Peradeniya → Ramboda Falls → Nuwara Eliya",
        "description": "Tour the sprawling Peradeniya Royal Botanical Gardens before ascending into the cool highlands. Marvel at the cascading Ramboda Falls, tour a functioning Ceylon tea factory with tasting, and arrive in colonial Nuwara Eliya.",
        "activities": [
          "Royal Botanical Gardens stroll",
          "Scenic ascent past endless emerald tea terraces",
          "Photo stop at Ramboda Waterfall",
          "Working Ceylon Tea Factory & estate tour with fresh tea tasting"
        ],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "~2.5 - 3 hours driving"
      },
      {
        "day": 5,
        "title": "Iconic Hill Country Train & Ella Wonders",
        "route": "Nanu Oya → Scenic Train → Ella",
        "description": "Board the world''s most scenic highland train from Nanu Oya to Ella. Your driver transports your luggage ahead while you sit back enjoying breathtaking bridges, misty valleys, and waterfall vistas. Meet your driver in Ella and visit the famed Nine Arches Bridge.",
        "activities": [
          "Scenic blue train ride across the central highlands",
          "Walk to the architectural wonder: Nine Arches Bridge",
          "Hike to Little Adam''s Peak for sweeping valley panoramas",
          "Relaxed evening in Ella''s vibrant cafe street"
        ],
        "overnightLocation": "Ella",
        "travelTime": "~2.5 hours train ride"
      },
      {
        "day": 6,
        "title": "Ravana Falls & Wild Leopard Safari in Yala",
        "route": "Ella → Ravana Falls → Yala National Park",
        "description": "Descend from the mountains past the roaring Ravana Waterfall into the southern dry zone. Check in near Yala and embark on an adrenaline-pumping afternoon 4x4 open-top jeep safari across Sri Lanka''s premiere wildlife sanctuary.",
        "activities": [
          "Photo stop at legendary Ravana Waterfall",
          "Afternoon 4x4 private Jeep Safari in Yala National Park",
          "Track wild leopards, sloth bears, Asian elephants, and crocodiles"
        ],
        "overnightLocation": "Yala / Tissamaharama",
        "travelTime": "~2.5 hours driving"
      },
      {
        "day": 7,
        "title": "Southern Coastline & Mirissa Paradise",
        "route": "Yala → Tangalle → Weligama → Mirissa",
        "description": "Drive along the shimmering southern coastline. Observe the unique traditional stilt fishermen of Weligama and arrive at the tropical paradise of Mirissa. Climb Coconut Tree Hill for sunset and savor fresh seafood by the ocean.",
        "activities": [
          "Coastal drive past secluded southern bays & coves",
          "Witness traditional Sri Lankan stilt fishermen",
          "Sunset photography at iconic Coconut Tree Hill"
        ],
        "overnightLocation": "Mirissa",
        "travelTime": "~2.5 hours driving"
      },
      {
        "day": 8,
        "title": "Galle Dutch Fort & Departure",
        "route": "Mirissa → Galle Dutch Fort → Colombo / Airport",
        "description": "Optional early morning whale watching boat excursion. Afterwards, stroll through the UNESCO-listed 17th-century Galle Dutch Fort with its cobblestone streets and ocean ramparts. Smooth highway transfer to Colombo or the airport for your flight home.",
        "activities": [
          "Optional morning whale and dolphin watching safari",
          "Guided walking tour of historic UNESCO Galle Dutch Fort & Lighthouse",
          "Expressway transfer to Colombo or Bandaranaike Airport (CMB)"
        ],
        "overnightLocation": "Departure or Colombo",
        "travelTime": "~2.5 - 3 hours driving"
      }
    ]'::jsonb,
    true,
    true,
    1
  ),
  (
    '10-Day Southern & Hill Country Escape',
    '10-day-southern-hill-country-escape',
    'Multi-Day Round Tours',
    '10 Days / 9 Nights',
    10,
    690,
    207000,
    'per vehicle',
    'Recommended • Cloud Forests, Horton Plains, Udawalawe Elephants & South Coast',
    'A serene and deeply restorative 10-day loop designed for nature lovers and slow travelers: cool highland cloud forests, Horton Plains, elephant herds in Udawalawe, and laid-back southern beach luxury.',
    '/images/nuwaraeliya.jpg',
    array['Negombo', 'Kandy', 'Nuwara Eliya', 'Horton Plains', 'Ella', 'Udawalawe', 'Mirissa', 'Galle', 'Bentota'],
    array[
      'Trek through Horton Plains National Park to the dramatic World''s End drop',
      'Visit Udawalawe Elephant Transit Home & private 4x4 game safari',
      'Breathtaking mountain train journey through cloud forests and tea fields',
      'Relaxed 3-night stay along the southern golden coast with whale watching',
      'UNESCO Galle Fort ramparts walk & Madu River mangrove cruise'
    ],
    array[
      'Private air-conditioned vehicle with dedicated driver guide for 10 full days',
      'All expressway tolls, fuel, vehicle insurance, and parking charges',
      'Driver meals, accommodation, and driver expenses covered',
      'Airport pickup & drop-off with meet & assist service',
      'Flexible schedule tailored daily to your party''s pace',
      'Unlimited chilled mineral water throughout journeys',
      '24/7 round-the-clock concierge support via WhatsApp'
    ],
    '[
      {
        "day": 1,
        "title": "Welcome to Negombo Coastal Town",
        "route": "Airport (CMB) → Negombo Beach",
        "description": "Short 20-minute transfer from CMB airport to coastal Negombo. Recover from your flight with a stroll along the beach and an evening lagoon boat ride.",
        "activities": ["Airport VIP pickup", "Check-in at seaside hotel", "Negombo fish market & canal boat ride"],
        "overnightLocation": "Negombo",
        "travelTime": "~25 mins"
      },
      {
        "day": 2,
        "title": "Ascent to Royal Kandy",
        "route": "Negombo → Pinnawala → Kandy",
        "description": "Travel inland towards Kandy. Stop at the elephant sanctuary, visit the sacred Temple of the Tooth Relic, and stroll through the Royal Botanical Gardens.",
        "activities": ["Elephant bathing viewing in the river", "Peradeniya Botanical Gardens tour", "Temple of the Tooth Relic visit"],
        "overnightLocation": "Kandy",
        "travelTime": "~3 hours"
      },
      {
        "day": 3,
        "title": "Into the Misty Tea Country",
        "route": "Kandy → Ramboda → Nuwara Eliya",
        "description": "Wind through lush mountain roads into Sri Lanka''s tea capital. Visit a vintage colonial tea factory, taste pure Ceylon Pekoe, and tour Gregory Lake.",
        "activities": ["Ramboda Falls photo stop", "Factory tour & orthodox tea tasting", "Colonial post office and golf club walk"],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 4,
        "title": "Trekking Horton Plains & World''s End",
        "route": "Nuwara Eliya → Horton Plains → Nuwara Eliya",
        "description": "Dawn expedition to Horton Plains National Park. Walk through windswept montane grasslands to the sheer 880m precipice at World''s End and Baker''s Falls.",
        "activities": ["Early morning misty plateau trek", "World''s End & Mini World''s End viewpoints", "Baker''s Waterfall cascade"],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "~1 hour transfer"
      },
      {
        "day": 5,
        "title": "Scenic Mountain Train to Ella",
        "route": "Nuwara Eliya → Nanu Oya Station → Ella",
        "description": "Board the legendary blue train through tunnels, high viaducts, and cascading tea terraces. Settle into Ella and hike to the Nine Arches Bridge.",
        "activities": ["Scenic blue train ride", "Nine Arches Bridge train photo capture", "Sunset drinks with Ella Gap views"],
        "overnightLocation": "Ella",
        "travelTime": "~2.5 hours train"
      },
      {
        "day": 6,
        "title": "Udawalawe Elephants in the Wild",
        "route": "Ella → Ravana Falls → Udawalawe",
        "description": "Drop down from the mountains to Udawalawe. Witness the feeding of orphaned baby elephants at the Elephant Transit Home and enjoy an afternoon 4x4 safari.",
        "activities": ["Ravana Falls stop", "Elephant Transit Home feeding session", "Private 4x4 safari across Udawalawe reservoir grasslands"],
        "overnightLocation": "Udawalawe",
        "travelTime": "~2 hours driving"
      },
      {
        "day": 7,
        "title": "Southern Coastline & Mirissa Sun",
        "route": "Udawalawe → Tangalle → Mirissa",
        "description": "Arrive at the sparkling Indian Ocean. Unwind under leaning coconut palms in Mirissa, swim in sheltered coves, and take sunset photos at Coconut Tree Hill.",
        "activities": ["Scenic coastal drive", "Check-in at boutique beachfront retreat", "Coconut Tree Hill golden hour walk"],
        "overnightLocation": "Mirissa",
        "travelTime": "~2 hours driving"
      },
      {
        "day": 8,
        "title": "Blue Whale Safari & Weligama Surf",
        "route": "Mirissa → Weligama Bay → Mirissa",
        "description": "Set sail at dawn to watch the world''s largest creature, the Blue Whale, breaching in deep offshore waters. Spend the afternoon surfing or relaxing in Weligama.",
        "activities": ["Ocean boat cruise for Blue Whales & Spinner Dolphins", "Fresh coconut hydration on the beach", "Stilt fishermen photography"],
        "overnightLocation": "Mirissa",
        "travelTime": "Local transfers"
      },
      {
        "day": 9,
        "title": "Galle Fort Ramparts & Bentota River",
        "route": "Mirissa → Galle Dutch Fort → Bentota",
        "description": "Explore the UNESCO Dutch Fort in Galle with its maritime museums, lighthouse, and artisan gelato shops. Continue to the golden sands of Bentota.",
        "activities": ["Galle Dutch Fort guided walking tour", "Gem museum & artisan Ceylon tea tasting", "Bentota beach sunset dinner"],
        "overnightLocation": "Bentota",
        "travelTime": "~1.5 hours driving"
      },
      {
        "day": 10,
        "title": "Madu River Safari & Homeward Bound",
        "route": "Bentota → Balapitiya → Colombo / Airport",
        "description": "Glide through the mangrove tunnels of the Madu River, visit a cinnamon island, and observe rescued sea turtles before your swift expressway transfer to CMB Airport.",
        "activities": ["Madu River mangrove motorboat safari", "Cinnamon peeling demonstration & fish therapy", "Kosgoda Sea Turtle Hatchery visit", "Expressway transfer to Airport"],
        "overnightLocation": "Departure",
        "travelTime": "~1.5 hours driving to CMB"
      }
    ]'::jsonb,
    true,
    true,
    2
  ),
  (
    '7-Day Scenic Sri Lanka Escape',
    '7-day-scenic-sri-lanka-escape',
    'Multi-Day Round Tours',
    '7 Days / 6 Nights',
    7,
    490,
    147000,
    'per vehicle',
    'Popular • Sigiriya, Kandy, Ella Nine Arches Bridge & Southern Coast',
    'Experience Sri Lanka''s most iconic mountain and heritage scenery in one seamless week: Sigiriya Lion Rock, sacred Kandy, the highland train to Ella''s Nine Arches Bridge, and southern coastal relaxation.',
    '/images/Ella_adventure.JPG',
    array['Sigiriya', 'Kandy', 'Nuwara Eliya', 'Ella', 'Galle', 'Mirissa'],
    array[
      'Climb UNESCO Sigiriya Lion Rock Fortress at sunrise',
      'Visit Kandy Temple of the Sacred Tooth Relic & Spice Gardens',
      'Scenic highland train journey from Nanu Oya to Ella',
      'Hike Little Adam''s Peak & photograph Nine Arches Bridge',
      'Relax on Mirissa beach & walk UNESCO Galle Dutch Fort ramparts'
    ],
    array[
      'Private air-conditioned vehicle with English-speaking chauffeur guide',
      'All fuel, highway tolls, and parking fees included',
      'Driver accommodation and meals covered',
      'Airport pickup and drop-off from Bandaranaike International Airport',
      'Complimentary bottled water daily'
    ],
    '[
      {
        "day": 1,
        "title": "Airport to Sigiriya Cultural Triangle",
        "route": "Airport (CMB) → Dambulla → Sigiriya",
        "description": "Meet your personal chauffeur at Colombo Airport and journey to Dambulla Golden Cave Temple before checking in at Sigiriya.",
        "activities": ["Airport pickup", "Dambulla Royal Cave Temple visit", "Evening relaxation in Sigiriya"],
        "overnightLocation": "Sigiriya",
        "travelTime": "~3.5 hours"
      },
      {
        "day": 2,
        "title": "Sigiriya Lion Rock & Journey to Kandy",
        "route": "Sigiriya → Matale → Kandy",
        "description": "Morning ascent of Sigiriya Rock Fortress, followed by a scenic drive via Matale Spice Gardens to the royal hill capital of Kandy.",
        "activities": ["Sigiriya Rock Fortress climb", "Matale herbal spice garden tour", "Temple of the Sacred Tooth Relic & cultural dance"],
        "overnightLocation": "Kandy",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 3,
        "title": "Tea Country Waterfalls & Nuwara Eliya",
        "route": "Kandy → Ramboda Falls → Nuwara Eliya",
        "description": "Ascend through emerald tea estates, view Ramboda Waterfall, and tour an authentic Ceylon Tea Factory before exploring Nuwara Eliya.",
        "activities": ["Ramboda Waterfall stop", "Ceylon Tea Factory tour & tasting", "Gregory Lake evening walk"],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 4,
        "title": "Scenic Highland Train to Ella",
        "route": "Nanu Oya → Scenic Train → Ella",
        "description": "Ride the famous blue mountain train to Ella. Visit the iconic Nine Arches Bridge and hike Little Adam''s Peak at sunset.",
        "activities": ["Scenic train journey", "Nine Arches Bridge walk", "Little Adam''s Peak viewpoint hike"],
        "overnightLocation": "Ella",
        "travelTime": "~2.5 hours train"
      },
      {
        "day": 5,
        "title": "Ravana Falls to Mirissa Beach",
        "route": "Ella → Ravana Falls → Mirissa",
        "description": "Descend from the cool highlands past Ravana Waterfall to the palm-fringed southern coast of Mirissa.",
        "activities": ["Ravana Waterfall photo stop", "Coconut Tree Hill sunset walk", "Beachfront seafood dinner"],
        "overnightLocation": "Mirissa",
        "travelTime": "~3 hours"
      },
      {
        "day": 6,
        "title": "Whale Watching & UNESCO Galle Fort",
        "route": "Mirissa → Weligama → Galle",
        "description": "Optional morning whale watching cruise, see traditional stilt fishermen in Weligama, and explore historic Galle Dutch Fort.",
        "activities": ["Optional whale watching safari", "Weligama stilt fishermen", "Galle Dutch Fort ramparts & lighthouse walk"],
        "overnightLocation": "Galle / Bentota",
        "travelTime": "~1.5 hours"
      },
      {
        "day": 7,
        "title": "Coastal Transfer to Colombo & Airport",
        "route": "Galle / Bentota → Colombo → Airport (CMB)",
        "description": "Enjoy a relaxed morning by the ocean before your expressway transfer to Colombo and Bandaranaike International Airport.",
        "activities": ["Optional Madu River boat safari", "Colombo city highlights", "Airport departure drop-off"],
        "overnightLocation": "Departure",
        "travelTime": "~2 hours"
      }
    ]'::jsonb,
    true,
    true,
    3
  ),
  (
    '3-Day Cultural Triangle Special',
    '3-day-cultural-triangle-special',
    'Multi-Day Round Tours',
    '3 Days / 2 Nights',
    3,
    280,
    84000,
    'per vehicle',
    'Heritage • Anuradhapura, Sigiriya Lion Rock, Polonnaruwa & Dambulla',
    'A fast-paced cultural immersion connecting Sri Lanka''s greatest ancient wonders: Anuradhapura''s 2,000-year-old stupas, Sigiriya Lion Rock, and Dambulla''s cave sanctuaries.',
    '/images/Sigiriya.jpeg',
    array['Colombo / Airport', 'Anuradhapura', 'Sigiriya', 'Polonnaruwa', 'Dambulla'],
    array[
      'Marvel at the sacred Sri Maha Bodhi tree & towering Ruwanwelisaya stupa',
      'Conquer the majestic 5th-century Sigiriya Lion Rock Fortress at dawn',
      'Cycle through the medieval palace ruins of Polonnaruwa',
      'Explore the UNESCO Dambulla Royal Golden Cave Temples',
      'Authentic village bullock cart ride & traditional clay-pot feast'
    ],
    array[
      'Dedicated air-conditioned vehicle with chauffeur guide for 3 days',
      'All expressway tolls, parking fees, and vehicle fuel included',
      'Driver accommodation, meals, and allowances',
      'Pickup & drop-off anywhere in Colombo, Negombo, or Airport',
      'Bottled water provided throughout',
      'Full flexibility to pause for photos and local food'
    ],
    '[
      {
        "day": 1,
        "title": "Colombo / Airport to Anuradhapura Ancient Kingdom",
        "route": "Colombo / Airport → Anuradhapura → Sigiriya",
        "description": "Early pickup and journey north to the first ancient capital of Sri Lanka. Discover sacred monasteries, the 2,300-year-old Sri Maha Bodhi tree, and colossal white stupas.",
        "activities": ["Pickup from hotel or airport", "Explore Anuradhapura Sacred City & Ruwanwelisaya", "Evening drive to Sigiriya"],
        "overnightLocation": "Sigiriya",
        "travelTime": "~4.5 hours"
      },
      {
        "day": 2,
        "title": "Sigiriya Lion Rock & Polonnaruwa Medieval Ruins",
        "route": "Sigiriya → Polonnaruwa → Sigiriya",
        "description": "Conquer the legendary Lion Rock at sunrise. Afterwards, travel to Polonnaruwa to admire the Gal Vihara rock-cut Buddha statues and the Royal Palace.",
        "activities": ["Morning Sigiriya Fortress ascent", "Guided tour of Polonnaruwa UNESCO ruins", "Hiriwadunna rural village catamaran ride"],
        "overnightLocation": "Sigiriya",
        "travelTime": "~1.5 hours"
      },
      {
        "day": 3,
        "title": "Dambulla Royal Cave Temple & Return",
        "route": "Sigiriya → Dambulla → Matale / Colombo",
        "description": "Visit the five grand cave chambers of Dambulla filled with ancient murals and golden Buddha figures. Enjoy a leisurely return drive back to Colombo or CMB airport.",
        "activities": ["Dambulla Cave Temple visit", "Herbal garden tour with fresh king coconut", "Comfortable drop-off at your destination"],
        "overnightLocation": "Colombo / Airport",
        "travelTime": "~3.5 hours"
      }
    ]'::jsonb,
    false,
    true,
    4
  ),
  (
    '1-Day Sigiriya & Dambulla Heritage Day Tour',
    '1-day-sigiriya-dambulla-heritage-day-tour',
    'Day Trips',
    '1 Day (Full Day)',
    1,
    110,
    33000,
    'per vehicle',
    'Top Day Trip • Climb Sigiriya Lion Rock & Explore Dambulla Golden Caves',
    'The ultimate single-day cultural excursion from Colombo, Negombo, or Kandy. Climb the 8th Wonder of the World and explore the mystical Dambulla Cave temples in a single stress-free day.',
    '/images/dumbulla-cave-header-image-mob.jpg',
    array['Colombo / Negombo / Kandy', 'Dambulla Cave Temple', 'Sigiriya Lion Rock', 'Village Experience'],
    array[
      'Climb UNESCO Sigiriya Rock Fortress with your private guide',
      'Explore the 2,000-year-old Dambulla Golden Cave Temple',
      'Authentic Sri Lankan buffet lunch in a village hut',
      'Comfortable door-to-door hotel pickup and drop-off in a private A/C vehicle',
      'Stress-free itinerary with driver handling all parking and logistics'
    ],
    array[
      'Private air-conditioned vehicle with dedicated English-speaking driver',
      'Door-to-door hotel pickup & return drop-off (Colombo, Negombo, or Kandy)',
      'All vehicle fuel, expressway tolls, and parking tickets',
      'Driver meals and allowances',
      'Complimentary chilled mineral water in the vehicle',
      'Flexible timetable customized to your energy and interest'
    ],
    '[
      {
        "day": 1,
        "title": "Full Day Sigiriya & Dambulla Heritage Expedition",
        "route": "Hotel Pickup (06:00 AM) → Dambulla → Sigiriya → Hotel Return (08:00 PM)",
        "description": "Early morning pickup from your hotel. Head directly to Sigiriya before noon temperatures peak. Climb the ancient stairway between the lion paws to the summit. After a traditional village lunch, explore the five sacred cave sanctuaries of Dambulla before returning comfortably in the evening.",
        "activities": [
          "06:00 AM - Prompt hotel pickup in private A/C vehicle",
          "10:00 AM - Climb the world-famous Sigiriya Lion Rock Fortress",
          "01:00 PM - Authentic Sri Lankan clay-pot lunch & coconut water",
          "02:30 PM - Tour UNESCO Dambulla Royal Cave Temples",
          "08:00 PM - Safe return drop-off at your hotel door"
        ],
        "overnightLocation": "Day Tour (Return to your hotel)",
        "travelTime": "Full day excursion (~12-14 hrs total)"
      }
    ]'::jsonb,
    false,
    true,
    5
  ),
  (
    '1-Day Galle Fort & Madu River Coastal Day Tour',
    '1-day-galle-fort-madu-river-coastal-day-tour',
    'Day Trips',
    '1 Day (Full Day)',
    1,
    99,
    29700,
    'per vehicle',
    'Coastal Special • Madu River Mangroves, Sea Turtles & UNESCO Galle Fort',
    'A scenic sun-filled day along Sri Lanka''s southwest shoreline: glide through mangrove waterways on the Madu River, hold baby turtles at a conservation hatchery, and walk the historic ramparts of Galle Fort.',
    '/images/galle_fort.JPG',
    array['Colombo / Negombo / Bentota', 'Kosgoda Turtle Sanctuary', 'Madu River Safari', 'Galle Dutch Fort'],
    array[
      'Guided walking tour of the 17th-century UNESCO Galle Dutch Fort',
      'Thrilling motorboat cruise through the mangroves of Madu Ganga',
      'Visit cinnamon peeling island & experience natural river fish therapy',
      'Support sea turtle conservation and see hatchlings up close',
      'Scenic high-speed drive via the Southern Expressway'
    ],
    array[
      'Private air-conditioned car or van with English-speaking chauffeur',
      'Door-to-door hotel pickup and drop-off (Colombo, Negombo, or Bentota)',
      'Expressway tolls, fuel, parking, and driver allowances',
      'Bottled water provided in vehicle',
      'Free stops for photos, king coconuts, and souvenir shopping'
    ],
    '[
      {
        "day": 1,
        "title": "South Coast Adventure: Mangroves, Fortresses & Ocean",
        "route": "Hotel Pickup (07:30 AM) → Kosgoda → Balapitiya → Galle Fort → Hotel Return (06:30 PM)",
        "description": "Travel south along the expressway to Kosgoda to observe protected sea turtles. Board a private motorboat along the Madu River with its 64 islands and mangrove tunnels. Continue to Galle Fort for lunch, boutique shopping, and a walk atop the ocean ramparts.",
        "activities": [
          "07:30 AM - Morning pickup from your hotel",
          "09:00 AM - Kosgoda Sea Turtle Conservation project visit",
          "10:30 AM - Madu River mangrove motorboat safari & Cinnamon Island",
          "02:30 PM - Walking tour of UNESCO Galle Fort ramparts, clocktower & lighthouse",
          "06:30 PM - Evening drop-off at your hotel"
        ],
        "overnightLocation": "Day Tour (Return to your hotel)",
        "travelTime": "Full day excursion (~10-11 hrs total)"
      }
    ]'::jsonb,
    false,
    true,
    6
  ),
  (
    '7-Day Coastal Escapes & Southern Sun',
    '7-day-coastal-escapes-southern-sun',
    'Coastal Escapes',
    '7 Days / 6 Nights',
    7,
    490,
    147000,
    'per vehicle',
    'Beach & Sun • Bentota, Hikkaduwa Reefs, Galle Fort, Mirissa & Hiriketiya',
    'Sun, surf, seafood, and seaside luxury: a dedicated ocean lover''s dream across Bentota, Hikkaduwa coral reefs, Galle Fort, Mirissa whale watching, and secret bays in Tangalle.',
    '/images/mirissa_turtle.jpg',
    array['Bentota', 'Hikkaduwa', 'Galle', 'Mirissa', 'Hiriketiya', 'Tangalle'],
    array[
      'Jet skiing, wakeboarding, and water sports along Bentota lagoon',
      'Snorkel with giant green sea turtles in Hikkaduwa coral sanctuary',
      'Boutique dining, cafes, and sunset walks inside UNESCO Galle Fort',
      'Mirissa deep-sea catamaran safari to observe Blue Whales',
      'Hidden horseshoe bay relaxation & surfing in trendy Hiriketiya'
    ],
    array[
      'Private vehicle and driver on stand-by throughout the 7 days',
      'Expressway tolls, fuel, and beach parking covered',
      'Driver''s lodging, meals, and allowances',
      'Airport pickup and drop-off included',
      'Flexible daily coastal hops and dinner transfers',
      'Chilled bottled water provided throughout'
    ],
    '[
      {
        "day": 1,
        "title": "Airport to Bentota Beach Haven",
        "route": "Airport (CMB) → Bentota",
        "description": "Arrive at Colombo Airport and take the scenic expressway south directly to the golden sand peninsula of Bentota. Relax by the pool with fresh coconut cocktails.",
        "activities": ["Airport welcome and transfer", "Hotel check-in & beach relaxation", "Sunset seafood barbecue"],
        "overnightLocation": "Bentota",
        "travelTime": "~1.5 hours"
      },
      {
        "day": 2,
        "title": "Bentota Water Sports & River Cruise",
        "route": "Bentota Lagoon & River",
        "description": "Spend an active morning with jet skiing, banana boating, or calm kayaking on Bentota River. In the afternoon, visit Brief Garden or relax on the sands.",
        "activities": ["Lagoon water sports activities", "Visit Bewis Bawa''s famed Brief Garden", "Sunset walk along Bentota sandspit"],
        "overnightLocation": "Bentota",
        "travelTime": "Local transfers"
      },
      {
        "day": 3,
        "title": "Coral Reefs in Hikkaduwa & Galle Fort",
        "route": "Bentota → Hikkaduwa → Galle",
        "description": "Swim with wild sea turtles in the shallow waters of Hikkaduwa coral reef. Travel onward to the UNESCO Galle Dutch Fort for an evening of cobblestone charm.",
        "activities": ["Hikkaduwa coral reef snorkeling", "Encounter wild turtles swimming in the bay", "Sunset ramparts walk in Galle Fort"],
        "overnightLocation": "Galle / Unawatuna",
        "travelTime": "~1 hour"
      },
      {
        "day": 4,
        "title": "Mirissa Beach & Coconut Tree Hill",
        "route": "Galle → Weligama → Mirissa",
        "description": "Follow the coastal curve to Mirissa. Stop at Weligama to observe stilt fishermen and catch some waves. Evening golden hour climb at Coconut Tree Hill.",
        "activities": ["Weligama Bay stilt fishermen photo stop", "Check-in at Mirissa beachfront hotel", "Coconut Tree Hill sunset views & beach dining"],
        "overnightLocation": "Mirissa",
        "travelTime": "~45 mins"
      },
      {
        "day": 5,
        "title": "Blue Whale Safari & Secret Beach",
        "route": "Mirissa Offshore & Secret Beach",
        "description": "Early morning boat safari to witness majestic Blue Whales and playful dolphins. Spend the afternoon lounging at Mirissa''s tucked-away Secret Beach.",
        "activities": ["Whale & dolphin watching catamaran cruise", "Afternoon chill at secluded Secret Beach cove", "Fresh grilled seafood on the shore"],
        "overnightLocation": "Mirissa",
        "travelTime": "Local transfers"
      },
      {
        "day": 6,
        "title": "Hiriketiya Horseshoe Bay & Tangalle Peace",
        "route": "Mirissa → Dikwella / Hiriketiya → Tangalle",
        "description": "Visit the postcard-perfect horseshoe bay of Hiriketiya, beloved for its cafe culture and gentle peeling waves. Spend the night at the wild, quiet beaches of Tangalle.",
        "activities": ["Hiriketiya bay swim & espresso break", "Blowhole (Hummanaya) natural ocean geyser", "Tangalle serene beach relaxation"],
        "overnightLocation": "Tangalle",
        "travelTime": "~1 hour"
      },
      {
        "day": 7,
        "title": "Coast to Airport Express Return",
        "route": "Tangalle → Southern Expressway → Airport (CMB)",
        "description": "Enjoy a final morning tropical breakfast by the ocean. Swift 2.5-hour direct highway transfer directly to Colombo Airport for your departure flight.",
        "activities": ["Morning swim in the Indian Ocean", "Direct expressway transfer to Colombo Airport", "Safe drop-off with fond memories"],
        "overnightLocation": "Departure",
        "travelTime": "~2.5 hours"
      }
    ]'::jsonb,
    false,
    true,
    7
  ),
  (
    '12-Day Grand All-Island Bespoke Expedition',
    '12-day-grand-all-island-tailor-made-itinerary',
    'Tailor-Made Itineraries',
    '12 Days / 11 Nights',
    12,
    840,
    252000,
    'per vehicle',
    '100% Customizable • Complete Island Circuit across Culture, Hills, Safari & Coast',
    'The ultimate bespoke Sri Lankan journey tailored completely to your pace: ancient kingdoms, Trincomalee or Jaffna culture, tea country trains, leopard safaris, and secluded coastal hideaways.',
    '/images/sigiriya_boat.jpg',
    array['Wilpattu / Sigiriya', 'Trincomalee', 'Kandy', 'Nuwara Eliya', 'Ella', 'Yala', 'Galle'],
    array[
      '100% flexible custom routing planned directly with our expert team',
      'Private dedicated chauffeur guide with unlimited day-trip flexibility',
      'Comprehensive cross-island journey combining culture, wildlife & coast',
      'Option to include east coast beaches (Trincomalee/Passikudah) in season',
      'Complimentary itinerary redesign and hotel advice tailored to your budget'
    ],
    array[
      'Dedicated luxury A/C vehicle & English-speaking chauffeur for 12 days',
      'Unlimited itinerary adjustments before and during your journey',
      'All fuel costs, highway tolls, vehicle insurance, and parking fees',
      'Driver accommodation and meals fully covered',
      'Airport pickup and drop-off at any time of day or night',
      'Complimentary local SIM card assistance & 24/7 VIP concierge line',
      'Chilled bottled water replenished daily'
    ],
    '[
      {
        "day": 1,
        "title": "Airport Greeting & Coastal Negombo or Cultural Triangle",
        "route": "Airport (CMB) → Negombo / Sigiriya",
        "description": "Welcome by Chamod & the Chama Travels team. Begin your journey tailored to your flight arrival time, heading to either coastal Negombo or directly to Sigiriya.",
        "activities": ["Personalized airport pickup", "Relaxed travel schedule", "Sunset coconut drink"],
        "overnightLocation": "Sigiriya or Negombo",
        "travelTime": "Flexible"
      },
      {
        "day": 2,
        "title": "Sigiriya Rock & Ancient Wonders",
        "route": "Sigiriya & surrounding kingdoms",
        "description": "Climb Sigiriya at sunrise or Pidurangala rock for incredible views of Lion Rock. Authentic village lunch and countryside sunset.",
        "activities": ["Sigiriya Fortress climb", "Rural catamaran village tour", "Dambulla Cave temples"],
        "overnightLocation": "Sigiriya",
        "travelTime": "Local"
      },
      {
        "day": 3,
        "title": "Polonnaruwa Ruins or Minneriya Elephant Gathering",
        "route": "Sigiriya → Polonnaruwa / Minneriya",
        "description": "Explore the medieval ruins of Polonnaruwa by bicycle, followed by an afternoon 4x4 safari to observe hundreds of wild elephants gather at Minneriya tank.",
        "activities": ["Bicycle tour of ancient ruins", "Minneriya / Kaudulla elephant safari", "Stargazing in Habarana"],
        "overnightLocation": "Sigiriya",
        "travelTime": "Local"
      },
      {
        "day": 4,
        "title": "Into the Hills: Matale Spices & Royal Kandy",
        "route": "Sigiriya → Matale → Kandy",
        "description": "Journey into the mountain realm. Walk through organic spice groves and explore the sacred Temple of the Tooth Relic in Kandy.",
        "activities": ["Aromatic spice garden walk", "Temple of the Sacred Tooth Relic", "Traditional Kandyan drumming performance"],
        "overnightLocation": "Kandy",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 5,
        "title": "Botanical Wonders & Highland Tea Trails",
        "route": "Kandy → Ramboda → Nuwara Eliya",
        "description": "Stroll the famous Peradeniya Botanical Gardens before driving through high misty hills. Tour an operational tea plantation and taste pure single-estate teas.",
        "activities": ["Royal Botanical Gardens visit", "Tea plucking & tasting experience", "Colonial high tea in Nuwara Eliya"],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 6,
        "title": "World''s End Trek or Scenic Relaxation",
        "route": "Nuwara Eliya → Horton Plains / Gregory Lake",
        "description": "Option for dawn trekking at Horton Plains to World''s End, or a relaxed morning exploring Victoria Park, strawberry farms, and colonial architecture.",
        "activities": ["World''s End trek or strawberry farm visit", "Boating on Lake Gregory", "Fireside dinner in the cool highlands"],
        "overnightLocation": "Nuwara Eliya",
        "travelTime": "Local"
      },
      {
        "day": 7,
        "title": "Legendary Blue Train to Ella",
        "route": "Nanu Oya → Ella",
        "description": "Ride the iconic high-altitude train across tea country viaducts. Walk to the Nine Arches Bridge and dine in Ella''s vibrant mountain town.",
        "activities": ["Scenic blue train ride", "Nine Arches Bridge photography", "Little Adam''s Peak sunset hike"],
        "overnightLocation": "Ella",
        "travelTime": "~2.5 hours train"
      },
      {
        "day": 8,
        "title": "Waterfalls & Yala National Park Safari",
        "route": "Ella → Ravana Falls → Yala",
        "description": "Descend past the roaring Ravana Waterfall into the wild savannah. Embark on a private 4x4 Jeep Safari tracking leopards, bears, and birdlife.",
        "activities": ["Ravana waterfall visit", "Private 4x4 Jeep Safari in Yala", "Campfire or starlit dinner"],
        "overnightLocation": "Yala",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 9,
        "title": "Scenic South Coast: Mirissa & Weligama",
        "route": "Yala → Tangalle → Mirissa",
        "description": "Coastline drive to the southern beaches. Watch stilt fishermen, relax on pristine golden shores, and climb Coconut Tree Hill.",
        "activities": ["Coastal stops along picturesque bays", "Stilt fishermen encounter", "Sunset at Coconut Tree Hill"],
        "overnightLocation": "Mirissa",
        "travelTime": "~2.5 hours"
      },
      {
        "day": 10,
        "title": "Whale Watching & Galle Dutch Fort",
        "route": "Mirissa → Galle",
        "description": "Morning oceanic excursion to spot Blue Whales. Afternoon guided exploration through the UNESCO Galle Dutch Fort with artisan shopping.",
        "activities": ["Deep sea whale watching cruise", "Galle Fort ramparts & lighthouse walk", "Boutique cafe dining"],
        "overnightLocation": "Galle / Unawatuna",
        "travelTime": "~1 hour"
      },
      {
        "day": 11,
        "title": "Bentota River Safaris & Beach Bliss",
        "route": "Galle → Bentota",
        "description": "Motorboat through the mangrove canopies of Madu River, visit a turtle conservation sanctuary, and unwind on Bentota''s wide sandy beach.",
        "activities": ["Madu River mangrove safari", "Sea turtle sanctuary visit", "Farewell seafood dinner by the sea"],
        "overnightLocation": "Bentota",
        "travelTime": "~1 hour"
      },
      {
        "day": 12,
        "title": "Colombo City Discovery & Airport Departure",
        "route": "Bentota → Colombo → Airport (CMB)",
        "description": "Drive north to the capital city. Tour Colombo''s Independence Square, Gangaramaya Temple, and Lotus Tower before a comfortable airport transfer.",
        "activities": ["Colombo city sights & souvenir shopping", "Comfortable departure transfer to CMB airport", "Warm goodbye from your Chama Travels family"],
        "overnightLocation": "Departure",
        "travelTime": "~1.5 hours to Airport"
      }
    ]'::jsonb,
    false,
    true,
    8
  )
on conflict (slug) do update
  set title = excluded.title,
      category = excluded.category,
      duration = excluded.duration,
      days_count = excluded.days_count,
      price_usd = excluded.price_usd,
      price_lkr = excluded.price_lkr,
      price_note = excluded.price_note,
      tagline = excluded.tagline,
      description = excluded.description,
      image_url = excluded.image_url,
      destinations_covered = excluded.destinations_covered,
      highlights = excluded.highlights,
      included = excluded.included,
      itinerary = excluded.itinerary,
      is_featured_home = excluded.is_featured_home,
      is_active = excluded.is_active,
      display_order = excluded.display_order,
      updated_at = now();
