// @ts-nocheck
import { SpringButton } from '../../components/SpringButton';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
} from 'react-native';
import { ArrowLeft, Cpu, Layers, Compass, Calendar, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useOrionStore } from '../../store/useOrionStore';
import { Colors } from '../../theme/colors';
import { ApertureLogo } from '../../components/ApertureLogo';

export default function ProfileScreen() {
  const router = useRouter();
  const { settings, updateSetting, portraitName } = useOrionStore();

  const toggleSetting = (key: keyof typeof settings, val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    updateSetting(key, !val);
  };

  const handleBack = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.porcelain} />

      {/* Header */}
      <View style={styles.header}>
        <SpringButton onPress={handleBack} style={styles.iconBtn}>
          <ArrowLeft size={20} color={Colors.obsidian} />
        </SpringButton>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ApertureLogo size={20} animated={false} />
          <Text style={styles.headerTitle}>Executive Identity & Senses</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Executive Badge */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>W</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{portraitName}</Text>
            <Text style={styles.userRole}>AI Chief of Staff • Version 1.0</Text>
          </View>
        </View>

        {/* Unified Settings Group */}
        <Text style={styles.sectionTitle}>SYSTEM PREFERENCES</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>"Hey Orion" Wake Word</Text>
              <Text style={styles.settingDesc}>Continuous background detection</Text>
            </View>
            <Switch
              value={settings.voiceWake}
              onValueChange={(v) => toggleSetting('voiceWake', settings.voiceWake)}
              trackColor={{ false: Colors.borderMedium, true: Colors.textPrimary }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Urgent Interrupts</Text>
              <Text style={styles.settingDesc}>Allow zooming in on high-priority alerts</Text>
            </View>
            <Switch
              value={settings.urgentInterrupts}
              onValueChange={(v) => toggleSetting('urgentInterrupts', settings.urgentInterrupts)}
              trackColor={{ false: Colors.borderMedium, true: Colors.textPrimary }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Auto-Resolve Conflicts</Text>
              <Text style={styles.settingDesc}>Automatically shift overlapping meetings</Text>
            </View>
            <Switch
              value={settings.autoReschedule}
              onValueChange={(v) => toggleSetting('autoReschedule', settings.autoReschedule)}
              trackColor={{ false: Colors.borderMedium, true: Colors.textPrimary }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Tactile Haptics</Text>
              <Text style={styles.settingDesc}>Snap feedback for UI elements</Text>
            </View>
            <Switch
              value={settings.hapticFeedback}
              onValueChange={(v) => toggleSetting('hapticFeedback', settings.hapticFeedback)}
              trackColor={{ false: Colors.borderMedium, true: Colors.textPrimary }}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>ACTIVE INTEGRATIONS</Text>
        <View style={styles.settingsGroup}>
          <SpringButton
            style={styles.integrationRow}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/intelligence' as any);
            }}
          >
            <View style={styles.integrationLeft}>
              <Cpu size={18} color={Colors.textPrimary} />
              <Text style={styles.integrationName}>Intelligence Gateway</Text>
            </View>
            <Text style={styles.connectedStatus}>Active</Text>
          </SpringButton>
          <View style={styles.divider} />
          <SpringButton style={styles.integrationRow}>
            <View style={styles.integrationLeft}>
              <Calendar size={18} color={Colors.textPrimary} />
              <Text style={styles.integrationName}>Google Calendar</Text>
            </View>
            <Text style={styles.connectedStatus}>Active</Text>
          </SpringButton>
          <View style={styles.divider} />
          <SpringButton style={styles.integrationRow}>
            <View style={styles.integrationLeft}>
              <Search size={18} color={Colors.textPrimary} />
              <Text style={styles.integrationName}>Metaphor Context Engine</Text>
            </View>
            <Text style={styles.connectedStatus}>Active</Text>
          </SpringButton>
          <View style={styles.divider} />
          <SpringButton style={styles.integrationRow}>
            <View style={styles.integrationLeft}>
              <Compass size={18} color={Colors.textPrimary} />
              <Text style={styles.integrationName}>Atlas Strategy</Text>
            </View>
            <Text style={styles.connectedStatus}>Active</Text>
          </SpringButton>
        </View>

        {/* Spacer to guarantee the dock never covers content */}
        <View style={{ height: 160 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.porcelain,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlaceholder: {
    width: 36,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.porcelainCard,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userRole: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  settingsGroup: {
    backgroundColor: Colors.porcelainCard,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.porcelainSubtle, // very subtle border instead of harsh shadow
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.porcelainSubtle,
  },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  integrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  integrationName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  connectedStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
