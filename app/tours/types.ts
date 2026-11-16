export type TourCategory = string;

export interface VehiclePriceOption {
  vehicleType: string;
  paxCapacity: string;
  luggageCapacity: string;
  totalPriceUSD: number;
  perDayUSD: number;
  recommendedFor: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  route: string;
  description: string;
  activities: string[];
  overnightLocation?: string;
  travelTime?: string;
}

export interface Tour {
  id: string;
  title: string;
  category: string;
  duration: string;
  badge?: string;
  image: string;
  imageAlt: string;
  shortDescription: string;
  routeHighlights: string[];
  keyHighlights: string[];
  startingPriceUSD: number;
  startingPriceLKR?: number | null;
  pricingUnit: string;
  vehiclePricing: VehiclePriceOption[];
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryDay[];
}

export interface BookingFormData {
  tourId: string;
  tourTitle: string;
  vehicleType: string;
  fullName: string;
  email: string;
  phone: string;
  travelDate: string;
  passengers: number;
  specialRequests?: string;
}
