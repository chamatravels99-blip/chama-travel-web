'use client';

import { useCallback, useEffect, useState } from 'react';
import { SERVICE_TYPES, todayInColombo } from '@/lib/constants';
import { X } from 'lucide-react';

interface BookingFormProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

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

export default function BookingForm({ isOpen = true, onClose, onSuccess }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service_type: 'airport_transfer',
    journey_type: 'one_way',
    vehicle_type: 'sedan',
    pickup_location: '',
    dropoff_location: '',
    pickup_date: '',
    pickup_time: '',
    return_date: '',
    return_time: '',
    end_date: '',
    end_time: '',
    flight_number: '',
    flight_arrival_date: '',
    flight_arrival_time: '',
    passengers: 1,
    luggage: 0,
    currency: 'LKR',
    notes: '',
    legs: [emptyLeg(), emptyLeg()],
  });
  const [idempotencyKey, setIdempotencyKey] = useState('');

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
          : result.data?.[0]?.code ?? '',
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLegChange = (index: number, field: keyof ItineraryLegForm, value: string) => {
    setFormData({
      ...formData,
      legs: formData.legs.map((leg, legIndex) => legIndex === index ? { ...leg, [field]: value } : leg),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = vehicleCategories.find((item) => item.code === formData.vehicle_type);
    if (!category || Number(formData.passengers) > category.max_passengers ||
        Number(formData.luggage) > category.max_luggage) {
      setMessage({ type: 'error', text: 'Choose a vehicle category that can accommodate your passengers and luggage.' });
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      const requestKey = idempotencyKey || crypto.randomUUID();
      setIdempotencyKey(requestKey);
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          legs: formData.journey_type === 'multi_leg' ? formData.legs : undefined,
          idempotency_key: requestKey,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Booking එක යැවීමේදී දෝෂයක් සිදු විය.');
      }

      setMessage({ type: 'success', text: 'ඔබගේ booking ඉල්ලීම ලැබුණා. ඔබගේ quote එක සූදානම් වූ විට දැනුම් දෙන්නෙමු.' });
      setIdempotencyKey('');
      
      // Form එක Reset කිරීම
      setFormData({
        name: '',
        email: '',
        phone: '',
        service_type: 'airport_transfer',
        journey_type: 'one_way',
        vehicle_type: 'sedan',
        pickup_location: '',
        dropoff_location: '',
        pickup_date: '',
        pickup_time: '',
        return_date: '',
        return_time: '',
        end_date: '',
        end_time: '',
        flight_number: '',
        flight_arrival_date: '',
        flight_arrival_time: '',
        passengers: 1,
        luggage: 0,
        currency: 'LKR',
        notes: '',
        legs: [emptyLeg(), emptyLeg()],
      });

      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Booking එක යැවීමේදී දෝෂයක් සිදු විය. නැවත උත්සාහ කරන්න.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="max-w-2xl w-full mx-auto p-6 bg-white rounded-3xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto relative text-xs">
      
      {/* Close button (Modal එකක් ලෙස පාවිච්චි කරන විට පෙන්වයි) */}
      {onClose && (
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      )}

      <h2 className="text-xl font-black text-slate-900 text-center mb-4">Book Your Ride - Chama Travels</h2>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

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
          />
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
          />
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
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="booking-service-type" className="block font-bold text-slate-700 uppercase mb-1">Service Type</label>
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
          <label htmlFor="booking-vehicle-type" className="block font-bold text-slate-700 uppercase mb-1">Vehicle Type</label>
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
              <p className="text-[11px] text-slate-500">Each leg needs a pickup, destination and expected end time.</p>
            </div>
            <button type="button" disabled={formData.legs.length >= 8} onClick={() => setFormData({ ...formData, legs: [...formData.legs, emptyLeg()] })} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold disabled:opacity-50">Add leg</button>
          </div>
          {formData.legs.map((leg, index) => (
            <fieldset key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-xs font-bold text-slate-600">Leg {index + 1}</legend>
              <input required maxLength={200} value={leg.pickup_location} onChange={(event) => handleLegChange(index, 'pickup_location', event.target.value)} placeholder="Pickup location" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              <input required maxLength={200} value={leg.dropoff_location} onChange={(event) => handleLegChange(index, 'dropoff_location', event.target.value)} placeholder="Drop-off location" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              <label className="text-[10px] font-bold text-slate-500">Pickup date<input required type="date" min={todayInColombo()} value={leg.pickup_date} onChange={(event) => handleLegChange(index, 'pickup_date', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" /></label>
              <label className="text-[10px] font-bold text-slate-500">Pickup time<input required type="time" value={leg.pickup_time} onChange={(event) => handleLegChange(index, 'pickup_time', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" /></label>
              <label className="text-[10px] font-bold text-slate-500">Expected end date<input required type="date" min={leg.pickup_date || todayInColombo()} value={leg.end_date} onChange={(event) => handleLegChange(index, 'end_date', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" /></label>
              <label className="text-[10px] font-bold text-slate-500">Expected end time<input required type="time" value={leg.end_time} onChange={(event) => handleLegChange(index, 'end_time', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800" /></label>
              <input maxLength={20} value={leg.flight_number} onChange={(event) => handleLegChange(index, 'flight_number', event.target.value)} placeholder="Flight number (optional)" className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" />
              {formData.legs.length > 2 && <button type="button" onClick={() => setFormData({ ...formData, legs: formData.legs.filter((_, legIndex) => legIndex !== index) })} className="justify-self-start text-xs font-bold text-red-600">Remove this leg</button>}
            </fieldset>
          ))}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="booking-pickup-location" className="block font-bold text-slate-700 uppercase mb-1">Pickup Location</label>
              <input type="text" id="booking-pickup-location" name="pickup_location" required maxLength={200} value={formData.pickup_location} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. BIA Airport / Colombo" />
            </div>
            <div>
              <label htmlFor="booking-dropoff-location" className="block font-bold text-slate-700 uppercase mb-1">Dropoff Location</label>
              <input type="text" id="booking-dropoff-location" name="dropoff_location" required maxLength={200} value={formData.dropoff_location} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. Kandy / Mirissa" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="font-bold text-slate-700 uppercase">Pickup Date<input type="date" name="pickup_date" required min={todayInColombo()} value={formData.pickup_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
            <label className="font-bold text-slate-700 uppercase">Pickup Time<input type="time" name="pickup_time" required value={formData.pickup_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
          </div>

          {formData.journey_type === 'return' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="font-bold text-slate-700 uppercase">Return Pickup Date<input type="date" name="return_date" required min={formData.pickup_date || todayInColombo()} value={formData.return_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
              <label className="font-bold text-slate-700 uppercase">Return Pickup Time<input type="time" name="return_time" required value={formData.return_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="font-bold text-slate-700 uppercase">Expected Trip End Date<input type="date" name="end_date" required min={formData.pickup_date || todayInColombo()} value={formData.end_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
            <label className="font-bold text-slate-700 uppercase">Expected Trip End Time<input type="time" name="end_time" required value={formData.end_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="font-bold text-slate-700 uppercase">Flight Number (optional)<input type="text" name="flight_number" maxLength={20} value={formData.flight_number} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="font-bold text-slate-700 uppercase">Arrival Date<input type="date" name="flight_arrival_date" value={formData.flight_arrival_date} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
              <label className="font-bold text-slate-700 uppercase">Arrival Time<input type="time" name="flight_arrival_time" value={formData.flight_arrival_time} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="font-bold text-slate-700 uppercase">Passengers<input type="number" name="passengers" min="1" max="14" required value={formData.passengers} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
        <label className="font-bold text-slate-700 uppercase">Luggage<input type="number" name="luggage" min="0" max="14" value={formData.luggage} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800" /></label>
      </div>

      <div>
        <label htmlFor="booking-notes" className="block font-bold text-slate-700 uppercase mb-1">Additional Notes</label>
        <textarea
          name="notes"
          id="booking-notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
          placeholder="Flight details, special requirements, etc."
        />
      </div>

      <button
        type="submit"
        disabled={loading || categoriesLoading || vehicleCategories.length === 0}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase tracking-wider rounded-2xl shadow-sm transition disabled:opacity-50"
      >
        {loading ? 'Submitting Booking...' : 'Confirm Booking'}
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