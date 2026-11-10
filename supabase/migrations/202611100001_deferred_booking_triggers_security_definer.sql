-- Deferred constraint triggers fire at COMMIT, after create_booking() has returned,
-- so they run as the API caller (anon/authenticated) rather than the function owner.
-- Those roles have no table privileges on public.bookings, which raised
-- "permission denied for table bookings". Run these read-only consistency checks
-- as their owner; they stay non-executable by API roles.
alter function private.assert_booking_leg_shape() security definer;
alter function private.assert_booking_assignment_state() security definer;
alter function private.assert_booking_quote_state() security definer;
