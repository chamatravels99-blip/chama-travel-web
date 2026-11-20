export type AnalyticsCurrency = 'LKR' | 'USD';

export type RawAnalyticsBookingLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  trip_status: string;
};

export type RawAnalyticsBooking = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  requested_currency: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  created_at: string;
  updated_at?: string;
  legs?: RawAnalyticsBookingLeg[];
};

export type RawAnalyticsQuote = {
  id: string;
  booking_id: string;
  revision: number;
  currency: string;
  total: number | string;
  quote_status: string;
  issued_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type RawAnalyticsPayment = {
  id: string;
  booking_id: string;
  quote_id: string;
  entry_type: 'receipt' | 'refund' | string;
  original_payment_id: string | null;
  amount: number | string;
  currency: string;
  method: string;
  receipt_number: string | null;
  payment_date: string | null;
  verified_at: string;
  created_at: string;
};

export type RawAnalyticsAssignment = {
  id: string;
  booking_id: string;
  driver_user_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_id: string;
  vehicle_name: string | null;
  vehicle_registration: string | null;
  vehicle_category: string | null;
  assignment_status: string;
  assigned_at: string;
  responded_at: string | null;
  released_at: string | null;
};

export type RawAnalyticsDriver = {
  id: string;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  account_status: string;
  default_vehicle_id: string | null;
  default_vehicle_name: string | null;
  default_vehicle_registration: string | null;
  default_vehicle_category: string | null;
};

export type RawAnalyticsVehicle = {
  id: string;
  display_name: string;
  registration_number: string | null;
  operational_status: string;
  category_name: string;
};

export type RawAnalyticsDriverSettlement = {
  id: string;
  assignment_id: string;
  booking_id: string;
  driver_user_id: string;
  quote_id: string;
  currency: string;
  amount: number | string;
  settlement_status: 'pending' | 'paid' | string;
  payout_method: string | null;
  created_at: string;
  paid_at: string | null;
};

export type RawAnalyticsDriverHireOffer = {
  id: string;
  assignment_id: string;
  booking_id: string;
  driver_user_id: string;
  revision: number;
  amount: number | string;
  currency: string;
  offer_status: 'offered' | 'accepted' | 'declined' | string;
  is_current: boolean;
  created_at: string;
  responded_at: string | null;
};

export type RawAnalyticsDriverHirePayout = {
  id: string;
  assignment_id: string;
  booking_id: string;
  driver_user_id: string;
  amount: number | string;
  currency: string;
  payment_date: string;
  payment_method: string;
  recorded_at: string;
};

export type RawAnalyticsTourPackage = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  duration: string;
  days_count: number;
  price_usd: number | string | null;
  price_lkr: number | string | null;
  destinations_covered: string[];
  is_active: boolean;
};

export type RawAnalyticsDestination = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  is_active: boolean;
};

export type AnalyticsSourceData = {
  bookings: RawAnalyticsBooking[];
  quotes: RawAnalyticsQuote[];
  payments: RawAnalyticsPayment[];
  assignments: RawAnalyticsAssignment[];
  drivers: RawAnalyticsDriver[];
  vehicles: RawAnalyticsVehicle[];
  driver_settlements: RawAnalyticsDriverSettlement[];
  driver_hire_offers: RawAnalyticsDriverHireOffer[];
  driver_hire_payouts: RawAnalyticsDriverHirePayout[];
  tour_packages: RawAnalyticsTourPackage[];
  destinations: RawAnalyticsDestination[];
};

export type CurrencyKpiMetrics = {
  currency: AnalyticsCurrency;
  gross_booked_value: number;
  gross_quoted_value: number;
  pending_quote_value: number;
  gross_payments_received: number;
  total_refunds: number;
  net_payments_collected: number;
  outstanding_balance: number;
  driver_obligations: number;
  driver_payouts_paid: number;
  driver_balance_pending: number;
  has_recorded_expenses: boolean;
};

export type AnalyticsKpiSummary = {
  total_bookings: number;
  completed_trips: number;
  active_upcoming_trips: number;
  pending_quoted_trips: number;
  cancelled_rejected_trips: number;
  completion_rate_pct: number;
  cancellation_rate_pct: number;
  has_any_recorded_expenses: boolean;
  financials: {
    LKR: CurrencyKpiMetrics;
    USD: CurrencyKpiMetrics;
  };
};

export type MonthlyTrendPoint = {
  month_index: number;
  month_label: string;
  month_key: string;
  bookingsCount: number;
  completedCount: number;
  activeCount: number;
  pendingCount: number;
  cancelledCount: number;
  bookedLKR: number;
  collectedLKR: number;
  refundedLKR: number;
  bookedUSD: number;
  collectedUSD: number;
  refundedUSD: number;
  driverPayoutsLKR: number;
  driverPayoutsUSD: number;
};

export type AnnualTrendPoint = {
  year: number;
  bookingsCount: number;
  completedCount: number;
  cancelledCount: number;
  bookedLKR: number;
  collectedLKR: number;
  bookedUSD: number;
  collectedUSD: number;
  driverPayoutsLKR: number;
  driverPayoutsUSD: number;
};

export type StatusBreakdownItem = {
  status_key: string;
  label: string;
  bucket: 'completed' | 'confirmed_assigned' | 'pending_quoted' | 'cancelled';
  count: number;
  percentage: number;
};

export type StatusBucketBreakdownItem = {
  bucket: 'completed' | 'confirmed_assigned' | 'pending_quoted' | 'cancelled';
  label: string;
  count: number;
  percentage: number;
};

