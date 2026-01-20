/**
 * Transmission interval slider component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { MIN_INTERVAL_MS, MAX_INTERVAL_MS } from '../constants/ble';

interface Props {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function IntervalSlider({ value, onChange, disabled }: Props) {
  const formatInterval = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>Transmission Interval</Text>
        <Text style={styles.value}>{formatInterval(value)}</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={MIN_INTERVAL_MS}
        maximumValue={MAX_INTERVAL_MS}
        step={100}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        minimumTrackTintColor="#4488ff"
        maximumTrackTintColor="#333344"
        thumbTintColor="#4488ff"
      />

      <View style={styles.labels}>
        <Text style={styles.boundLabel}>{formatInterval(MIN_INTERVAL_MS)}</Text>
        <Text style={styles.boundLabel}>{formatInterval(MAX_INTERVAL_MS)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    color: '#4488ff',
    fontSize: 16,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  boundLabel: {
    color: '#666666',
    fontSize: 12,
  },
});
