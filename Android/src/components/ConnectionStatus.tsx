/**
 * Connection status indicator component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ConnectionState } from '../services/BleService';

interface Props {
  state: ConnectionState;
  deviceName?: string | null;
}

const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: '#ff4444',
  scanning: '#ffaa00',
  connecting: '#ffaa00',
  connected: '#44ff44',
};

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  scanning: 'Scanning...',
  connecting: 'Connecting...',
  connected: 'Connected',
};

export function ConnectionStatus({ state, deviceName }: Props) {
  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: STATE_COLORS[state] }]} />
      <View style={styles.textContainer}>
        <Text style={styles.statusText}>{STATE_LABELS[state]}</Text>
        {deviceName && state === 'connected' && (
          <Text style={styles.deviceText}>{deviceName}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 16,
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceText: {
    color: '#888888',
    fontSize: 14,
    marginTop: 2,
  },
});
