/**
 * Format a numeric amount as a currency string.
 * Positive values = expenses (shown as negative by convention in budget apps).
 * Negative values = credits/refunds (shown as positive green).
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  options?: { showSign?: boolean; compact?: boolean }
): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: options?.compact ? 'compact' : 'standard',
    maximumFractionDigits: options?.compact ? 1 : 2,
  }).format(absAmount);

  if (options?.showSign) {
    return amount < 0 ? `+${formatted}` : `-${formatted}`;
  }

  return formatted;
}

/**
 * Format a budget progress percentage.
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}
