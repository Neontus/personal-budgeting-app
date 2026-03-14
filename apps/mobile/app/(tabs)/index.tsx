import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

// TODO Phase 2: Wire up real data with useTransactions + useAccounts hooks
// TODO Phase 3: Add budget summary cards with BudgetProgressBar
// TODO Phase 3: Add in-app notification bell with unread badge

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.netWorthLabel}>Total Spending This Month</Text>
            <Text style={styles.netWorthValue}>$0.00</Text>
          </View>
        </View>

        {/* Budget Summary Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budgets</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No budgets yet</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/budgets')}>
              <Text style={styles.emptyAction}>Create your first budget →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/transactions/')}>
              <Text style={styles.sectionAction}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <TouchableOpacity onPress={() => router.push('/link-account')}>
              <Text style={styles.emptyAction}>Link a card to get started →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: '#8A8A9A',
    marginBottom: 4,
  },
  netWorthLabel: {
    fontSize: 14,
    color: '#8A8A9A',
    marginBottom: 4,
  },
  netWorthValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionAction: {
    fontSize: 14,
    color: '#00C896',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#16161F',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  emptyText: {
    color: '#8A8A9A',
    fontSize: 15,
    marginBottom: 8,
  },
  emptyAction: {
    color: '#00C896',
    fontSize: 14,
    fontWeight: '600',
  },
});
