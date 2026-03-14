/**
 * Edge Function: scheduled-reports
 *
 * Generates weekly and monthly spending reports for all users and sends
 * them as notifications.
 *
 * Triggered by Supabase pg_cron:
 *   - Weekly:  every Monday at 8am UTC
 *   - Monthly: 1st of each month at 8am UTC
 *
 * POST /functions/v1/scheduled-reports
 * Body: { report_type: 'weekly' | 'monthly' }
 * Auth: Service role
 *
 * TODO Phase 4: Set up pg_cron schedules in Supabase dashboard:
 *   SELECT cron.schedule('weekly-report',  '0 8 * * 1', $$SELECT net.http_post(...)$$);
 *   SELECT cron.schedule('monthly-report', '0 8 1 * *', $$SELECT net.http_post(...)$$);
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { report_type } = await req.json() as { report_type: 'weekly' | 'monthly' };
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Compute date range
  const today = new Date();
  let startDate: string;
  let endDate: string;
  let reportLabel: string;

  if (report_type === 'weekly') {
    const end = new Date(today);
    end.setDate(today.getDate() - 1); // yesterday
    const start = new Date(end);
    start.setDate(end.getDate() - 6); // 7 days ago
    startDate = toDate(start);
    endDate = toDate(end);
    reportLabel = 'Weekly';
  } else {
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    startDate = toDate(prevMonth);
    endDate = toDate(prevMonthEnd);
    reportLabel = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  // Fetch all user IDs with notification preferences for this report type
  const eventType = report_type === 'weekly' ? 'weekly_report' : 'monthly_report';
  const { data: prefRows } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .eq('event_type', eventType)
    .or('push_enabled.eq.true,telegram_enabled.eq.true,in_app_enabled.eq.true');

  const userIds = (prefRows ?? []).map((r: { user_id: string }) => r.user_id);

  let dispatched = 0;

  for (const user_id of userIds) {
    // Get total spending for the period
    const { data: totalData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user_id)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('pending', false)
      .gt('amount', 0);

    const total = ((totalData ?? []) as { amount: number }[]).reduce(
      (sum, t) => sum + t.amount,
      0
    );

    if (total === 0) continue; // Skip users with no activity

    // Dispatch report notification
    fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id,
        type: eventType,
        title: `📊 Your ${reportLabel} Report`,
        body: `You spent $${total.toFixed(2)} ${report_type === 'weekly' ? 'this week' : `in ${reportLabel}`}. Tap to see the breakdown.`,
        data: { report_type, start_date: startDate, end_date: endDate, total },
      }),
    }).catch(console.error);

    dispatched++;
  }

  console.log(`[scheduled-reports] Dispatched ${dispatched} ${report_type} reports`);

  return new Response(
    JSON.stringify({ report_type, dispatched }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

function toDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}
