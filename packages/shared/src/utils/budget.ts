import type { Budget, BudgetPeriod, BudgetWithProgress, ISODateString } from '../types';

/**
 * Given a budget and today's date, compute the start and end of the current
 * budget period.
 */
export function getCurrentPeriod(
  budget: Budget,
  today: Date = new Date()
): { start: ISODateString; end: ISODateString } {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const d = today.getDate();

  if (budget.period_type === 'weekly') {
    // period_anchor: 0=Sunday, 1=Monday, ... 6=Saturday
    const anchor = budget.period_anchor ?? 1; // default Monday
    const dayOfWeek = today.getDay();
    const diff = (dayOfWeek - anchor + 7) % 7;
    const start = new Date(today);
    start.setDate(d - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }

  if (budget.period_type === 'monthly') {
    // period_anchor: day of month the budget resets (default: 1)
    const anchor = budget.period_anchor ?? 1;
    let start: Date;
    let end: Date;

    if (d >= anchor) {
      start = new Date(y, m, anchor);
      end = new Date(y, m + 1, anchor - 1);
    } else {
      start = new Date(y, m - 1, anchor);
      end = new Date(y, m, anchor - 1);
    }
    return { start: toISODate(start), end: toISODate(end) };
  }

  if (budget.period_type === 'statement_cycle') {
    // period_anchor: statement close date (day of month)
    const anchor = budget.period_anchor ?? 1;
    let start: Date;
    let end: Date;

    if (d <= anchor) {
      // We're in the current statement period (previous month close to this month's close)
      start = new Date(y, m - 1, anchor + 1);
      end = new Date(y, m, anchor);
    } else {
      start = new Date(y, m, anchor + 1);
      end = new Date(y, m + 1, anchor);
    }
    return { start: toISODate(start), end: toISODate(end) };
  }

  // Fallback: current calendar month
  return {
    start: toISODate(new Date(y, m, 1)),
    end: toISODate(new Date(y, m + 1, 0)),
  };
}

/**
 * Merge a budget with its current period to produce a BudgetWithProgress.
 */
export function toBudgetWithProgress(
  budget: Budget,
  currentPeriod: BudgetPeriod | null
): BudgetWithProgress {
  const spent = currentPeriod?.spent ?? 0;
  const percent_used = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

  return {
    ...budget,
    current_period: currentPeriod,
    percent_used: Math.round(percent_used * 10) / 10,
  };
}

/**
 * Given a percent_used value, return a status label and color.
 */
export function getBudgetStatus(percentUsed: number): {
  label: 'good' | 'warning' | 'danger';
  color: string;
} {
  if (percentUsed >= 100) return { label: 'danger', color: '#FF4D4D' };
  if (percentUsed >= 80) return { label: 'warning', color: '#FFAA00' };
  return { label: 'good', color: '#00C896' };
}

function toISODate(date: Date): ISODateString {
  return date.toISOString().split('T')[0]!;
}
