import { createServiceClient } from '@/lib/server/service-client';

export type GuestEndpoint =
  | 'guest_tracker'
  | 'guest_quote_accept'
  | 'guest_driver_invitation'
  | 'guest_driver_link'
  | 'guest_tracker_issue'
  | 'booking_submit'
  | 'guest_documents'
  | 'guest_token_validation';

type Policy = { tokenLimit: number; ipLimit: number; windowSeconds: number };

// Per-token limits stop token guessing/abuse regardless of source IP; the
// larger per-IP limit stops spraying many tokens from one client.
const POLICIES: Record<GuestEndpoint, Policy> = {
  guest_tracker: { tokenLimit: 60, ipLimit: 240, windowSeconds: 300 },
  guest_quote_accept: { tokenLimit: 10, ipLimit: 40, windowSeconds: 300 },
  guest_driver_invitation: { tokenLimit: 40, ipLimit: 160, windowSeconds: 300 },
  guest_driver_link: { tokenLimit: 10, ipLimit: 40, windowSeconds: 300 },
  guest_tracker_issue: { tokenLimit: 10, ipLimit: 40, windowSeconds: 300 },
  booking_submit: { tokenLimit: 10, ipLimit: 40, windowSeconds: 300 },
  guest_documents: { tokenLimit: 60, ipLimit: 240, windowSeconds: 300 },
  guest_token_validation: { tokenLimit: 30, ipLimit: 120, windowSeconds: 300 },
};

export function clientAddress(request: Request) {
  const forwarded = process.env.TRUST_CLOUDFLARE_CLIENT_IP === 'true'
    ? request.headers.get('cf-connecting-ip') ?? ''
    : '';
  return forwarded.trim().slice(0, 64) || 'unknown';
}

async function digest(parts: string[]) {
  const secret = process.env.RATE_LIMIT_SECRET ?? '';
  const data = new TextEncoder().encode([secret, ...parts].join('\u0000'));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return `\\x${Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function tokenDigestKey(token: unknown) {
  return typeof token === 'string' ? token.toLowerCase().slice(0, 128) : 'none';
}

function limited(retryAfter: number) {
  return Response.json(
    { success: false, error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
  );
}

/**
 * Returns a 429/503 Response when the request must not proceed, otherwise null.
 * Fails closed: if the persistent counter is unavailable the sensitive route is
 * refused rather than left unprotected.
 */
export async function enforceGuestRateLimit(
  request: Request,
  endpoint: GuestEndpoint,
  token: unknown
): Promise<Response | null> {
  const policy = POLICIES[endpoint];
  const client = createServiceClient();
  // An unkeyed digest would let anyone precompute bucket hashes of known tokens.
  if (!client || (process.env.RATE_LIMIT_SECRET ?? '').length < 16) {
    console.error('Guest rate limiting is not configured.');
    return Response.json(
      { success: false, error: 'This service is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const checks = [
    { key: await digest([endpoint, 'ip', clientAddress(request)]), limit: policy.ipLimit },
    { key: await digest([endpoint, 'token', tokenDigestKey(token)]), limit: policy.tokenLimit },
  ];
  for (const check of checks) {
    const { data, error } = await client.rpc('check_rate_limit', {
      p_bucket_hash: check.key,
      p_limit: check.limit,
      p_window_seconds: policy.windowSeconds,
    });
    if (error || !Array.isArray(data) || data.length !== 1) {
      console.error('Guest rate limit check failed.', error?.code);
      return Response.json(
        { success: false, error: 'This service is temporarily unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const row: unknown = data[0];
    if (typeof row !== 'object' || row === null
      || !('allowed' in row) || typeof row.allowed !== 'boolean'
      || !('retry_after_seconds' in row) || typeof row.retry_after_seconds !== 'number'
      || !Number.isInteger(row.retry_after_seconds) || row.retry_after_seconds < 1) {
      console.error('Guest rate limit check returned an invalid response.');
      return Response.json(
        { success: false, error: 'This service is temporarily unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!row.allowed) return limited(row.retry_after_seconds);
  }
  return null;
}
