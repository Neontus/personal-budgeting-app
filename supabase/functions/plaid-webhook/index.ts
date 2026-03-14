/**
 * Edge Function: plaid-webhook
 *
 * Receives and verifies Plaid webhooks, then dispatches to the appropriate
 * handler (sync-transactions, budget-check, etc.)
 *
 * POST /functions/v1/plaid-webhook
 * No auth header — verified via Plaid JWT signature
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET    = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV       = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_BASE_URL  = `https://${PLAID_ENV}.plaid.com`;
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const payload = JSON.parse(body) as PlaidWebhookPayload;

  console.log(`[plaid-webhook] ${payload.webhook_type}/${payload.webhook_code}`, {
    item_id: payload.item_id,
  });

  // TODO: Verify Plaid webhook JWT signature using the plaid-webhooks-verification library
  // For now, we trust the payload in sandbox. In production, verify the
  // Plaid-Verification header before processing.

  const serviceSupabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Look up the linked account by Plaid item_id
  const { data: linkedAccount } = await serviceSupabase
    .from('linked_accounts')
    .select('id, user_id')
    .eq('plaid_item_id', payload.item_id)
    .single();

  if (!linkedAccount) {
    console.warn('[plaid-webhook] Unknown item_id:', payload.item_id);
    return new Response('OK', { status: 200 }); // Always return 200 to Plaid
  }

  // Handle different webhook types
  switch (payload.webhook_type) {
    case 'TRANSACTIONS': {
      if (
        payload.webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        payload.webhook_code === 'DEFAULT_UPDATE' ||
        payload.webhook_code === 'INITIAL_UPDATE' ||
        payload.webhook_code === 'HISTORICAL_UPDATE'
      ) {
        // Trigger sync-transactions (fire-and-forget)
        fetch(`${SUPABASE_URL}/functions/v1/sync-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ linked_account_id: linkedAccount.id }),
        }).catch(console.error);
      }
      break;
    }

    case 'ITEM': {
      if (payload.webhook_code === 'ERROR') {
        // Update linked account status to 'error'
        await serviceSupabase
          .from('linked_accounts')
          .update({ status: 'error', error_code: payload.error?.error_code })
          .eq('id', linkedAccount.id);

        // TODO Phase 5: Send notification to re-link account
      }
      if (payload.webhook_code === 'PENDING_EXPIRATION') {
        await serviceSupabase
          .from('linked_accounts')
          .update({ consent_expires_at: payload.consent_expiration_time })
          .eq('id', linkedAccount.id);
      }
      break;
    }

    default:
      console.log('[plaid-webhook] Unhandled webhook:', payload.webhook_type, payload.webhook_code);
  }

  return new Response('OK', { status: 200 });
});

interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  consent_expiration_time?: string;
  error?: { error_code: string; error_message: string };
}