export type ServiceTypeBreakdownItem = {
  service_type: string;
  label: string;
  bookings_count: number;
  completed_count: number;
  share_pct: number;
  booked_lkr: number;
  collected_lkr: number;
  booked_usd: number;
  collected_usd: number;
};

export type TopPackageItem = {
  rank: number;
  title: string;
  category: string;
  is_catalog_package: boolean;
  bookings_count: number;
  completed_count: number;
  share_pct: number;
  booked_lkr: number;
  collected_lkr: number;
  booked_usd: number;
  collected_usd: number;
};

export type TopDestinationItem = {
  rank: number;
  destination: string;
  region: string;
  trip_appearances: number;
  share_pct: number;
  booked_lkr: number;
  collected_lkr: number;
  booked_usd: number;
  collected_usd: number;
};

export type DriverPerformanceItem = {
  driver_id: string;
  driver_name: string;
  driver_phone: string | null;
  account_status: string;
  vehicle_name: string;
  vehicle_registration: string;
  vehicle_category: string;
  total_assigned_trips: number;
  completed_trips: number;
  active_upcoming_trips: number;
  cancelled_released_trips: number;
  completion_rate_pct: number;
  settled_lkr: number;
  settled_usd: number;
};

export type BusinessAnalyticsReport = {
  selected_year: string;
  chart_year: number;
  available_years: number[];
  kpis: AnalyticsKpiSummary;
  monthly_series: MonthlyTrendPoint[];
  annual_series: AnnualTrendPoint[];
  status_buckets: StatusBucketBreakdownItem[];
  status_breakdown: StatusBreakdownItem[];
  service_type_breakdown: ServiceTypeBreakdownItem[];
  top_packages: TopPackageItem[];
  top_destinations: TopDestinationItem[];
  driver_performance: DriverPerformanceItem[];
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SERVICE_TYPE_LABELS: Record<string, string> = {
  airport_transfer: 'Airport Transfer',
  day_trip: 'Day Trip',
  round_tour: 'Multi-Day Round Tour',
  vehicle_hire: 'Chauffeur / Vehicle Hire',
  custom: 'Custom Itinerary',
};

const GENERIC_BOOKING_TITLES = new Set([
  'airport transfer',
  'day trip',
  'round tour',
  'vehicle hire',
  'custom itinerary',
  'custom',
]);

function toCurrency(value: string | null | undefined): AnalyticsCurrency {
  return value?.trim().toUpperCase() === 'USD' ? 'USD' : 'LKR';
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function getColomboYearMonth(
  dateOrIso: string | null | undefined
): { year: number; monthIndex: number; monthKey: string } | null {
  if (!dateOrIso || typeof dateOrIso !== 'string') return null;
  const trimmed = dateOrIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(5, 7));
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return {
        year,
        monthIndex: month - 1,
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
      };
    }
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(parsed));
  const yearStr = parts.find((p) => p.type === 'year')?.value ?? '';
  const monthStr = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return {
    year,
    monthIndex: month - 1,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
  };
}

function emptyCurrencyMetrics(currency: AnalyticsCurrency): CurrencyKpiMetrics {
  return {
    currency,
    gross_booked_value: 0,
    gross_quoted_value: 0,
    pending_quote_value: 0,
    gross_payments_received: 0,
    total_refunds: 0,
    net_payments_collected: 0,
    outstanding_balance: 0,
    driver_obligations: 0,
    driver_payouts_paid: 0,
    driver_balance_pending: 0,
    has_recorded_expenses: false,
  };
}

function extractBookingTitleFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/Booking title:\s*([^\r\n]+)/i);
  if (!match || !match[1]) return null;
  const cleaned = match[1].trim();
  return cleaned.length > 0 ? cleaned : null;
}

function extractItineraryStopsFromNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const match = notes.match(/Itinerary:\s*([^\r\n]+)/i);
  if (!match || !match[1]) return [];
  return match[1]
    .split(/\s*(?:->|→|,)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function canonicalizeDestination(
  rawLocation: string,
  catalogMap: Map<string, { name: string; region: string }>
): { name: string; region: string } | null {
  const cleaned = rawLocation.trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  // Check common airport / city aliases first
  if (
    lower === 'bia' ||
    lower === 'cmb' ||
    lower === 'airport' ||
    lower === 'colombo airport' ||
    lower === 'bandaranaike airport' ||
    lower === 'airport (cmb)' ||
    lower === 'katunayake'
  ) {
    return { name: 'Colombo Airport (CMB / BIA)', region: 'Western Province' };
  }
  if (lower === 'colombo / airport') {
    return { name: 'Colombo', region: 'Heritage & Cities' };
  }

  // Exact match in destinations catalog
  const exact = catalogMap.get(lower);
  if (exact) return exact;

  // Substring match against catalog destinations (e.g., "Mirissa Beach" -> "Mirissa", "Galle Dutch Fort" -> "Galle")
  for (const [catalogLower, info] of catalogMap.entries()) {
    if (lower.includes(catalogLower)) {
      return info;
    }
  }

  // Title-case well-known Sri Lanka destinations
  const titleCased = cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return { name: titleCased, region: 'Sri Lanka' };
}

function statusToBucket(
  status: string
): 'completed' | 'confirmed_assigned' | 'pending_quoted' | 'cancelled' {
  if (status === 'completed') return 'completed';
  if (['confirmed', 'assigned', 'in_progress'].includes(status)) return 'confirmed_assigned';
  if (['cancelled', 'rejected'].includes(status)) return 'cancelled';
  return 'pending_quoted';
}

export function aggregateBusinessAnalytics(
  source: AnalyticsSourceData,
  yearFilterInput?: string | null
): BusinessAnalyticsReport {
  const rawBookings = Array.isArray(source.bookings) ? source.bookings : [];
  const rawQuotes = Array.isArray(source.quotes) ? source.quotes : [];
  const rawPayments = Array.isArray(source.payments) ? source.payments : [];
  const rawAssignments = Array.isArray(source.assignments) ? source.assignments : [];
  const rawDrivers = Array.isArray(source.drivers) ? source.drivers : [];
  const rawSettlements = Array.isArray(source.driver_settlements)
    ? source.driver_settlements
    : [];
  const rawHireOffers = Array.isArray(source.driver_hire_offers)
    ? source.driver_hire_offers
    : [];
  const rawHirePayouts = Array.isArray(source.driver_hire_payouts)
    ? source.driver_hire_payouts
    : [];
  const rawPackages = Array.isArray(source.tour_packages) ? source.tour_packages : [];
  const rawDestinations = Array.isArray(source.destinations) ? source.destinations : [];

  const currentColomboYear =
    getColomboYearMonth(new Date().toISOString())?.year ?? new Date().getFullYear();

  // Collect all available years
  const yearSet = new Set<number>([currentColomboYear]);
  for (const b of rawBookings) {
    const ym = getColomboYearMonth(b.created_at);
    if (ym) yearSet.add(ym.year);
  }
  for (const p of rawPayments) {
    const ym = getColomboYearMonth(p.payment_date || p.verified_at || p.created_at);
    if (ym) yearSet.add(ym.year);
  }
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  const normalizedFilter = (yearFilterInput ?? 'all').trim().toLowerCase();
  const filterYearNum =
    /^\d{4}$/.test(normalizedFilter) && Number(normalizedFilter) >= 2000
      ? Number(normalizedFilter)
      : null;
  const selectedYear = filterYearNum ? String(filterYearNum) : 'all';
  const chartYear = filterYearNum ?? availableYears[0] ?? currentColomboYear;

  // Index quotes and payments by booking_id (all time, for accurate booking quote & balance lookup)
  const quotesByBookingId = new Map<string, RawAnalyticsQuote[]>();
  for (const q of rawQuotes) {
    const list = quotesByBookingId.get(q.booking_id) ?? [];
    list.push(q);
    quotesByBookingId.set(q.booking_id, list);
  }
  for (const list of quotesByBookingId.values()) {
    list.sort((a, b) => Number(b.revision) - Number(a.revision));
  }

  const allPaymentsByBookingId = new Map<string, RawAnalyticsPayment[]>();
  for (const p of rawPayments) {
    const list = allPaymentsByBookingId.get(p.booking_id) ?? [];
    list.push(p);
    allPaymentsByBookingId.set(p.booking_id, list);
  }

  // Helper to check if a date matches the selected year filter
  function matchesYearFilter(dateStr: string | null | undefined): boolean {
    if (filterYearNum === null) return true;
    const ym = getColomboYearMonth(dateStr);
    return ym?.year === filterYearNum;
  }

  // Initialize Monthly Trend Series for chartYear (Jan..Dec)
  const monthlySeries: MonthlyTrendPoint[] = MONTH_LABELS.map((label, idx) => ({
    month_index: idx + 1,
    month_label: label,
    month_key: `${chartYear}-${String(idx + 1).padStart(2, '0')}`,
    bookingsCount: 0,
    completedCount: 0,
    activeCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    bookedLKR: 0,
    collectedLKR: 0,
    refundedLKR: 0,
    bookedUSD: 0,
    collectedUSD: 0,
    refundedUSD: 0,
    driverPayoutsLKR: 0,
    driverPayoutsUSD: 0,
  }));

  // Initialize Annual Trend Series map
  const annualMap = new Map<number, AnnualTrendPoint>();
  for (const y of availableYears) {
    annualMap.set(y, {
      year: y,
      bookingsCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      bookedLKR: 0,
      collectedLKR: 0,
      bookedUSD: 0,
      collectedUSD: 0,
      driverPayoutsLKR: 0,
      driverPayoutsUSD: 0,
    });
  }

  function getOrCreateAnnualPoint(year: number): AnnualTrendPoint {
    let pt = annualMap.get(year);
    if (!pt) {
      pt = {
        year,
        bookingsCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        bookedLKR: 0,
        collectedLKR: 0,
        bookedUSD: 0,
        collectedUSD: 0,
        driverPayoutsLKR: 0,
        driverPayoutsUSD: 0,
      };
      annualMap.set(year, pt);
    }
    return pt;
  }

  // Catalog lookups for packages and destinations
  const packageCatalogByTitle = new Map<string, RawAnalyticsTourPackage>();
  for (const pkg of rawPackages) {
    packageCatalogByTitle.set(pkg.title.trim().toLowerCase(), pkg);
  }

  const destinationCatalogMap = new Map<string, { name: string; region: string }>();
  for (const dest of rawDestinations) {
    destinationCatalogMap.set(dest.name.trim().toLowerCase(), {
      name: dest.name.trim(),
      region: dest.region?.trim() || 'Sri Lanka',
    });
  }

  // Financial & Booking KPI accumulators (for selectedYear scope)
  const financials: { LKR: CurrencyKpiMetrics; USD: CurrencyKpiMetrics } = {
    LKR: emptyCurrencyMetrics('LKR'),
    USD: emptyCurrencyMetrics('USD'),
  };

  let totalBookings = 0;
  let completedTrips = 0;
  let activeUpcomingTrips = 0;
  let pendingQuotedTrips = 0;
  let cancelledRejectedTrips = 0;

  const statusCounts = new Map<string, number>();

  type ServiceAgg = {
    service_type: string;
    label: string;
    bookings_count: number;
    completed_count: number;
    booked_lkr: number;
    collected_lkr: number;
    booked_usd: number;
    collected_usd: number;
  };
  const serviceAggMap = new Map<string, ServiceAgg>();

  type PackageAgg = {
    title: string;
    category: string;
    is_catalog_package: boolean;
    bookings_count: number;
    completed_count: number;
    booked_lkr: number;
    collected_lkr: number;
    booked_usd: number;
    collected_usd: number;
  };
  const packageAggMap = new Map<string, PackageAgg>();

  type DestinationAgg = {
    destination: string;
    region: string;
    trip_appearances: number;
    booked_lkr: number;
    collected_lkr: number;
    booked_usd: number;
    collected_usd: number;
  };
  const destinationAggMap = new Map<string, DestinationAgg>();

  // 1. Process all bookings (both for Annual/Monthly trends and for selectedYear KPIs)
  for (const b of rawBookings) {
    const createdYm = getColomboYearMonth(b.created_at);
    const bQuotes = quotesByBookingId.get(b.id) ?? [];
    const acceptedQuote = bQuotes.find((q) => q.quote_status === 'accepted') ?? null;
    const latestSentQuote = bQuotes.find((q) => q.quote_status === 'sent') ?? null;
    const activeQuote = acceptedQuote ?? latestSentQuote ?? null;

    const bPayments = allPaymentsByBookingId.get(b.id) ?? [];
    let bookingNetPaidLKR = 0;
    let bookingNetPaidUSD = 0;
    for (const p of bPayments) {
      const pCurr = toCurrency(p.currency);
      const pAmt = roundMoney(Number(p.amount) || 0);
      const delta = p.entry_type === 'refund' ? -pAmt : pAmt;
      if (pCurr === 'USD') {
        bookingNetPaidUSD = roundMoney(bookingNetPaidUSD + delta);
      } else {
        bookingNetPaidLKR = roundMoney(bookingNetPaidLKR + delta);
      }
    }

    const isCancelled = b.booking_status === 'cancelled' || b.booking_status === 'rejected';
    const quoteCurrency = toCurrency(activeQuote?.currency ?? b.requested_currency);
    const quoteTotal =
      activeQuote && !isCancelled ? roundMoney(Number(activeQuote.total) || 0) : 0;
    const acceptedTotal =
      acceptedQuote && !isCancelled ? roundMoney(Number(acceptedQuote.total) || 0) : 0;

    // Annual & chartYear monthly booking volume + booked value
    if (createdYm) {
      const annualPt = getOrCreateAnnualPoint(createdYm.year);
      annualPt.bookingsCount += 1;
      if (b.booking_status === 'completed') annualPt.completedCount += 1;
      if (isCancelled) annualPt.cancelledCount += 1;
      if (quoteTotal > 0) {
        if (quoteCurrency === 'USD') {
          annualPt.bookedUSD = roundMoney(annualPt.bookedUSD + quoteTotal);
        } else {
          annualPt.bookedLKR = roundMoney(annualPt.bookedLKR + quoteTotal);
        }
      }

      if (createdYm.year === chartYear) {
        const mPt = monthlySeries[createdYm.monthIndex];
        if (mPt) {
          mPt.bookingsCount += 1;
          const bucket = statusToBucket(b.booking_status);
          if (bucket === 'completed') mPt.completedCount += 1;
          else if (bucket === 'confirmed_assigned') mPt.activeCount += 1;
          else if (bucket === 'cancelled') mPt.cancelledCount += 1;
          else mPt.pendingCount += 1;

          if (quoteTotal > 0) {
            if (quoteCurrency === 'USD') {
              mPt.bookedUSD = roundMoney(mPt.bookedUSD + quoteTotal);
            } else {
              mPt.bookedLKR = roundMoney(mPt.bookedLKR + quoteTotal);
            }
          }
        }
      }
    }

    // Filter check for selectedYear scope
    if (!matchesYearFilter(b.created_at)) {
      continue;
    }

    totalBookings += 1;
    statusCounts.set(b.booking_status, (statusCounts.get(b.booking_status) ?? 0) + 1);

    const bucket = statusToBucket(b.booking_status);
    if (bucket === 'completed') completedTrips += 1;
    else if (bucket === 'confirmed_assigned') activeUpcomingTrips += 1;
    else if (bucket === 'cancelled') cancelledRejectedTrips += 1;
    else pendingQuotedTrips += 1;

    if (!isCancelled) {
      if (acceptedQuote) {
        const accCurr = toCurrency(acceptedQuote.currency);
        financials[accCurr].gross_booked_value = roundMoney(
          financials[accCurr].gross_booked_value + acceptedTotal
        );
        financials[accCurr].gross_quoted_value = roundMoney(
          financials[accCurr].gross_quoted_value + acceptedTotal
        );
        const netForBooking = accCurr === 'USD' ? bookingNetPaidUSD : bookingNetPaidLKR;
        const bookingOutstanding = roundMoney(Math.max(acceptedTotal - netForBooking, 0));
        financials[accCurr].outstanding_balance = roundMoney(
          financials[accCurr].outstanding_balance + bookingOutstanding
        );
      } else if (latestSentQuote) {
        const sentCurr = toCurrency(latestSentQuote.currency);
        const sentTotal = roundMoney(Number(latestSentQuote.total) || 0);
        financials[sentCurr].gross_quoted_value = roundMoney(
          financials[sentCurr].gross_quoted_value + sentTotal
        );
        financials[sentCurr].pending_quote_value = roundMoney(
          financials[sentCurr].pending_quote_value + sentTotal
        );
      }
    }

    // Service Type Breakdown
    const svcKey = b.service_type || 'custom';
    const svcLabel =
      SERVICE_TYPE_LABELS[svcKey] ??
      svcKey
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    let svcAgg = serviceAggMap.get(svcKey);
    if (!svcAgg) {
      svcAgg = {
        service_type: svcKey,
        label: svcLabel,
        bookings_count: 0,
        completed_count: 0,
        booked_lkr: 0,
        collected_lkr: 0,
        booked_usd: 0,
        collected_usd: 0,
      };
      serviceAggMap.set(svcKey, svcAgg);
    }
    svcAgg.bookings_count += 1;
    if (b.booking_status === 'completed') svcAgg.completed_count += 1;
    if (quoteCurrency === 'USD') {
      svcAgg.booked_usd = roundMoney(svcAgg.booked_usd + quoteTotal);
    } else {
      svcAgg.booked_lkr = roundMoney(svcAgg.booked_lkr + quoteTotal);
    }
    svcAgg.collected_lkr = roundMoney(svcAgg.collected_lkr + Math.max(bookingNetPaidLKR, 0));
    svcAgg.collected_usd = roundMoney(svcAgg.collected_usd + Math.max(bookingNetPaidUSD, 0));

    // Tour Package / Service Offering Leaderboard
    const extractedTitle = extractBookingTitleFromNotes(b.customer_notes);
    const catalogMatch = extractedTitle
      ? packageCatalogByTitle.get(extractedTitle.toLowerCase())
      : undefined;
    const isSpecificTitle =
      Boolean(extractedTitle) &&
      !GENERIC_BOOKING_TITLES.has((extractedTitle ?? '').toLowerCase());

    const pkgTitle = catalogMatch
      ? catalogMatch.title
      : isSpecificTitle && extractedTitle
        ? extractedTitle
        : svcLabel;
    const pkgCategory = catalogMatch
      ? catalogMatch.category || 'Tour Package'
      : isSpecificTitle
        ? 'Tour Package'
        : svcLabel;
    const isCatalogPkg = Boolean(catalogMatch) || isSpecificTitle;

    let pkgAgg = packageAggMap.get(pkgTitle.toLowerCase());
    if (!pkgAgg) {
      pkgAgg = {
        title: pkgTitle,
        category: pkgCategory,
        is_catalog_package: isCatalogPkg,
        bookings_count: 0,
        completed_count: 0,
        booked_lkr: 0,
        collected_lkr: 0,
        booked_usd: 0,
        collected_usd: 0,
      };
      packageAggMap.set(pkgTitle.toLowerCase(), pkgAgg);
    }
    pkgAgg.bookings_count += 1;
    if (b.booking_status === 'completed') pkgAgg.completed_count += 1;
    if (quoteCurrency === 'USD') {
      pkgAgg.booked_usd = roundMoney(pkgAgg.booked_usd + quoteTotal);
    } else {
      pkgAgg.booked_lkr = roundMoney(pkgAgg.booked_lkr + quoteTotal);
    }
    pkgAgg.collected_lkr = roundMoney(pkgAgg.collected_lkr + Math.max(bookingNetPaidLKR, 0));
    pkgAgg.collected_usd = roundMoney(pkgAgg.collected_usd + Math.max(bookingNetPaidUSD, 0));

    // Top Destinations from legs + itinerary notes + matched catalog package destinations
    const uniqueDestinationsForBooking = new Map<string, { name: string; region: string }>();
    const legs = Array.isArray(b.legs) ? b.legs : [];
    for (const leg of legs) {
      for (const rawLoc of [leg.pickup_location, leg.dropoff_location]) {
        if (!rawLoc) continue;
        const resolved = canonicalizeDestination(rawLoc, destinationCatalogMap);
        if (resolved) {
          uniqueDestinationsForBooking.set(resolved.name.toLowerCase(), resolved);
        }
      }
    }
    for (const noteStop of extractItineraryStopsFromNotes(b.customer_notes)) {
      const resolved = canonicalizeDestination(noteStop, destinationCatalogMap);
      if (resolved) {
        uniqueDestinationsForBooking.set(resolved.name.toLowerCase(), resolved);
      }
    }
    if (catalogMatch && Array.isArray(catalogMatch.destinations_covered)) {
      for (const cov of catalogMatch.destinations_covered) {
        const resolved = canonicalizeDestination(cov, destinationCatalogMap);
        if (resolved) {
          uniqueDestinationsForBooking.set(resolved.name.toLowerCase(), resolved);
        }
      }
    }

    for (const [destKey, destInfo] of uniqueDestinationsForBooking.entries()) {
      let destAgg = destinationAggMap.get(destKey);
      if (!destAgg) {
        destAgg = {
          destination: destInfo.name,
          region: destInfo.region,
          trip_appearances: 0,
          booked_lkr: 0,
          collected_lkr: 0,
          booked_usd: 0,
          collected_usd: 0,
        };
        destinationAggMap.set(destKey, destAgg);
      }
      destAgg.trip_appearances += 1;
      if (quoteCurrency === 'USD') {
        destAgg.booked_usd = roundMoney(destAgg.booked_usd + quoteTotal);
      } else {
        destAgg.booked_lkr = roundMoney(destAgg.booked_lkr + quoteTotal);
      }
      destAgg.collected_lkr = roundMoney(
        destAgg.collected_lkr + Math.max(bookingNetPaidLKR, 0)
      );
      destAgg.collected_usd = roundMoney(
        destAgg.collected_usd + Math.max(bookingNetPaidUSD, 0)
      );
    }
  }

  // 2. Process all payments (by payment_date || verified_at || created_at)
  for (const p of rawPayments) {
    const pDate = p.payment_date || p.verified_at || p.created_at;
    const ym = getColomboYearMonth(pDate);
    const curr = toCurrency(p.currency);
    const amt = roundMoney(Number(p.amount) || 0);
    const isRefund = p.entry_type === 'refund';

    if (ym) {
      const annualPt = getOrCreateAnnualPoint(ym.year);
      if (curr === 'USD') {
        annualPt.collectedUSD = roundMoney(
          annualPt.collectedUSD + (isRefund ? -amt : amt)
        );
      } else {
        annualPt.collectedLKR = roundMoney(
          annualPt.collectedLKR + (isRefund ? -amt : amt)
        );
      }

      if (ym.year === chartYear) {
        const mPt = monthlySeries[ym.monthIndex];
        if (mPt) {
          if (curr === 'USD') {
            if (isRefund) {
              mPt.refundedUSD = roundMoney(mPt.refundedUSD + amt);
              mPt.collectedUSD = roundMoney(mPt.collectedUSD - amt);
            } else {
              mPt.collectedUSD = roundMoney(mPt.collectedUSD + amt);
            }
          } else {
            if (isRefund) {
              mPt.refundedLKR = roundMoney(mPt.refundedLKR + amt);
              mPt.collectedLKR = roundMoney(mPt.collectedLKR - amt);
            } else {
              mPt.collectedLKR = roundMoney(mPt.collectedLKR + amt);
            }
          }
        }
      }
    }

    if (matchesYearFilter(pDate)) {
      if (isRefund) {
        financials[curr].total_refunds = roundMoney(financials[curr].total_refunds + amt);
      } else {
        financials[curr].gross_payments_received = roundMoney(
          financials[curr].gross_payments_received + amt
        );
      }
    }
  }

  financials.LKR.net_payments_collected = roundMoney(
    financials.LKR.gross_payments_received - financials.LKR.total_refunds
  );
  financials.USD.net_payments_collected = roundMoney(
    financials.USD.gross_payments_received - financials.USD.total_refunds
  );

  // 3. Process recorded Driver Settlements & Driver Hire Offers/Payouts
  const settledAssignmentIds = new Set<string>();
  const driverSettledByDriverId = new Map<string, { LKR: number; USD: number }>();

  function addDriverSettled(driverId: string, currency: AnalyticsCurrency, amount: number) {
    const curr = driverSettledByDriverId.get(driverId) ?? { LKR: 0, USD: 0 };
    curr[currency] = roundMoney(curr[currency] + amount);
    driverSettledByDriverId.set(driverId, curr);
  }

  for (const ds of rawSettlements) {
    settledAssignmentIds.add(ds.assignment_id);
    const curr = toCurrency(ds.currency);
    const amt = roundMoney(Number(ds.amount) || 0);

    if (matchesYearFilter(ds.created_at)) {
      financials[curr].driver_obligations = roundMoney(
        financials[curr].driver_obligations + amt
      );
    }

    if (ds.settlement_status === 'paid') {
      const paidDate = ds.paid_at || ds.created_at;
      const paidYm = getColomboYearMonth(paidDate);
      if (paidYm) {
        const annualPt = getOrCreateAnnualPoint(paidYm.year);
        if (curr === 'USD') {
          annualPt.driverPayoutsUSD = roundMoney(annualPt.driverPayoutsUSD + amt);
        } else {
          annualPt.driverPayoutsLKR = roundMoney(annualPt.driverPayoutsLKR + amt);
        }
        if (paidYm.year === chartYear) {
          const mPt = monthlySeries[paidYm.monthIndex];
          if (mPt) {
            if (curr === 'USD') {
              mPt.driverPayoutsUSD = roundMoney(mPt.driverPayoutsUSD + amt);
            } else {
              mPt.driverPayoutsLKR = roundMoney(mPt.driverPayoutsLKR + amt);
            }
          }
        }
      }

      if (matchesYearFilter(paidDate)) {
        financials[curr].driver_payouts_paid = roundMoney(
          financials[curr].driver_payouts_paid + amt
        );
        addDriverSettled(ds.driver_user_id, curr, amt);
      }
    }
  }

  for (const dho of rawHireOffers) {
    if (
      dho.is_current &&
      dho.offer_status === 'accepted' &&
      !settledAssignmentIds.has(dho.assignment_id)
    ) {
      const offerDate = dho.responded_at || dho.created_at;
      if (matchesYearFilter(offerDate)) {
        const curr = toCurrency(dho.currency);
        const amt = roundMoney(Number(dho.amount) || 0);
        financials[curr].driver_obligations = roundMoney(
          financials[curr].driver_obligations + amt
        );
      }
    }
  }

  for (const dhp of rawHirePayouts) {
    const payoutDate = dhp.payment_date || dhp.recorded_at;
    const payoutYm = getColomboYearMonth(payoutDate);
    const curr = toCurrency(dhp.currency);
    const amt = roundMoney(Number(dhp.amount) || 0);

    if (payoutYm) {
      const annualPt = getOrCreateAnnualPoint(payoutYm.year);
      if (curr === 'USD') {
        annualPt.driverPayoutsUSD = roundMoney(annualPt.driverPayoutsUSD + amt);
      } else {
        annualPt.driverPayoutsLKR = roundMoney(annualPt.driverPayoutsLKR + amt);
      }
      if (payoutYm.year === chartYear) {
        const mPt = monthlySeries[payoutYm.monthIndex];
        if (mPt) {
          if (curr === 'USD') {
            mPt.driverPayoutsUSD = roundMoney(mPt.driverPayoutsUSD + amt);
          } else {
            mPt.driverPayoutsLKR = roundMoney(mPt.driverPayoutsLKR + amt);
          }
        }
      }
    }

    if (matchesYearFilter(payoutDate)) {
      financials[curr].driver_payouts_paid = roundMoney(
        financials[curr].driver_payouts_paid + amt
      );
      addDriverSettled(dhp.driver_user_id, curr, amt);
    }
  }

  for (const curr of ['LKR', 'USD'] as const) {
    financials[curr].driver_balance_pending = roundMoney(
      Math.max(
        financials[curr].driver_obligations - financials[curr].driver_payouts_paid,
        0
      )
    );
    financials[curr].has_recorded_expenses =
      financials[curr].driver_obligations > 0 || financials[curr].driver_payouts_paid > 0;
  }

  // 4. Status Breakdown & Buckets
  const statusLabels: Array<{
    key: string;
    label: string;
    bucket: StatusBreakdownItem['bucket'];
  }> = [
    { key: 'completed', label: 'Completed', bucket: 'completed' },
    { key: 'in_progress', label: 'In Progress', bucket: 'confirmed_assigned' },
    { key: 'assigned', label: 'Assigned to Driver', bucket: 'confirmed_assigned' },
    { key: 'confirmed', label: 'Confirmed', bucket: 'confirmed_assigned' },
    { key: 'quoted', label: 'Quoted (Awaiting Guest)', bucket: 'pending_quoted' },
    { key: 'reviewing', label: 'Under Review', bucket: 'pending_quoted' },
    { key: 'pending', label: 'Pending Inquiry', bucket: 'pending_quoted' },
    { key: 'cancelled', label: 'Cancelled', bucket: 'cancelled' },
    { key: 'rejected', label: 'Rejected', bucket: 'cancelled' },
  ];

  const statusBreakdown: StatusBreakdownItem[] = statusLabels.map((item) => {
    const count = statusCounts.get(item.key) ?? 0;
    return {
      status_key: item.key,
      label: item.label,
      bucket: item.bucket,
      count,
      percentage: totalBookings > 0 ? roundPct((count / totalBookings) * 100) : 0,
    };
  });

  const statusBuckets: StatusBucketBreakdownItem[] = [
    {
      bucket: 'completed',
      label: 'Completed Trips',
      count: completedTrips,
      percentage: totalBookings > 0 ? roundPct((completedTrips / totalBookings) * 100) : 0,
    },
    {
      bucket: 'confirmed_assigned',
      label: 'Confirmed & Assigned',
      count: activeUpcomingTrips,
      percentage:
        totalBookings > 0 ? roundPct((activeUpcomingTrips / totalBookings) * 100) : 0,
    },
    {
      bucket: 'pending_quoted',
      label: 'Pending & Quoted',
      count: pendingQuotedTrips,
      percentage:
        totalBookings > 0 ? roundPct((pendingQuotedTrips / totalBookings) * 100) : 0,
    },
    {
      bucket: 'cancelled',
      label: 'Cancelled / Rejected',
      count: cancelledRejectedTrips,
      percentage:
        totalBookings > 0 ? roundPct((cancelledRejectedTrips / totalBookings) * 100) : 0,
    },
  ];

  // 5. Service Type Breakdown sorted by bookings_count desc
  const serviceTypeBreakdown: ServiceTypeBreakdownItem[] = Array.from(
    serviceAggMap.values()
  )
    .sort((a, b) => b.bookings_count - a.bookings_count || b.booked_lkr - a.booked_lkr)
    .map((item) => ({
      ...item,
      share_pct:
        totalBookings > 0 ? roundPct((item.bookings_count / totalBookings) * 100) : 0,
    }));

  // 6. Top Packages & Service Offerings Leaderboard
  const topPackages: TopPackageItem[] = Array.from(packageAggMap.values())
    .sort(
      (a, b) =>
        b.bookings_count - a.bookings_count ||
        b.booked_lkr + b.booked_usd * 300 - (a.booked_lkr + a.booked_usd * 300)
    )
    .map((item, idx) => ({
      rank: idx + 1,
      title: item.title,
      category: item.category,
      is_catalog_package: item.is_catalog_package,
      bookings_count: item.bookings_count,
      completed_count: item.completed_count,
      share_pct:
        totalBookings > 0 ? roundPct((item.bookings_count / totalBookings) * 100) : 0,
      booked_lkr: item.booked_lkr,
      collected_lkr: item.collected_lkr,
      booked_usd: item.booked_usd,
      collected_usd: item.collected_usd,
    }));

  // 7. Top Destinations Leaderboard
  const totalDestinationAppearances = Array.from(destinationAggMap.values()).reduce(
    (sum, d) => sum + d.trip_appearances,
    0
  );
  const topDestinations: TopDestinationItem[] = Array.from(destinationAggMap.values())
    .sort(
      (a, b) =>
        b.trip_appearances - a.trip_appearances ||
        b.booked_lkr + b.booked_usd * 300 - (a.booked_lkr + a.booked_usd * 300)
    )
    .map((item, idx) => ({
      rank: idx + 1,
      destination: item.destination,
      region: item.region,
      trip_appearances: item.trip_appearances,
      share_pct:
        totalDestinationAppearances > 0
          ? roundPct((item.trip_appearances / totalDestinationAppearances) * 100)
          : 0,
      booked_lkr: item.booked_lkr,
      collected_lkr: item.collected_lkr,
      booked_usd: item.booked_usd,
      collected_usd: item.collected_usd,
    }));

  // 8. Driver & Fleet Performance Table
  const bookingById = new Map(rawBookings.map((b) => [b.id, b]));
  type DriverAgg = {
    driver_id: string;
    driver_name: string;
    driver_phone: string | null;
    account_status: string;
    vehicle_name: string;
    vehicle_registration: string;
    vehicle_category: string;
    total_assigned_trips: number;
    completed_trips: number;
    active_upcoming_trips: number;
    cancelled_released_trips: number;
  };
  const driverAggMap = new Map<string, DriverAgg>();

  for (const d of rawDrivers) {
    driverAggMap.set(d.id, {
      driver_id: d.id,
      driver_name: d.full_name,
      driver_phone: d.phone ?? null,
      account_status: d.account_status || 'active',
      vehicle_name: d.default_vehicle_name || 'Any Fleet Vehicle',
      vehicle_registration: d.default_vehicle_registration || '—',
      vehicle_category: d.default_vehicle_category || 'Fleet',
      total_assigned_trips: 0,
      completed_trips: 0,
      active_upcoming_trips: 0,
      cancelled_released_trips: 0,
    });
  }

  for (const ba of rawAssignments) {
    if (!matchesYearFilter(ba.assigned_at)) continue;

    let dAgg = driverAggMap.get(ba.driver_user_id);
    if (!dAgg) {
      dAgg = {
        driver_id: ba.driver_user_id,
        driver_name: ba.driver_name || 'Assigned Driver',
        driver_phone: ba.driver_phone ?? null,
        account_status: 'active',
        vehicle_name: ba.vehicle_name || 'Assigned Vehicle',
        vehicle_registration: ba.vehicle_registration || '—',
        vehicle_category: ba.vehicle_category || 'Fleet',
        total_assigned_trips: 0,
        completed_trips: 0,
        active_upcoming_trips: 0,
        cancelled_released_trips: 0,
      };
      driverAggMap.set(ba.driver_user_id, dAgg);
    } else if (dAgg.vehicle_name === 'Any Fleet Vehicle' && ba.vehicle_name) {
      dAgg.vehicle_name = ba.vehicle_name;
      dAgg.vehicle_registration = ba.vehicle_registration || dAgg.vehicle_registration;
      dAgg.vehicle_category = ba.vehicle_category || dAgg.vehicle_category;
    }

    dAgg.total_assigned_trips += 1;
    const linkedBooking = bookingById.get(ba.booking_id);
    const isReleasedOrDeclined =
      ba.assignment_status === 'released' ||
      ba.assignment_status === 'declined' ||
      linkedBooking?.booking_status === 'cancelled';
    const isCompleted =
      !isReleasedOrDeclined &&
      (ba.assignment_status === 'completed' ||
        linkedBooking?.booking_status === 'completed');

    if (isCompleted) {
      dAgg.completed_trips += 1;
    } else if (isReleasedOrDeclined) {
      dAgg.cancelled_released_trips += 1;
    } else {
      dAgg.active_upcoming_trips += 1;
    }
  }

  const driverPerformance: DriverPerformanceItem[] = Array.from(driverAggMap.values())
    .sort(
      (a, b) =>
        b.completed_trips - a.completed_trips ||
        b.total_assigned_trips - a.total_assigned_trips ||
        a.driver_name.localeCompare(b.driver_name)
    )
    .map((d) => {
      const settled = driverSettledByDriverId.get(d.driver_id) ?? { LKR: 0, USD: 0 };
      return {
        ...d,
        completion_rate_pct:
          d.total_assigned_trips > 0
            ? roundPct((d.completed_trips / d.total_assigned_trips) * 100)
            : 0,
        settled_lkr: settled.LKR,
        settled_usd: settled.USD,
      };
    });

  const annualSeries = Array.from(annualMap.values()).sort((a, b) => b.year - a.year);

  const kpis: AnalyticsKpiSummary = {
    total_bookings: totalBookings,
    completed_trips: completedTrips,
    active_upcoming_trips: activeUpcomingTrips,
    pending_quoted_trips: pendingQuotedTrips,
    cancelled_rejected_trips: cancelledRejectedTrips,
    completion_rate_pct:
      totalBookings > 0 ? roundPct((completedTrips / totalBookings) * 100) : 0,
    cancellation_rate_pct:
      totalBookings > 0 ? roundPct((cancelledRejectedTrips / totalBookings) * 100) : 0,
    has_any_recorded_expenses:
      financials.LKR.has_recorded_expenses || financials.USD.has_recorded_expenses,
    financials,
  };

  return {
    selected_year: selectedYear,
    chart_year: chartYear,
    available_years: availableYears,
    kpis,
    monthly_series: monthlySeries,
    annual_series: annualSeries,
    status_buckets: statusBuckets,
    status_breakdown: statusBreakdown,
    service_type_breakdown: serviceTypeBreakdown,
    top_packages: topPackages,
    top_destinations: topDestinations,
    driver_performance: driverPerformance,
  };
}
