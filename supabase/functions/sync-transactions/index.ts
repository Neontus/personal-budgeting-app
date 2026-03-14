/**
 * Edge Function: sync-transactions
 *
 * Pulls new/updated/removed transactions from Plaid using the cursor-based
 * /transactions/sync endpoint. Upserts them to the DB, then triggers
 * categorization and budget checks.
 *
 * POST /functions/v1/sync-transactions
 * Body: { linked_account_id: string }
 * Auth: Service role (called internally by plaid-webhook or plaid-exchange-token)
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

  const { linked_account_id } = await req.json() as { linked_account_id: string };
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch linked account (includes access token + cursor)
  const { data: linkedAccount, error: fetchError } = await supabase
    .from('linked_accounts')
    .select('*, accounts(*)')
    .eq('id', linked_account_id)
    .single();

  if (fetchError || !linkedAccount) {
    return new Response(JSON.stringify({ error: 'Linked account not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = linkedAccount.user_id;
  const accessToken = linkedAccount.plaid_access_token;
  let cursor: string | null = linkedAccount.cursor ?? null;

  // Build a map from plaid_account_id → our DB account.id
  const accountMap = new Map<string, string>();
  for (const acc of (linkedAccount.accounts ?? []) as { plaid_account_id: string; id: string }[]) {
    accountMap.set(acc.plaid_account_id, acc.id);
  }

  const addedTransactions: PlaidTransaction[] = [];
  let hasMore = true;

  // Paginate through all updates
  while (hasMore) {
    const syncResp = await fetch(`${PLAID_BASE_URL}/transactions/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
        cursor: cursor ?? undefined,
        count: 500,
      }),
    });

    const syncData = await syncResp.json();
    if (!syncResp.ok) {
      console.error('[sync-transactions] Plaid sync error:', syncData);
      break;
    }

    const { added, modified, removed, next_cursor, has_more } = syncData as PlaidSyncResponse;
    addedTransactions.push(...added, ...modified);
    cursor = next_cursor;
    hasMore = has_more;

    // Handle removed transactions
    if (removed.length > 0) {
      const removedIds = removed.map((r) => r.transaction_id);
      await supabase.from('transactions').delete().in('plaid_transaction_id', removedIds);
    }
  }

  // Save new cursor
  await supabase
    .from('linked_accounts')
    .update({ cursor, last_synced_at: new Date().toISOString() })
    .eq('id', linked_account_id);

  if (addedTransactions.length === 0) {
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Upsert transactions (will trigger categorization via next step)
  const transactionRows = addedTransactions
    .filter((t) => accountMap.has(t.account_id)) // only transactions for known accounts
    .map((t) => ({
      user_id: userId,
      account_id: accountMap.get(t.account_id)!,
      plaid_transaction_id: t.transaction_id,
      amount: t.amount,
      merchant_name: t.merchant_name ?? null,
      name: t.name,
      plaid_category: t.personal_finance_category
        ? [t.personal_finance_category.primary, t.personal_finance_category.detailed]
        : null,
      pending: t.pending,
      date: t.date,
      authorized_date: t.authorized_date ?? null,
    }));

  const { data: upsertedRows, error: upsertError } = await supabase
    .from('transactions')
    .upsert(transactionRows, { onConflict: 'plaid_transaction_id' })
    .select('id');

  if (upsertError) {
    console.error('[sync-transactions] Upsert error:', upsertError);
    return new Response(JSON.stringify({ error: 'DB upsert failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Trigger categorize + budget-check (fire-and-forget)
  const transactionIds = (upsertedRows ?? []).map((r: { id: string }) => r.id);

  fetch(`${SUPABASE_URL}/functions/v1/categorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ user_id: userId, transaction_ids: transactionIds }),
  }).catch(console.error);

  console.log(`[sync-transactions] Synced ${transactionIds.length} transactions for user ${userId}`);

  return new Response(
    JSON.stringify({ synced: transactionIds.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  date: string;
  authorized_date?: string | null;
  personal_finance_category?: { primary: string; detailed: string } | null;
}

interface PlaidSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
}
