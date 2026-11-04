import type { Metadata } from 'next';
import BookingForm from '@/components/BookingForm';

export const metadata: Metadata = {
  title: 'Book a Transfer',
  description:
    'Request an airport transfer, private vehicle or Sri Lanka tour with Chama Travels.',
};

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <BookingForm />
      </div>
    </main>
  );
}