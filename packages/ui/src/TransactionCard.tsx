import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@budget-tracker/shared';
import type { Transaction } from '@budget-tracker/shared';
import { Colors } from './theme/colors';
import { Radius, Spacing } from './theme/spacing';
import { FontSize, FontWeight } from './theme/typography';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  showDate?: boolean;
}

export function TransactionCard({
  transaction,
  onPress,
  showDate = true,
}: TransactionCardProps) {
  const isCredit = transaction.amount < 0;
  const displayName = transaction.merchant_name ?? transaction.name;
  const category = transaction.category;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(transaction)}
      activeOpacity={0.7}
    >
      {/* Category Icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: (category?.color ?? Colors.categories.uncategorized) + '22' },
        ]}
      >
        <Ionicons
          name={(category?.icon as React.ComponentProps<typeof Ionicons>['name']) ?? 'help-circle-outline'}
          size={20}
          color={category?.color ?? Colors.categories.uncategorized}
        />
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.meta}>
          {category?.name ?? 'Uncategorized'}
          {showDate ? ` · ${formatDate(transaction.date, 'short')}` : ''}
          {transaction.pending ? ' · Pending' : ''}
        </Text>
      </View>

      {/* Amount */}
      <Text style={[styles.amount, isCredit && styles.amountCredit]}>
        {isCredit ? '+' : '-'}
        {formatCurrency(transaction.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    backgroundColor: Colors.dark.background.secondary,
    borderRadius: Radius.lg,
    marginBottom: Spacing['2'],
    borderWidth: 1,
    borderColor: Colors.dark.border.subtle,
    gap: Spacing['3'],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.dark.text.primary,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.dark.text.secondary,
  },
  amount: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.dark.text.primary,
    flexShrink: 0,
  },
  amountCredit: {
    color: Colors.brand.green,
  },
});
