export type GuestQuoteLinkState = 'active' | 'expired' | 'revoked' | 'accepted' | 'unavailable';

export type GuestQuoteLinkDetails = {
  has_guest_acceptance_link: boolean;
  quote_status: string;
  expires_at: string | null;
  token_expires_at: string | null;
  token_consumed_at: string | null;
  token_revoked_at: string | null;
};

export function getGuestQuoteLinkState(
  quote: GuestQuoteLinkDetails,
  now = Date.now()
): GuestQuoteLinkState {
  if (quote.quote_status === 'accepted' || Boolean(quote.token_consumed_at)) {
    return 'accepted';
  }
  if (quote.token_revoked_at) return 'revoked';
  if (!quote.has_guest_acceptance_link) return 'unavailable';
  if (quote.quote_status === 'expired') return 'expired';
  if (quote.quote_status !== 'sent' || !quote.expires_at || !quote.token_expires_at) {
    return 'unavailable';
  }

  const quoteExpiry = Date.parse(quote.expires_at);
  const tokenExpiry = Date.parse(quote.token_expires_at);
  if (!Number.isFinite(quoteExpiry) || !Number.isFinite(tokenExpiry)) return 'unavailable';
  return quoteExpiry <= now || tokenExpiry <= now ? 'expired' : 'active';
}
