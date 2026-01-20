/**
 * BLE device list modal component.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Device } from 'react-native-ble-plx';

interface Props {
  visible: boolean;
  devices: Device[];
  scanning: boolean;
  onSelect: (device: Device) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export function DeviceList({
  visible,
  devices,
  scanning,
  onSelect,
  onClose,
  onRefresh,
}: Props) {
  const renderDevice = ({ item }: { item: Device }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => onSelect(item)}>
      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Available Devices</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>

          {scanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator color="#4488ff" />
              <Text style={styles.scanningText}>Scanning...</Text>
            </View>
          )}

          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            style={styles.list}
            ListEmptyComponent={
              !scanning ? (
                <Text style={styles.emptyText}>No devices found</Text>
              ) : null
            }
          />

          <TouchableOpacity
            style={[styles.refreshButton, scanning && styles.buttonDisabled]}
            onPress={onRefresh}
            disabled={scanning}
          >
            <Text style={styles.refreshButtonText}>
              {scanning ? 'Scanning...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    color: '#4488ff',
    fontSize: 16,
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scanningText: {
    color: '#888888',
    marginLeft: 8,
  },
  list: {
    maxHeight: 300,
  },
  deviceItem: {
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    color: '#666666',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#666666',
    textAlign: 'center',
    padding: 32,
  },
  refreshButton: {
    backgroundColor: '#4488ff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333344',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
