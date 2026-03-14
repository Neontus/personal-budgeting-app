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
 * Auth: Service role
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Plaid primary category → system category name mapping
const PLAID_TO_SYSTEM: Record<string, string> = {
  FOOD_AND_DRINK:             'Food & Dining',
  GENERAL_MERCHANDISE:        'Shopping',
  CLOTHING_AND_ACCESSORIES:   'Shopping',
  TRANSPORTATION:             'Transportation',
  ENTERTAINMENT:              'Entertainment',
  SUBSCRIPTION:               'Subscriptions',
  MEDICAL:                    'Health & Medical',
  PERSONAL_CARE:              'Health & Medical',
  RENT_AND_UTILITIES:         'Housing',
  HOME_IMPROVEMENT:           'Housing',
  TRAVEL:                     'Travel',
  EDUCATION:                  'Education',
  INCOME:                     'Income',
  TRANSFER_IN:                'Transfers',
  TRANSFER_OUT:               'Transfers',
  LOAN_PAYMENTS:              'Transfers',
  BANK_FEES:                  'Fees & Charges',
  OTHER_PAYMENT:              'Fees & Charges',
};

// Plaid detailed subcategory overrides
const PLAID_DETAILED_TO_SYSTEM: Record<string, string> = {
  'FOOD_AND_DRINK_GROCERIES': 'Groceries',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { user_id, transaction_ids } = await req.json() as {
    user_id: string;
    transaction_ids: string[];
  };

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch the transactions to categorize
  const { data: transactions, error: fetchError } = await supabase
    .from('transactions')
    .select('id, merchant_name, name, plaid_category, auto_categorized')
    .in('id', transaction_ids)
    .eq('user_id', user_id);

  if (fetchError || !transactions) {
    return new Response(JSON.stringify({ error: 'Failed to fetch transactions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only categorize transactions that haven't been manually set
  const toCateg = transactions.filter((t) => t.auto_categorized !== false);
  if (toCateg.length === 0) {
    return new Response(JSON.stringify({ categorized: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch system categories (id lookup by name)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_system', true);

  const categoryByName = new Map<string, string>();
  for (const cat of (categories ?? []) as { id: string; name: string }[]) {
    categoryByName.set(cat.name, cat.id);
  }

  // Fetch user category rules
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

  const updates: { id: string; category_id: string; auto_categorized: boolean }[] = [];

  for (const txn of toCateg) {
    let categoryId: string | null = null;

    // Tier 1: User rules (case-insensitive merchant_name match)
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

      // Check detailed subcategory first (more specific)
      const detailedKey = `${primary}_${detailed?.split(':').pop()}`;
      const detailedMatch = PLAID_DETAILED_TO_SYSTEM[detailedKey];
      if (detailedMatch) {
        categoryId = categoryByName.get(detailedMatch) ?? null;
      }

      // Fall back to primary category
      if (!categoryId) {
        const primaryMatch = PLAID_TO_SYSTEM[primary];
        if (primaryMatch) {
          categoryId = categoryByName.get(primaryMatch) ?? null;
        }
      }
    }

    // Tier 3: Fallback to Uncategorized
    if (!categoryId) {
      categoryId = categoryByName.get('Uncategorized') ?? null;
    }

    if (categoryId) {
      updates.push({ id: txn.id, category_id: categoryId, auto_categorized: true });
    }
  }

  // Batch update categories
  if (updates.length > 0) {
    for (const update of updates) {
      await supabase
        .from('transactions')
        .update({ category_id: update.category_id, auto_categorized: update.auto_categorized })
        .eq('id', update.id);
    }
  }

  // Trigger budget check
  if (updates.length > 0) {
    fetch(`${SUPABASE_URL}/functions/v1/budget-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ user_id }),
    }).catch(console.error);
  }

  console.log(`[categorize] Categorized ${updates.length} transactions for user ${user_id}`);

  return new Response(
    JSON.stringify({ categorized: updates.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
