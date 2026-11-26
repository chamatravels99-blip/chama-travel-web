export function sriLankanWhatsAppNumber(value: string): string | null {
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const compact = value.replace(/[\s().-]/g, '');
  let national: string;
  if (compact.startsWith('+94')) national = compact.slice(3);
  else if (compact.startsWith('0094')) national = compact.slice(4);
  else if (compact.startsWith('94')) national = compact.slice(2);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else return null;
  return /^7\d{8}$/.test(national) ? `94${national}` : null;
}

export function whatsAppLink(phone: string | null, message: string): string | null {
  const number = phone ? sriLankanWhatsAppNumber(phone) : null;
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function customerWhatsAppUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const sl = sriLankanWhatsAppNumber(phone);
  if (sl) return `https://wa.me/${sl}?text=${encodeURIComponent(message)}`;
  const clean = phone.replace(/[^\d]/g, '');
  if (clean.length >= 10 && clean.length <= 15) {
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }
  return null;
}

export type TripDispatchDetails = {
  bookingRef: string;
  customerName: string;
  serviceType: string;
  journeyType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTimeColombo: string;
  driverName: string;
  driverPhone: string | null;
  vehicleName: string;
  vehicleRegistration: string | null;
  passengerCount: number;
};

export function formatTripDispatchMessage(details: TripDispatchDetails): string {
  const service = details.serviceType.replaceAll('_', ' ');
  const journey = details.journeyType.replaceAll('_', ' ');
  const driverContact = details.driverPhone ? details.driverPhone : 'Contact office';
  const vehicleReg = details.vehicleRegistration ? ` (Reg: ${details.vehicleRegistration})` : '';

  return `*CHAMA TRAVELS — TRIP & DRIVER DETAILS*

Dear ${details.customerName},

Here are your confirmed trip and driver details for booking *${details.bookingRef}*:

📅 *Date & Pickup Time:* ${details.pickupTimeColombo}
📍 *Pickup Location:* ${details.pickupLocation}
🏁 *Drop-off Location:* ${details.dropoffLocation}
🚗 *Service:* ${service} (${journey})
👥 *Passengers:* ${details.passengerCount}

👨‍✈️ *Assigned Driver:* ${details.driverName}
📞 *Driver Contact:* ${driverContact}
🚘 *Vehicle:* ${details.vehicleName}${vehicleReg}

Thank you for choosing Chama Travels! If you have any questions or schedule adjustments, please contact us or reply to this message.`;
}

export type DriverTripDispatchDetails = {
  bookingRef: string;
  driverName: string;
  customerName: string;
  customerPhone: string;
  pickupTimeColombo: string;
  pickupLocation: string;
  dropoffLocation: string;
  routeSummary?: string | null;
  passengerCount: number;
  luggageCount: number;
  vehicleName: string;
  vehicleRegistration: string | null;
  customerNotes?: string | null;
};

export function formatDriverTripDispatchMessage(details: DriverTripDispatchDetails): string {
  const vehicleReg = details.vehicleRegistration ? ` (Reg: ${details.vehicleRegistration})` : '';
  const cleanedNotes = details.customerNotes?.trim() || '';

  const lines = [
    '*CHAMA TRAVELS — DRIVER TRIP DISPATCH*',
    '',
    `Hello ${details.driverName},`,
    '',
    `You have been assigned to booking *${details.bookingRef}*. Please review the trip details below:`,
    '',
    `👤 *Customer:* ${details.customerName}`,
    `📞 *Customer Contact:* ${details.customerPhone || 'Contact office'}`,
    `📅 *Pickup Date & Time:* ${details.pickupTimeColombo}`,
    `📍 *Pickup Location:* ${details.pickupLocation}`,
    `🏁 *Drop-off / Route:* ${details.routeSummary?.trim() || details.dropoffLocation}`,
    `👥 *Passengers & Luggage:* ${details.passengerCount} pax · ${details.luggageCount} bags`,
    `🚘 *Assigned Vehicle:* ${details.vehicleName}${vehicleReg}`,
  ];

  if (cleanedNotes) {
    lines.push('', `📝 *Special Instructions / Trip Notes:*`, cleanedNotes);
  }

  lines.push(
    '',
    'Please arrive at the pickup point 15 minutes early and confirm receipt of this dispatch with the Chama Travels office.'
  );

  return lines.join('\n');
}
