-- Preserve existing rows while rejecting non-finite times on new writes.
alter table public.booking_legs
  add constraint booking_legs_finite_times_check
  check (
    pg_catalog.isfinite(pickup_at)
    and (planned_end_at is null or pg_catalog.isfinite(planned_end_at))
    and (flight_arrival_at is null or pg_catalog.isfinite(flight_arrival_at))
  ) not valid;
