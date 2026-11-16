// Shared types, constants, and static fallbacks for the Gallery & Activities system.

export type GalleryLayoutSize = 'standard' | 'wide' | 'featured';

export type GalleryPhotoRecord = {
  id: string;
  title: string | null;
  alt_text: string;
  category: string;
  image_url: string;
  layout_size: GalleryLayoutSize;
  is_featured_home: boolean;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ActivityRecord = {
  id: string;
  title: string;
  slug: string;
  category: string;
  location: string | null;
  duration: string | null;
  price_usd: number | null;
  price_lkr: number | null;
  description: string;
  image_url: string;
  image_alt: string | null;
  highlights: string[];
  is_featured_home: boolean;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

export const GALLERY_CATEGORIES = [
  'Journeys',
  'Beaches',
  'Hill Country',
  'Wildlife',
  'Culture & Heritage',
  'Happy Guests',
] as const;

export const ACTIVITY_CATEGORIES = [
  'Wildlife',
  'Adventure & Nature',
  'Culture & Culinary',
  'Coastal Adventure',
  'Heritage & Nature',
  'Nature & Relaxation',
] as const;

export const GALLERY_LAYOUT_LABELS: Record<GalleryLayoutSize, string> = {
  standard: 'Standard',
  wide: 'Wide 2x1',
  featured: 'Featured 2x2',
};

export function normalizeLayoutSize(value: unknown): GalleryLayoutSize {
  return value === 'wide' || value === 'featured' ? value : 'standard';
}

/** Tailwind span classes for the Home Page mosaic grid. */
export function galleryLayoutClass(layout: GalleryLayoutSize): string {
  if (layout === 'featured') return 'md:col-span-2 md:row-span-2';
  if (layout === 'wide') return 'md:col-span-2';
  return '';
}

/** Whether next/image can optimise this source with the configured remotePatterns. */
export function isOptimizableImageUrl(src: string): boolean {
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    return (
      url.hostname === 'images.pexels.com' ||
      url.hostname === 'images.unsplash.com' ||
      url.hostname.endsWith('.supabase.co')
    );
  } catch {
    return false;
  }
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function whatsappActivityLink(title: string): string {
  return `https://wa.me/94711114901?text=${encodeURIComponent(
    `Hello Chama Travels, I am interested in including "${title}" in my Sri Lanka trip plan!`,
  )}`;
}

function photo(
  order: number,
  image_url: string,
  alt_text: string,
  category: string,
  layout_size: GalleryLayoutSize = 'standard',
  is_featured_home = false,
  title: string | null = null,
): GalleryPhotoRecord {
  return {
    id: `fallback-photo-${order}`,
    title,
    alt_text,
    category,
    image_url,
    layout_size,
    is_featured_home,
    is_active: true,
    display_order: order,
  };
}

/** Static fallback mirroring the seeded database rows (used if the API is unavailable). */
export const FALLBACK_GALLERY_PHOTOS: GalleryPhotoRecord[] = [
  photo(1, '/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg', 'Happy travelers exploring Sri Lanka with Chama Travels', 'Happy Guests', 'featured', true, 'Happy Travelers'),
  photo(2, '/images/2024_07_26_21_27_56_47FA4CFD-FCDD-4AC3-94BF-AC5FD4CE820F.jpg', 'Scenic travel moments and sightseeing in Sri Lanka', 'Journeys', 'standard', true, 'Scenic Moments'),
  photo(3, '/images/2024_03_30_11_21_19_IMG_1200.jpg', 'Tourists enjoying private transport across Sri Lankan destinations', 'Journeys', 'standard', true, 'Private Transport'),
  photo(4, '/images/2024_10_12_15_22_52_IMG_3436.jpg', 'Cultural landmark visit with Chama Travels chauffeur guide', 'Culture & Heritage', 'featured', true, 'Cultural Landmark'),
  photo(5, '/images/2024_11_28_09_44_28_IMG_4455.jpg', 'Travelers visiting Sri Lanka highlands and tea plantations', 'Hill Country', 'standard', true, 'Highlands & Tea'),
  photo(6, '/images/2024_12_18_10_08_44_IMG_4962.jpg', 'Memorable holiday moments with local Sri Lankan driver guide', 'Happy Guests', 'standard', true, 'Holiday Memories'),
  photo(7, '/images/2025_07_23_06_19_23_IMG_0757.jpg', 'Sigiriya Rock Fortress panoramic viewpoint in Sri Lanka', 'Culture & Heritage', 'standard', true, 'Sigiriya Viewpoint'),
  photo(8, '/images/2025_10_01_10_59_58_IMG_2604(1).jpg', 'Family touring iconic Sri Lanka heritage sites', 'Culture & Heritage', 'wide', true, 'Family Heritage Tour'),
  photo(9, '/images/2026_02_27_10_52_34_IMG_5805.jpg', 'Island wildlife and coastal adventure with Chama Travels', 'Wildlife', 'standard', true, 'Wildlife & Coast'),
  photo(10, '/images/1307254.jpg', 'Chama Travels journey across Sri Lanka', 'Journeys', 'standard', false, 'Chama Travels Journey'),
  photo(11, '/images/beach.jpg', 'Sri Lanka beach tour with Chama Travels', 'Beaches', 'standard', false, 'Sri Lanka Beach'),
  photo(12, '/images/2024_11_06_10_35_25_IMG_3959.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(13, '/images/2024_11_07_00_48_21_IMG_4030.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(14, '/images/2024_11_30_06_50_30_IMG_4470.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(15, '/images/2025_05_27_10_49_29_IMG_9935.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(16, '/images/2025_09_06_13_09_56_IMG_2081.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(17, '/images/2025_10_10_12_45_43_IMG_2800.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(18, '/images/2025_10_11_08_51_11_IMG_2829.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(19, '/images/2026_01_11_18_33_10_IMG_5149.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(20, '/images/2026_03_05_17_43_47_IMG_5910.jpg', 'Chama Travels tour moment in Sri Lanka', 'Journeys'),
  photo(21, '/images/aboutimage.jpg', 'About Chama Travels', 'Journeys', 'standard', false, 'About Chama Travels'),
  photo(22, '/images/WhatsApp Image 2024-12-29 at 13.02.42_b9b4dbaa.jpg', 'Happy guests travelling with Chama Travels', 'Happy Guests'),
  photo(23, '/images/WhatsApp Image 2024-12-29 at 13.05.37_9e691c01.jpg', 'Happy guests travelling with Chama Travels', 'Happy Guests'),
  photo(24, '/images/WhatsApp Image 2024-12-29 at 13.05.48_c650a197.jpg', 'Happy guests travelling with Chama Travels', 'Happy Guests'),
];

export const FALLBACK_HOME_GALLERY_PHOTOS = FALLBACK_GALLERY_PHOTOS.filter((p) => p.is_featured_home);

function activity(
  order: number,
  slug: string,
  title: string,
  category: string,
  location: string,
  duration: string,
  description: string,
  image_url: string,
  image_alt: string,
  highlights: string[],
): ActivityRecord {
  return {
    id: `fallback-activity-${slug}`,
    title,
    slug,
    category,
    location,
    duration,
    price_usd: null,
    price_lkr: null,
    description,
    image_url,
    image_alt,
    highlights,
    is_featured_home: true,
    is_active: true,
    display_order: order,
  };
}

/** Static fallback mirroring the seeded database rows (used if the API is unavailable). */
export const FALLBACK_ACTIVITIES: ActivityRecord[] = [
  activity(1, 'sri-lankan-village-food-experience', 'Sri Lankan Village & Food Experience', 'Culture & Culinary', 'Sigiriya / Habarana', 'Half Day',
    'Experience authentic rural life, traditional cooking in clay pots, bullock cart rides, and boat tours through lotus lagoons. Enjoy genuine hospitality from local villagers and taste organic delicacies.',
    '/images/village_tour.jpg', 'Outdoor cooking in a Sri Lankan village', ['Clay-pot cooking demonstration', 'Bullock cart ride', 'Lotus lagoon catamaran ride']),
  activity(2, 'ella-hiking-mountain-adventure', 'Ella Hiking & Mountain Adventure', 'Adventure & Nature', 'Ella', 'Full Day / Multi-Day',
    'Hike through lush green tea plantations, climb Little Adam’s Peak and Ella Rock, and marvel at the breathtaking Nine Arches Bridge surrounded by misty mountains.',
    '/images/Ella_adventure.JPG', 'Green hills and valleys in Ella, Sri Lanka', ["Little Adam's Peak hike", 'Ella Rock trail', 'Nine Arches Bridge']),
  activity(3, 'yala-national-park-safari', 'Yala National Park Safari', 'Wildlife', 'Yala', '3 - 4 Hours',
    "Embark on an exciting 4x4 jeep safari in Sri Lanka's premier wildlife park, famed for having one of the highest leopard densities in the world, alongside elephants and sloth bears.",
    '/images/yala-leopard.jpg', 'Elephants in Yala National Park', ['4x4 jeep safari', 'Leopard tracking', 'Elephants & sloth bears']),
  activity(4, 'udawalawe-elephant-transit-safari', 'Udawalawe Elephant Transit Safari', 'Wildlife', 'Udawalawe', '3 Hours',
    'Witness majestic wild elephant herds roaming freely across vast grasslands, plus deer, water buffaloes, and exotic bird species in their natural sanctuary.',
    '/images/udawalawe.jpg', 'Sri Lankan elephant in Udawalawe National Park', ['Wild elephant herds', 'Open grassland safari', 'Exotic bird watching']),
  activity(5, 'mirissa-whale-dolphin-watching', 'Mirissa Whale & Dolphin Watching', 'Coastal Adventure', 'Mirissa', '4 - 5 Hours',
    'Sail into the Indian Ocean from Mirissa harbor to spot magnificent blue whales, sperm whales, and playful pods of dolphins in the tropical waters.',
    '/images/whale.jpg', 'Blue whale diving in the ocean near Sri Lanka', ['Blue & sperm whales', 'Spinner dolphin pods', 'Morning ocean cruise']),
  activity(6, 'kithulgala-whitewater-rafting', 'Kithulgala Whitewater Rafting', 'Adventure & Nature', 'Kithulgala', '2 - 3 Hours',
    'Navigate the thrilling rapids of the Kelani River surrounded by lush tropical rainforests. Perfect for adventure seekers looking for an adrenaline rush!',
    '/images/kithulgala_rafting.jpg', 'Rafters navigating whitewater on a tropical river', ['Kelani River rapids', 'Rainforest scenery', 'Professional safety guides']),
  activity(7, 'madu-river-mangrove-boat-safari', 'Madu River Mangrove Boat Safari', 'Nature & Relaxation', 'Balapitiya / Bentota', '2 Hours',
    'Cruise calm river waters through dense mangrove tunnels, visit cinnamon island, and experience natural fish massage therapy in a tranquil wetland setting.',
    '/images/madu_river.jpg', 'Boat travelling through calm mangrove waterways', ['Mangrove tunnels', 'Cinnamon island visit', 'Natural fish therapy']),
  activity(8, 'ceylon-tea-plantation-factory-tour', 'Ceylon Tea Plantation & Factory Tour', 'Heritage & Nature', 'Nuwara Eliya', '2 Hours',
    'Walk amidst emerald tea bushes, learn about hand-picking techniques from local pluckers, and taste world-famous Ceylon tea at a historic factory.',
    '/images/Tea-Plantation.jpg', 'Lush tea plantation in Sri Lanka highlands', ['Tea estate walk', 'Factory process tour', 'Fresh Ceylon tea tasting']),
  activity(9, 'bentota-water-sports', 'Bentota Water Sports', 'Coastal Adventure', 'Bentota', '1 - 3 Hours',
    'Try beachside water activities along Sri Lanka’s western coast, from jet skiing and banana boat rides to windsurfing and calm lagoon kayaking.',
    'https://images.pexels.com/photos/10825335/pexels-photo-10825335.jpeg?auto=compress&cs=tinysrgb&w=800', 'Windsurfer on Sri Lankan coastal waters', ['Jet skiing', 'Banana boat rides', 'Lagoon kayaking']),
  activity(10, 'surfing-in-sri-lanka', 'Surfing in Sri Lanka', 'Coastal Adventure', 'Weligama', '2 Hours',
    'Catch a wave at one of Sri Lanka’s well-known surf beaches, with beginner-friendly lessons and board rentals in sheltered southern bays.',
    'https://images.pexels.com/photos/34714740/pexels-photo-34714740.jpeg?auto=compress&cs=tinysrgb&w=800', 'Surfer walking along Weligama Beach at sunset', ['Beginner surf lessons', 'Board rental', 'Sunset sessions']),
];

/** Normalises a raw API row (numeric columns may arrive as strings). */
export function normalizeActivity(row: ActivityRecord): ActivityRecord {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    ...row,
    price_usd: num(row.price_usd),
    price_lkr: num(row.price_lkr),
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
  };
}

export function normalizeGalleryPhoto(row: GalleryPhotoRecord): GalleryPhotoRecord {
  return { ...row, layout_size: normalizeLayoutSize(row.layout_size) };
}
