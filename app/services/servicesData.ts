import { FleetVehicle, GuaranteeBadge, ServiceItem } from "./types";

export const whatsappNumber = "94711114901";

export const coreServicesData: ServiceItem[] = [
  {
    id: "airport-transfers",
    serviceType: "Airport Transfers",
    title: "Airport Transfers (BIA Katunayake / Mattala)",
    badge: "24/7 Priority Service",
    shortDesc:
      "Stress-free, 24/7 direct airport pickup and drop-off with live flight tracking, warm VIP paging reception, and zero delay surcharges.",
    fullDesc:
      "Arrive in Sri Lanka with complete peace of mind. Your dedicated chauffeur guide tracks your incoming flight in real time, waits inside the air-conditioned arrival terminal with a personalized name-board, assists with your luggage, and whisks you straight to your hotel via the expressway. All highway tolls, fuel, and parking fees are completely included.",
    image:
      "/images/airlinesl.jpg",
    imageAlt: "Airplane landing in tropical Sri Lanka for airport transfers",
    highlights: [
      "24/7 Live flight radar monitoring & flight delay protection (zero waiting surcharges)",
      "Warm paging name-board reception inside the Katunayake (CMB) or Mattala (HRI) arrival lounge",
      "All expressway toll tickets, parking permits, and fuel included — no surprise cash requests",
      "Express highway route to Colombo (35 mins), Negombo (20 mins), Galle (2 hrs), or Kandy (2.5 hrs)",
      "Complimentary cold mineral water bottles and high-speed Wi-Fi hot-spot assistance",
    ],
    inclusions: [
      "Dedicated air-conditioned private vehicle",
      "SLTDA-licensed English-speaking chauffeur",
      "Arrival terminal name-board meet & greet",
      "Expressway highway tolls & airport parking",
      "Flight delay buffer & luggage assistance",
    ],
    popularDestinations: ["Negombo", "Colombo", "Kandy", "Galle / Bentota", "Sigiriya", "Ella"],
    startingRateHint: "Flat rates from $25 (Negombo) & $45 (Colombo)",
    whatsappMessage:
      "Hello Chama Travels, I would like to book an Airport Transfer to/from Bandaranaike Airport (CMB).",
  },
  {
    id: "private-vehicle-hire",
    serviceType: "Islandwide Private Vehicle Hire",
    title: "Islandwide Private Vehicle Hire with Driver-Guide",
    badge: "Most Flexible Choice",
    shortDesc:
      "Rent an air-conditioned Sedan, Luxury Passenger Van, or Mini Bus with a friendly, licensed English-speaking chauffeur for your entire trip.",
    fullDesc:
      "Enjoy the ultimate freedom to explore Sri Lanka at your own rhythm without navigating stressful traffic or train schedules. You get an impeccably maintained, fully-insured vehicle and a professional, government-certified tourist chauffeur guide. Driver overnight accommodation, daily meals, fuel, and expressway tolls are 100% taken care of by us.",
    image:
      "/images/privite_taxi.jpg",
    imageAlt: "Scenic road journey through Sri Lanka with private chauffeur vehicle",
    highlights: [
      "Modern A/C fleet: Sedans (1-3 Pax), Toyota KDH Vans (4-8 Pax), and Mini Buses (9-14 Pax)",
      "Certified SLTDA English-speaking driver-guides who know every scenic shortcut and scenic vista",
      "Total itinerary flexibility: start your day whenever you wish, stop for fresh coconuts anytime",
      "Driver meals, overnight lodging, fuel, and parking fees fully covered with zero hidden bills",
      "Safe, courteous driving standards with 24/7 customer care and route tracking support",
    ],
    inclusions: [
      "Private vehicle exclusively for your party",
      "Fuel, expressway tolls & roadside parking",
      "Driver's daily food & hotel accommodation",
      "Unlimited itinerary advice & local assistance",
      "Full passenger and commercial vehicle insurance",
    ],
    popularDestinations: ["Cultural Triangle", "Central Highlands", "Southern Coast", "East Coast", "Jaffna"],
    startingRateHint: "From $65 / day all-inclusive",
    whatsappMessage:
      "Hello Chama Travels, I would like to inquire about Islandwide Private Vehicle Hire with an English-speaking driver.",
  },
  {
    id: "round-tours",
    serviceType: "Customized Sri Lanka Round Tours",
    title: "Customized Sri Lanka Round Tours",
    badge: "Tailor-Made Journeys",
    shortDesc:
      "Bespoke multi-day travel itineraries hand-crafted to your travel pace, interests, budget, and arrival/departure flight schedules.",
    fullDesc:
      "Whether you are planning an unforgettable 7-day family vacation, a romantic 10-day honeymoon, or a 14-day wildlife and heritage expedition, our travel specialists design every single day around your preferences. We coordinate temple visits, scenic train tickets, wildlife safaris, and boutique hotel bookings seamlessly.",
    image:
      "/images/sigiriya_boat.jpg",
    imageAlt: "Sigiriya Rock Fortress rising above Sri Lankan forest at sunrise",
    highlights: [
      "Tailored day-by-day itineraries matching your exact pace, group size, and favorite sights",
      "Full coverage: Sigiriya, Dambulla, Kandy, Nuwara Eliya, Ella, Yala, Mirissa, and Galle Fort",
      "Assistance with reserved Kandy-Ella scenic train seats and open-top 4x4 safari jeeps",
      "Dedicated chauffeur guide remains with your group throughout every leg of the journey",
      "Free pre-trip consultation via WhatsApp or phone with expert route optimization",
    ],
    inclusions: [
      "Custom day-by-day route planning",
      "Private dedicated vehicle for all tour days",
      "Professional SLTDA chauffeur guide",
      "All fuel, highway tolls & driver expenses",
      "Hotel & safari jeep booking coordination",
    ],
    popularDestinations: ["Sigiriya", "Kandy", "Nuwara Eliya", "Ella", "Yala Safari", "Mirissa Beach"],
    startingRateHint: "Customized packages from 3 to 21+ Days",
    whatsappMessage:
      "Hello Chama Travels, I want to design a Customized Sri Lanka Round Tour for my upcoming holiday.",
  },
  {
    id: "day-trips-excursions",
    serviceType: "Day Trips & Excursions",
    title: "Day Trips, Shore Excursions & Safari Pickups",
    badge: "1-Day Adventures",
    shortDesc:
      "Single-day excursions from Colombo, Negombo, Galle, or cruise ports — including wildlife safari transfers, whale watching, and adventure pickups.",
    fullDesc:
      "Make the most of limited time with our prompt day tours and excursion transfers. We cater to cruise ship passengers docking at Colombo, Galle, or Hambantota ports with guaranteed on-time return to ship, as well as vacationers looking for full-day trips to Sigiriya Rock, Kandy Tooth Temple, Udawalawe Elephant safaris, or Kithulgala whitewater rafting.",
    image:
      "/images/galle_fort.JPG",
    imageAlt: "Wild elephant safari in Sri Lanka during a day trip excursion",
    highlights: [
      "Colombo, Galle & Hambantota Cruise Port Shore Excursions with guaranteed timely ship return",
      "Express 1-day trips to Sigiriya Rock Fortress, Dambulla Cave Temples, or Kandy Royal Palace",
      "Early morning wildlife safari transfers to Udawalawe, Yala, Wilpattu, or Minneriya National Parks",
      "Adventure day transfers: Kithulgala whitewater rafting, Ella Little Adam's Peak, Mirissa whales",
      "Door-to-door hotel pickup and return drop-off with flexible dinner & shopping stops",
    ],
    inclusions: [
      "Private pickup and drop-off from hotel or port",
      "Air-conditioned vehicle with licensed driver",
      "All fuel and expressway highway toll tickets",
      "Flexible timing for lunch and scenic photography",
      "Port gate access coordination for cruise guests",
    ],
    popularDestinations: ["Galle Fort Day Tour", "Kandy Cultural Tour", "Sigiriya Day Trip", "Udawalawe Safari", "Kithulgala Rafting"],
    startingRateHint: "Day trips from $55 per vehicle",
    whatsappMessage:
      "Hello Chama Travels, I would like to book a Day Trip / Shore Excursion in Sri Lanka.",
  },
];

