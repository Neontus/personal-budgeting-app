import { View, Text, StyleSheet } from 'react-native';

// TODO Phase 1: Implement full login screen with Supabase Auth
// - Email/password form
// - Google OAuth button
// - Apple Sign In button
// - Link to signup and forgot-password

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budget Tracker</Text>
      <Text style={styles.subtitle}>Login screen — coming in Phase 1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A9A',
  },
});
