/**
 * Edge Function: budget-check
 *
 * Recalculates spending for all active budgets for a user,
 * checks against alert thresholds, and dispatches notifications
 * for any newly crossed thresholds.
 *
 * POST /functions/v1/budget-check
 * Body: { user_id: string }
 * Auth: Service role
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { user_id } = await req.json() as { user_id: string };
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch all active budgets for this user
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('*, category:categories(name)')
    .eq('user_id', user_id)
    .eq('is_active', true);

  if (error || !budgets || budgets.length === 0) {
    return new Response(JSON.stringify({ checked: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const alertsToSend: NotificationPayload[] = [];

  for (const budget of budgets as BudgetRow[]) {
    const { start, end } = getPeriodBounds(budget, today);

    // Recalculate spent via DB function
    const { data: spentResult } = await supabase.rpc('recalculate_budget_spent', {
      p_budget_id: budget.id,
      p_period_start: start,
      p_period_end: end,
    });
    const spent = (spentResult as number) ?? 0;
    const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    // Fetch current period's alerted_at map
    const { data: period } = await supabase
      .from('budget_periods')
      .select('alerted_at')
      .eq('budget_id', budget.id)
      .eq('period_start', start)
      .single();

    const alertedAt: Record<string, string | null> = (period?.alerted_at as Record<string, string | null>) ?? {};

    // Check each threshold
    for (const threshold of budget.alert_thresholds) {
      const key = String(threshold);
      if (percentUsed >= threshold && !alertedAt[key]) {
        // Threshold crossed and not yet alerted
        alertsToSend.push({
          user_id,
          budget_id: budget.id,
          category_name: budget.category?.name ?? 'Overall',
          threshold,
          percent_used: Math.round(percentUsed),
          spent,
          limit: budget.amount,
        });

        // Mark this threshold as alerted
        alertedAt[key] = new Date().toISOString();
      }
    }

    // Update alerted_at in budget_periods
    if (Object.keys(alertedAt).length > 0) {
      await supabase
        .from('budget_periods')
        .update({ alerted_at: alertedAt })
        .eq('budget_id', budget.id)
        .eq('period_start', start);
    }
  }

  // Dispatch notifications
  for (const alert of alertsToSend) {
    fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: alert.user_id,
        type: 'budget_alert',
        title: alert.threshold >= 100
          ? `⚠️ ${alert.category_name} budget exceeded`
          : `🟡 ${alert.category_name} budget ${alert.threshold}% used`,
        body: `You've spent $${alert.spent.toFixed(2)} of your $${alert.limit.toFixed(2)} ${alert.category_name} budget (${alert.percent_used}%).`,
        data: { budget_id: alert.budget_id, threshold: alert.threshold },
      }),
    }).catch(console.error);
  }

  console.log(`[budget-check] Sent ${alertsToSend.length} alerts for user ${user_id}`);

  return new Response(
    JSON.stringify({ checked: budgets.length, alerts_sent: alertsToSend.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPeriodBounds(budget: BudgetRow, today: string): { start: string; end: string } {
  const date = new Date(today + 'T00:00:00');
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const anchor = budget.period_anchor ?? 1;

  if (budget.period_type === 'weekly') {
    const dayOfWeek = date.getDay();
    const diff = (dayOfWeek - anchor + 7) % 7;
    const start = new Date(date);
    start.setDate(d - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toDate(start), end: toDate(end) };
  }

  if (budget.period_type === 'monthly') {
    if (d >= anchor) {
      return {
        start: toDate(new Date(y, m, anchor)),
        end: toDate(new Date(y, m + 1, anchor - 1)),
      };
    }
    return {
      start: toDate(new Date(y, m - 1, anchor)),
      end: toDate(new Date(y, m, anchor - 1)),
    };
  }

  if (budget.period_type === 'statement_cycle') {
    if (d <= anchor) {
      return {
        start: toDate(new Date(y, m - 1, anchor + 1)),
        end: toDate(new Date(y, m, anchor)),
      };
    }
    return {
      start: toDate(new Date(y, m, anchor + 1)),
      end: toDate(new Date(y, m + 1, anchor)),
    };
  }

  return {
    start: toDate(new Date(y, m, 1)),
    end: toDate(new Date(y, m + 1, 0)),
  };
}

function toDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  category: { name: string } | null;
  amount: number;
  period_type: string;
  period_anchor: number | null;
  account_id: string | null;
  alert_thresholds: number[];
}

interface NotificationPayload {
  user_id: string;
  budget_id: string;
  category_name: string;
  threshold: number;
  percent_used: number;
  spent: number;
  limit: number;
}
