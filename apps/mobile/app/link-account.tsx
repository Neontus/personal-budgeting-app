import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

// TODO Phase 2: Implement full Plaid Link flow
// 1. Call plaid-link-token edge function to get link token
// 2. Open PlaidLink component from react-native-plaid-link-sdk
// 3. On success: call plaid-exchange-token edge function with public_token
// 4. On success: invalidate useAccounts query and close modal

export default function LinkAccountScreen() {
  const [loading, setLoading] = useState(false);

  const handleLinkPress = async () => {
    setLoading(true);
    // TODO Phase 2: Implement Plaid Link
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="card" size={48} color="#00C896" />
        </View>

        <Text style={styles.title}>Link a Card or Account</Text>
        <Text style={styles.subtitle}>
          Securely connect your bank accounts and credit cards via Plaid.
          Your credentials are never stored — only a secure access token.
        </Text>

        <View style={styles.featureList}>
          {[
            'Real-time transaction sync',
            'Automatic spending categorization',
            'Budget tracking per account',
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#00C896" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLinkPress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.buttonText}>Connect Account</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Powered by Plaid. Your data is encrypted and never sold.
        </Text>
      </View>
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#16161F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  featureList: {
    alignSelf: 'stretch',
    marginBottom: 40,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#00C896',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 17,
  },
  disclaimer: {
    fontSize: 12,
    color: '#4A4A5A',
    textAlign: 'center',
  },
});
