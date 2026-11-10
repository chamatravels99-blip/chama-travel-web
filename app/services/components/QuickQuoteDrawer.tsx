"use client";

import BookingForm from "@/components/BookingForm";
import type { ServiceType, VehicleCategory } from "../types";

interface QuickQuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceType?: ServiceType;
  initialVehicleCategory?: VehicleCategory;
  serviceTitle?: string;
}

const serviceCodes: Record<ServiceType, string> = {
  "Airport Transfers": "airport_transfer",
  "Islandwide Private Vehicle Hire": "vehicle_hire",
  "Customized Sri Lanka Round Tours": "round_tour",
  "Day Trips & Excursions": "day_trip",
};

function vehicleCode(vehicle: VehicleCategory) {
  if (vehicle.toLowerCase().includes("mini bus") || vehicle.toLowerCase().includes("coaster")) {
    return "mini_bus";
  }
  if (vehicle.toLowerCase().includes("van") || vehicle.toLowerCase().includes("kdh")) {
    return "luxury_van";
  }
  return "sedan";
}

export default function QuickQuoteDrawer({
  isOpen,
  onClose,
  initialServiceType = "Airport Transfers",
  initialVehicleCategory = "Sedan (Toyota Axio/Prius)",
  serviceTitle = initialServiceType,
}: QuickQuoteDrawerProps) {
  if (!isOpen) return null;

  return (
    <BookingForm
      isOpen
      onClose={onClose}
      submitLabel="Continue Booking"
      heading={`Request ${serviceTitle}`}
      initialValues={{
        service_type: serviceCodes[initialServiceType],
        booking_title: serviceTitle,
        vehicle_type: vehicleCode(initialVehicleCategory),
      }}
    />
  );
}
