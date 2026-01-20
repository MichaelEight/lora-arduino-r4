/**
 * Mode Selector Component - Toggle between Advertise and Scan modes
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type AppMode = 'advertise' | 'scan';

interface ModeSelectorProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.tab,
          mode === 'advertise' && styles.tabActive,
          disabled && styles.tabDisabled,
        ]}
        onPress={() => onModeChange('advertise')}
        disabled={disabled}
      >
        <Text style={[styles.tabText, mode === 'advertise' && styles.tabTextActive]}>
          Advertise GPS
        </Text>
        <Text style={styles.tabHint}>Receiver connects to phone</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          mode === 'scan' && styles.tabActive,
          disabled && styles.tabDisabled,
        ]}
        onPress={() => onModeChange('scan')}
        disabled={disabled}
      >
        <Text style={[styles.tabText, mode === 'scan' && styles.tabTextActive]}>
          Scan & Connect
        </Text>
        <Text style={styles.tabHint}>Phone connects to receiver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#4488ff',
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabHint: {
    color: '#666666',
    fontSize: 10,
    marginTop: 2,
  },
});
