'use client';

import { useEffect, useState } from 'react';

type DriverDetails = {
  driver_name: string;
  driver_phone: string | null;
  vehicle_name: string;
  vehicle_type: string;
  registration_number: string | null;
};

export default function AssignedDriver({ bookingId }: { bookingId: string }) {
  const [driver, setDriver] = useState<DriverDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/customer/bookings/driver?booking_id=${encodeURIComponent(bookingId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json() as { success?: boolean; data?: DriverDetails | null; error?: string };
        if (!response.ok || !result.success) throw new Error(result.error || 'Driver details could not be loaded.');
        setDriver(result.data ?? null);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Driver details could not be loaded.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [bookingId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <h3 className="font-bold text-slate-900">Your driver</h3>
      {loading ? <p className="mt-2">Loading driver details…</p> : error ? (
        <p role="alert" className="mt-2 text-rose-700">{error}</p>
      ) : driver ? (
        <div className="mt-2 space-y-1">
          <p>{driver.driver_name}</p>
          {driver.driver_phone && <p><a className="text-blue-700 underline" href={`tel:${driver.driver_phone}`}>{driver.driver_phone}</a></p>}
          <p>{driver.vehicle_name} · {driver.vehicle_type}</p>
          {driver.registration_number && <p>Registration: {driver.registration_number}</p>}
        </div>
      ) : <p className="mt-2">Your driver is being arranged. Driver details will be available once the driver confirms the assignment.</p>}
    </section>
  );
}
