import type { ISODateString } from '../types';

/**
 * Format an ISO date string for display.
 * e.g. "2026-03-14" → "Mar 14"  or  "March 14, 2026"
 */
export function formatDate(
  isoDate: ISODateString,
  style: 'short' | 'long' | 'relative' = 'short'
): string {
  const date = new Date(isoDate + 'T00:00:00'); // Force local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (style === 'relative') {
    const diffMs = date.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  }

  if (style === 'long') {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // short
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/**
 * Get a human-readable description of a budget period reset.
 * e.g. "Resets every Monday" or "Resets on the 1st of each month"
 */
export function describePeriodReset(periodType: string, anchor: number | null): string {
  if (periodType === 'weekly') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Resets every ${days[anchor ?? 1] ?? 'Monday'}`;
  }
  if (periodType === 'monthly') {
    return `Resets on the ${ordinal(anchor ?? 1)} of each month`;
  }
  if (periodType === 'statement_cycle') {
    return `Based on statement closing on the ${ordinal(anchor ?? 1)}`;
  }
  return '';
}
