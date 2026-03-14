import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// TODO Phase 1: Wire up auth (sign out)
// TODO Phase 2: Show linked accounts, add/remove accounts via Plaid Link
// TODO Phase 3: Notification preferences per event type
// TODO Phase 5: Telegram bot linking flow (deep link + chat ID storage)

function SettingsRow({
  icon,
  label,
  onPress,
  rightElement,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={destructive ? '#FF4D4D' : '#8A8A9A'} />
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
      </View>
      {rightElement ?? <Ionicons name="chevron-forward" size={18} color="#4A4A5A" />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Accounts */}
        <Text style={styles.sectionLabel}>ACCOUNTS</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="card-outline"
            label="Linked Accounts"
            onPress={() => router.push('/link-account')}
          />
          <View style={styles.separator} />
          <SettingsRow icon="person-outline" label="Profile" />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="notifications-outline"
            label="Push Notifications"
            rightElement={<Switch value={true} onValueChange={() => {}} trackColor={{ true: '#00C896' }} />}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="logo-telegram"
            label="Link Telegram"
            onPress={() => {
              // TODO Phase 5: Open Telegram deep link for bot linking
            }}
          />
          <View style={styles.separator} />
          <SettingsRow icon="alert-circle-outline" label="Alert Preferences" />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.group}>
          <SettingsRow icon="moon-outline" label="Dark Mode" rightElement={<Switch value={true} onValueChange={() => {}} trackColor={{ true: '#00C896' }} />} />
          <View style={styles.separator} />
          <SettingsRow icon="globe-outline" label="Currency" rightElement={<Text style={styles.rowValue}>USD</Text>} />
        </View>

        {/* App */}
        <Text style={styles.sectionLabel}>APP</Text>
        <View style={styles.group}>
          <SettingsRow icon="information-circle-outline" label="About" />
          <View style={styles.separator} />
          <SettingsRow icon="log-out-outline" label="Sign Out" destructive onPress={() => {
            // TODO Phase 1: supabase.auth.signOut()
          }} />
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
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A4A5A',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  group: {
    backgroundColor: '#16161F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  rowLabelDestructive: {
    color: '#FF4D4D',
  },
  rowValue: {
    fontSize: 15,
    color: '#8A8A9A',
  },
  separator: {
    height: 1,
    backgroundColor: '#2A2A3A',
    marginLeft: 48,
  },
});
