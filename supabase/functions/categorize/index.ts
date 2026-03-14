/**
 * Edge Function: categorize
 *
 * Auto-categorizes transactions using a 3-tier approach:
 * 1. User-defined category_rules (merchant pattern match) — highest priority
 * 2. Plaid personal_finance_category mapping
 * 3. Fallback: "Uncategorized"
 *
 * POST /functions/v1/categorize
 * Body: { user_id: string, transaction_ids: string[] }
 * Auth: INTERNAL_API_SECRET — must NOT be called directly from the client.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  isInternalRequest,
  isValidUUID,
  unauthorizedResponse,
  securityHeaders,
} from '../_shared/security.ts';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_API_SECRET')!;

const PLAID_TO_SYSTEM: Record<string, string> = {
  FOOD_AND_DRINK:           'Food & Dining',
  GENERAL_MERCHANDISE:      'Shopping',
  CLOTHING_AND_ACCESSORIES: 'Shopping',
  TRANSPORTATION:           'Transportation',
  ENTERTAINMENT:            'Entertainment',
  SUBSCRIPTION:             'Subscriptions',
  MEDICAL:                  'Health & Medical',
  PERSONAL_CARE:            'Health & Medical',
  RENT_AND_UTILITIES:       'Housing',
  HOME_IMPROVEMENT:         'Housing',
  TRAVEL:                   'Travel',
  EDUCATION:                'Education',
  INCOME:                   'Income',
  TRANSFER_IN:              'Transfers',
  TRANSFER_OUT:             'Transfers',
  LOAN_PAYMENTS:            'Transfers',
  BANK_FEES:                'Fees & Charges',
  OTHER_PAYMENT:            'Fees & Charges',
};

const PLAID_DETAILED_TO_SYSTEM: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: 'Groceries',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: securityHeaders });
  }

  // ── Internal auth guard ───────────────────────────────────────────────────
  if (!isInternalRequest(req)) {
    console.error('[categorize] SECURITY: Rejected unauthorized request');
    return unauthorizedResponse();
  }
  // ─────────────────────────────────────────────────────────────────────────

  const body = await req.json() as { user_id: unknown; transaction_ids: unknown };
  if (!isValidUUID(body.user_id)) {
    return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }
  if (
    !Array.isArray(body.transaction_ids) ||
    body.transaction_ids.length === 0 ||
    !body.transaction_ids.every(isValidUUID)
  ) {
    return new Response(JSON.stringify({ error: 'Invalid transaction_ids' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }
  const user_id        = body.user_id;
  const transaction_ids: string[] = body.transaction_ids;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: transactions, error: fetchError } = await supabase
    .from('transactions')
    .select('id, merchant_name, name, plaid_category, auto_categorized')
    .in('id', transaction_ids)
    .eq('user_id', user_id);  // double-check ownership even though service role

  if (fetchError || !transactions) {
    return new Response(JSON.stringify({ error: 'Failed to fetch' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }

  const toCateg = transactions.filter((t) => t.auto_categorized !== false);
  if (toCateg.length === 0) {
    return new Response(JSON.stringify({ categorized: 0 }), {
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_system', true);

  const categoryByName = new Map<string, string>();
  for (const cat of (categories ?? []) as { id: string; name: string }[]) {
    categoryByName.set(cat.name, cat.id);
  }

  const { data: rules } = await supabase
    .from('category_rules')
    .select('merchant_pattern, category_id, priority')
    .eq('user_id', user_id)
    .order('priority', { ascending: false });

  const userRules = (rules ?? []) as {
    merchant_pattern: string;
    category_id: string;
    priority: number;
  }[];

  const updates: { id: string; category_id: string }[] = [];

  for (const txn of toCateg) {
    let categoryId: string | null = null;

    // Tier 1: User rules
    if (txn.merchant_name) {
      for (const rule of userRules) {
        if (txn.merchant_name.toLowerCase().includes(rule.merchant_pattern.toLowerCase())) {
          categoryId = rule.category_id;
          break;
        }
      }
    }

    // Tier 2: Plaid category mapping
    if (!categoryId && txn.plaid_category) {
      const [primary, detailed] = txn.plaid_category as [string, string];
      const detailedKey   = `${primary}_${detailed?.split(':').pop()}`;
      const detailedMatch = PLAID_DETAILED_TO_SYSTEM[detailedKey];
      if (detailedMatch) categoryId = categoryByName.get(detailedMatch) ?? null;
      if (!categoryId) {
        const primaryMatch = PLAID_TO_SYSTEM[primary];
        if (primaryMatch) categoryId = categoryByName.get(primaryMatch) ?? null;
      }
    }

    // Tier 3: Fallback
    if (!categoryId) categoryId = categoryByName.get('Uncategorized') ?? null;

    if (categoryId) updates.push({ id: txn.id, category_id: categoryId });
  }

  for (const update of updates) {
    await supabase
      .from('transactions')
      .update({ category_id: update.category_id, auto_categorized: true })
      .eq('id', update.id);
  }

  if (updates.length > 0) {
    fetch(`${SUPABASE_URL}/functions/v1/budget-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify({ user_id }),
    }).catch(console.error);
  }

  console.log(`[categorize] Categorized ${updates.length} transactions`);

  return new Response(
    JSON.stringify({ categorized: updates.length }),
    { headers: { 'Content-Type': 'application/json', ...securityHeaders } }
  );
});
