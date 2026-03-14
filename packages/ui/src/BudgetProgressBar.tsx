import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency, formatPercent, getBudgetStatus, describePeriodReset } from '@budget-tracker/shared';
import type { BudgetWithProgress } from '@budget-tracker/shared';
import { Colors } from './theme/colors';
import { Radius, Spacing } from './theme/spacing';
import { FontSize, FontWeight } from './theme/typography';

interface BudgetProgressBarProps {
  budget: BudgetWithProgress;
  compact?: boolean;
}

export function BudgetProgressBar({ budget, compact = false }: BudgetProgressBarProps) {
  const spent = budget.current_period?.spent ?? 0;
  const { color } = getBudgetStatus(budget.percent_used);
  const clampedPercent = Math.min(budget.percent_used, 100);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {budget.category && (
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: budget.category.color ?? Colors.brand.green },
              ]}
            />
          )}
          <Text style={styles.categoryName} numberOfLines={1}>
            {budget.category?.name ?? 'Overall'}
          </Text>
        </View>
        <Text style={[styles.percentLabel, { color }]}>
          {formatPercent(budget.percent_used)}
        </Text>
      </View>

      {/* Progress track */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${clampedPercent}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>

      {/* Amounts row */}
      <View style={styles.amounts}>
        <Text style={styles.spentLabel}>
          <Text style={{ color: Colors.dark.text.primary }}>{formatCurrency(spent)}</Text>
          {' spent'}
        </Text>
        <Text style={styles.limitLabel}>
          of {formatCurrency(budget.amount)}
        </Text>
      </View>

      {/* Period label */}
      {!compact && (
        <Text style={styles.periodLabel}>
          {describePeriodReset(budget.period_type, budget.period_anchor)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.background.secondary,
    borderRadius: Radius.lg,
    padding: Spacing['4'],
    borderWidth: 1,
    borderColor: Colors.dark.border.subtle,
    gap: Spacing['2'],
  },
  containerCompact: {
    padding: Spacing['3'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.dark.text.primary,
    flex: 1,
  },
  percentLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  track: {
    height: 6,
    backgroundColor: Colors.dark.background.tertiary,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  amounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spentLabel: {
    fontSize: FontSize.sm,
    color: Colors.dark.text.secondary,
  },
  limitLabel: {
    fontSize: FontSize.sm,
    color: Colors.dark.text.muted,
  },
  periodLabel: {
    fontSize: FontSize.xs,
    color: Colors.dark.text.muted,
  },
});
