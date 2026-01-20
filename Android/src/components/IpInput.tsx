/**
 * IP address input component.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function IpInput({ value, onChange, disabled }: Props) {
  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <Text style={styles.label}>PC Server IP</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="192.168.1.100"
        placeholderTextColor="#666666"
        keyboardType="numeric"
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>Enter the IP shown in the PC receiver</Text>
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
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: '#333344',
  },
  hint: {
    color: '#666666',
    fontSize: 12,
    marginTop: 8,
  },
});
