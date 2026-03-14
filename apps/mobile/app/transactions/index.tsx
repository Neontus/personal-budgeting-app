import { View, Text, StyleSheet, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// TODO Phase 2: Wire up useTransactions hook with search/filter params
// TODO Phase 2: Implement TransactionCard component from @budget-tracker/ui
// TODO Phase 2: Add category filter chips
// TODO Phase 4: Add date range picker

export default function TransactionListScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#8A8A9A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor="#4A4A5A"
        />
      </View>

      <FlatList
        data={[]}
        keyExtractor={(item) => String(item)}
        renderItem={() => null}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color="#2A2A3A" />
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptySubtitle}>
              Link a card to start tracking your spending.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161F',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 12,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  empty: {
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
});
