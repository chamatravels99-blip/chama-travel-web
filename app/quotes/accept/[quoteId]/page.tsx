import type { Metadata } from 'next';
import { GuestQuoteAcceptance } from './guest-quote-acceptance';

export const metadata: Metadata = {
  title: 'Review & Confirm Your Chama Travels Quotation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function AcceptQuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  return <GuestQuoteAcceptance quoteId={quoteId} />;
}
