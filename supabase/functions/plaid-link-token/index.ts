/**
 * Edge Function: plaid-link-token
 *
 * Creates a Plaid link_token for the authenticated user.
 * The client uses this token to open the Plaid Link UI.
 *
 * POST /functions/v1/plaid-link-token
 * Auth: Supabase JWT (user must be authenticated)
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the user via Supabase JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Plaid /link/token/create
    const plaidResponse = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: 'Budget Tracker',
        user: { client_user_id: user.id },
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        webhook: Deno.env.get('PLAID_WEBHOOK_URL'),
      }),
    });

    const plaidData = await plaidResponse.json();

    if (!plaidResponse.ok) {
      console.error('[plaid-link-token] Plaid error:', plaidData);
      return new Response(
        JSON.stringify({ error: plaidData.error_message ?? 'Plaid error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ link_token: plaidData.link_token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[plaid-link-token] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
