'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BookingOperations from './BookingOperations';
import BookingActivity from './BookingActivity';
import BookingBillingPanel from './BookingBillingPanel';
import {
  customerWhatsAppUrl,
  formatTripDispatchMessage,
  whatsAppLink,
} from '@/lib/whatsapp';
import { getGuestQuoteLinkState } from '@/lib/guest-quote-link';
import {
  AlertCircle,
  Calendar,
  Car,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Info,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  User,
  UserPlus,
  X,
} from 'lucide-react';

type BookingLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  trip_status: string;
};

type BookingQuote = {
  id: string;
  revision: number;
  currency: string;
  total: number;
  quote_status: string;
  expires_at: string;
  has_guest_acceptance_link: boolean;
  token_expires_at: string | null;
  token_consumed_at: string | null;
  token_revoked_at: string | null;
};

type Booking = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  currency: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  google_calendar_event_id?: string | null;
  google_calendar_synced_at?: string | null;
  google_calendar_sync_error?: string | null;
  created_at: string;
  legs: BookingLeg[];
  assignment: {
    id: string;
    driver_user_id: string;
    vehicle_id: string;
    assignment_status: string;
    driver_name?: string;
    driver_phone?: string | null;
    vehicle_name?: string;
    vehicle_registration?: string | null;
    vehicle_category?: string;
  } | null;
  quotes: BookingQuote[];
  financials?: {
    quote_id?: string;
    quote_total: number;
    currency: string;
    total_paid: number;
    net_paid: number;
    outstanding_balance: number;
    payment_status: 'paid' | 'partially_paid' | 'unpaid' | 'no_quote';
  } | null;
};

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  license_number?: string | null;
  driver_notes?: string | null;
  default_vehicle_id?: string | null;
  default_vehicle_name?: string | null;
  default_vehicle_registration?: string | null;
};
type Vehicle = {
  id: string;
  display_name: string;
  registration_number?: string | null;
  category_id?: string;
  category_name?: string;
  max_passengers?: number;
  max_luggage?: number;
  operational_status?: string;
};
type FleetCategoryOption = {
  id: string;
  code?: string;
  display_name?: string;
  name?: string;
  max_passengers?: number;
  max_luggage?: number;
  passenger_capacity?: number;
  luggage_capacity?: number;
};

type GuestTrackerState = {
  booking_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  active: boolean;
};

type GoogleCalendarStatusInfo = {
  configured: boolean;
  calendar_id: string;
};

type OperationsResponse = {
  success?: boolean;
  error?: string;
  data?: {
    bookings: Booking[];
    resources: { drivers: Driver[]; vehicles: Vehicle[] };
    guest_tracker_states?: GuestTrackerState[];
    google_calendar?: GoogleCalendarStatusInfo;
  };
  roles?: string[];
};

type OperationResponse = {
  success?: boolean;
  configured?: boolean;
  error?: string;
  message?: string;
  data?: {
    acceptance_url?: string | null;
    booking_id?: string;
    booking_ref?: string;
    auto_confirmed?: boolean;
    event_id?: string | null;
    synced_count?: number;
    failed_count?: number;
  };
};

type QuickTab = 'all' | 'needs_attention' | 'active_upcoming' | 'completed' | 'cancelled';

const PAGE_SIZE = 10;

const MANUAL_BOOKING_SOURCES = [
  'WhatsApp',
  'Phone Call',
  'Walk-in',
  'Email',
  'Partner/Agent',
] as const;

const MANUAL_SERVICE_TYPES = [
  'Airport Pickup',
  'Airport Drop',
  'Chauffeur Tour',
  'Day Trip',
  'Point-to-Point Transfer',
] as const;

