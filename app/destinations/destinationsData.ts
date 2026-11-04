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
    name: "Sigiriya & Cultural Triangle",
    region: "Central Province / Cultural Triangle",
    tagline: "Ancient Lions Rock Fortress & Royal Heritage",
    description:
      "A UNESCO World Heritage site featuring a 5th-century palace fortress built atop a 200-meter sheer rock, surrounded by lush water gardens and ancient frescoes.",
    image:
      "https://images.pexels.com/photos/34128249/pexels-photo-34128249.jpeg?auto=compress&cs=tinysrgb&w=1200",
    imageAlt: "Sigiriya Rock Fortress rising above greenery",
    bestTimeToVisit: "December to April",
    highlights: [
      "Climb Sigiriya Rock at sunrise or sunset",
      "Panoramic views from Pidurangala Rock",
      "Explore Polonnaruwa and Dambulla Cave Temple",
    ],
    popularActivities: ["Archaeological Tours", "Minneriya Elephant Safari", "Village Cooking Class"],
    recommendedDays: "2 - 3 Days",
  },
  {
    id: "ella",
    name: "Ella & Hill Country Highlands",
    region: "Uva Province / Highlands",
    tagline: "Misty Mountains, Tea Trails & Iconic Railway Bridges",
    description:
      "A peaceful mountain village famed for its breathtaking views, hiking trails through tea gardens, waterfalls, and the iconic Nine Arches Bridge.",
    image:
      "/images/Ella_adventure.JPG",
    imageAlt: "Nine Arches Bridge in Ella surrounded by tea hills",
    bestTimeToVisit: "January to May",
    highlights: [
      "Watch train crossing Nine Arches Bridge",
      "Hike Little Adam's Peak & Ella Rock",
      "Scenic train ride from Kandy to Ella",
    ],
    popularActivities: ["Highland Trekking", "Waterfall Bathing", "Tea Factory Tastings"],
    recommendedDays: "2 - 3 Days",
  },
  {
    id: "kandy",
    name: "Kandy Cultural Capital",
    region: "Central Province",
    tagline: "Sacred Tooth Relic, Royal Botanical Gardens & Tradition",
    description:
      "Sri Lanka's last royal kingdom nestled among green hills, home to the Temple of the Sacred Tooth Relic and traditional Kandyan dance performances.",
    image:
      "/images/temple-of-the-tooth.jpg",
    imageAlt: "Kandy Lake and temple view",
    bestTimeToVisit: "December to April",
    highlights: [
      "Temple of the Sacred Tooth Relic (Sri Dalada Maligawa)",
      "Royal Botanical Gardens Peradeniya",
      "Kandyan Cultural Dance Show",
    ],
    popularActivities: ["Cultural Heritage Walk", "Spice Garden Visit", "Lake Stroll"],
    recommendedDays: "1 - 2 Days",
  },
  {
    id: "mirissa",
    name: "Mirissa & Southern Coast",
    region: "Southern Province",
    tagline: "Golden Beaches, Whale Watching & Palm rope Swings",
    description:
      "A vibrant coastal paradise known for its laid-back beach vibe, blue whale safaris, Coconut Tree Hill, and fresh seafood dining on the sand.",
    image:
      "/images/mirissa_turtle.jpg",
    imageAlt: "Palm trees on Mirissa coast",
    bestTimeToVisit: "November to April",
    highlights: [
      "Blue Whale & Dolphin Watching Safaris",
      "Sunset view at Coconut Tree Hill",
      "Surfing & beach relaxation in Weligama",
    ],
    popularActivities: ["Whale Safaris", "Surfing Lessons", "Seafood BBQ Dinners"],
    recommendedDays: "2 - 4 Days",
  },
  {
    id: "yala",
    name: "Yala National Park",
    region: "Southern / Southern-Eastern Province",
    tagline: "Wild Leopards, Elephants & Coastal Wilderness",
    description:
      "Sri Lanka’s most famous wildlife sanctuary, possessing one of the highest leopard densities in the world alongside wild elephants and sloth bears.",
    image:
      "/images/leopard-yala-national-park.jpg",
    imageAlt: "Leopard in Yala National Park",
    bestTimeToVisit: "February to July",
    highlights: [
      "Jeep Safari targeting Leopard tracking",
      "Wild Elephant herds near waterholes",
      "Coastal wilderness & bird watching",
    ],
    popularActivities: ["4x4 Game Drives", "Camping in Nature", "Bird Watching"],
    recommendedDays: "1 - 2 Days",
  },
  {
    id: "galle",
    name: "Galle Fort & Coastal Dutch Heritage",
    region: "Southern Province",
    tagline: "17th Century Dutch Fortification & Colonial Charm",
    description:
      "A historic fortified enclave where European colonial architecture blends seamlessly with tropical ocean views, boutique cafes, and artisan shops.",
    image:
      "/images/galle_fort.JPG",
    imageAlt: "Galle Fort Lighthouse and ocean view",
    bestTimeToVisit: "December to April",
    highlights: [
      "Sunset walk on Galle Fort Ramparts",
      "Galle Lighthouse & colonial streets",
      "Boutique shopping & artisan coffee",
    ],
    popularActivities: ["Heritage Walking Tour", "Coastal Photography", "Madu River Safari"],
    recommendedDays: "1 Day",
  },
];