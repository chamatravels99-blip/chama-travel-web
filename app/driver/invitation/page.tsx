import type { Metadata } from 'next';
import DriverInvitation from './DriverInvitation';

export const metadata: Metadata = {
  title: 'Driver invitation | Chama Travels',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function DriverInvitationPage() {
  return <DriverInvitation />;
}
