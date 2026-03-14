/**
 * Edge Function: budget-check
 *
 * Recalculates spending for all active budgets for a user,
 * checks against alert thresholds, and dispatches notifications
 * for any newly crossed thresholds.
 *
 * POST /functions/v1/budget-check
 * Body: { user_id: string }
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: securityHeaders });
  }

  // ── Internal auth guard ───────────────────────────────────────────────────
  if (!isInternalRequest(req)) {
    console.error('[budget-check] SECURITY: Rejected unauthorized request');
    return unauthorizedResponse();
  }
  // ─────────────────────────────────────────────────────────────────────────

  const body = await req.json() as { user_id: unknown };
  if (!isValidUUID(body.user_id)) {
    return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }
  const user_id = body.user_id;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('*, category:categories(name)')
    .eq('user_id', user_id)
    .eq('is_active', true);

  if (error || !budgets || budgets.length === 0) {
    return new Response(JSON.stringify({ checked: 0 }), {
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const alertsToSend: NotificationPayload[] = [];

  for (const budget of budgets as BudgetRow[]) {
    const { start, end } = getPeriodBounds(budget, today);

    const { data: spentResult } = await supabase.rpc('recalculate_budget_spent', {
      p_budget_id:    budget.id,
      p_period_start: start,
      p_period_end:   end,
    });
    const spent      = (spentResult as number) ?? 0;
    const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    const { data: period } = await supabase
      .from('budget_periods')
      .select('alerted_at')
      .eq('budget_id', budget.id)
      .eq('period_start', start)
      .single();

    const alertedAt: Record<string, string | null> =
      (period?.alerted_at as Record<string, string | null>) ?? {};

    for (const threshold of budget.alert_thresholds) {
      const key = String(threshold);
      if (percentUsed >= threshold && !alertedAt[key]) {
        alertsToSend.push({
          user_id,
          budget_id:     budget.id,
          category_name: budget.category?.name ?? 'Overall',
          threshold,
          percent_used:  Math.round(percentUsed),
          spent,
          limit:         budget.amount,
        });
        alertedAt[key] = new Date().toISOString();
      }
    }

    if (Object.keys(alertedAt).length > 0) {
      await supabase
        .from('budget_periods')
        .update({ alerted_at: alertedAt })
        .eq('budget_id', budget.id)
        .eq('period_start', start);
    }
  }

  for (const alert of alertsToSend) {
    fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify({
        user_id:  alert.user_id,
        type:     'budget_alert',
        title:    alert.threshold >= 100
          ? `⚠️ ${alert.category_name} budget exceeded`
          : `🟡 ${alert.category_name} budget ${alert.threshold}% used`,
        body:     `You've spent $${alert.spent.toFixed(2)} of your $${alert.limit.toFixed(2)} ${alert.category_name} budget (${alert.percent_used}%).`,
        data:     { budget_id: alert.budget_id, threshold: alert.threshold },
      }),
    }).catch(console.error);
  }

  console.log(`[budget-check] ${alertsToSend.length} alerts sent for user ${user_id}`);

  return new Response(
    JSON.stringify({ checked: budgets.length, alerts_sent: alertsToSend.length }),
    { headers: { 'Content-Type': 'application/json', ...securityHeaders } }
  );
});

function getPeriodBounds(budget: BudgetRow, today: string): { start: string; end: string } {
  const date   = new Date(today + 'T00:00:00');
  const y      = date.getFullYear();
  const m      = date.getMonth();
  const d      = date.getDate();
  const anchor = budget.period_anchor ?? 1;

  if (budget.period_type === 'weekly') {
    const diff  = (date.getDay() - anchor + 7) % 7;
    const start = new Date(date); start.setDate(d - diff);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return { start: toDate(start), end: toDate(end) };
  }
  if (budget.period_type === 'monthly') {
    return d >= anchor
      ? { start: toDate(new Date(y, m, anchor)),     end: toDate(new Date(y, m + 1, anchor - 1)) }
      : { start: toDate(new Date(y, m - 1, anchor)), end: toDate(new Date(y, m, anchor - 1)) };
  }
  if (budget.period_type === 'statement_cycle') {
    return d <= anchor
      ? { start: toDate(new Date(y, m - 1, anchor + 1)), end: toDate(new Date(y, m, anchor)) }
      : { start: toDate(new Date(y, m, anchor + 1)),     end: toDate(new Date(y, m + 1, anchor)) };
  }
  return { start: toDate(new Date(y, m, 1)), end: toDate(new Date(y, m + 1, 0)) };
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
