import type { Metadata } from 'next';
import GuestBookingTracker from './GuestBookingTracker';

export const metadata: Metadata = {
  title: 'Booking tracker | Chama Travels',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function GuestBookingTrackerPage() {
  return <GuestBookingTracker />;
}