export const fleetVehiclesData: FleetVehicle[] = [
  {
    id: "sedan",
    name: "Comfort Sedan",
    category: "Sedan (Toyota Axio/Prius)",
    models: "Toyota Axio / Allion / Grace / Prius Hybrid",
    passengers: "1 - 3 Passengers",
    luggage: "2 Large + 2 Small Bags",
    acType: "Climate Controlled A/C",
    bestFor: "Couples, Solo Travelers & Small Families",
    image:
      "/images/toyota_corolla_car.jpg",
    imageAlt: "Comfortable air conditioned Toyota sedan for private travel in Sri Lanka",
    tag: "Most Popular for Couples",
    features: [
      "Whisper-quiet hybrid / petrol efficiency",
      "High-power air conditioning for tropical heat",
      "Bluetooth audio & USB smartphone charging",
      "Deep trunk space for suitcases & daypacks",
      "Ergonomic contoured seating with armrests",
      "Complimentary bottled water & wet wipes",
    ],
    whatsappMessage:
      "Hello Chama Travels, I would like to inquire about reserving a Sedan (Toyota Axio/Prius) for my Sri Lanka journey.",
  },
  {
    id: "spacious-van",
    name: "Spacious Passenger Van",
    category: "Spacious Passenger Van (Toyota KDH)",
    models: "Toyota KDH / Flat Roof / High Roof Commuter",
    passengers: "4 - 10 Passengers",
    luggage: "5 - 9 Large Bags + Carry-ons",
    acType: "Dual Front & Rear Overhead A/C",
    bestFor: "Families, Small Groups & Surf/Camera Travelers",
    image:
      "/images/toyota_hiace.jpg",
    imageAlt: "Toyota KDH luxury passenger van with reclining seats for Sri Lanka tours",
    tag: "Best for Families & Groups",
    features: [
      "Dual-zone overhead air conditioning to every row",
      "Velvet-plush reclining individual seats",
      "Tinted UV-protective privacy glass throughout",
      "Generous aisle space & elevated ride height",
      "Multi-port USB charging stations for all passengers",
      "Child safety booster seats available upon advance notice",
    ],
    whatsappMessage:
      "Hello Chama Travels, I would like to inquire about reserving a Spacious Passenger Van (Toyota KDH) for my group.",
  },
  {
    id: "mini-bus",
    name: "Mini Bus / Tourist Bus",
    category: "Mini Bus / Coaster (9-14 Pax)",
    models: "Toyota Coaster / Mitsubishi Rosa Luxury Coach",
    passengers: "9 - 23 Passengers",
    luggage: "9 - 20 Large Bags (Maximum Capacity)",
    acType: "Heavy-Duty Roof-Mounted Dual A/C",
    bestFor: "Extended Family Reunions & Tour Groups",
    image:
      "/images/fuso_bus.jpg",
    imageAlt: "Toyota Coaster tourist mini bus for large group travel across Sri Lanka",
    tag: "Maximum Luggage & Seating",
    features: [
      "Commercial heavy-duty high-output climate control",
      "High-back reclining coach seats with footrests",
      "Wide panoramic picture windows for scenic mountain views",
      "Built-in PA microphone system for tour guide commentary",
      "Dedicated rear or overhead luggage racks for bulky gear",
      "Dual emergency exits & full passenger group insurance",
    ],
    whatsappMessage:
      "Hello Chama Travels, I would like to inquire about booking a Mini Bus / Coaster for a large group tour in Sri Lanka.",
  },
];

