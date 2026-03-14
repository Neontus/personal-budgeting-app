/**
 * Edge Function: plaid-webhook
 *
 * Receives Plaid webhooks, verifies their cryptographic signature, then
 * dispatches to the appropriate internal handler.
 *
 * POST /functions/v1/plaid-webhook
 * Auth: Plaid JWT signature (Plaid-Verification header) — NOT a Supabase JWT.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  verifyPlaidWebhook,
  securityHeaders,
} from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_API_SECRET')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: securityHeaders,
    });
  }

  // Read the raw body FIRST — we need it for signature verification AND parsing.
  const rawBody = await req.text();

  // ── Verify Plaid webhook signature ────────────────────────────────────────
  // In sandbox: logged warning, skipped.
  // In production: full RSA-SHA256 + body-hash verification.
  const isVerified = await verifyPlaidWebhook(req, rawBody);
  if (!isVerified) {
    // Return 200 to Plaid even on failure so Plaid doesn't keep retrying a
    // request we've already identified as forged.  Log it for alerting.
    console.error('[plaid-webhook] SECURITY: Rejected unverified webhook request');
    return new Response('OK', { status: 200, headers: securityHeaders });
  }
  // ─────────────────────────────────────────────────────────────────────────

  let payload: PlaidWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PlaidWebhookPayload;
  } catch {
    console.error('[plaid-webhook] Failed to parse body as JSON');
    return new Response('OK', { status: 200, headers: securityHeaders });
  }

  console.log(`[plaid-webhook] ${payload.webhook_type}/${payload.webhook_code}`, {
    item_id: payload.item_id,
  });

  const serviceSupabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Look up the linked account by Plaid item_id
  const { data: linkedAccount } = await serviceSupabase
    .from('linked_accounts')
    .select('id, user_id')
    .eq('plaid_item_id', payload.item_id)
    .single();

  if (!linkedAccount) {
    // Unknown item_id — could be a leftover from a deleted account.
    // Always return 200 so Plaid stops retrying.
    console.warn('[plaid-webhook] Unknown item_id:', payload.item_id);
    return new Response('OK', { status: 200, headers: securityHeaders });
  }

  // Internal function calls use INTERNAL_API_SECRET, not SERVICE_KEY.
  // SERVICE_KEY must never be passed to internal HTTP calls — it would leak
  // elevated DB privileges to any function that receives it.
  const internalHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${INTERNAL_SECRET}`,
  };

  switch (payload.webhook_type) {
    case 'TRANSACTIONS': {
      if (
        payload.webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        payload.webhook_code === 'DEFAULT_UPDATE'         ||
        payload.webhook_code === 'INITIAL_UPDATE'         ||
        payload.webhook_code === 'HISTORICAL_UPDATE'
      ) {
        fetch(`${SUPABASE_URL}/functions/v1/sync-transactions`, {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({ linked_account_id: linkedAccount.id }),
        }).catch(console.error);
      }
      break;
    }

    case 'ITEM': {
      if (payload.webhook_code === 'ERROR') {
        await serviceSupabase
          .from('linked_accounts')
          .update({ status: 'error', error_code: payload.error?.error_code ?? null })
          .eq('id', linkedAccount.id);
        // TODO Phase 5: Trigger re-link notification
      }
      if (payload.webhook_code === 'PENDING_EXPIRATION') {
        await serviceSupabase
          .from('linked_accounts')
          .update({ consent_expires_at: payload.consent_expiration_time ?? null })
          .eq('id', linkedAccount.id);
      }
      break;
    }

    default:
      console.log('[plaid-webhook] Unhandled:', payload.webhook_type, payload.webhook_code);
  }

  return new Response('OK', { status: 200, headers: securityHeaders });
});

interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  consent_expiration_time?: string;
  error?: { error_code: string; error_message: string };
}
