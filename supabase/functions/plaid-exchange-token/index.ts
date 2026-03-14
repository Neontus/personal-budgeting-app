/**
 * Edge Function: plaid-exchange-token
 *
 * Exchanges a Plaid public_token for a permanent access_token,
 * stores it in linked_accounts, then fetches and stores account info.
 *
 * POST /functions/v1/plaid-exchange-token
 * Body: { public_token: string, institution_name: string, institution_id: string }
 * Auth: Supabase JWT
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET    = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV       = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_BASE_URL  = `https://${PLAID_ENV}.plaid.com`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { public_token, institution_name, institution_id } = await req.json() as {
      public_token: string;
      institution_name: string;
      institution_id: string;
    };

    // 1. Exchange public_token → access_token + item_id
    const exchangeResp = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });
    const exchangeData = await exchangeResp.json();
    if (!exchangeResp.ok) {
      return new Response(JSON.stringify({ error: exchangeData.error_message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, item_id } = exchangeData as {
      access_token: string;
      item_id: string;
    };

    // 2. Store linked account (service role to bypass RLS)
    const { data: linkedAccount, error: insertError } = await serviceSupabase
      .from('linked_accounts')
      .insert({
        user_id: user.id,
        plaid_item_id: item_id,
        plaid_access_token: access_token, // TODO: encrypt via Supabase Vault in production
        institution_name,
        institution_id,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[plaid-exchange-token] DB insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch accounts from Plaid
    const accountsResp = await fetch(`${PLAID_BASE_URL}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    });
    const accountsData = await accountsResp.json();

    if (accountsResp.ok && accountsData.accounts) {
      const accountRows = (accountsData.accounts as PlaidAccount[]).map((acc) => ({
        user_id: user.id,
        linked_account_id: linkedAccount.id,
        plaid_account_id: acc.account_id,
        name: acc.name,
        official_name: acc.official_name ?? null,
        type: acc.type,
        subtype: acc.subtype ?? null,
        mask: acc.mask ?? null,
        current_balance: acc.balances.current ?? null,
        available_balance: acc.balances.available ?? null,
        credit_limit: acc.balances.limit ?? null,
        iso_currency_code: acc.balances.iso_currency_code ?? 'USD',
      }));

      await serviceSupabase.from('accounts').upsert(accountRows, {
        onConflict: 'plaid_account_id',
      });
    }

    // 4. Trigger initial transaction sync (fire-and-forget)
    const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-transactions`;
    fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ linked_account_id: linkedAccount.id }),
    }).catch(console.error);

    return new Response(
      JSON.stringify({ success: true, linked_account_id: linkedAccount.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[plaid-exchange-token] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances: {
    current: number | null;
    available: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
}
