/**
 * Shared security utilities for Supabase Edge Functions.
 *
 * Import with a relative path, e.g.:
 *   import { requireInternalAuth, corsHeaders, securityHeaders }
 *     from '../_shared/security.ts';
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FUNCTION AUTHENTICATION
//
// Internal edge functions (sync-transactions, categorize, budget-check,
// send-notification, scheduled-reports) must never be callable by the public.
// They are invoked only by other server-side edge functions using the shared
// INTERNAL_API_SECRET environment variable.
//
// Callers pass: Authorization: Bearer <INTERNAL_API_SECRET>
// ─────────────────────────────────────────────────────────────────────────────

const INTERNAL_SECRET = Deno.env.get('INTERNAL_API_SECRET') ?? '';

/**
 * Verify the request carries the correct internal API secret.
 * Uses a constant-time comparison to prevent timing attacks.
 *
 * Returns true if authorized, false otherwise.
 */
export function isInternalRequest(req: Request): boolean {
  if (!INTERNAL_SECRET) {
    // Fail closed: if the env var is not configured, deny everything.
    // This prevents the function from being callable at all until secrets
    // are properly provisioned.
    console.error(
      '[SECURITY] INTERNAL_API_SECRET is not set. ' +
        'All internal function calls will be rejected.'
    );
    return false;
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  return timingSafeEqual(token, INTERNAL_SECRET);
}

/** Constant-time string comparison to prevent timing side-channels. */
function timingSafeEqual(a: string, b: string): boolean {
  // Length check must not short-circuit — XOR all bytes regardless.
  const lenA = a.length;
  const lenB = b.length;
  let result = lenA === lenB ? 0 : 1; // mismatch flag if lengths differ

  // Compare up to the longer string's length using the shorter as a base
  const maxLen = Math.max(lenA, lenB);
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i % lenA) ^ b.charCodeAt(i % lenB));
  }
  return result === 0;
}

/** Standard unauthorized response for internal endpoints. */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...securityHeaders },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS
//
// CORS only applies to browser requests — not to native mobile requests.
// For the web version of the app, restrict the allowed origin to the configured
// domain rather than using the wildcard *.
//
// Set ALLOWED_ORIGIN in your Supabase project's Edge Function secrets:
//   e.g. https://yourapp.com  or  http://localhost:8081 for local dev.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';

/**
 * Build CORS headers scoped to the configured allowed origin.
 * Falls back to localhost:8081 for local development if ALLOWED_ORIGIN is unset.
 *
 * Pass the incoming request's Origin header so we can echo it back only when
 * it matches, rather than echoing arbitrary values.
 */
export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  if (!ALLOWED_ORIGIN) {
    console.warn(
      '[SECURITY] ALLOWED_ORIGIN is not set. ' +
        'Defaulting to http://localhost:8081 — set this env var in production.'
    );
  }
  const allowed = ALLOWED_ORIGIN || 'http://localhost:8081';

  // Only echo the request's origin if it matches the allowed value.
  // Otherwise, return the configured allowed origin (which won't match
  // the attacker's site and the browser will block the response).
  const responseOrigin =
    requestOrigin === allowed ? requestOrigin : allowed;

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY RESPONSE HEADERS
//
// Applied to every response from every edge function.
// ─────────────────────────────────────────────────────────────────────────────

