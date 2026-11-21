'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERVICE_TYPES, todayInColombo } from '@/lib/constants';
import { X } from 'lucide-react';

interface BookingFormProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (bookingReference: string, trackerUrl?: string) => void;
  initialValues?: Partial<BookingFormInitialValues>;
  submitLabel?: string;
  heading?: string;
  preserveBookingTitleOnServiceChange?: boolean;
}

export type BookingFormInitialValues = {
  name: string;
  email: string;
  phone: string;
  service_type: string;
  booking_title?: string;
  journey_type: string;
  vehicle_type: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  flight_number: string;
  passengers: number;
  luggage: number;
  notes: string;
  legs: Array<{ pickup_location: string; dropoff_location: string; pickup_date?: string }>;
};

type ItineraryLegForm = {
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  end_date: string;
  end_time: string;
  flight_number: string;
  flight_arrival_date: string;
  flight_arrival_time: string;
};

type VehicleCategory = {
  code: string;
  display_name: string;
  max_passengers: number;
  max_luggage: number;
};

type BookingResponse = {
  success?: boolean;
  error?: string;
  data?: {
    id?: string | null;
    booking_ref?: string | null;
    tracker_token?: string | null;
  };
};

type IdempotencyEntry = {
  fingerprint: string;
  key: string;
};

const IDEMPOTENCY_STORAGE_KEY = 'chama-booking-idempotency-v1';

const emptyLeg = (): ItineraryLegForm => ({
  pickup_location: '',
  dropoff_location: '',
  pickup_date: '',
  pickup_time: '',
  end_date: '',
  end_time: '',
  flight_number: '',
  flight_arrival_date: '',
  flight_arrival_time: '',
});

const createInitialFormData = (
  initialValues?: Partial<BookingFormInitialValues>
) => {
  const defaultLegs = [emptyLeg(), emptyLeg()];
  const prefilledLegs = initialValues?.legs?.slice(0, 8).map((leg, index) => ({
    ...emptyLeg(),
    pickup_location: leg.pickup_location,
    dropoff_location: leg.dropoff_location,
    pickup_date: leg.pickup_date ?? (index === 0 ? initialValues.pickup_date ?? '' : ''),
  }));
  return {
    name: initialValues?.name ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    service_type: initialValues?.service_type ?? 'airport_transfer',
    booking_title: initialValues?.booking_title ?? '',
    journey_type: initialValues?.journey_type ?? 'one_way',
    vehicle_type: initialValues?.vehicle_type ?? 'sedan',
    pickup_location: initialValues?.pickup_location ?? '',
    dropoff_location: initialValues?.dropoff_location ?? '',
    pickup_date: initialValues?.pickup_date ?? '',
    pickup_time: initialValues?.pickup_time ?? '',
    return_date: '',
    return_time: '',
    end_date: '',
    end_time: '',
    flight_number: initialValues?.flight_number ?? '',
    flight_arrival_date: '',
    flight_arrival_time: '',
    passengers: initialValues?.passengers ?? 1,
    luggage: initialValues?.luggage ?? 0,
    currency: 'LKR',
    notes: initialValues?.notes ?? '',
    legs: prefilledLegs?.length ? prefilledLegs : defaultLegs,
  };
};

function preferredVehicleCode(preference: string, categories: VehicleCategory[]) {
  const normalized = preference.toLowerCase();
  const preferredCode = normalized.includes('mini') || normalized.includes('coaster') || normalized.includes('bus')
    ? 'mini_bus'
    : normalized.includes('van') || normalized.includes('kdh') || normalized.includes('suv') || normalized.includes('premium')
      ? 'luxury_van'
      : normalized.includes('sedan') || normalized.includes('axio') || normalized.includes('prius')
        ? 'sedan'
        : preference;
  return categories.find((category) => category.code === preferredCode)?.code ?? '';
}

