import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// TODO Phase 3: Wire up useBudgets hook
// TODO Phase 3: Implement BudgetProgressBar component
// TODO Phase 3: Add create/edit budget modal
// TODO Phase 3: Handle weekly / monthly / statement_cycle periods

export default function BudgetsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Budgets</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color="#00C896" />
          </TouchableOpacity>
        </View>

        {/* Empty state */}
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={64} color="#2A2A3A" />
          <Text style={styles.emptyTitle}>No budgets yet</Text>
          <Text style={styles.emptySubtitle}>
            Set spending limits by category or overall to stay on track.
          </Text>
          <TouchableOpacity style={styles.createButton}>
            <Text style={styles.createButtonText}>Create Budget</Text>
          </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16161F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8A8A9A',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 22,
  },
  createButton: {
    marginTop: 8,
    backgroundColor: '#00C896',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});