export const serviceGuaranteesData: GuaranteeBadge[] = [
  {
    icon: "💎",
    title: "100% Transparent Flat Rates",
    subHighlight: "Zero Hidden Costs",
    description:
      "No surprise fuel supplements, no unexpected toll fees, and no forced commissions. Driver meals and overnight stays are fully included in our quote.",
  },
  {
    icon: "🛡️",
    title: "Certified SLTDA Driver-Guides",
    subHighlight: "Government Accredited",
    description:
      "Our chauffeurs are certified by the Sri Lanka Tourism Development Authority, fluent in English, and rigorously background-checked for professionalism.",
  },
  {
    icon: "⏱️",
    title: "Punctual & Safe Driving Assurance",
    subHighlight: "24/7 Route Monitoring",
    description:
      "We prioritize your safety above all. We practice defensive driving, strictly respect speed regulations, and guarantee timely pickups for every booking.",
  },
  {
    icon: "❄️",
    title: "Clean, Modern, Fully-Insured Fleet",
    subHighlight: "Daily Sanitization",
    description:
      "Every vehicle undergoes routine mechanical checkups, has high-power ice-cold air conditioning, non-smoking interiors, and full commercial passenger insurance.",
  },
];

export const servicesFaqs = [
  {
    question: "How do airport pickups work when my flight lands at Bandaranaike (CMB)?",
    answer:
      "After passing through customs and collecting your bags, exit into the arrivals hall. Your Chama Travels driver will be waiting right at the passenger barrier holding a prominent name-board with your name. We monitor your flight on radar, so even if your arrival is delayed or lands early, your driver will be there on time.",
  },
  {
    question: "Are expressway tolls and fuel really included in the vehicle hire rate?",
    answer:
      "Yes, 100%! When you book a private vehicle with Chama Travels, all highway expressway tickets (e.g., Katunayake Expressway, Southern Expressway, Central Expressway), fuel for the agreed itinerary, vehicle insurance, and parking charges are fully included. You will never be asked to pay unexpected cash on the road.",
  },
  {
    question: "Do I need to pay or arrange for the driver's meals and hotel rooms?",
    answer:
      "No. All driver meals and overnight driver accommodations are either handled by our company allowance or arranged via standard driver quarters provided by tourist hotels throughout Sri Lanka. You can focus entirely on enjoying your trip.",
  },
  {
    question: "Can we modify our route or add spontaneous stops during the day?",
    answer:
      "Absolutely! Having a private vehicle with Chama Travels means complete flexibility. If you want to stop for fresh king coconuts, take scenic photos of tea plantations, or visit an artisan craft shop, simply let your driver know. You dictate the pace of each day.",
  },
  {
    question: "How can I secure a vehicle or get an instant quote?",
    answer:
      "You can submit our quick online request form on this page or tap the direct WhatsApp button. We respond in minutes with clear flat rates and vehicle confirmation without requiring rigid upfront deposits.",
  },
];
