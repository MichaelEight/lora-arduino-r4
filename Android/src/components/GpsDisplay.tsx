/**
 * GPS coordinates display component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

interface Props {
  location: Location.LocationObject | null;
  transmitting: boolean;
  transmitCount: number;
}

export function GpsDisplay({ location, transmitting, transmitCount }: Props) {
  const formatCoord = (value: number | undefined, decimals: number = 6): string => {
    return value !== undefined ? value.toFixed(decimals) : '--';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GPS Location</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Latitude:</Text>
        <Text style={styles.value}>{formatCoord(location?.coords.latitude)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Longitude:</Text>
        <Text style={styles.value}>{formatCoord(location?.coords.longitude)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Accuracy:</Text>
        <Text style={styles.value}>
          {location?.coords.accuracy ? `${location.coords.accuracy.toFixed(1)} m` : '--'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Altitude:</Text>
        <Text style={styles.value}>
          {location?.coords.altitude ? `${location.coords.altitude.toFixed(1)} m` : '--'}
        </Text>
      </View>

      {transmitting && (
        <View style={styles.transmitInfo}>
          <Text style={styles.transmitText}>Transmitting... ({transmitCount} sent)</Text>
        </View>
      )}
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
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#888888',
    fontSize: 14,
  },
  value: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  transmitInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333344',
  },
  transmitText: {
    color: '#44ff44',
    fontSize: 14,
    textAlign: 'center',
  },
});
