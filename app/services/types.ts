export type ServiceType =
  | "Airport Transfers"
  | "Islandwide Private Vehicle Hire"
  | "Customized Sri Lanka Round Tours"
  | "Day Trips & Excursions";

export type VehicleCategory =
  | "Sedan (Toyota Axio/Prius)"
  | "Spacious Passenger Van (Toyota KDH)"
  | "Mini Bus / Coaster (9-14 Pax)";

export interface ServiceItem {
  id: string;
  serviceType: ServiceType;
  title: string;
  badge: string;
  shortDesc: string;
  fullDesc: string;
  image: string;
  imageAlt: string;
  highlights: string[];
  inclusions: string[];
  popularDestinations: string[];
  startingRateHint?: string;
  whatsappMessage: string;
}

export interface FleetVehicle {
  id: string;
  name: string;
  category: VehicleCategory;
  models: string;
  passengers: string;
  luggage: string;
  acType: string;
  bestFor: string;
  image: string;
  imageAlt: string;
  features: string[];
  tag: string;
  whatsappMessage: string;
}

export interface GuaranteeBadge {
  icon: string;
  title: string;
  description: string;
  subHighlight: string;
}

export interface QuickQuoteFormState {
  serviceType: ServiceType;
  vehicleType: VehicleCategory | "Unsure / Need Advice";
  fullName: string;
  email: string;
  whatsapp: string;
  pickupLocation: string;
  dropoffLocation: string;
  travelDate: string;
  flightNumber: string;
  passengers: string;
  luggage: string;
  specialRequests: string;
}