export const securityHeaders: Record<string, string> = {
  // Prevent MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Deny framing (clickjacking)
  'X-Frame-Options': 'DENY',
  // Don't send the full URL as Referer to third parties
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permit only HTTPS for 1 year (edge functions are always HTTPS)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAID WEBHOOK SIGNATURE VERIFICATION
//
// Plaid signs every webhook with a JWT in the Plaid-Verification header.
// The JWT contains a SHA-256 hash of the raw request body, which we verify
// to prove both (a) Plaid sent the request and (b) the body wasn't tampered.
//
// Reference: https://plaid.com/docs/api/webhooks/webhook-verification/
// ─────────────────────────────────────────────────────────────────────────────

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? '';
const PLAID_SECRET    = Deno.env.get('PLAID_SECRET') ?? '';
// Do NOT default PLAID_ENV to 'sandbox' — a missing env var in production
// would silently skip signature verification.  An empty string will NOT
// match the 'sandbox' guard below, so verification will run by default.
const PLAID_ENV       = Deno.env.get('PLAID_ENV') ?? '';
const PLAID_BASE_URL  = `https://${PLAID_ENV || 'sandbox'}.plaid.com`;

// Cache fetched verification keys for their TTL (Plaid rotates them periodically)
const keyCache = new Map<string, { key: JsonWebKey; expiresAt: number }>();

/**
 * Verify a Plaid webhook request.
 *
 * - In sandbox, Plaid does not sign webhooks, so verification is skipped.
 * - In development/production, a full cryptographic check is performed:
 *   1. JWT from the Plaid-Verification header is decoded.
 *   2. The signing key is fetched from Plaid (with in-memory caching).
 *   3. The JWT signature is verified with the RSA-SHA256 public key.
 *   4. The JWT's iat (issued-at) must be within 5 minutes.
 *   5. The JWT's request_body_sha256 must match the actual body hash.
 *
 * Returns true if verification passes, false if it fails.
 */
export async function verifyPlaidWebhook(
  req: Request,
  rawBody: string
): Promise<boolean> {
  if (PLAID_ENV === 'sandbox') {
    // Sandbox webhooks are not signed by Plaid.
    console.warn(
      '[plaid-webhook] SANDBOX MODE: Skipping signature verification. ' +
        'Enable verification before moving to production.'
    );
    return true;
  }

  const verificationJwt = req.headers.get('Plaid-Verification');
  if (!verificationJwt) {
    console.error('[plaid-webhook] Missing Plaid-Verification header');
    return false;
  }

  try {
    const parts = verificationJwt.split('.');
    if (parts.length !== 3) {
      console.error('[plaid-webhook] Malformed JWT in Plaid-Verification header');
      return false;
    }
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    // Decode JWT header + payload
    const header  = jsonFromBase64Url(headerB64)  as { kid?: string; alg?: string };
    const payload = jsonFromBase64Url(payloadB64) as {
      iat?: number;
      request_body_sha256?: string;
    };

    if (!header.kid) {
      console.error('[plaid-webhook] JWT header missing kid');
      return false;
    }
    if (header.alg !== 'RS256') {
      console.error('[plaid-webhook] Unexpected JWT alg:', header.alg);
      return false;
    }

    // ── 1. Check JWT freshness (5-minute window) ──────────────────────────
    const now = Math.floor(Date.now() / 1000);
    if (!payload.iat || Math.abs(now - payload.iat) > 300) {
      console.error('[plaid-webhook] JWT is stale or has no iat claim');
      return false;
    }

    // ── 2. Fetch / cache the Plaid verification key ───────────────────────
    const publicKey = await getPlaidVerificationKey(header.kid);
    if (!publicKey) {
      console.error('[plaid-webhook] Could not obtain Plaid verification key');
      return false;
    }

    // ── 3. Verify the JWT signature ───────────────────────────────────────
    const dataToVerify  = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);
    const isValidSig = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      dataToVerify
    );
    if (!isValidSig) {
      console.error('[plaid-webhook] JWT signature verification failed');
      return false;
    }

    // ── 4. Verify the body hash ───────────────────────────────────────────
    if (!payload.request_body_sha256) {
      console.error('[plaid-webhook] JWT missing request_body_sha256 claim');
      return false;
    }
    const bodyBytes      = new TextEncoder().encode(rawBody);
    const bodyHashBuffer = await crypto.subtle.digest('SHA-256', bodyBytes);
    const bodyHash       = hexEncode(new Uint8Array(bodyHashBuffer));

    if (bodyHash !== payload.request_body_sha256) {
      console.error('[plaid-webhook] Body hash mismatch — possible tampering');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[plaid-webhook] Verification threw an error:', err);
    return false;
  }
}

/** Fetch and cache a Plaid webhook verification key by key ID. */
async function getPlaidVerificationKey(kid: string): Promise<CryptoKey | null> {
  const now = Date.now();
  const cached = keyCache.get(kid);
  if (cached && cached.expiresAt > now) {
    return await importRsaKey(cached.key);
  }

  const resp = await fetch(`${PLAID_BASE_URL}/webhook_verification_key/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      key_id: kid,
    }),
  });

  if (!resp.ok) {
    console.error('[plaid-webhook] Failed to fetch verification key:', resp.status);
    return null;
  }

  const data = await resp.json() as {
    key: JsonWebKey & { expired_at: number | null };
  };
  const { key } = data;

  // Cache for 1 hour unless the key is already expired
  // key.expired_at is a Unix timestamp in seconds; Date.now() is milliseconds.
  const ttl    = key.expired_at ? Math.max(0, key.expired_at * 1000 - now) : 3_600_000;
  const jwk: JsonWebKey = { kty: key.kty, n: key.n, e: key.e, use: key.use, alg: key.alg };
  keyCache.set(kid, { key: jwk, expiresAt: now + ttl });

  return await importRsaKey(jwk);
}

async function importRsaKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function jsonFromBase64Url(b64url: string): unknown {
  const json = atob(b64url.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

function base64UrlDecode(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only if the value is a non-empty string in UUID v4 format. */
export function isValidUUID(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
