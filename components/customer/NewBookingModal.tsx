'use client';

import BookingForm from '@/components/BookingForm';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewBookingModal({ isOpen, onClose }: NewBookingModalProps) {
  return (
    <BookingForm
      isOpen={isOpen}
      onClose={onClose}
      heading="Book Your Transfer"
      initialValues={{ service_type: 'custom', booking_title: 'Customer Transfer' }}
    />
  );
}
