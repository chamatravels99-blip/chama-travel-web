export interface Destination {
  id: string;
  name: string;
  region: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  bestTimeToVisit: string;
  highlights: string[];
  popularActivities: string[];
  recommendedDays: string;
}

export const destinationsData: Destination[] = [
  {
    id: "sigiriya",
    name: "Sigiriya",
    region: "Cultural Triangle",
    tagline: "Ancient Lions Rock Fortress & Royal Heritage",
    description:
      "A UNESCO World Heritage site featuring a 5th-century palace fortress built atop a 200-meter sheer rock, surrounded by lush water gardens and ancient frescoes.",
    image: "/images/Sigiriya.jpeg",
    imageAlt: "Sigiriya Rock Fortress rising above greenery",
    bestTimeToVisit: "December to April",
    highlights: [
      "Climb Sigiriya Rock at sunrise or sunset",
      "Panoramic views from Pidurangala Rock",
      "Explore Polonnaruwa and Dambulla Cave Temple",
    ],
    popularActivities: ["Archaeological Tours", "Minneriya Elephant Safari", "Village Cooking Class"],
    recommendedDays: "2 - 3 Days (4 hrs from Airport)",
  },
  {
    id: "ella",
    name: "Ella",
    region: "Hill Country",
    tagline: "Misty Mountains, Tea Trails & Iconic Railway Bridges",
    description:
      "A peaceful mountain village famed for its breathtaking views, hiking trails through tea gardens, waterfalls, and the iconic Nine Arches Bridge.",
    image: "/images/Ella_adventure.JPG",
    imageAlt: "Nine Arches Bridge in Ella surrounded by tea hills",
    bestTimeToVisit: "January to May",
    highlights: [
      "Watch train crossing Nine Arches Bridge",
      "Hike Little Adam's Peak & Ella Rock",
      "Scenic train ride from Kandy to Ella",
    ],
    popularActivities: ["Highland Trekking", "Waterfall Bathing", "Tea Factory Tastings"],
    recommendedDays: "2 - 3 Days (5.5 hrs from Airport)",
  },
  {
    id: "kandy",
    name: "Kandy",
    region: "Cultural Triangle",
    tagline: "Sacred Tooth Relic, Royal Botanical Gardens & Tradition",
    description:
      "Sri Lanka's last royal kingdom nestled among green hills, home to the Temple of the Sacred Tooth Relic and traditional Kandyan dance performances.",
    image: "/images/temple-of-the-tooth.jpg",
    imageAlt: "Kandy Lake and temple view",
    bestTimeToVisit: "December to April",
    highlights: [
      "Temple of the Sacred Tooth Relic (Sri Dalada Maligawa)",
      "Royal Botanical Gardens Peradeniya",
      "Kandyan Cultural Dance Show",
    ],
    popularActivities: ["Cultural Heritage Walk", "Spice Garden Visit", "Lake Stroll"],
    recommendedDays: "1 - 2 Days (3 hrs from Airport)",
  },
  {
    id: "mirissa",
    name: "Mirissa",
    region: "South Coast",
    tagline: "Golden Beaches, Whale Watching & Palm Rope Swings",
    description:
      "A vibrant coastal paradise known for its laid-back beach vibe, blue whale safaris, Coconut Tree Hill, and fresh seafood dining on the sand.",
    image: "/images/mirissa_turtle.jpg",
    imageAlt: "Palm trees on Mirissa coast",
    bestTimeToVisit: "November to April",
    highlights: [
      "Blue Whale & Dolphin Watching Safaris",
      "Sunset view at Coconut Tree Hill",
      "Surfing & beach relaxation in Weligama",
    ],
    popularActivities: ["Whale Safaris", "Surfing Lessons", "Seafood BBQ Dinners"],
    recommendedDays: "2 - 4 Days (2.5 hrs from Airport)",
  },
  {
    id: "yala",
    name: "Yala",
    region: "Wildlife & Nature",
    tagline: "Wild Leopards, Elephants & Coastal Wilderness",
    description:
      "Sri Lanka’s most famous wildlife sanctuary, possessing one of the highest leopard densities in the world alongside wild elephants and sloth bears.",
    image: "/images/leopard-yala-national-park.jpg",
    imageAlt: "Leopard in Yala National Park",
    bestTimeToVisit: "February to July",
    highlights: [
      "Jeep Safari targeting Leopard tracking",
      "Wild Elephant herds near waterholes",
      "Coastal wilderness & bird watching",
    ],
    popularActivities: ["4x4 Game Drives", "Camping in Nature", "Bird Watching"],
    recommendedDays: "1 - 2 Days (4.5 hrs from Airport)",
  },
  {
    id: "galle",
    name: "Galle",
    region: "South Coast",
    tagline: "17th Century Dutch Fortification & Colonial Charm",
    description:
      "A historic fortified enclave where European colonial architecture blends seamlessly with tropical ocean views, boutique cafes, and artisan shops.",
    image: "/images/galle_fort.JPG",
    imageAlt: "Galle Fort Lighthouse and ocean view",
    bestTimeToVisit: "December to April",
    highlights: [
      "Sunset walk on Galle Fort Ramparts",
      "Galle Lighthouse & colonial streets",
      "Boutique shopping & artisan coffee",
    ],
    popularActivities: ["Heritage Walking Tour", "Coastal Photography", "Madu River Safari"],
    recommendedDays: "1 - 2 Days (2 hrs from Airport)",
  },
  {
    id: "nuwara-eliya",
    name: "Nuwara Eliya",
    region: "Hill Country",
    tagline: "Little England & Emerald Tea Estates",
    description:
      "Perched high in the central highlands, Nuwara Eliya charms visitors with cool mountain air, colonial bungalows, Gregory Lake, and rolling Ceylon tea plantations.",
    image: "/images/nuwaraeliya.jpg",
    imageAlt: "Nuwara Eliya tea plantations and highlands",
    bestTimeToVisit: "January to May",
    highlights: [
      "Ceylon Tea Factory tour & tasting",
      "Boat ride & stroll around Gregory Lake",
      "Horton Plains & World's End trek",
    ],
    popularActivities: ["Tea Estate Walks", "Lake Boating", "Highland Hiking"],
    recommendedDays: "1 - 2 Days (4.5 hrs from Airport)",
  },
  {
    id: "bentota",
    name: "Bentota",
    region: "South Coast",
    tagline: "Golden Beaches, Mangroves & Water Sports",
    description:
      "A premier resort town on the southwest coast offering calm golden beaches, thrilling lagoon water sports, sea turtle hatcheries, and Madu River boat safaris.",
    image: "/images/benthota_water_sport.jpg",
    imageAlt: "Bentota beach and water sports",
    bestTimeToVisit: "November to April",
    highlights: [
      "Jet skiing & lagoon water sports",
      "Madu River mangrove boat safari",
      "Kosgoda Sea Turtle Hatchery visit",
    ],
    popularActivities: ["Water Sports", "River Safaris", "Turtle Conservation"],
    recommendedDays: "1 - 3 Days (1.5 hrs from Airport)",
  },
  {
    id: "colombo",
    name: "Colombo",
    region: "Heritage & Cities",
    tagline: "The Bustling Oceanfront Capital City",
    description:
      "Sri Lanka’s vibrant commercial capital where historic colonial landmarks, Gangaramaya Temple, colourful Pettah markets, and Galle Face Green meet modern dining.",
    image: "/images/colombo-sri-lanka.jpg",
    imageAlt: "Colombo city skyline and oceanfront",
    bestTimeToVisit: "Year-round (Best Dec - Apr)",
    highlights: [
      "Gangaramaya Temple & Seema Malaka",
      "Sunset street food at Galle Face Green",
      "Lotus Tower & historic Pettah bazaar",
    ],
    popularActivities: ["City Heritage Tour", "Street Food Walk", "Shopping"],
    recommendedDays: "1 - 2 Days (45 mins from Airport)",
  },
  {
    id: "negombo",
    name: "Negombo",
    region: "Heritage & Cities",
    tagline: "Coastal Charm, Dutch Canals & Lagoon Sunsets",
    description:
      "Located just minutes from the international airport, Negombo welcomes travelers with wide sandy beaches, historic Dutch canals, and traditional catamarans.",
    image: "/images/negombo-heritance.jpg",
    imageAlt: "Negombo beach and fishing boats",
    bestTimeToVisit: "December to April",
    highlights: [
      "Negombo Lagoon boat safari",
      "Historic Dutch Canal & fish markets",
      "Relaxing sunset beach walk",
    ],
    popularActivities: ["Lagoon Boating", "Beach Relaxation", "Seafood Dining"],
    recommendedDays: "1 Day (20 mins from Airport)",
  },
];