export default function BookingForm({
  isOpen = true,
  onClose,
  onSuccess,
  initialValues,
  submitLabel = 'Confirm Booking',
  heading = 'Book Your Ride - Chama Travels',
  preserveBookingTitleOnServiceChange = false,
}: BookingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState(() => createInitialFormData(initialValues));
  const [bookingReference, setBookingReference] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [trackerUrl, setTrackerUrl] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    title: string;
    discount_label: string;
    booking_note_tag: string;
  } | null>(null);
  const [promoError, setPromoError] = useState('');
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<IdempotencyEntry | null>(null);

  async function handleApplyPromoCode() {
    const cleanCode = promoInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Enter a promo code to apply.');
      return;
    }
    setValidatingPromo(true);
    setPromoError('');
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_code',
          code: cleanCode,
          service_type: formData.service_type,
          currency: formData.currency,
        }),
      });
      const result = (await res.json()) as {
        success?: boolean;
        valid?: boolean;
        error?: string;
        data?: {
          code?: string;
          title?: string;
          discount_label?: string;
          booking_note_tag?: string;
        };
      };
      if (!res.ok || !result.valid || !result.data?.code) {
        setAppliedPromo(null);
        setPromoError(result.error || 'This promo code is invalid or expired.');
        return;
      }
      setAppliedPromo({
        code: result.data.code,
        title: result.data.title || 'Promotional Offer',
        discount_label: result.data.discount_label || 'Discount Applied',
        booking_note_tag:
          result.data.booking_note_tag ||
          `Promo code applied: ${result.data.code} (${result.data.discount_label || ''})`,
      });
      setPromoInput(result.data.code);
      setPromoError('');
    } catch {
      setPromoError('Could not verify promo code right now.');
    } finally {
      setValidatingPromo(false);
    }
  }

  const loadVehicleCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/vehicle-categories', { cache: 'no-store' });
      const result = await response.json() as { success?: boolean; error?: string; data?: VehicleCategory[] };
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Vehicle options could not be loaded.');
      }
      setVehicleCategories(result.data);
      setFormData((current) => ({
        ...current,
        vehicle_type: result.data?.some((category) => category.code === current.vehicle_type)
          ? current.vehicle_type
          : preferredVehicleCode(current.vehicle_type, result.data ?? []) || result.data?.[0]?.code || '',
      }));
      setCategoryError(result.data.length ? '' : 'No vehicle categories are currently available.');
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'Vehicle options could not be loaded.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadVehicleCategories); }, [loadVehicleCategories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMessage(null);
    setBookingReference(null);
    setBookingId(null);
    setTrackerUrl(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    if (name === 'service_type') {
      setFormData({
        ...formData,
        service_type: value,
        booking_title: preserveBookingTitleOnServiceChange
          ? formData.booking_title
          : SERVICE_TYPES.find((service) => service.value === value)?.label ?? value,
        ...(value !== 'airport_transfer' ? {
          flight_number: '',
          flight_arrival_date: '',
          flight_arrival_time: '',
          legs: formData.legs.map((leg) => ({ ...leg, flight_number: '' })),
        } : {}),
      });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleLegChange = (index: number, field: keyof ItineraryLegForm, value: string) => {
    setMessage(null);
    setBookingReference(null);
    setBookingId(null);
    setTrackerUrl(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`legs.${index}.${field}`];
      return next;
    });
    setFormData({
      ...formData,
      legs: formData.legs.map((leg, legIndex) => legIndex === index ? { ...leg, [field]: value } : leg),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const errors: Record<string, string> = {};
    if (formData.name.trim().length < 2) errors.name = 'Enter your full name.';
    if (!/^\+?[0-9\s()-]+$/.test(formData.phone.trim()) || formData.phone.replace(/\D/g, '').length < 7) {
      errors.phone = 'Enter a valid WhatsApp or phone number.';
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (formData.journey_type === 'multi_leg') {
      if (formData.legs.length < 2) errors.legs = 'Add at least two itinerary legs.';
      formData.legs.forEach((leg, index) => {
        if (!leg.pickup_location.trim()) errors[`legs.${index}.pickup_location`] = 'Enter this leg’s pickup location.';
        if (!leg.dropoff_location.trim()) errors[`legs.${index}.dropoff_location`] = 'Enter this leg’s destination.';
        if (!leg.pickup_date || leg.pickup_date < todayInColombo()) errors[`legs.${index}.pickup_date`] = 'Choose a future pickup date.';
        if (!leg.pickup_time) errors[`legs.${index}.pickup_time`] = 'Choose this leg’s pickup time.';
      });
    } else {
      if (!formData.pickup_location.trim()) errors.pickup_location = 'Enter your pickup location.';
      if (!formData.dropoff_location.trim()) errors.dropoff_location = 'Enter your destination.';
      if (!formData.pickup_date || formData.pickup_date < todayInColombo()) errors.pickup_date = 'Choose a future pickup date.';
      if (!formData.pickup_time) errors.pickup_time = 'Choose a pickup time.';
      if (formData.journey_type === 'return') {
        if (!formData.return_date) errors.return_date = 'Choose the return pickup date.';
        if (!formData.return_time) errors.return_time = 'Choose the return pickup time.';
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage({ type: 'error', text: 'Please correct the highlighted fields.' });
      return;
    }
    const category = vehicleCategories.find((item) => item.code === formData.vehicle_type);
    if (!category || Number(formData.passengers) > category.max_passengers ||
        Number(formData.luggage) > category.max_luggage) {
      setMessage({ type: 'error', text: 'Choose a vehicle category that can accommodate your passengers and luggage.' });
      return;
    }
    const { booking_title: bookingTitle, ...bookingFields } = formData;
    const bookingNotes = [
      bookingTitle ? `Booking title: ${bookingTitle}` : '',
      `Vehicle preference: ${category.display_name}`,
      appliedPromo ? appliedPromo.booking_note_tag : '',
      formData.notes.trim(),
    ].filter(Boolean).join('\n');
    if (bookingNotes.length > 1000) {
      setFieldErrors({ notes: 'Shorten the itinerary or special requests to fit the 1,000-character limit.' });
      setMessage({ type: 'error', text: 'Please shorten the notes before submitting.' });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setMessage(null);
    setBookingReference(null);
    setBookingId(null);
    setTrackerUrl(null);

    try {
      const payload = {
        ...bookingFields,
        notes: bookingNotes,
        legs: formData.journey_type === 'multi_leg' ? formData.legs : undefined,
      };
      const payloadText = JSON.stringify(payload);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadText));
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('');
      let savedEntry: IdempotencyEntry | null = null;
      try {
        const stored = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'fingerprint' in parsed &&
            parsed.fingerprint === fingerprint &&
            'key' in parsed &&
            typeof parsed.key === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.key)
          ) {
            savedEntry = { fingerprint, key: parsed.key };
          }
        }
      } catch (storageError) {
        console.warn('Booking retry key could not be restored from this browser session.', storageError);
      }
      const currentEntry = idempotencyRef.current?.fingerprint === fingerprint
        ? idempotencyRef.current
        : savedEntry;
      const requestKey = currentEntry?.key ?? crypto.randomUUID();
      const idempotencyEntry = { fingerprint, key: requestKey };
      idempotencyRef.current = idempotencyEntry;
      try {
        sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(idempotencyEntry));
      } catch (storageError) {
        console.warn('Booking retry key could not be saved for this browser session.', storageError);
      }
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotency_key: requestKey }),
      });

      const result = await response.json() as BookingResponse;

      if (
        !response.ok ||
        !result.success ||
        typeof result.data?.id !== 'string' ||
        !result.data.id ||
        typeof result.data.booking_ref !== 'string' ||
        !result.data.booking_ref ||
        (result.data.tracker_token !== undefined &&
          result.data.tracker_token !== null &&
          !/^[0-9a-f]{64}$/i.test(result.data.tracker_token))
      ) {
        throw new Error(result.error || 'We could not submit this booking. Please review the details and try again.');
      }

      const reference = result.data.booking_ref;
      const newTrackerUrl = result.data.tracker_token
        ? `${window.location.origin}/track#${result.data.tracker_token}`
        : null;
      setBookingId(result.data.id);
      setBookingReference(reference);
      setTrackerUrl(newTrackerUrl);
      try {
        const stored = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) as Partial<IdempotencyEntry> : null;
        if (parsed?.key === requestKey) sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
      } catch (storageError) {
        console.warn('Completed booking retry key could not be cleared.', storageError);
      }
      idempotencyRef.current = null;

      if (onSuccess) {
        try {
          onSuccess(reference, newTrackerUrl ?? undefined);
        } catch (callbackError) {
          console.error('Booking was saved, but the post-booking view could not be updated.', callbackError);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'We could not submit this booking. Please review the details and try again.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const closeSuccess = () => {
    if (onClose) {
      onClose();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/');
    }
  };

  if (bookingId && bookingReference) {
    const successContent = (
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-black text-emerald-700">✓</div>
        <h2 id="booking-success-title" className="mt-4 text-2xl font-black text-slate-950">
          Booking Completed Successfully!
        </h2>
        <p className="mt-2 text-sm text-slate-600">Your booking request has been saved.</p>
        <p className="mt-4 text-lg font-extrabold text-slate-900">Booking reference: {bookingReference}</p>
        {trackerUrl && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left">
            <p className="text-sm font-bold text-blue-950">Save your private booking tracker link</p>
            <p className="mt-1 text-xs leading-5 text-blue-900">This link provides access to this booking and expires after one year. Keep it private; it is required to view or link the guest booking to an account.</p>
            <a href={trackerUrl} className="mt-3 inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white" rel="noreferrer">
              Open booking tracker
            </a>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={`https://wa.me/94711114901?text=${encodeURIComponent(`Hello Chama Travels, my booking request has been saved. Booking reference: ${bookingReference}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            WhatsApp
          </a>
          <button type="button" onClick={closeSuccess} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-200">
            Close
          </button>
        </div>
      </section>
    );
    return onClose ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
        {successContent}
      </div>
    ) : (
      <div className="mx-auto flex min-h-[60vh] items-center justify-center p-4">{successContent}</div>
    );
  }

  const formContent = (
    <form noValidate onSubmit={handleSubmit} className="max-w-2xl w-full mx-auto p-6 bg-white rounded-3xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto relative text-xs">
      
      {/* Close button (Modal එකක් ලෙස පාවිච්චි කරන විට පෙන්වයි) */}
      {onClose && (
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      )}

      <h2 className="text-xl font-black text-slate-900 text-center mb-4">{heading}</h2>

      {message && <div role="alert" className="rounded-xl bg-red-100 p-4 text-xs font-bold text-red-800">{message.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="booking-name" className="block font-bold text-slate-700 uppercase mb-1">Full Name</label>
          <input
            type="text"
            id="booking-name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
            placeholder="John Doe"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor="booking-phone" className="block font-bold text-slate-700 uppercase mb-1">Phone / WhatsApp</label>
          <input
            type="tel"
            id="booking-phone"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
            placeholder="+94 7X XXX XXXX"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && <p className="mt-1 text-xs text-red-700">{fieldErrors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="booking-email" className="block font-bold text-slate-700 uppercase mb-1">Email Address</label>
        <input
          type="email"
          id="booking-email"
          name="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
          placeholder="john@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email && <p className="mt-1 text-xs text-red-700">{fieldErrors.email}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="booking-service-type" className="block font-bold text-slate-700 uppercase mb-1">Service Required</label>
          <select
            name="service_type"
            id="booking-service-type"
            value={formData.service_type}
            onChange={handleChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="booking-vehicle-type" className="block font-bold text-slate-700 uppercase mb-1">Vehicle Preference</label>
          <select
            name="vehicle_type"
            id="booking-vehicle-type"
            value={formData.vehicle_type}
            onChange={handleChange}
            disabled={categoriesLoading || vehicleCategories.length === 0}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
          >
            {categoriesLoading && <option value="">Loading vehicle types…</option>}
            {!categoriesLoading && vehicleCategories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.display_name} (up to {category.max_passengers} passengers, {category.max_luggage} bags)
              </option>
            ))}
          </select>
          {categoryError && <p className="mt-1 text-xs text-red-700">{categoryError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="booking-journey-type" className="block font-bold text-slate-700 uppercase mb-1">Journey Type</label>
          <select
            name="journey_type"
            id="booking-journey-type"
            value={formData.journey_type}
            onChange={handleChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="one_way">One way</option>
            <option value="return">Return journey</option>
            <option value="multi_leg">Multi-leg / tour</option>
          </select>
        </div>
        <div>
          <label htmlFor="booking-currency" className="block font-bold text-slate-700 uppercase mb-1">Quote Currency</label>
          <select
            name="currency"
            id="booking-currency"
            value={formData.currency}
            onChange={handleChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="LKR">LKR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {formData.journey_type === 'multi_leg' ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900">Itinerary legs</h3>
              <p className="text-[11px] text-slate-500">Enter each leg’s pickup, destination, date and time.</p>
            </div>
            <button type="button" disabled={formData.legs.length >= 8} onClick={() => setFormData({ ...formData, legs: [...formData.legs, emptyLeg()] })} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold disabled:opacity-50">Add leg</button>
          </div>
          {fieldErrors.legs && <p className="text-xs text-red-700">{fieldErrors.legs}</p>}
          {formData.legs.map((leg, index) => (
            <fieldset key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-xs font-bold text-slate-600">Leg {index + 1}</legend>
              <input required maxLength={200} value={leg.pickup_location} onChange={(event) => handleLegChange(index, 'pickup_location', event.target.value)} placeholder="Pickup location" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              {fieldErrors[`legs.${index}.pickup_location`] && <p className="text-xs text-red-700">{fieldErrors[`legs.${index}.pickup_location`]}</p>}
              <input required maxLength={200} value={leg.dropoff_location} onChange={(event) => handleLegChange(index, 'dropoff_location', event.target.value)} placeholder="Drop-off location" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              {fieldErrors[`legs.${index}.dropoff_location`] && <p className="text-xs text-red-700">{fieldErrors[`legs.${index}.dropoff_location`]}</p>}
              <label className="text-[10px] font-bold text-slate-500">Pickup date<input required type="date" min={todayInColombo()} value={leg.pickup_date} onChange={(event) => handleLegChange(index, 'pickup_date', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" />{fieldErrors[`legs.${index}.pickup_date`] && <span className="mt-1 block text-red-700">{fieldErrors[`legs.${index}.pickup_date`]}</span>}</label>
              <label className="text-[10px] font-bold text-slate-500">Pickup time<input required type="time" value={leg.pickup_time} onChange={(event) => handleLegChange(index, 'pickup_time', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" />{fieldErrors[`legs.${index}.pickup_time`] && <span className="mt-1 block text-red-700">{fieldErrors[`legs.${index}.pickup_time`]}</span>}</label>
              {formData.service_type === 'airport_transfer' && (
                <input maxLength={20} value={leg.flight_number} onChange={(event) => handleLegChange(index, 'flight_number', event.target.value)} placeholder="Flight number (optional)" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              )}
              {formData.legs.length > 2 && <button type="button" onClick={() => setFormData({ ...formData, legs: formData.legs.filter((_, legIndex) => legIndex !== index) })} className="justify-self-start text-xs font-bold text-red-600">Remove this leg</button>}
            </fieldset>
          ))}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="booking-pickup-location" className="block font-bold text-slate-700 uppercase mb-1">Pickup Location</label>
              <input type="text" id="booking-pickup-location" name="pickup_location" required maxLength={200} value={formData.pickup_location} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. BIA Airport / Colombo" aria-invalid={Boolean(fieldErrors.pickup_location)} />
              {fieldErrors.pickup_location && <p className="mt-1 text-xs text-red-700">{fieldErrors.pickup_location}</p>}
            </div>
            <div>
              <label htmlFor="booking-dropoff-location" className="block font-bold text-slate-700 uppercase mb-1">Dropoff Location</label>
              <input type="text" id="booking-dropoff-location" name="dropoff_location" required maxLength={200} value={formData.dropoff_location} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. Kandy / Mirissa" aria-invalid={Boolean(fieldErrors.dropoff_location)} />
              {fieldErrors.dropoff_location && <p className="mt-1 text-xs text-red-700">{fieldErrors.dropoff_location}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="font-bold text-slate-700 uppercase">Pickup Date<input type="date" name="pickup_date" required min={todayInColombo()} value={formData.pickup_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />{fieldErrors.pickup_date && <span className="mt-1 block text-xs text-red-700">{fieldErrors.pickup_date}</span>}</label>
            <label className="font-bold text-slate-700 uppercase">Pickup Time<input type="time" name="pickup_time" required value={formData.pickup_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />{fieldErrors.pickup_time && <span className="mt-1 block text-xs text-red-700">{fieldErrors.pickup_time}</span>}</label>
          </div>

          {formData.journey_type === 'return' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="font-bold text-slate-700 uppercase">Return Pickup Date<input type="date" name="return_date" required min={formData.pickup_date || todayInColombo()} value={formData.return_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />{fieldErrors.return_date && <span className="mt-1 block text-xs text-red-700">{fieldErrors.return_date}</span>}</label>
              <label className="font-bold text-slate-700 uppercase">Return Pickup Time<input type="time" name="return_time" required value={formData.return_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />{fieldErrors.return_time && <span className="mt-1 block text-xs text-red-700">{fieldErrors.return_time}</span>}</label>
            </div>
          )}
          {formData.service_type === 'airport_transfer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="font-bold text-slate-700 uppercase">Flight Number (optional)<input type="text" name="flight_number" maxLength={20} value={formData.flight_number} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="font-bold text-slate-700 uppercase">Arrival Date<input type="date" name="flight_arrival_date" value={formData.flight_arrival_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
                <label className="font-bold text-slate-700 uppercase">Arrival Time<input type="time" name="flight_arrival_time" value={formData.flight_arrival_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="font-bold text-slate-700 uppercase">Passengers<input type="number" name="passengers" min="1" max={vehicleCategories.find((item) => item.code === formData.vehicle_type)?.max_passengers ?? 50} required value={formData.passengers} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
        <label className="font-bold text-slate-700 uppercase">Luggage<input type="number" name="luggage" min="0" max={vehicleCategories.find((item) => item.code === formData.vehicle_type)?.max_luggage ?? 50} value={formData.luggage} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
      </div>

      {/* Optional Promo Code Validation Box */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
        <label htmlFor="booking-promo-code" className="block font-bold text-slate-700 uppercase">
          Have a Promo Code? <span className="font-normal text-slate-400 normal-case">(Optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            id="booking-promo-code"
            value={promoInput}
            onChange={(e) => {
              setPromoInput(e.target.value.toUpperCase());
              setPromoError('');
            }}
            placeholder="e.g. WELCOME10"
            className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs font-bold uppercase text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
          />
          <button
            type="button"
            disabled={validatingPromo || !promoInput.trim()}
            onClick={() => void handleApplyPromoCode()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {validatingPromo ? 'Checking…' : 'Apply'}
          </button>
        </div>

        {promoError && (
          <p className="text-xs font-semibold text-red-700">{promoError}</p>
        )}

        {appliedPromo && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <div>
              <span className="font-black">✓ {appliedPromo.code}</span> —{' '}
              <span className="font-bold">{appliedPromo.discount_label}</span>{' '}
              <span className="text-emerald-700">({appliedPromo.title})</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAppliedPromo(null);
                setPromoInput('');
              }}
              className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="booking-notes" className="block font-bold text-slate-700 uppercase mb-1">Special Notes / Itinerary Requests</label>
        <textarea
          name="notes"
          id="booking-notes"
          rows={3}
          maxLength={900}
          value={formData.notes}
          onChange={handleChange}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
          placeholder="Flight details, special requirements, etc."
        />
        {fieldErrors.notes && <p className="mt-1 text-xs text-red-700">{fieldErrors.notes}</p>}
      </div>

      <button
        type="submit"
        disabled={loading || categoriesLoading || vehicleCategories.length === 0}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase tracking-wider rounded-2xl shadow-sm transition disabled:opacity-50"
      >
        {loading ? 'Submitting Booking...' : submitLabel}
      </button>
    </form>
  );

  // Modal එකක් ලෙස විවෘත වන විට Backdrop එකක් සමඟ පෙන්වයි
  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        {formContent}
      </div>
    );
  }

  return formContent;
}