const DEFAULT_VEHICLE_CATEGORIES = [
  { code: 'sedan', label: 'Sedan (1–3 Pax)' },
  { code: 'suv', label: 'SUV (1–4 Pax)' },
  { code: 'van', label: 'Passenger Van / KDH (1–8 Pax)' },
  { code: 'luxury', label: 'Luxury Executive (1–3 Pax)' },
  { code: 'minibus', label: 'Mini Coach / Bus (1–14 Pax)' },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatColomboTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function colomboDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function buildGoogleCalendarTemplateLink(booking: Booking): string {
  const firstLeg = booking.legs[0];
  const lastLeg = booking.legs[booking.legs.length - 1] ?? firstLeg;
  const pickup = firstLeg?.pickup_location || 'Sri Lanka';
  const dropoff = lastLeg?.dropoff_location || 'Destination';
  const start = firstLeg?.pickup_at ? new Date(firstLeg.pickup_at) : new Date(booking.created_at);
  const endRaw = lastLeg?.planned_end_at ? new Date(lastLeg.planned_end_at) : null;
  const end =
    endRaw && !Number.isNaN(endRaw.getTime()) && endRaw.getTime() > start.getTime()
      ? endRaw
      : new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const toGCalDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const title = `[Chama Travels] ${booking.customer_name} - ${pickup} → ${dropoff} (${booking.booking_status.replaceAll('_', ' ')})`;
  const details = [
    `Booking Reference: ${booking.booking_ref}`,
    `Customer: ${booking.customer_name} (${booking.customer_phone})`,
    `Passengers: ${booking.passenger_count} pax · ${booking.luggage_count} bags`,
    `Route: ${pickup} → ${dropoff}`,
    booking.assignment?.driver_name
      ? `Driver: ${booking.assignment.driver_name} (${booking.assignment.driver_phone || 'N/A'})`
      : 'Driver: Unassigned',
    booking.assignment?.vehicle_name
      ? `Vehicle: ${booking.assignment.vehicle_name} (${booking.assignment.vehicle_registration || 'N/A'})`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGCalDate(start)}/${toGCalDate(end)}`,
    location: pickup,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarPillClasses(status: string) {
  if (['confirmed'].includes(status)) {
    return 'border-blue-300 bg-blue-50/90 text-blue-950 hover:bg-blue-100';
  }
  if (['assigned', 'in_progress'].includes(status)) {
    return 'border-indigo-300 bg-indigo-50/90 text-indigo-950 hover:bg-indigo-100';
  }
  if (['completed'].includes(status)) {
    return 'border-emerald-300 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100';
  }
  if (['pending', 'reviewing', 'quoted'].includes(status)) {
    return 'border-amber-300 bg-amber-50/90 text-amber-950 hover:bg-amber-100';
  }
  if (['cancelled', 'rejected'].includes(status)) {
    return 'border-rose-200 bg-rose-50/80 text-rose-800 line-through opacity-75 hover:bg-rose-100';
  }
  return 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100';
}

function statusBadgeClasses(status: string) {
  if (['pending', 'reviewing', 'offered'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  }
  if (['confirmed', 'accepted', 'active', 'completed'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/20';
  }
  if (['assigned', 'quoted', 'sent', 'issued', 'in_progress'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/20';
  }
  if (['cancelled', 'expired', 'rejected', 'declined'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/20';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

function paymentBadgeClasses(status: string | undefined) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-800 ring-emerald-600/20';
  if (status === 'partially_paid') return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  if (status === 'unpaid') return 'bg-rose-50 text-rose-800 ring-rose-600/20';
  return 'bg-slate-100 text-slate-500 ring-slate-300';
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [guestTrackerStates, setGuestTrackerStates] = useState<GuestTrackerState[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [journeyFilter, setJourneyFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'pickup' | 'amount'>('newest');
  const [quickTab, setQuickTab] = useState<QuickTab>('all');
  const [page, setPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'quote' | 'dispatch' | 'billing' | 'activity'>('overview');
  const [assignments, setAssignments] = useState<Record<string, { driver: string; vehicle: string }>>({});
  const [savingAction, setSavingAction] = useState('');
  const [acceptanceLink, setAcceptanceLink] = useState<{ bookingId: string; url: string } | null>(null);
  const [dispatchPreviewBooking, setDispatchPreviewBooking] = useState<Booking | null>(null);
  const [dispatchCopied, setDispatchCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [showQuickAddDriver, setShowQuickAddDriver] = useState(false);
  const [fleetCategories, setFleetCategories] = useState<FleetCategoryOption[]>([]);
  const [quickDriverName, setQuickDriverName] = useState('');
  const [quickDriverPhone, setQuickDriverPhone] = useState('');
  const [quickDriverLicense, setQuickDriverLicense] = useState('');
  const [quickDriverNotes, setQuickDriverNotes] = useState('');
  const [quickVehicleMode, setQuickVehicleMode] = useState<'existing' | 'new' | 'none'>('new');
  const [quickExistingVehicleId, setQuickExistingVehicleId] = useState('');
  const [quickNewVehicleName, setQuickNewVehicleName] = useState('');
  const [quickNewVehicleCategoryId, setQuickNewVehicleCategoryId] = useState('');
  const [quickNewVehicleReg, setQuickNewVehicleReg] = useState('');
  const [quickNewVehiclePax, setQuickNewVehiclePax] = useState(4);
  const [quickNewVehicleLuggage, setQuickNewVehicleLuggage] = useState(4);
  const [savingQuickDriver, setSavingQuickDriver] = useState(false);

  // View Mode & Interactive Calendar State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const todayKey = colomboDateKey(new Date().toISOString());
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y || 2026, month: (m || 1) - 1 };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() =>
    colomboDateKey(new Date().toISOString())
  );
  const [googleCalendarInfo, setGoogleCalendarInfo] = useState<GoogleCalendarStatusInfo>({
    configured: false,
    calendar_id: 'primary',
  });
  const [showGCalSetupGuide, setShowGCalSetupGuide] = useState(false);
  const [syncingAllGCal, setSyncingAllGCal] = useState(false);

  // "+ Add Manual Booking" Modal State
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [manualSource, setManualSource] = useState<(typeof MANUAL_BOOKING_SOURCES)[number]>('WhatsApp');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualCustomerEmail, setManualCustomerEmail] = useState('');
  const [manualCustomerCountry, setManualCustomerCountry] = useState('');
  const [manualServiceType, setManualServiceType] = useState<(typeof MANUAL_SERVICE_TYPES)[number]>('Airport Pickup');
  const [manualPickupLocation, setManualPickupLocation] = useState('');
  const [manualDropoffLocation, setManualDropoffLocation] = useState('');
  const [manualPickupDate, setManualPickupDate] = useState(() =>
    colomboDateKey(new Date().toISOString())
  );
  const [manualPickupTime, setManualPickupTime] = useState('09:00');
  const [manualEndDate, setManualEndDate] = useState('');
  const [manualEndTime, setManualEndTime] = useState('17:00');
  const [manualPassengers, setManualPassengers] = useState(2);
  const [manualLuggage, setManualLuggage] = useState(2);
  const [manualCategoryCode, setManualCategoryCode] = useState('sedan');
  const [manualFlightNumber, setManualFlightNumber] = useState('');
  const [manualSpecialNotes, setManualSpecialNotes] = useState('');
  const [manualAutoConfirm, setManualAutoConfirm] = useState(true);
  const [manualCurrency, setManualCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [manualAgreedAmount, setManualAgreedAmount] = useState('');
  const [savingManualBooking, setSavingManualBooking] = useState(false);

  const loadFleetCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/fleet', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        data?: { categories?: FleetCategoryOption[] };
      };
      if (response.ok && result.success && result.data?.categories) {
        setFleetCategories(result.data.categories);
        if (result.data.categories.length > 0) {
          setQuickNewVehicleCategoryId((curr) => curr || result.data!.categories![0].id);
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

  async function submitQuickDriver(bookingId: string) {
    if (!quickDriverName.trim() || !quickDriverPhone.trim()) {
      setError('Driver Full Name and Phone / WhatsApp Number are required.');
      return;
    }
    if (quickVehicleMode === 'new' && (!quickNewVehicleName.trim() || !quickNewVehicleCategoryId)) {
      setError('Please enter the Vehicle Display Name and select a Category.');
      return;
    }

    setSavingQuickDriver(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_driver',
          driver_id: null,
          full_name: quickDriverName.trim(),
          phone: quickDriverPhone.trim(),
          license_number: quickDriverLicense.trim() || null,
          driver_notes: quickDriverNotes.trim() || null,
          account_status: 'active',
          default_vehicle_id:
            quickVehicleMode === 'existing' ? quickExistingVehicleId || null : null,
          new_vehicle_name:
            quickVehicleMode === 'new' ? quickNewVehicleName.trim() : null,
          new_vehicle_category_id:
            quickVehicleMode === 'new' ? quickNewVehicleCategoryId : null,
          new_vehicle_registration:
            quickVehicleMode === 'new' ? quickNewVehicleReg.trim() || null : null,
          new_vehicle_passengers:
            quickVehicleMode === 'new' ? Number(quickNewVehiclePax) || 4 : null,
          new_vehicle_luggage:
            quickVehicleMode === 'new' ? Number(quickNewVehicleLuggage) || 4 : null,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { driver_id?: string; vehicle_id?: string | null };
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save driver.');
      }

      const createdDriverId = result.data?.driver_id ?? '';
      const createdVehicleId =
        result.data?.vehicle_id ??
        (quickVehicleMode === 'existing' ? quickExistingVehicleId : '');

      await loadBookings();

      setAssignments((prev) => ({
        ...prev,
        [bookingId]: {
          driver: createdDriverId || prev[bookingId]?.driver || '',
          vehicle: createdVehicleId || prev[bookingId]?.vehicle || '',
        },
      }));

      setShowQuickAddDriver(false);
      setQuickDriverName('');
      setQuickDriverPhone('');
      setQuickDriverLicense('');
      setQuickDriverNotes('');
      setQuickNewVehicleName('');
      setQuickNewVehicleReg('');
      setNotice('New driver (and vehicle) added to Fleet and pre-selected for dispatch.');
    } catch (quickErr) {
      setError(quickErr instanceof Error ? quickErr.message : 'Driver could not be created.');
    } finally {
      setSavingQuickDriver(false);
    }
  }

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/operations/bookings', { cache: 'no-store' });
      const result = (await response.json()) as OperationsResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Bookings could not be loaded.');
      }
      setBookings(result.data.bookings);
      setDrivers(result.data.resources.drivers);
      setVehicles(result.data.resources.vehicles);
      setGuestTrackerStates(result.data.guest_tracker_states ?? []);
      if (result.data.google_calendar) {
        setGoogleCalendarInfo(result.data.google_calendar);
      }
      setRoles(result.roles ?? []);
      setNow(Date.now());
      setError('');
      if (typeof window !== 'undefined') {
        const paramId = new URLSearchParams(window.location.search).get('booking_id');
        if (paramId && result.data.bookings.some((b) => b.id === paramId)) {
          setSelectedBookingId((current) => current ?? paramId);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Bookings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadBookings);
  }, [loadBookings]);

  const serviceTypes = useMemo(
    () => [...new Set(bookings.map((booking) => booking.service_type))].sort(),
    [bookings]
  );
  const journeyTypes = useMemo(
    () => [...new Set(bookings.map((booking) => booking.journey_type))].sort(),
    [bookings]
  );
  const bookingStatuses = useMemo(
    () => [...new Set(bookings.map((booking) => booking.booking_status))].sort(),
    [bookings]
  );

  // Filtered and Sorted Bookings
  const filteredBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = bookings.filter((booking) => {
      const matchesSearch =
        !needle ||
        [
          booking.booking_ref,
          booking.customer_name,
          booking.customer_email,
          booking.customer_phone,
          ...booking.legs.flatMap((leg) => [leg.pickup_location, leg.dropoff_location]),
        ].some((value) => value.toLowerCase().includes(needle));

      const matchesDates =
        (!dateFrom && !dateTo) ||
        booking.legs.some((leg) => {
          const pickupDate = colomboDateKey(leg.pickup_at);
          return (!dateFrom || pickupDate >= dateFrom) && (!dateTo || pickupDate <= dateTo);
        });

      const paymentStatus = booking.financials?.payment_status ?? 'no_quote';
      const matchesPayment = !paymentFilter || paymentStatus === paymentFilter;

      // Quick tabs
      let matchesTab = true;
      if (quickTab === 'needs_attention') {
        matchesTab =
          ['pending', 'reviewing'].includes(booking.booking_status) ||
          booking.booking_status === 'quoted' ||
          (booking.booking_status === 'confirmed' && !booking.assignment);
      } else if (quickTab === 'active_upcoming') {
        matchesTab =
          booking.booking_status === 'assigned' || booking.booking_status === 'in_progress';
      } else if (quickTab === 'completed') {
        matchesTab = booking.booking_status === 'completed';
      } else if (quickTab === 'cancelled') {
        matchesTab = ['cancelled', 'rejected'].includes(booking.booking_status);
      }

      return (
        matchesSearch &&
        matchesTab &&
        matchesPayment &&
        (!statusFilter || booking.booking_status === statusFilter) &&
        (!serviceFilter || booking.service_type === serviceFilter) &&
        (!journeyFilter || booking.journey_type === journeyFilter) &&
        (!driverFilter || booking.assignment?.driver_user_id === driverFilter) &&
        (!vehicleFilter || booking.assignment?.vehicle_id === vehicleFilter) &&
        matchesDates
      );
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      }
      if (sortBy === 'oldest') {
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      }
      if (sortBy === 'pickup') {
        const aPickup = Date.parse(a.legs[0]?.pickup_at || a.created_at);
        const bPickup = Date.parse(b.legs[0]?.pickup_at || b.created_at);
        return aPickup - bPickup;
      }
      if (sortBy === 'amount') {
        const aAmt = a.financials?.quote_total ?? a.quotes[0]?.total ?? 0;
        const bAmt = b.financials?.quote_total ?? b.quotes[0]?.total ?? 0;
        return Number(bAmt) - Number(aAmt);
      }
      return 0;
    });

    return result;
  }, [
    bookings,
    dateFrom,
    dateTo,
    driverFilter,
    journeyFilter,
    paymentFilter,
    quickTab,
    search,
    serviceFilter,
    sortBy,
    statusFilter,
    vehicleFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleBookings = filteredBookings.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const canOperate = roles.some((role) => ['admin', 'super_admin'].includes(role));

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId]
  );

  // Group filtered bookings by Colombo calendar date (YYYY-MM-DD)
  const bookingsByCalendarDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      const seenDatesForBooking = new Set<string>();
      if (b.legs.length > 0) {
        for (const leg of b.legs) {
          const startKey = colomboDateKey(leg.pickup_at);
          seenDatesForBooking.add(startKey);
          if (leg.planned_end_at) {
            const endKey = colomboDateKey(leg.planned_end_at);
            if (endKey > startKey) {
              // Span multi-day tour across up to 21 calendar days
              const cur = new Date(`${startKey}T00:00:00Z`);
              const endD = new Date(`${endKey}T00:00:00Z`);
              let steps = 0;
              while (cur <= endD && steps < 21) {
                seenDatesForBooking.add(cur.toISOString().slice(0, 10));
                cur.setUTCDate(cur.getUTCDate() + 1);
                steps += 1;
              }
            }
          }
        }
      } else {
        seenDatesForBooking.add(colomboDateKey(b.created_at));
      }

      for (const dateKey of seenDatesForBooking) {
        const list = map.get(dateKey) ?? [];
        list.push(b);
        map.set(dateKey, list);
      }
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const aTime = Date.parse(a.legs[0]?.pickup_at || a.created_at);
        const bTime = Date.parse(b.legs[0]?.pickup_at || b.created_at);
        return aTime - bTime;
      });
      map.set(key, list);
    }
    return map;
  }, [filteredBookings]);

  const calendarGridCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    // Monday-first grid (0 = Monday ... 6 = Sunday)
    const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: Array<{
      dateKey: string;
      dayNumber: number;
      inCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      const d = prevMonthDays - i;
      const prevDate = new Date(Date.UTC(year, month - 1, d));
      cells.push({
        dateKey: prevDate.toISOString().slice(0, 10),
        dayNumber: d,
        inCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d += 1) {
      const curDate = new Date(Date.UTC(year, month, d));
      cells.push({
        dateKey: curDate.toISOString().slice(0, 10),
        dayNumber: d,
        inCurrentMonth: true,
      });
    }

    // Trailing days to complete 35 or 42 cells
    const totalCells = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalCells) {
      const nextDate = new Date(Date.UTC(year, month + 1, nextDay));
      cells.push({
        dateKey: nextDate.toISOString().slice(0, 10),
        dayNumber: nextDay,
        inCurrentMonth: false,
      });
      nextDay += 1;
    }

    return cells;
  }, [calendarMonth]);

  const calendarMonthLabel = useMemo(() => {
    const d = new Date(Date.UTC(calendarMonth.year, calendarMonth.month, 1));
    return d.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [calendarMonth]);

  const syncedBookingsCount = useMemo(
    () => bookings.filter((b) => Boolean(b.google_calendar_event_id)).length,
    [bookings]
  );

  function openManualBookingModal(prefillDate?: string) {
    const targetDate = prefillDate || colomboDateKey(new Date().toISOString());
    setManualPickupDate(targetDate);
    setManualEndDate('');
    if (fleetCategories.length === 0) {
      void loadFleetCategories();
    }
    setError('');
    setShowManualBookingModal(true);
  }

  async function submitManualBooking() {
    if (!manualCustomerName.trim() || manualCustomerName.trim().length < 2) {
      setError('Enter the customer full name (at least 2 characters).');
      return;
    }
    if (!manualCustomerPhone.trim() || manualCustomerPhone.replace(/[^0-9]/g, '').length < 7) {
      setError('Enter a valid customer phone or WhatsApp number.');
      return;
    }
    if (!manualPickupLocation.trim() || !manualDropoffLocation.trim()) {
      setError('Enter both pickup and drop-off locations.');
      return;
    }
    if (!manualPickupDate || !manualPickupTime) {
      setError('Choose a valid pickup date and time.');
      return;
    }
    if (manualAutoConfirm && (!manualAgreedAmount.trim() || Number(manualAgreedAmount) <= 0)) {
      setError('Enter an agreed price greater than 0 to auto-confirm the booking, or uncheck Auto-Confirm.');
      return;
    }

    const pickupIso = `${manualPickupDate}T${manualPickupTime}:00+05:30`;
    let plannedEndIso: string | null = null;
    if (manualEndDate) {
      const endTimePart = manualEndTime || '17:00';
      plannedEndIso = `${manualEndDate}T${endTimePart}:00+05:30`;
      if (Date.parse(plannedEndIso) <= Date.parse(pickupIso)) {
        setError('Return / end date and time must be after the pickup date and time.');
        return;
      }
    }

    setSavingManualBooking(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_manual_booking',
          booking_source: manualSource,
          customer_name: manualCustomerName.trim(),
          customer_phone: manualCustomerPhone.trim(),
          customer_email: manualCustomerEmail.trim(),
          customer_country: manualCustomerCountry.trim(),
          service_type: manualServiceType,
          pickup_location: manualPickupLocation.trim(),
          dropoff_location: manualDropoffLocation.trim(),
          pickup_at: pickupIso,
          planned_end_at: plannedEndIso,
          passenger_count: Number(manualPassengers) || 2,
          luggage_count: Number(manualLuggage) || 0,
          category_code: manualCategoryCode || 'sedan',
          flight_number: manualFlightNumber.trim(),
          special_notes: manualSpecialNotes.trim(),
          auto_confirm: manualAutoConfirm,
          currency: manualCurrency,
          agreed_amount: manualAutoConfirm ? manualAgreedAmount.trim() : null,
        }),
      });
      const result = (await response.json()) as OperationResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Manual booking could not be created.');
      }

      setShowManualBookingModal(false);
      setManualCustomerName('');
      setManualCustomerPhone('');
      setManualCustomerEmail('');
      setManualCustomerCountry('');
      setManualPickupLocation('');
      setManualDropoffLocation('');
      setManualFlightNumber('');
      setManualSpecialNotes('');
      setManualAgreedAmount('');

      setNotice(result.message || 'Manual booking created.');
      await loadBookings();

      if (result.data?.booking_id) {
        setSelectedBookingId(result.data.booking_id);
        setActiveModalTab(result.data.auto_confirmed ? 'dispatch' : 'quote');
      }
    } catch (manualErr) {
      setError(manualErr instanceof Error ? manualErr.message : 'Manual booking creation failed.');
    } finally {
      setSavingManualBooking(false);
    }
  }

  async function handleSyncSingleBookingToGCal(bookingId: string) {
    setSavingAction(`gcal-${bookingId}`);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_google_calendar',
          booking_id: bookingId,
        }),
      });
      const result = (await response.json()) as OperationResponse;
      if (result.configured === false) {
        setShowGCalSetupGuide(true);
        setNotice(
          result.error ||
            'Google Calendar credentials are not configured yet. Follow the 3-step setup guide to activate real-time sync.'
        );
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Google Calendar sync failed.');
      }
      setNotice(result.message || 'Booking synced to Google Calendar.');
      await loadBookings();
    } catch (syncErr) {
      setError(syncErr instanceof Error ? syncErr.message : 'Google Calendar sync failed.');
    } finally {
      setSavingAction('');
    }
  }

  async function handleSyncAllBookingsToGCal() {
    setSyncingAllGCal(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all_google_calendar',
        }),
      });
      const result = (await response.json()) as OperationResponse;
      if (result.configured === false) {
        setShowGCalSetupGuide(true);
        setNotice(
          result.error ||
            'Google Calendar credentials are not configured yet. Follow the 3-step setup guide below to activate live sync.'
        );
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Bulk Google Calendar sync failed.');
      }
      setNotice(result.message || 'Active bookings synced to Google Calendar.');
      await loadBookings();
    } catch (syncErr) {
      setError(syncErr instanceof Error ? syncErr.message : 'Bulk Google Calendar sync failed.');
    } finally {
      setSyncingAllGCal(false);
    }
  }

  async function postOperation(body: Record<string, unknown>) {
    const response = await fetch('/api/operations/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as OperationResponse;
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'The booking operation could not be completed.');
    }
    return result;
  }

  async function assignBooking(booking: Booking) {
    const selection = assignments[booking.id];
    if (!selection?.driver || !selection.vehicle) {
      setNotice('Choose both a driver and vehicle.');
      return;
    }
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      await postOperation({
        action: 'assign',
        booking_id: booking.id,
        driver_user_id: selection.driver,
        vehicle_id: selection.vehicle,
      });
      setNotice('Driver and vehicle assigned.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Assignment failed.');
    } finally {
      setSavingAction('');
    }
  }

  async function releaseDriverAssignment(booking: Booking) {
    const reason = window.prompt('Enter reason for removing/releasing this driver assignment:');
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) setError('Provide a release reason of at least 3 characters.');
      return;
    }
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      const res = await postOperation({
        action: 'release_assignment',
        booking_id: booking.id,
        reason: reason.trim(),
      });
      setNotice(res.message || 'Driver assignment released and booking returned to confirmed.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Assignment release failed.');
    } finally {
      setSavingAction('');
    }
  }

  async function handleStartTrip(booking: Booking) {
    if (!window.confirm(`Start trip for ${booking.booking_ref} now?`)) return;
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      const res = await postOperation({ action: 'start_trip', booking_id: booking.id });
      setNotice(res.message || 'Trip started.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Failed to start trip.');
    } finally {
      setSavingAction('');
    }
  }

  async function handleCompleteTrip(booking: Booking) {
    if (!window.confirm(`Mark trip for ${booking.booking_ref} as completed?`)) return;
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      const res = await postOperation({ action: 'complete_trip', booking_id: booking.id });
      setNotice(res.message || 'Trip completed.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Failed to complete trip.');
    } finally {
      setSavingAction('');
    }
  }

  async function handleCancelBooking(booking: Booking) {
    const reason = window.prompt(`Enter reason for cancelling booking ${booking.booking_ref}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) setError('Cancellation requires a reason of at least 3 characters.');
      return;
    }
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      const res = await postOperation({
        action: 'cancel_booking',
        booking_id: booking.id,
        reason: reason.trim(),
      });
      setNotice(res.message || 'Booking cancelled.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Cancellation failed.');
    } finally {
      setSavingAction('');
    }
  }

  async function revokeGuestTracker(booking: Booking) {
    if (!window.confirm(`Revoke the private guest tracker link for ${booking.booking_ref}?`)) return;
    setSavingAction(booking.id);
    setError('');
    setNotice('');
    try {
      await postOperation({
        action: 'revoke_guest_booking_tracker',
        booking_id: booking.id,
      });
      setNotice(`Guest tracker access revoked for ${booking.booking_ref}.`);
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Guest tracker link could not be revoked.');
    } finally {
      setSavingAction('');
    }
  }

  async function recordWhatsAppConfirmation(quoteId: string) {
    if (!window.confirm('Record that the customer accepted this quote through WhatsApp?')) return;
    setSavingAction(quoteId);
    setNotice('');
    setError('');
    try {
      await postOperation({ action: 'record_whatsapp_confirmation', quote_id: quoteId });
      setNotice('WhatsApp confirmation recorded and the booking is confirmed.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'WhatsApp confirmation could not be recorded.');
    } finally {
      setSavingAction('');
    }
  }

  async function revokeGuestQuoteLink(bookingId: string, quoteId: string) {
    if (
      !window.confirm(
        'Revoke this guest acceptance link now? This cannot be undone. The quote amount, booking status and payment records will not change.'
      )
    )
      return;
    setSavingAction(quoteId);
    setNotice('');
    setError('');
    try {
      await postOperation({ action: 'revoke_guest_quote_link', quote_id: quoteId });
      setAcceptanceLink((current) => (current?.bookingId === bookingId ? null : current));
      setNotice('Guest acceptance link revoked. The quote, booking status and payment records are unchanged.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Guest quote link could not be revoked.');
    } finally {
      setSavingAction('');
    }
  }

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Operational metrics calculated from database records
  const metrics = useMemo(() => {
    const total = bookings.length;
    const awaitingReview = bookings.filter((b) => ['pending', 'reviewing'].includes(b.booking_status)).length;
    const awaitingQuotes = bookings.filter(
      (b) => ['pending', 'reviewing'].includes(b.booking_status) && !b.quotes.some((q) => q.quote_status === 'sent')
    ).length;
    const awaitingCustomer = bookings.filter((b) => b.booking_status === 'quoted').length;
    const confirmed = bookings.filter((b) => b.booking_status === 'confirmed').length;
    const awaitingDriver = bookings.filter((b) => b.booking_status === 'confirmed' && !b.assignment).length;
    const upcoming = bookings.filter(
      (b) =>
        b.booking_status === 'assigned' &&
        b.legs.some((leg) => Date.parse(leg.pickup_at) >= now)
    ).length;
    const inProgress = bookings.filter((b) => b.booking_status === 'in_progress').length;
    const completed = bookings.filter((b) => b.booking_status === 'completed').length;
    const cancelled = bookings.filter((b) => ['cancelled', 'rejected'].includes(b.booking_status)).length;

    // Financial calculations
    const outstandingCandidates = bookings.filter(
      (b) =>
        ['confirmed', 'assigned', 'in_progress', 'completed'].includes(b.booking_status) &&
        (b.financials?.outstanding_balance ?? 0) > 0
    );
    const totalOutstanding = outstandingCandidates.reduce(
      (sum, b) => sum + (b.financials?.outstanding_balance ?? 0),
      0
    );
    const totalReceived = bookings.reduce(
      (sum, b) => sum + (b.financials?.total_paid ?? 0),
      0
    );

    return {
      total,
      awaitingReview,
      awaitingQuotes,
      awaitingCustomer,
      confirmed,
      awaitingDriver,
      upcoming,
      inProgress,
      completed,
      cancelled,
      outstandingCount: outstandingCandidates.length,
      totalOutstanding,
      totalReceived,
    };
  }, [bookings, now]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800">
            <Clipboard className="h-4 w-4" /> Operations Command Center
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Booking Management</h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete booking lifecycle: review requests, calculate quotes, assign fleet, record payments, and monitor trip progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: List View vs Booking Calendar */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" /> List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Booking Calendar
            </button>
          </div>

          {canOperate && (
            <button
              type="button"
              onClick={() => openManualBookingModal(viewMode === 'calendar' ? selectedCalendarDate : undefined)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Plus className="h-4 w-4" /> + Add Manual Booking
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadBookings()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {/* Google Calendar Real-Time Sync Status Bar */}
      <section
        aria-label="Google Calendar sync status"
        className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {googleCalendarInfo.configured ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                Google Calendar: Real-Time Sync Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Google Calendar: Setup Pending
              </span>
            )}
            <span className="text-xs text-slate-600">
              {googleCalendarInfo.configured ? (
                <>
                  Calendar ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">{googleCalendarInfo.calendar_id}</code> ·{' '}
                  <b>{syncedBookingsCount}</b> booking(s) synced
                </>
              ) : (
                'Auto-syncs confirmed, assigned, completed, and cancelled trips with your Google Calendar once Service Account credentials are set.'
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGCalSetupGuide((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              <Info className="h-3.5 w-3.5 text-blue-600" />
              {showGCalSetupGuide ? 'Hide Setup Guide' : 'Google Calendar Setup Guide'}
            </button>

            {canOperate && (
              <button
                type="button"
                disabled={syncingAllGCal}
                onClick={() => void handleSyncAllBookingsToGCal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingAllGCal ? 'animate-spin' : ''}`} />
                {syncingAllGCal ? 'Syncing Active Bookings…' : 'Sync All Active Bookings'}
              </button>
            )}
          </div>
        </div>

        {showGCalSetupGuide && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                3-Step Google Calendar API v3 Service Account Setup (Cloudflare &amp; Next.js Compatible)
              </h3>
              <button
                type="button"
                onClick={() => setShowGCalSetupGuide(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700">
              <li>
                <b>Enable Google Calendar API &amp; Create Service Account:</b> In Google Cloud Console, enable the{' '}
                <i>Google Calendar API</i>, create a Service Account, and download its JSON key file.
              </li>
              <li>
                <b>Share Your Google Calendar:</b> Open Google Calendar → Settings for your Chama Travels calendar →{' '}
                <i>Share with specific people</i> → add your Service Account email with{' '}
                <b>&ldquo;Make changes to events&rdquo;</b> permission.
              </li>
              <li>
                <b>Set Environment Variables in Cloudflare / <code className="font-mono">.env.local</code>:</b>
                <div className="mt-2 rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-slate-100 space-y-1 overflow-x-auto">
                  <div>GOOGLE_SERVICE_ACCOUNT_EMAIL=&quot;chama-calendar-sync@your-project.iam.gserviceaccount.com&quot;</div>
                  <div>GOOGLE_PRIVATE_KEY=&quot;-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n&quot;</div>
                  <div>GOOGLE_CALENDAR_ID=&quot;your-calendar-id@group.calendar.google.com&quot;</div>
                </div>
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* Notifications */}
      {notice && (
        <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{notice}</p>
              {acceptanceLink && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 border border-blue-200">
                  <a
                    className="break-all font-mono text-xs font-semibold text-blue-700 underline"
                    href={acceptanceLink.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {acceptanceLink.url}
                  </a>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-blue-700"
                    onClick={() => void navigator.clipboard.writeText(acceptanceLink.url)}
                  >
                    <Clipboard className="h-4 w-4" /> Copy Link
                  </button>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setNotice('')} className="text-blue-500 hover:text-blue-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
          <div className="flex-1">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Overview Statistics Grid */}
      {!loading && (
        <section aria-label="Booking statistics overview" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Bookings</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{metrics.total}</p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Awaiting Review</p>
              <p className="mt-1 text-2xl font-black text-amber-900">{metrics.awaitingReview}</p>
            </div>
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Awaiting Quotation</p>
              <p className="mt-1 text-2xl font-black text-blue-900">{metrics.awaitingQuotes}</p>
            </div>
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Awaiting Guest</p>
              <p className="mt-1 text-2xl font-black text-purple-900">{metrics.awaitingCustomer}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Confirmed (Total)</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">{metrics.confirmed}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/80 bg-amber-100/60 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Needs Driver</p>
              <p className="mt-1 text-2xl font-black text-amber-950">{metrics.awaitingDriver}</p>
            </div>
            <div className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Assigned &amp; Upcoming</p>
              <p className="mt-1 text-2xl font-black text-teal-900">{metrics.upcoming}</p>
            </div>
            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Active Trips</p>
              <p className="mt-1 text-2xl font-black text-indigo-900">{metrics.inProgress}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Completed</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{metrics.completed}</p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Cancelled / Rejected</p>
              <p className="mt-1 text-2xl font-black text-rose-900">{metrics.cancelled}</p>
            </div>
          </div>

          {/* Financial summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-900 to-slate-900 p-4 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Payment &amp; Revenue Ledger</p>
                <p className="text-xs text-slate-300">Verified cash &amp; transfer receipts across confirmed bookings</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-300 block">Total Received</span>
                <span className="font-extrabold text-base text-emerald-400">LKR {metrics.totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-l border-white/20 pl-6">
                <span className="text-[11px] uppercase tracking-wider text-slate-300 block">Outstanding Balance ({metrics.outstandingCount} bookings)</span>
                <span className="font-extrabold text-base text-amber-300">LKR {metrics.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Filter Tabs & Search Bar */}
      <section aria-label="Booking filters" className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        {/* Quick Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {(
            [
              { id: 'all', label: 'All Bookings', count: bookings.length },
              { id: 'needs_attention', label: 'Needs Attention', count: metrics.awaitingReview + metrics.awaitingCustomer + metrics.awaitingDriver },
              { id: 'active_upcoming', label: 'Upcoming & Active', count: metrics.upcoming + metrics.inProgress },
              { id: 'completed', label: 'Completed', count: metrics.completed },
              { id: 'cancelled', label: 'Cancelled', count: metrics.cancelled },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateFilter(() => setQuickTab(tab.id))}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                quickTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${quickTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="relative block min-w-0 sm:col-span-2">
            <span className="sr-only">Search bookings</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => updateFilter(() => setSearch(e.target.value))}
              placeholder="Search reference, customer, phone, email, route"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by booking status</span>
            <select
              value={statusFilter}
              onChange={(e) => updateFilter(() => setStatusFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {bookingStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by payment status</span>
            <select
              value={paymentFilter}
              onChange={(e) => updateFilter(() => setPaymentFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All payment statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="no_quote">No accepted quote</option>
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by service type</span>
            <select
              value={serviceFilter}
              onChange={(e) => updateFilter(() => setServiceFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All services</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by journey type</span>
            <select
              value={journeyFilter}
              onChange={(e) => updateFilter(() => setJourneyFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All journey types</option>
              {journeyTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => updateFilter(() => setSortBy(e.target.value as 'newest' | 'oldest' | 'pickup' | 'amount'))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="newest">Newest created first</option>
              <option value="oldest">Oldest created first</option>
              <option value="pickup">Travel date (soonest)</option>
              <option value="amount">Quote amount (highest)</option>
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by assigned driver</span>
            <select
              value={driverFilter}
              onChange={(e) => updateFilter(() => setDriverFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700"
            >
              <option value="">All drivers</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Filter by assigned vehicle</span>
            <select
              value={vehicleFilter}
              onChange={(e) => updateFilter(() => setVehicleFilter(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700"
            >
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.display_name} {vehicle.registration_number ? `(${vehicle.registration_number})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter(() => setDateFrom(e.target.value))}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700"
            />
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter(() => setDateTo(e.target.value))}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Showing <b>{filteredBookings.length}</b> booking(s)</span>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setPaymentFilter('');
              setServiceFilter('');
              setJourneyFilter('');
              setDriverFilter('');
              setVehicleFilter('');
              setDateFrom('');
              setDateTo('');
              setQuickTab('all');
              setSortBy('newest');
              setPage(1);
            }}
            className="rounded-lg px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Clear all filters
          </button>
        </div>
      </section>

      {/* Interactive Booking Calendar View */}
      {viewMode === 'calendar' ? (
        <section
          aria-label="Interactive booking calendar"
          className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6"
        >
          {/* Calendar Toolbar & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((curr) =>
                    curr.month === 0
                      ? { year: curr.year - 1, month: 11 }
                      : { year: curr.year, month: curr.month - 1 }
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <h2 className="min-w-[160px] text-center text-lg font-black text-slate-950">
                {calendarMonthLabel}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((curr) =>
                    curr.month === 11
                      ? { year: curr.year + 1, month: 0 }
                      : { year: curr.year, month: curr.month + 1 }
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const todayKey = colomboDateKey(new Date().toISOString());
                  const [y, m] = todayKey.split('-').map(Number);
                  setCalendarMonth({ year: y || 2026, month: (m || 1) - 1 });
                  setSelectedCalendarDate(todayKey);
                }}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                Today
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-900">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Confirmed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-900">
                <span className="h-2 w-2 rounded-full bg-indigo-600" /> Assigned / Active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
                <span className="h-2 w-2 rounded-full bg-emerald-600" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending / Quoted
              </span>
            </div>
          </div>

          {/* 7-Column Monthly Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 rounded-t-2xl text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday) => (
                  <div key={weekday} className="py-2.5">
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 border border-t-0 border-slate-200 rounded-b-2xl overflow-hidden">
                {calendarGridCells.map((cell) => {
                  const dayBookings = bookingsByCalendarDate.get(cell.dateKey) ?? [];
                  const isToday = cell.dateKey === colomboDateKey(new Date().toISOString());
                  const isSelected = cell.dateKey === selectedCalendarDate;

                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => setSelectedCalendarDate(cell.dateKey)}
                      className={`min-h-[132px] p-2 transition cursor-pointer flex flex-col justify-between ${
                        !cell.inCurrentMonth
                          ? 'bg-slate-50/60 text-slate-400'
                          : isSelected
                            ? 'bg-blue-50/35 ring-2 ring-inset ring-blue-500'
                            : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${
                            isToday
                              ? 'bg-blue-600 text-white shadow-sm'
                              : cell.inCurrentMonth
                                ? 'text-slate-900'
                                : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        <div className="flex items-center gap-1">
                          {dayBookings.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {dayBookings.length}
                            </span>
                          )}
                          {canOperate && (
                            <button
                              type="button"
                              title={`Add manual booking on ${cell.dateKey}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCalendarDate(cell.dateKey);
                                openManualBookingModal(cell.dateKey);
                              }}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 flex-1">
                        {dayBookings.slice(0, 3).map((b) => {
                          const firstLeg = b.legs[0];
                          const driverName =
                            b.assignment?.driver_name ||
                            (b.assignment ? driverById.get(b.assignment.driver_user_id)?.full_name : null);

                          return (
                            <button
                              key={`${cell.dateKey}-${b.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingId(b.id);
                              }}
                              className={`w-full rounded-lg border px-1.5 py-1 text-left text-[10px] transition shadow-2xs ${calendarPillClasses(
                                b.booking_status
                              )}`}
                            >
                              <div className="flex items-center justify-between gap-1 font-extrabold">
                                <span className="truncate">
                                  {firstLeg ? formatColomboTime(firstLeg.pickup_at) : ''} {b.customer_name}
                                </span>
                                {b.google_calendar_event_id && (
                                  <span
                                    title="Synced to Google Calendar"
                                    className="shrink-0 rounded bg-emerald-600/15 px-1 text-[9px] font-black text-emerald-800"
                                  >
                                    GCal
                                  </span>
                                )}
                              </div>
                              {firstLeg && (
                                <div className="truncate text-[9px] opacity-85">
                                  {firstLeg.pickup_location} → {firstLeg.dropoff_location}
                                </div>
                              )}
                              <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] font-semibold">
                                <span className="truncate">
                                  {driverName ? `🚗 ${driverName}` : '⚠ Unassigned'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        {dayBookings.length > 3 && (
                          <div className="pt-0.5 text-center text-[10px] font-bold text-blue-700">
                            +{dayBookings.length - 3} more trip(s)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Date Detailed Schedule / Agenda */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Daily Schedule for {selectedCalendarDate}
                </h3>
                <p className="text-xs text-slate-500">
                  {(bookingsByCalendarDate.get(selectedCalendarDate) ?? []).length} scheduled trip(s) on this date. Click any trip to open the 5-tab Booking Operations Modal.
                </p>
              </div>
              {canOperate && (
                <button
                  type="button"
                  onClick={() => openManualBookingModal(selectedCalendarDate)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add Booking on {selectedCalendarDate}
                </button>
              )}
            </div>

            {(bookingsByCalendarDate.get(selectedCalendarDate) ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                No trips scheduled on {selectedCalendarDate}. Click <b>+ Add Booking on {selectedCalendarDate}</b> to log a manual WhatsApp, phone, or walk-in booking.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(bookingsByCalendarDate.get(selectedCalendarDate) ?? []).map((b) => {
                  const firstLeg = b.legs[0];
                  const driverName =
                    b.assignment?.driver_name ||
                    (b.assignment ? driverById.get(b.assignment.driver_user_id)?.full_name : null);
                  const vehicleName =
                    b.assignment?.vehicle_name ||
                    (b.assignment ? vehicleById.get(b.assignment.vehicle_id)?.display_name : null);

                  return (
                    <div
                      key={`agenda-${b.id}`}
                      onClick={() => setSelectedBookingId(b.id)}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-400 transition cursor-pointer"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900">
                              {b.booking_ref}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(
                                b.booking_status
                              )}`}
                            >
                              {b.booking_status.replaceAll('_', ' ')}
                            </span>
                          </div>
                          {b.google_calendar_event_id ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle className="h-3 w-3" /> Synced to GCal
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Not synced
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-extrabold text-slate-950">
                          {b.customer_name}{' '}
                          <span className="text-xs font-medium text-slate-500">
                            ({b.customer_phone})
                          </span>
                        </div>

                        {firstLeg && (
                          <div className="text-xs font-semibold text-slate-700">
                            {formatColomboTime(firstLeg.pickup_at)} · {firstLeg.pickup_location} →{' '}
                            {firstLeg.dropoff_location}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-semibold">
                            {b.passenger_count} pax · {b.luggage_count} bags
                          </span>
                          {driverName ? (
                            <span className="rounded-lg bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                              Driver: {driverName} {vehicleName ? `(${vehicleName})` : ''}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
                              Driver Unassigned
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={buildGoogleCalendarTemplateLink(b)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3 w-3" /> Open in GCal
                        </a>
                        {canOperate && (
                          <button
                            type="button"
                            disabled={savingAction === `gcal-${b.id}`}
                            onClick={() => void handleSyncSingleBookingToGCal(b.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                savingAction === `gcal-${b.id}` ? 'animate-spin' : ''
                              }`}
                            />
                            Sync API
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedBookingId(b.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-slate-700"
                        >
                          Manage Booking
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Main Bookings Table View */
        <section aria-label="Bookings table" className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            Loading bookings…
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-600">
            No bookings match these filters. Try adjusting your search or clearing filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Reference</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Service &amp; Route</th>
                  <th className="px-4 py-3.5">Travel Date &amp; Time</th>
                  <th className="px-4 py-3.5">Passengers</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Quotation</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-4 py-3.5">Driver &amp; Vehicle</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBookings.map((b) => {
                  const firstLeg = b.legs[0];
                  const latestQuote = b.quotes[0];
                  const assignedDriver = b.assignment ? driverById.get(b.assignment.driver_user_id) : undefined;
                  const assignedVehicle = b.assignment ? vehicleById.get(b.assignment.vehicle_id) : undefined;
                  const paymentStatus = b.financials?.payment_status ?? 'no_quote';
                  const quoteTotal = b.financials?.quote_total ?? latestQuote?.total;
                  const quoteCurrency = b.financials?.currency ?? latestQuote?.currency ?? b.currency;

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedBookingId(b.id)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {b.booking_ref}
                        <span className="block text-[10px] font-sans font-normal text-slate-400">
                          {new Date(b.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{b.customer_name}</div>
                        <div className="text-[11px] text-slate-500">{b.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="font-semibold text-slate-800 capitalize">
                          {b.service_type.replaceAll('_', ' ')}
                        </span>
                        {firstLeg && (
                          <div className="truncate text-[11px] text-slate-500">
                            {firstLeg.pickup_location} → {firstLeg.dropoff_location}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {firstLeg ? (
                          <>
                            <div className="font-semibold text-slate-800">{formatDate(firstLeg.pickup_at)}</div>
                            {b.legs.length > 1 && (
                              <span className="text-[10px] text-blue-600 font-bold">+{b.legs.length - 1} more legs</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">No legs</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {b.passenger_count} pax · {b.luggage_count} bags
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(b.booking_status)}`}>
                          {b.booking_status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-semibold text-slate-900">
                        {quoteTotal !== undefined ? (
                          `${quoteCurrency} ${Number(quoteTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-400 font-sans italic">Not quoted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${paymentBadgeClasses(paymentStatus)}`}>
                          {paymentStatus === 'no_quote' ? 'No quote' : paymentStatus.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {b.assignment ? (
                          <div className="truncate text-[11px]">
                            <span className="font-bold text-emerald-800 block">
                              {b.assignment.driver_name || assignedDriver?.full_name || 'Assigned driver'}
                            </span>
                            <span className="text-slate-500">
                              {b.assignment.vehicle_name || assignedVehicle?.display_name || 'Vehicle'}
                              {b.assignment.vehicle_registration ? ` (${b.assignment.vehicle_registration})` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedBookingId(b.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredBookings.length > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50 px-4 py-3">
            <span className="text-xs text-slate-600">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-medium text-slate-600">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </footer>
        )}
        </section>
      )}

      {/* Comprehensive Booking Operations Workstation Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-lg font-black text-slate-950">{selectedBooking.booking_ref}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(selectedBooking.booking_status)}`}>
                  {selectedBooking.booking_status.replaceAll('_', ' ')}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-800 ring-1 ring-inset ring-blue-600/15">
                  {selectedBooking.service_type.replaceAll('_', ' ')} · {selectedBooking.journey_type.replaceAll('_', ' ')}
                </span>
                {selectedBooking.google_calendar_event_id ? (
                  <span
                    title={
                      selectedBooking.google_calendar_synced_at
                        ? `Last synced: ${formatDate(selectedBooking.google_calendar_synced_at)}`
                        : 'Synced to Google Calendar'
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
                  >
                    <CheckCircle className="h-3 w-3" /> Google Calendar Synced
                  </span>
                ) : selectedBooking.google_calendar_sync_error ? (
                  <span
                    title={selectedBooking.google_calendar_sync_error}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-800 ring-1 ring-inset ring-rose-600/20"
                  >
                    <AlertCircle className="h-3 w-3" /> GCal Sync Error
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canOperate && (
                  <button
                    type="button"
                    disabled={savingAction === `gcal-${selectedBooking.id}`}
                    onClick={() => void handleSyncSingleBookingToGCal(selectedBooking.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50 transition"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        savingAction === `gcal-${selectedBooking.id}` ? 'animate-spin' : ''
                      }`}
                    />
                    {savingAction === `gcal-${selectedBooking.id}`
                      ? 'Syncing…'
                      : 'Sync to Google Calendar'}
                  </button>
                )}
                <a
                  href={buildGoogleCalendarTemplateLink(selectedBooking)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <Calendar className="h-3.5 w-3.5 text-blue-600" /> Open in Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedBookingId(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Status Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-6 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Next Recommended Step:</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
                  {selectedBooking.booking_status === 'pending' && '1. Mark Under Review & Prepare Quote'}
                  {selectedBooking.booking_status === 'reviewing' && '2. Issue Quotation in Tab 2'}
                  {selectedBooking.booking_status === 'quoted' && '3. Await Guest Acceptance or Confirm Manually in Tab 2'}
                  {selectedBooking.booking_status === 'confirmed' && '4. Assign Driver & Vehicle in Tab 3'}
                  {selectedBooking.booking_status === 'assigned' && '5. Send WhatsApp Trip Details & Start Trip'}
                  {selectedBooking.booking_status === 'in_progress' && '6. Record Balance Payment & Complete Trip'}
                  {selectedBooking.booking_status === 'completed' && 'Trip Completed'}
                  {selectedBooking.booking_status === 'cancelled' && 'Booking Cancelled'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedBooking.booking_status === 'pending' && canOperate && (
                  <button
                    type="button"
                    disabled={savingAction === selectedBooking.id}
                    onClick={async () => {
                      setSavingAction(selectedBooking.id);
                      try {
                        await postOperation({ action: 'set_review', booking_id: selectedBooking.id });
                        setNotice('Booking marked under review.');
                        await loadBookings();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Operation failed');
                      } finally {
                        setSavingAction('');
                      }
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
                  >
                    Mark Under Review
                  </button>
                )}

                {selectedBooking.booking_status === 'assigned' && canOperate && (
                  <button
                    type="button"
                    disabled={savingAction === selectedBooking.id}
                    onClick={() => void handleStartTrip(selectedBooking)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Start Trip (In Progress)
                  </button>
                )}

                {selectedBooking.booking_status === 'in_progress' && canOperate && (
                  <button
                    type="button"
                    disabled={savingAction === selectedBooking.id}
                    onClick={() => void handleCompleteTrip(selectedBooking)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                  >
                    Complete Trip
                  </button>
                )}

                {!['completed', 'cancelled', 'rejected'].includes(selectedBooking.booking_status) && canOperate && (
                  <button
                    type="button"
                    disabled={savingAction === selectedBooking.id}
                    onClick={() => void handleCancelBooking(selectedBooking)}
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6">
              {[
                { id: 'overview', label: '1. Customer & Trip Info' },
                { id: 'quote', label: '2. Quotation & Pricing' },
                { id: 'dispatch', label: '3. Driver & Fleet Dispatch' },
                { id: 'billing', label: '4. Payments, Invoices & Receipts' },
                { id: 'activity', label: '5. Timeline & Internal Notes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModalTab(tab.id as typeof activeModalTab)}
                  className={`border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                    activeModalTab === tab.id
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: Customer & Trip Information */}
              {activeModalTab === 'overview' && (
                <div className="space-y-6">
                  {/* Section A: Customer Details & One-Click Contact Bar */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 mb-3">
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" /> Customer Information
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${selectedBooking.customer_phone}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                        >
                          Call ({selectedBooking.customer_phone})
                        </a>
                        <a
                          href={`mailto:${selectedBooking.customer_email}?subject=${encodeURIComponent(`Chama Travels Booking ${selectedBooking.booking_ref}`)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                        >
                          Email Customer
                        </a>
                        {customerWhatsAppUrl(
                          selectedBooking.customer_phone,
                          `Hello ${selectedBooking.customer_name} from Chama Travels. Regarding your booking ${selectedBooking.booking_ref}:`
                        ) && (
                          <a
                            href={
                              customerWhatsAppUrl(
                                selectedBooking.customer_phone,
                                `Hello ${selectedBooking.customer_name} from Chama Travels. Regarding your booking ${selectedBooking.booking_ref}:`
                              )!
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> WhatsApp Direct Chat
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                        <span className="font-bold text-slate-900 text-sm">{selectedBooking.customer_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                        <a href={`mailto:${selectedBooking.customer_email}`} className="font-semibold text-blue-700 underline text-sm break-all">
                          {selectedBooking.customer_email}
                        </a>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone Number</span>
                        <span className="font-semibold text-slate-900 text-sm">{selectedBooking.customer_phone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Passengers &amp; Luggage</span>
                        <span className="font-medium text-slate-800 text-sm">
                          {selectedBooking.passenger_count} Passenger(s) · {selectedBooking.luggage_count} Luggage Bag(s)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Service &amp; Preferred Currency</span>
                        <span className="font-medium text-slate-800 text-sm capitalize">
                          {selectedBooking.service_type.replaceAll('_', ' ')} ({selectedBooking.journey_type.replaceAll('_', ' ')}) · {selectedBooking.currency}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Booking Submission Date</span>
                        <span className="font-medium text-slate-800 text-sm">{formatDate(selectedBooking.created_at)}</span>
                      </div>
                    </div>
                    {selectedBooking.customer_notes && (
                      <div className="mt-4 rounded-xl bg-white p-3 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Customer Special Requests &amp; Notes</span>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedBooking.customer_notes}</p>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const tracker = guestTrackerStates.find((g) => g.booking_id === selectedBooking.id);
                    if (!tracker) return null;
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Guest Booking Tracker Access</h4>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {tracker.active && tracker.expires_at
                              ? `Active until ${formatDate(tracker.expires_at)}`
                              : tracker.revoked_at
                                ? `Revoked on ${formatDate(tracker.revoked_at)}`
                                : 'Expired or unavailable'}
                          </p>
                        </div>
                        {tracker.active && canOperate && (
                          <button
                            type="button"
                            disabled={savingAction === selectedBooking.id}
                            onClick={() => void revokeGuestTracker(selectedBooking)}
                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
                          >
                            {savingAction === selectedBooking.id ? 'Revoking…' : 'Revoke Guest Tracker Link'}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Section B: Trip Legs & Schedule */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" /> Trip Details &amp; Route Legs
                    </h3>
                    {selectedBooking.legs.map((leg) => (
                      <div key={leg.sequence_no} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-900">
                            Leg {leg.sequence_no} of {selectedBooking.legs.length}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(leg.trip_status)}`}>
                            {leg.trip_status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pickup</span>
                            <p className="font-semibold text-slate-800">{leg.pickup_location}</p>
                            <p className="text-xs text-slate-500 font-mono">Pickup Time: {formatDate(leg.pickup_at)}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Drop-off</span>
                            <p className="font-semibold text-slate-800">{leg.dropoff_location}</p>
                            <p className="text-xs text-slate-500 font-mono">
                              {leg.planned_end_at ? `Expected End: ${formatDate(leg.planned_end_at)}` : 'Expected end: Not specified'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: Quotation & Pricing Management */}
              {activeModalTab === 'quote' && (
                <div className="space-y-6">
                  {canOperate && (
                    <BookingOperations
                      bookingId={selectedBooking.id}
                      status={selectedBooking.booking_status}
                      currency={selectedBooking.currency}
                      legs={selectedBooking.legs}
                      onUpdated={async (url) => {
                        if (url) {
                          setAcceptanceLink({ bookingId: selectedBooking.id, url });
                          setNotice('Quote issued. Share the guest link with the customer.');
                        } else {
                          setNotice('Booking operations updated.');
                        }
                        await loadBookings();
                      }}
                    />
                  )}

                  {/* Guest Quote Confirmation & History Box */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Guest Quote Confirmation &amp; History</h3>
                    {selectedBooking.quotes.length === 0 ? (
                      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                        No quotes issued yet for this booking. Use the form above to issue a quotation.
                      </p>
                    ) : (
                      selectedBooking.quotes.map((quote) => {
                        const linkState = quote.has_guest_acceptance_link ? getGuestQuoteLinkState(quote) : 'unavailable';
                        const linkStateLabels: Record<string, string> = {
                          active: 'Guest link active',
                          expired: 'Guest link expired',
                          revoked: 'Guest link revoked',
                          accepted: 'Guest link used',
                          unavailable: 'No guest link',
                        };
                        const activeGuestUrl =
                          acceptanceLink?.bookingId === selectedBooking.id ? acceptanceLink.url : null;
                        const firstLeg = selectedBooking.legs[0];
                        const waQuoteMessage = [
                          `Hello ${selectedBooking.customer_name},`,
                          `Here is your Chama Travels quotation for booking *${selectedBooking.booking_ref}*:`,
                          `• Route: ${firstLeg ? `${firstLeg.pickup_location} → ${firstLeg.dropoff_location}` : selectedBooking.service_type.replaceAll('_', ' ')}`,
                          `• Quoted Amount: *${quote.currency} ${Number(quote.total).toFixed(2)}* (Revision #${quote.revision})`,
                          `• Valid Until: ${formatDate(quote.expires_at)}`,
                          activeGuestUrl
                            ? `\nReview and confirm your quotation online (no account needed):\n${activeGuestUrl}`
                            : `\nPlease reply to this WhatsApp message to confirm your booking.`,
                        ].join('\n');
                        const waQuoteUrl = customerWhatsAppUrl(selectedBooking.customer_phone, waQuoteMessage);

                        return (
                          <div key={quote.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-black text-slate-900 text-sm">
                                  Revision {quote.revision} — {quote.currency} {Number(quote.total).toFixed(2)}
                                </span>
                                <span className="ml-2 text-xs text-slate-500">
                                  Expires: {formatDate(quote.expires_at)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(quote.quote_status)}`}>
                                  {quote.quote_status}
                                </span>
                                {quote.has_guest_acceptance_link && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                                    {linkStateLabels[linkState]}
                                  </span>
                                )}
                              </div>
                            </div>

                            {activeGuestUrl && quote.quote_status === 'sent' && (
                              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs space-y-1.5">
                                <span className="font-bold text-blue-950 block">One-Time Guest Quote Link:</span>
                                <p className="break-all font-mono text-[11px] text-blue-800">{activeGuestUrl}</p>
                              </div>
                            )}

                            {/* Actions on this quote */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                              {activeGuestUrl && quote.quote_status === 'sent' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(activeGuestUrl);
                                    setNotice('Guest quote acceptance link copied to clipboard.');
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                                >
                                  <Clipboard className="h-3.5 w-3.5" /> Copy Guest Quote Link
                                </button>
                              )}

                              {waQuoteUrl && quote.quote_status === 'sent' && (
                                <a
                                  href={waQuoteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Send Quote via WhatsApp
                                </a>
                              )}

                              {quote.quote_status === 'sent' && canOperate && (now === 0 || Date.parse(quote.expires_at) > now) && (
                                <button
                                  type="button"
                                  disabled={savingAction === quote.id}
                                  onClick={() => void recordWhatsAppConfirmation(quote.id)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {savingAction === quote.id
                                    ? 'Confirming…'
                                    : 'Confirm Quote Manually (Admin Override)'}
                                </button>
                              )}

                              {quote.quote_status === 'sent' && canOperate && linkState === 'active' && (
                                <button
                                  type="button"
                                  disabled={savingAction === quote.id}
                                  onClick={() => void revokeGuestQuoteLink(selectedBooking.id, quote.id)}
                                  className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  {savingAction === quote.id ? 'Revoking…' : 'Revoke Guest Link'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Driver & Vehicle Fleet Dispatch */}
              {activeModalTab === 'dispatch' && (
                <div className="space-y-6">
                  {(() => {
                    const busyDriverIds = new Set(
                      bookings
                        .filter(
                          (b) =>
                            b.id !== selectedBooking.id &&
                            ['assigned', 'in_progress'].includes(b.booking_status) &&
                            b.assignment?.driver_user_id
                        )
                        .map((b) => b.assignment!.driver_user_id)
                    );
                    const busyVehicleIds = new Set(
                      bookings
                        .filter(
                          (b) =>
                            b.id !== selectedBooking.id &&
                            ['assigned', 'in_progress'].includes(b.booking_status) &&
                            b.assignment?.vehicle_id
                        )
                        .map((b) => b.assignment!.vehicle_id)
                    );

                    return (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <Car className="h-4 w-4 text-emerald-600" /> Driver &amp; Vehicle Fleet Dispatch
                            </h3>
                            <span className="text-xs text-slate-500">
                              {drivers.length} Active Driver(s) · {vehicles.length} Active Vehicle(s)
                            </span>
                          </div>
                          {canOperate && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOpen = !showQuickAddDriver;
                                  setShowQuickAddDriver(nextOpen);
                                  if (nextOpen && fleetCategories.length === 0) {
                                    void loadFleetCategories();
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-sm"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                {showQuickAddDriver ? 'Close Quick Add' : '+ Quick Add Driver & Vehicle'}
                              </button>
                              <a
                                href="/admin/fleet"
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                              >
                                Manage Full Fleet
                              </a>
                            </div>
                          )}
                        </div>

                        {canOperate && showQuickAddDriver && (
                          <div className="rounded-2xl border border-emerald-200 bg-white p-4 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                  <Plus className="h-3.5 w-3.5 text-emerald-600" /> Quick Register Internal Driver &amp; Vehicle
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Creates an internal driver record (no login password needed) and pre-selects them for this booking.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowQuickAddDriver(false)}
                                className="text-slate-400 hover:text-slate-700"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <label className="block text-xs font-bold text-slate-700">
                                Driver Full Name <span className="text-rose-600">*</span>
                                <input
                                  type="text"
                                  value={quickDriverName}
                                  onChange={(e) => setQuickDriverName(e.target.value)}
                                  placeholder="e.g. Kamal Perera"
                                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
                                />
                              </label>
                              <label className="block text-xs font-bold text-slate-700">
                                Phone / WhatsApp <span className="text-rose-600">*</span>
                                <input
                                  type="text"
                                  value={quickDriverPhone}
                                  onChange={(e) => setQuickDriverPhone(e.target.value)}
                                  placeholder="e.g. +94 77 123 4567"
                                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
                                />
                              </label>
                              <label className="block text-xs font-bold text-slate-700">
                                License No / Tier
                                <input
                                  type="text"
                                  value={quickDriverLicense}
                                  onChange={(e) => setQuickDriverLicense(e.target.value)}
                                  placeholder="Optional (e.g. B1234567)"
                                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
                                />
                              </label>
                              <label className="block text-xs font-bold text-slate-700">
                                Languages / Notes
                                <input
                                  type="text"
                                  value={quickDriverNotes}
                                  onChange={(e) => setQuickDriverNotes(e.target.value)}
                                  placeholder="Optional (e.g. English, Sinhala)"
                                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
                                />
                              </label>
                            </div>

                            <div className="space-y-3 rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800">Assigned / Default Vehicle</span>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setQuickVehicleMode('new')}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                      quickVehicleMode === 'new'
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    + Create New Vehicle
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickVehicleMode('existing')}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                      quickVehicleMode === 'existing'
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    Link Existing Vehicle
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickVehicleMode('none')}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                      quickVehicleMode === 'none'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    Driver Only
                                  </button>
                                </div>
                              </div>

                              {quickVehicleMode === 'existing' && (
                                <label className="block text-xs font-bold text-slate-700">
                                  Choose Existing Fleet Vehicle
                                  <select
                                    value={quickExistingVehicleId}
                                    onChange={(e) => setQuickExistingVehicleId(e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                                  >
                                    <option value="">Select a vehicle</option>
                                    {vehicles.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.display_name} {v.registration_number ? `(${v.registration_number})` : ''} · {v.category_name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              {quickVehicleMode === 'new' && (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                  <label className="block text-xs font-bold text-slate-700 lg:col-span-2">
                                    Vehicle Display Name / Model <span className="text-rose-600">*</span>
                                    <input
                                      type="text"
                                      value={quickNewVehicleName}
                                      onChange={(e) => setQuickNewVehicleName(e.target.value)}
                                      placeholder="e.g. Toyota KDH High Roof"
                                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                                    />
                                  </label>
                                  <label className="block text-xs font-bold text-slate-700">
                                    Category <span className="text-rose-600">*</span>
                                    <select
                                      value={quickNewVehicleCategoryId}
                                      onChange={(e) => {
                                        const catId = e.target.value;
                                        setQuickNewVehicleCategoryId(catId);
                                        const found = fleetCategories.find((c) => c.id === catId);
                                        const pax = found?.max_passengers ?? found?.passenger_capacity;
                                        const lug = found?.max_luggage ?? found?.luggage_capacity;
                                        if (pax) setQuickNewVehiclePax(pax);
                                        if (lug !== undefined) setQuickNewVehicleLuggage(lug);
                                      }}
                                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                                    >
                                      <option value="">Select Category</option>
                                      {fleetCategories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.display_name || c.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block text-xs font-bold text-slate-700">
                                    Reg Number
                                    <input
                                      type="text"
                                      value={quickNewVehicleReg}
                                      onChange={(e) => setQuickNewVehicleReg(e.target.value)}
                                      placeholder="e.g. WP CAA-1234"
                                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                                    />
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block text-xs font-bold text-slate-700">
                                      Max Pax
                                      <input
                                        type="number"
                                        min={1}
                                        value={quickNewVehiclePax}
                                        onChange={(e) => setQuickNewVehiclePax(Number(e.target.value))}
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900"
                                      />
                                    </label>
                                    <label className="block text-xs font-bold text-slate-700">
                                      Luggage
                                      <input
                                        type="number"
                                        min={0}
                                        value={quickNewVehicleLuggage}
                                        onChange={(e) => setQuickNewVehicleLuggage(Number(e.target.value))}
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900"
                                      />
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowQuickAddDriver(false)}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingQuickDriver}
                                onClick={() => void submitQuickDriver(selectedBooking.id)}
                                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
                              >
                                {savingQuickDriver ? 'Saving Driver & Vehicle…' : 'Save & Pre-Select for Dispatch'}
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedBooking.assignment ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="rounded-xl bg-white p-3.5 border border-slate-200 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Driver</span>
                                <p className="font-extrabold text-slate-900 text-sm">
                                  {selectedBooking.assignment.driver_name || driverById.get(selectedBooking.assignment.driver_user_id)?.full_name || 'Driver'}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Phone: {selectedBooking.assignment.driver_phone || driverById.get(selectedBooking.assignment.driver_user_id)?.phone || 'Not provided'}
                                </p>
                                {selectedBooking.assignment.driver_phone && (
                                  <div className="pt-1 flex gap-3">
                                    <a
                                      href={`tel:${selectedBooking.assignment.driver_phone}`}
                                      className="text-xs font-bold text-blue-700 underline"
                                    >
                                      Call Driver
                                    </a>
                                    {whatsAppLink(selectedBooking.assignment.driver_phone, `Hello from Chama Travels regarding booking ${selectedBooking.booking_ref}:`) && (
                                      <a
                                        href={whatsAppLink(selectedBooking.assignment.driver_phone, `Hello from Chama Travels regarding booking ${selectedBooking.booking_ref}:`)!}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-bold text-emerald-700 underline"
                                      >
                                        WhatsApp Driver
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="rounded-xl bg-white p-3.5 border border-slate-200 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Vehicle</span>
                                <p className="font-extrabold text-slate-900 text-sm">
                                  {selectedBooking.assignment.vehicle_name || vehicleById.get(selectedBooking.assignment.vehicle_id)?.display_name || 'Vehicle'}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Reg No: {selectedBooking.assignment.vehicle_registration || vehicleById.get(selectedBooking.assignment.vehicle_id)?.registration_number || 'N/A'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Category: {selectedBooking.assignment.vehicle_category || vehicleById.get(selectedBooking.assignment.vehicle_id)?.category_name || ''}
                                </p>
                              </div>
                            </div>

                            {canOperate && ['offered', 'accepted'].includes(selectedBooking.assignment.assignment_status) && (
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                                <span className="text-xs text-slate-500">
                                  Need to switch the driver or vehicle for this trip?
                                </span>
                                <button
                                  type="button"
                                  disabled={savingAction === selectedBooking.id}
                                  onClick={() => void releaseDriverAssignment(selectedBooking)}
                                  className="rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                                >
                                  Release / Change Driver
                                </button>
                              </div>
                            )}

                            {/* In-Tab Instant Customer WhatsApp Dispatch Card */}
                            {(() => {
                              const leg = selectedBooking.legs[0];
                              const driver = driverById.get(selectedBooking.assignment.driver_user_id);
                              const vehicle = vehicleById.get(selectedBooking.assignment.vehicle_id);
                              const dispatchMsg = formatTripDispatchMessage({
                                bookingRef: selectedBooking.booking_ref,
                                customerName: selectedBooking.customer_name,
                                serviceType: selectedBooking.service_type,
                                journeyType: selectedBooking.journey_type,
                                pickupLocation: leg?.pickup_location ?? 'As agreed',
                                dropoffLocation: leg?.dropoff_location ?? 'As agreed',
                                pickupTimeColombo: leg ? formatDate(leg.pickup_at) : 'To be confirmed',
                                driverName: selectedBooking.assignment.driver_name || driver?.full_name || 'Assigned Driver',
                                driverPhone: selectedBooking.assignment.driver_phone || driver?.phone || null,
                                vehicleName: selectedBooking.assignment.vehicle_name || vehicle?.display_name || 'Chama Travels Vehicle',
                                vehicleRegistration: selectedBooking.assignment.vehicle_registration || vehicle?.registration_number || null,
                                passengerCount: selectedBooking.passenger_count,
                              });
                              const customerWaUrl = customerWhatsAppUrl(selectedBooking.customer_phone, dispatchMsg);

                              return (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <h4 className="text-xs font-extrabold text-emerald-950">
                                        Send Driver &amp; Vehicle Info via WhatsApp
                                      </h4>
                                      <p className="text-[11px] text-emerald-800">
                                        100% manual dispatch — preview, copy, or open WhatsApp for {selectedBooking.customer_name}.
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void navigator.clipboard.writeText(dispatchMsg);
                                          setDispatchCopied(true);
                                          setTimeout(() => setDispatchCopied(false), 3000);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition"
                                      >
                                        {dispatchCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
                                        {dispatchCopied ? 'Copied!' : 'Copy Message'}
                                      </button>
                                      {customerWaUrl && (
                                        <a
                                          href={customerWaUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" /> Open WhatsApp
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <textarea
                                    readOnly
                                    rows={7}
                                    value={dispatchMsg}
                                    className="w-full rounded-xl border border-emerald-200 bg-white p-3 font-mono text-xs text-slate-800 focus:outline-none"
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-600">
                              {selectedBooking.booking_status === 'confirmed'
                                ? `Select an available driver and vehicle for ${selectedBooking.passenger_count} passenger(s) and ${selectedBooking.luggage_count} bag(s). Database overlap checks prevent double-booking.`
                                : 'Confirm the customer quotation in Tab 2 first before assigning a driver and vehicle.'}
                            </p>

                            {canOperate && selectedBooking.booking_status === 'confirmed' && (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end rounded-2xl bg-white p-4 border border-slate-200">
                                <label className="block text-xs font-bold text-slate-700">
                                  Select Available Driver
                                  <select
                                    value={assignments[selectedBooking.id]?.driver ?? ''}
                                    onChange={(e) => {
                                      const chosenDriverId = e.target.value;
                                      const chosenDriver = drivers.find((d) => d.id === chosenDriverId);
                                      const currentVehicle = assignments[selectedBooking.id]?.vehicle ?? '';
                                      setAssignments({
                                        ...assignments,
                                        [selectedBooking.id]: {
                                          driver: chosenDriverId,
                                          vehicle:
                                            chosenDriver?.default_vehicle_id &&
                                            vehicles.some((v) => v.id === chosenDriver.default_vehicle_id)
                                              ? chosenDriver.default_vehicle_id
                                              : currentVehicle,
                                        },
                                      });
                                    }}
                                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium text-slate-900"
                                  >
                                    <option value="">Choose Driver</option>
                                    {drivers.map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.full_name} {d.phone ? `· ${d.phone}` : ''}{' '}
                                        {d.default_vehicle_name ? `[${d.default_vehicle_name}] ` : ''}
                                        {busyDriverIds.has(d.id) ? '(On another active trip)' : '(Available)'}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="block text-xs font-bold text-slate-700">
                                  Select Available Vehicle
                                  <select
                                    value={assignments[selectedBooking.id]?.vehicle ?? ''}
                                    onChange={(e) =>
                                      setAssignments({
                                        ...assignments,
                                        [selectedBooking.id]: {
                                          ...(assignments[selectedBooking.id] ?? { driver: '', vehicle: '' }),
                                          vehicle: e.target.value,
                                        },
                                      })
                                    }
                                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium text-slate-900"
                                  >
                                    <option value="">Choose Vehicle</option>
                                    {vehicles.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.display_name} {v.registration_number ? `(${v.registration_number})` : ''} · {v.category_name}{' '}
                                        {v.max_passengers ? `[${v.max_passengers} pax]` : ''}{' '}
                                        {busyVehicleIds.has(v.id) ? '(Assigned elsewhere)' : '(Available)'}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <button
                                  type="button"
                                  disabled={savingAction === selectedBooking.id}
                                  onClick={() => void assignBooking(selectedBooking)}
                                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-sm"
                                >
                                  {savingAction === selectedBooking.id ? 'Assigning…' : 'Assign Driver & Vehicle'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: Payments, Invoices & Receipts */}
              {activeModalTab === 'billing' && canOperate && (
                <div className="space-y-6">
                  <BookingBillingPanel
                    bookingId={selectedBooking.id}
                    bookingRef={selectedBooking.booking_ref}
                    acceptedQuoteId={
                      selectedBooking.quotes.find((q) => q.quote_status === 'accepted')?.id ?? null
                    }
                    assignmentId={
                      selectedBooking.assignment &&
                      ['offered', 'accepted'].includes(selectedBooking.assignment.assignment_status)
                        ? selectedBooking.assignment.id
                        : null
                    }
                    customerName={selectedBooking.customer_name}
                    customerPhone={selectedBooking.customer_phone}
                    sentQuoteId={
                      selectedBooking.quotes.find((q) => q.quote_status === 'sent')?.id ?? null
                    }
                    onConfirmSentQuote={async (quoteId) => {
                      await recordWhatsAppConfirmation(quoteId);
                    }}
                    onUpdated={loadBookings}
                  />
                </div>
              )}

              {/* TAB 5: Timeline & Internal Admin Notes */}
              {activeModalTab === 'activity' && canOperate && (
                <div className="space-y-6">
                  <BookingActivity bookingId={selectedBooking.id} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-between items-center text-xs text-slate-500">
              <span>Status transitions are validated server-side to guarantee audit history integrity.</span>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Customer WhatsApp Trip Details Generator Modal */}
      {dispatchPreviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" /> WhatsApp Trip Details for Customer
              </h3>
              <button
                type="button"
                onClick={() => setDispatchPreviewBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Preview the customer-facing trip and driver information before sending manually via WhatsApp. Sending remains 100% manual.
            </p>

            {(() => {
              const leg = dispatchPreviewBooking.legs[0];
              const driver = dispatchPreviewBooking.assignment
                ? driverById.get(dispatchPreviewBooking.assignment.driver_user_id)
                : undefined;
              const vehicle = dispatchPreviewBooking.assignment
                ? vehicleById.get(dispatchPreviewBooking.assignment.vehicle_id)
                : undefined;

              const message = formatTripDispatchMessage({
                bookingRef: dispatchPreviewBooking.booking_ref,
                customerName: dispatchPreviewBooking.customer_name,
                serviceType: dispatchPreviewBooking.service_type,
                journeyType: dispatchPreviewBooking.journey_type,
                pickupLocation: leg?.pickup_location ?? 'As agreed',
                dropoffLocation: leg?.dropoff_location ?? 'As agreed',
                pickupTimeColombo: leg ? formatDate(leg.pickup_at) : 'To be confirmed',
                driverName: dispatchPreviewBooking.assignment?.driver_name || driver?.full_name || 'Assigned Driver',
                driverPhone: dispatchPreviewBooking.assignment?.driver_phone || driver?.phone || null,
                vehicleName: dispatchPreviewBooking.assignment?.vehicle_name || vehicle?.display_name || 'Chama Travels Vehicle',
                vehicleRegistration: dispatchPreviewBooking.assignment?.vehicle_registration || vehicle?.registration_number || null,
                passengerCount: dispatchPreviewBooking.passenger_count,
              });

              const waUrl = customerWhatsAppUrl(dispatchPreviewBooking.customer_phone, message);

              return (
                <div className="space-y-4">
                  <textarea
                    readOnly
                    rows={12}
                    value={message}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(message);
                        setDispatchCopied(true);
                        setTimeout(() => setDispatchCopied(false), 3000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                    >
                      {dispatchCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
                      {dispatchCopied ? 'Copied to Clipboard!' : 'Copy Message'}
                    </button>

                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
                      >
                        <ExternalLink className="h-4 w-4" /> Open WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-amber-700">Customer phone not formatted for WhatsApp direct link.</span>
                    )}

                    <button
                      type="button"
                      onClick={() => setDispatchPreviewBooking(null)}
                      className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* "+ Add Manual Booking" Modal */}
      {showManualBookingModal && canOperate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  <Plus className="h-3.5 w-3.5" /> Direct Admin Entry
                </span>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  + Add Manual Booking (WhatsApp / Phone / Walk-in)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowManualBookingModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 1. Booking Source */}
              <div className="space-y-2">
                <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  1. Booking Source
                </span>
                <div className="flex flex-wrap gap-2">
                  {MANUAL_BOOKING_SOURCES.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setManualSource(src)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        manualSource === src
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Customer Information */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" /> 2. Customer Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Customer Full Name <span className="text-rose-600">*</span>
                    <input
                      type="text"
                      value={manualCustomerName}
                      onChange={(e) => setManualCustomerName(e.target.value)}
                      placeholder="e.g. Liam Anderson"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Phone / WhatsApp Number <span className="text-rose-600">*</span>
                    <input
                      type="text"
                      value={manualCustomerPhone}
                      onChange={(e) => setManualCustomerPhone(e.target.value)}
                      placeholder="e.g. +94 77 123 4567 or +44 7700 900077"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Email Address <span className="font-normal text-slate-400">(Optional)</span>
                    <input
                      type="email"
                      value={manualCustomerEmail}
                      onChange={(e) => setManualCustomerEmail(e.target.value)}
                      placeholder="Optional — guest email"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Country <span className="font-normal text-slate-400">(Optional)</span>
                    <input
                      type="text"
                      value={manualCustomerCountry}
                      onChange={(e) => setManualCustomerCountry(e.target.value)}
                      placeholder="e.g. United Kingdom, Germany, Sri Lanka"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>
                </div>
              </div>

              {/* 3. Journey & Schedule Details */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> 3. Journey &amp; Schedule Information
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Service Type <span className="text-rose-600">*</span>
                    <select
                      value={manualServiceType}
                      onChange={(e) =>
                        setManualServiceType(e.target.value as (typeof MANUAL_SERVICE_TYPES)[number])
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    >
                      {MANUAL_SERVICE_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Vehicle Preference
                    <select
                      value={manualCategoryCode}
                      onChange={(e) => setManualCategoryCode(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    >
                      {fleetCategories.length > 0
                        ? fleetCategories.map((cat) => {
                            const code =
                              cat.code ||
                              (cat.display_name || cat.name || 'sedan')
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '_');
                            return (
                              <option key={cat.id} value={code}>
                                {cat.display_name || cat.name}
                              </option>
                            );
                          })
                        : DEFAULT_VEHICLE_CATEGORIES.map((vc) => (
                            <option key={vc.code} value={vc.code}>
                              {vc.label}
                            </option>
                          ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Pickup Location <span className="text-rose-600">*</span>
                    <input
                      type="text"
                      value={manualPickupLocation}
                      onChange={(e) => setManualPickupLocation(e.target.value)}
                      placeholder="e.g. Bandaranaike Airport (BIA) / Colombo Hotel"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Drop-off Location <span className="text-rose-600">*</span>
                    <input
                      type="text"
                      value={manualDropoffLocation}
                      onChange={(e) => setManualDropoffLocation(e.target.value)}
                      placeholder="e.g. Ella / Sigiriya / Mirissa"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Pickup Date <span className="text-rose-600">*</span>
                      <input
                        type="date"
                        value={manualPickupDate}
                        onChange={(e) => setManualPickupDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Pickup Time <span className="text-rose-600">*</span>
                      <input
                        type="time"
                        value={manualPickupTime}
                        onChange={(e) => setManualPickupTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-bold text-slate-700">
                      End Date <span className="font-normal text-slate-400">(Optional)</span>
                      <input
                        type="date"
                        value={manualEndDate}
                        onChange={(e) => setManualEndDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      End Time <span className="font-normal text-slate-400">(Optional)</span>
                      <input
                        type="time"
                        value={manualEndTime}
                        onChange={(e) => setManualEndTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Passengers (1–14)
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={manualPassengers}
                        onChange={(e) => setManualPassengers(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Luggage (0–14)
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={manualLuggage}
                        onChange={(e) => setManualLuggage(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Flight No <span className="font-normal text-slate-400">(Optional)</span>
                      <input
                        type="text"
                        value={manualFlightNumber}
                        onChange={(e) => setManualFlightNumber(e.target.value)}
                        placeholder="e.g. UL 504 / EK 650"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                    Special Notes / Itinerary Details
                    <textarea
                      rows={2}
                      value={manualSpecialNotes}
                      onChange={(e) => setManualSpecialNotes(e.target.value)}
                      placeholder="Optional — child seat request, hotel name, multi-day stops..."
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                    />
                  </label>
                </div>
              </div>

              {/* 4. Quick Price & Auto-Confirm Option */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualAutoConfirm}
                    onChange={(e) => setManualAutoConfirm(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-emerald-950 block">
                      Quick Price &amp; Auto-Confirm Booking (+ Real-Time Google Calendar Sync)
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Attach the agreed price (LKR or USD) to immediately mark this booking as{' '}
                      <b>Confirmed</b> and sync it to Google Calendar so you can dispatch a driver right away.
                    </span>
                  </div>
                </label>

                {manualAutoConfirm && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-1">
                    <label className="block text-xs font-bold text-emerald-950">
                      Currency
                      <select
                        value={manualCurrency}
                        onChange={(e) => setManualCurrency(e.target.value as 'LKR' | 'USD')}
                        className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                      >
                        <option value="LKR">LKR (Sri Lankan Rupee)</option>
                        <option value="USD">USD (US Dollar)</option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-emerald-950 sm:col-span-2">
                      Agreed Total Price ({manualCurrency}) <span className="text-rose-600">*</span>
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={manualAgreedAmount}
                        onChange={(e) => setManualAgreedAmount(e.target.value)}
                        placeholder={manualCurrency === 'LKR' ? 'e.g. 25000' : 'e.g. 120'}
                        className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <span className="text-xs text-slate-500">
                All timestamps are saved in Sri Lanka time (<code className="font-mono">Asia/Colombo</code>).
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualBookingModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingManualBooking}
                  onClick={() => void submitManualBooking()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition"
                >
                  <CheckCircle className="h-4 w-4" />
                  {savingManualBooking
                    ? 'Creating Booking…'
                    : manualAutoConfirm
                      ? 'Create & Confirm Booking'
                      : 'Create Pending Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
