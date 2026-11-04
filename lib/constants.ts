export const SERVICE_TYPES = [
  { value: 'airport_transfer', label: 'Airport transfer', description: 'Between the airport and your hotel or home.' },
  { value: 'day_trip', label: 'Day trip', description: 'One day out and back, with a driver on call.' },
  { value: 'round_tour', label: 'Round tour', description: 'Multi-day trip with a driver for the whole journey.' },
  { value: 'vehicle_hire', label: 'Vehicle hire', description: 'Private vehicle and driver for your schedule.' },
  { value: 'custom', label: 'Custom itinerary', description: 'A tailored transfer or travel plan.' },
] as const;

export const VEHICLES = [
  { value: 'sedan', label: 'Sedan', maxPassengers: 3, maxLuggage: 2, description: 'Best for couples and small families.' },
  { value: 'luxury_van', label: 'Luxury van', maxPassengers: 7, maxLuggage: 6, description: 'Space and comfort for groups and long drives.' },
  { value: 'mini_bus', label: 'Mini bus', maxPassengers: 14, maxLuggage: 14, description: 'For large groups and events.' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash to the driver', description: 'Pay on the day of travel.' },
  { value: 'bank_transfer', label: 'Bank transfer', description: 'We email the account details.' },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]['value'];
export type VehicleType = (typeof VEHICLES)[number]['value'];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export interface BookingFormState {
  serviceType: ServiceType | '';
  pickupDate: string;
  pickupTime: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  flightNumber: string;
  passengers: number;
  luggage: number;
  vehicleType: VehicleType | '';
  name: string;
  email: string;
  phone: string;
  paymentMethod: PaymentMethod | '';
  notes: string;
}

export type BookingErrors = Partial<Record<keyof BookingFormState, string>>;

export const INITIAL_FORM: BookingFormState = {
  serviceType: '', pickupDate: '', pickupTime: '', endDate: '',
  pickupLocation: '', dropoffLocation: '', flightNumber: '',
  passengers: 1, luggage: 0, vehicleType: '',
  name: '', email: '', phone: '', paymentMethod: '', notes: '',
};

export const vehicleFits = (v: (typeof VEHICLES)[number], passengers: number, luggage: number) =>
  passengers <= v.maxPassengers && luggage <= v.maxLuggage;

/** Today's date in Sri Lanka as YYYY-MM-DD (for min date inputs and validation). */
export const todayInColombo = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });

export function validateStep(step: number, f: BookingFormState): BookingErrors {
  const e: BookingErrors = {};
  if (step === 0) {
    if (!f.serviceType) e.serviceType = 'Choose a service.';
    if (!f.pickupDate) e.pickupDate = 'Choose a date.';
    else if (f.pickupDate < todayInColombo()) e.pickupDate = 'The date can’t be in the past.';
    if (!f.pickupTime) e.pickupTime = 'Choose a pickup time.';
    if (!f.pickupLocation.trim()) e.pickupLocation = 'Enter the pickup location.';
    if (!f.dropoffLocation.trim()) e.dropoffLocation = 'Enter the drop-off location.';
    if (f.serviceType === 'round_tour') {
      if (!f.endDate) e.endDate = 'Choose the tour end date.';
      else if (f.endDate < f.pickupDate) e.endDate = 'The end date must be on or after the start date.';
    }
  }
  if (step === 1) {
    const v = VEHICLES.find((x) => x.value === f.vehicleType);
    if (!Number.isInteger(f.passengers) || f.passengers < 1 || f.passengers > 14)
      e.passengers = 'Enter between 1 and 14 passengers.';
    if (!Number.isInteger(f.luggage) || f.luggage < 0 || f.luggage > 14)
      e.luggage = 'Enter between 0 and 14 bags.';
    if (!v) e.vehicleType = 'Choose a vehicle.';
    else if (!vehicleFits(v, f.passengers, f.luggage))
      e.vehicleType = `The ${v.label.toLowerCase()} can’t carry this group and luggage.`;
  }
  if (step === 2) {
    if (f.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!/^\+?[0-9\s-]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number, e.g. +94 77 123 4567.';
    if (!f.paymentMethod) e.paymentMethod = 'Choose how you’d like to pay.';
  }
  return e;
}