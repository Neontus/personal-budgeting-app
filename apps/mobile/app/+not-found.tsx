import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>This screen doesn&apos;t exist.</Text>
        <Link href="/(tabs)/" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 18,
    color: '#8A8A9A',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#00C896',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  buttonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});
