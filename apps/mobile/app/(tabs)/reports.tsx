import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

type Period = 'weekly' | 'monthly';

// TODO Phase 4: Wire up useReports hook
// TODO Phase 4: Render spending-by-category donut chart (victory-native)
// TODO Phase 4: Render monthly trend bar chart
// TODO Phase 4: Period comparison (vs last period)

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('monthly');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Reports</Text>

        {/* Period Toggle */}
        <View style={styles.toggle}>
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[styles.toggleText, period === p && styles.toggleTextActive]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Spending by Category Placeholder */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>Donut chart — Phase 4</Text>
          </View>
        </View>

        {/* Monthly Trends Placeholder */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Trends</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>Bar chart — Phase 4</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#00C896',
  },
  toggleText: {
    color: '#8A8A9A',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#000000',
  },
  card: {
    backgroundColor: '#16161F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F14',
    borderRadius: 10,
  },
  placeholderText: {
    color: '#4A4A5A',
    fontSize: 14,
  },
});
