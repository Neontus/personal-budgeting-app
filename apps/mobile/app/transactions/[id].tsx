import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// TODO Phase 2: Fetch transaction by id via useTransaction(id) hook
// TODO Phase 4: Implement category picker for recategorization
// TODO Phase 4: Add notes text input with save
// TODO Phase 4: On recategorize: upsert category_rules for merchant

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.placeholder}>Transaction {id}</Text>
      <Text style={styles.subtitle}>Detail view — coming in Phase 2</Text>

      {/* Category Row */}
      <View style={styles.section}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.categoryPicker}>
          <Text style={styles.categoryText}>Uncategorized</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <Text style={styles.notesPlaceholder}>Add a note...</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  content: {
    padding: 20,
  },
  placeholder: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8A8A9A',
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9A',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  categoryPicker: {
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  notesPlaceholder: {
    color: '#4A4A5A',
    fontSize: 15,
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
});
