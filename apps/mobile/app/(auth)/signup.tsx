import { View, Text, StyleSheet } from 'react-native';

// TODO Phase 1: Implement signup screen
// - Display name, email, password fields
// - Supabase signUp call
// - Auto-redirect on success

export default function SignupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Signup screen — coming in Phase 1</Text>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A9A',
  },
});
