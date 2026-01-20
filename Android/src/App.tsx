/**
 * GPS BLE Sender - Main Application
 * Supports dual modes: Advertise (phone sends GPS) and Scan (phone connects to PC)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
} from 'react-native';
import * as Location from 'expo-location';
import { Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

import { blePeripheralService, PeripheralState } from './services/BlePeripheralService';
import { bleService, ConnectionState } from './services/BleService';
import { locationService } from './services/LocationService';
import { deviceIdService } from './services/DeviceIdService';
import { DEFAULT_INTERVAL_MS, DEVICE_NAME } from './constants/ble';

import { GpsDisplay } from './components/GpsDisplay';
import { IntervalSlider } from './components/IntervalSlider';
import { ModeSelector, AppMode } from './components/ModeSelector';

const MAX_LOGS = 50;

export default function App() {
  // App mode
  const [mode, setMode] = useState<AppMode>('advertise');
  const [deviceId, setDeviceId] = useState<string>('');

  // Advertise mode (peripheral) state
  const [peripheralState, setPeripheralState] = useState<PeripheralState>('stopped');
  const [connectedClients, setConnectedClients] = useState<string[]>([]);

  // Scan mode (central) state
  const [centralState, setCentralState] = useState<ConnectionState>('disconnected');
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [serverVerified, setServerVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [interval, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [transmitting, setTransmitting] = useState(false);
  const [transmitCount, setTransmitCount] = useState(0);

  // Debug logs
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logScrollRef = useRef<ScrollView>(null);

  // Refs for transmission loop
  const transmitIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestLocationRef = useRef<Location.LocationObject | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => {
      const newLogs = [...prev, message];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

  // Keep ref updated with latest location
  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  // Initialize device ID and services
  useEffect(() => {
    const init = async () => {
      addLog('App started');

      // Load persistent device ID
      const id = await deviceIdService.getShortId();
      setDeviceId(id);
      addLog(`Device ID: ${id}`);

      // Setup peripheral service callbacks
      blePeripheralService.setCallbacks({
        onStateChange: setPeripheralState,
        onError: (err) => {
          setError(err);
          setTimeout(() => setError(null), 5000);
        },
        onLog: addLog,
        onClientConnected: (address) => {
          setConnectedClients((prev) => [...prev, address]);
        },
        onClientDisconnected: (address) => {
          setConnectedClients((prev) => prev.filter((a) => a !== address));
        },
      });

      // Setup central service callbacks
      bleService.setCallbacks({
        onStateChange: setCentralState,
        onDeviceFound: (device) => {
          setScannedDevices((prev) => {
            if (prev.find((d) => d.id === device.id)) return prev;
            return [...prev, device];
          });
        },
        onError: (err) => {
          setError(err);
          setTimeout(() => setError(null), 5000);
        },
        onLog: addLog,
        onDataReceived: (data) => {
          addLog(`Received GPS: ${data.lat?.toFixed(6)}, ${data.lon?.toFixed(6)}`);
        },
      });

      // Setup location service callbacks
      locationService.setCallbacks({
        onLocation: setLocation,
        onError: (err) => {
          addLog(`Location error: ${err}`);
          setError(err);
          setTimeout(() => setError(null), 5000);
        },
      });

      // Request location permissions
      addLog('Requesting location permissions...');
      const granted = await locationService.requestPermissions();
      addLog(`Location permissions: ${granted ? 'granted' : 'denied'}`);
    };

    init();

    return () => {
      stopTransmission();
      blePeripheralService.destroy();
      bleService.destroy();
      locationService.stopWatching();
    };
  }, [addLog]);

  // Auto-scroll logs
  useEffect(() => {
    if (logScrollRef.current) {
      setTimeout(() => {
        logScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs]);

  // Handle mode change
  const handleModeChange = useCallback((newMode: AppMode) => {
    if (transmitting) {
      addLog('Stop transmission before changing mode');
      return;
    }

    // Clean up current mode
    if (mode === 'advertise') {
      blePeripheralService.stopAdvertising();
    } else {
      bleService.disconnect();
    }

    setMode(newMode);
    setScannedDevices([]);
    setConnectedDevice(null);
    addLog(`Mode changed to: ${newMode}`);
  }, [mode, transmitting, addLog]);

  // ========== ADVERTISE MODE HANDLERS ==========

  const handleStartAdvertising = useCallback(async () => {
    addLog('User tapped: Start BLE Advertising');
    await blePeripheralService.startAdvertising();
  }, [addLog]);

  const handleStopAdvertising = useCallback(async () => {
    addLog('User tapped: Stop BLE');
    stopTransmission();
    await blePeripheralService.stopAdvertising();
  }, [addLog]);

  const transmitGpsAsPeripheral = useCallback(async () => {
    const loc = latestLocationRef.current;
    if (!loc) {
      addLog('No location available for transmission');
      return;
    }

    const data = {
      id: deviceId,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      acc: loc.coords.accuracy ?? 0,
      alt: loc.coords.altitude,
      ts: loc.timestamp,
      spd: loc.coords.speed,
    };

    const success = await blePeripheralService.updateGpsData(data);
    if (success) {
      setTransmitCount((prev) => prev + 1);
    }
  }, [deviceId, addLog]);

  // ========== SCAN MODE HANDLERS ==========

  const handleStartScan = useCallback(async () => {
    addLog('User tapped: Start Scanning');
    setScannedDevices([]);
    await bleService.startScan(15000);
  }, [addLog]);

  const handleStopScan = useCallback(() => {
    addLog('User tapped: Stop Scan');
    bleService.stopScan();
  }, [addLog]);

  const handleConnectToDevice = useCallback(async (device: Device) => {
    addLog(`Connecting to ${device.name || device.id}...`);
    const success = await bleService.connect(device.id);
    if (success) {
      setConnectedDevice(device);
      addLog('Connected! Ready to send GPS data.');
    }
  }, [addLog]);

  const handleDisconnect = useCallback(async () => {
    addLog('User tapped: Disconnect');
    stopTransmission();
    await bleService.disconnect();
    setConnectedDevice(null);
    setServerVerified(false);
  }, [addLog]);

  const handlePingServer = useCallback(async () => {
    addLog('User tapped: Verify Server (PING)');
    setVerifying(true);
    const success = await bleService.sendPing();
    setVerifying(false);
    setServerVerified(success);
    if (success) {
      addLog('Server verified successfully!');
    } else {
      addLog('Server verification failed');
    }
  }, [addLog]);

  const transmitGpsAsCentral = useCallback(async () => {
    const loc = latestLocationRef.current;
    if (!loc) {
      addLog('No location available for transmission');
      return;
    }

    const data = {
      id: deviceId,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      acc: loc.coords.accuracy ?? 0,
      alt: loc.coords.altitude,
      ts: loc.timestamp,
      spd: loc.coords.speed,
    };

    const base64Data = Buffer.from(JSON.stringify(data)).toString('base64');
    const success = await bleService.writeGpsData(base64Data);
    if (success) {
      setTransmitCount((prev) => prev + 1);
    }
  }, [deviceId, addLog]);

  // ========== COMMON HANDLERS ==========

  const startTransmission = useCallback(async () => {
    addLog('Starting GPS transmission...');

    const initialLocation = await locationService.getCurrentLocation();
    if (initialLocation) {
      setLocation(initialLocation);
      addLog(`Initial location: ${initialLocation.coords.latitude.toFixed(6)}, ${initialLocation.coords.longitude.toFixed(6)}`);
    } else {
      addLog('WARNING: Could not get initial location');
    }

    const watchStarted = await locationService.startWatching(interval);
    addLog(`Location watching started: ${watchStarted}`);

    setTransmitting(true);
    setTransmitCount(0);

    const transmitFn = mode === 'advertise' ? transmitGpsAsPeripheral : transmitGpsAsCentral;
    await transmitFn();
    transmitIntervalRef.current = setInterval(transmitFn, interval);
    addLog(`Transmission loop started (interval: ${interval}ms)`);
  }, [interval, mode, transmitGpsAsPeripheral, transmitGpsAsCentral, addLog]);

  const stopTransmission = useCallback(() => {
    if (transmitIntervalRef.current) {
      clearInterval(transmitIntervalRef.current);
      transmitIntervalRef.current = null;
      addLog('Transmission loop stopped');
    }
    locationService.stopWatching();
    setTransmitting(false);
  }, [addLog]);

  const handleToggleTransmission = useCallback(() => {
    if (transmitting) {
      addLog('User tapped: Stop Sending GPS');
      stopTransmission();
    } else {
      addLog('User tapped: Start Sending GPS');
      startTransmission();
    }
  }, [transmitting, startTransmission, stopTransmission, addLog]);

  const handleIntervalChange = useCallback(
    (newInterval: number) => {
      setIntervalMs(newInterval);
      addLog(`Interval changed to ${newInterval}ms`);

      if (transmitting) {
        stopTransmission();
        setTimeout(() => startTransmission(), 100);
      }
    },
    [transmitting, stopTransmission, startTransmission, addLog]
  );

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Status helpers
  const isAdvertising = peripheralState === 'advertising';
  const isStartingAdvertise = peripheralState === 'starting';
  const isScanning = centralState === 'scanning';
  const isConnecting = centralState === 'connecting';
  const isConnected = centralState === 'connected';
  const isBusy = isStartingAdvertise || isScanning || isConnecting || transmitting;

  // Filter devices that look like our PC receiver
  const filteredDevices = scannedDevices.filter(
    (d) => d.name && (d.name.includes('GPS') || d.name.includes(DEVICE_NAME))
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />

      <ScrollView style={styles.content}>
        <Text style={styles.title}>GPS BLE Sender</Text>
        <Text style={styles.subtitle}>Device ID: {deviceId}</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ModeSelector
          mode={mode}
          onModeChange={handleModeChange}
          disabled={isBusy}
        />

        {/* Mode-specific status card */}
        <View style={styles.statusCard}>
          {mode === 'advertise' ? (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isAdvertising ? '#44ff44' : '#ff4444' },
                ]}
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusText}>
                  {isStartingAdvertise
                    ? 'Starting BLE...'
                    : isAdvertising
                    ? 'Advertising'
                    : 'BLE Stopped'}
                </Text>
                {isAdvertising && (
                  <Text style={styles.statusHint}>
                    Clients connected: {connectedClients.length}
                  </Text>
                )}
                {connectedClients.length > 0 && (
                  <Text style={styles.clientList}>
                    {connectedClients.join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isConnected ? '#44ff44' : isScanning ? '#ffaa44' : '#ff4444' },
                ]}
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusText}>
                  {isConnecting
                    ? 'Connecting...'
                    : isConnected
                    ? `Connected to ${connectedDevice?.name || 'device'}`
                    : isScanning
                    ? 'Scanning...'
                    : 'Disconnected'}
                </Text>
                {isScanning && (
                  <Text style={styles.statusHint}>
                    Found {scannedDevices.length} device(s)
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        <GpsDisplay
          location={location}
          transmitting={transmitting}
          transmitCount={transmitCount}
        />

        <IntervalSlider
          value={interval}
          onChange={handleIntervalChange}
          disabled={transmitting}
        />

        {/* Mode-specific buttons */}
        <View style={styles.buttonContainer}>
          {mode === 'advertise' ? (
            // Advertise mode buttons
            !isAdvertising ? (
              <TouchableOpacity
                style={[styles.button, styles.startBleButton]}
                onPress={handleStartAdvertising}
                disabled={isStartingAdvertise}
              >
                <Text style={styles.buttonText}>
                  {isStartingAdvertise ? 'Starting...' : 'Start BLE Advertising'}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    transmitting ? styles.stopButton : styles.startButton,
                  ]}
                  onPress={handleToggleTransmission}
                >
                  <Text style={styles.buttonText}>
                    {transmitting ? 'Stop Sending GPS' : 'Start Sending GPS'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.stopBleButton]}
                  onPress={handleStopAdvertising}
                  disabled={transmitting}
                >
                  <Text style={styles.buttonText}>Stop BLE</Text>
                </TouchableOpacity>
              </>
            )
          ) : (
            // Scan mode buttons
            !isConnected ? (
              <>
                <TouchableOpacity
                  style={[styles.button, isScanning ? styles.stopButton : styles.startBleButton]}
                  onPress={isScanning ? handleStopScan : handleStartScan}
                  disabled={isConnecting}
                >
                  <Text style={styles.buttonText}>
                    {isConnecting ? 'Connecting...' : isScanning ? 'Stop Scan' : 'Scan for Devices'}
                  </Text>
                </TouchableOpacity>

                {/* Device list */}
                {scannedDevices.length > 0 && (
                  <View style={styles.deviceList}>
                    <Text style={styles.deviceListTitle}>
                      Found Devices:
                    </Text>
                    {scannedDevices.map((device) => (
                      <TouchableOpacity
                        key={device.id}
                        style={styles.deviceItem}
                        onPress={() => handleConnectToDevice(device)}
                        disabled={isConnecting}
                      >
                        <Text style={styles.deviceName}>
                          {device.name || 'Unknown'}
                        </Text>
                        <Text style={styles.deviceId}>{device.id}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                {serverVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Server Verified</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    transmitting ? styles.stopButton : styles.startButton,
                  ]}
                  onPress={handleToggleTransmission}
                  disabled={verifying}
                >
                  <Text style={styles.buttonText}>
                    {transmitting ? 'Stop Sending GPS' : 'Start Sending GPS'}
                  </Text>
                </TouchableOpacity>

                {!serverVerified && !transmitting && (
                  <TouchableOpacity
                    style={[styles.button, styles.verifyButton]}
                    onPress={handlePingServer}
                    disabled={verifying}
                  >
                    <Text style={styles.buttonText}>
                      {verifying ? 'Verifying...' : 'Verify Server (PING)'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.stopBleButton]}
                  onPress={handleDisconnect}
                  disabled={transmitting}
                >
                  <Text style={styles.buttonText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            )
          )}
        </View>

        {/* Debug Logs */}
        <View style={styles.logsContainer}>
          <View style={styles.logsHeader}>
            <TouchableOpacity onPress={() => setShowLogs(!showLogs)}>
              <Text style={styles.logsTitle}>
                Debug Logs {showLogs ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>

          {showLogs && (
            <ScrollView
              ref={logScrollRef}
              style={styles.logsScroll}
              nestedScrollEnabled
            >
              {logs.map((log, index) => (
                <Text key={index} style={styles.logLine}>
                  {log}
                </Text>
              ))}
              {logs.length === 0 && (
                <Text style={styles.logLine}>No logs yet...</Text>
              )}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    color: '#4488ff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  errorBanner: {
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  statusCard: {
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusHint: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },
  clientList: {
    color: '#44ff44',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startBleButton: {
    backgroundColor: '#4488ff',
  },
  startButton: {
    backgroundColor: '#44bb44',
  },
  stopButton: {
    backgroundColor: '#ff4444',
  },
  stopBleButton: {
    backgroundColor: '#666666',
  },
  verifyButton: {
    backgroundColor: '#ff9900',
  },
  verifiedBadge: {
    backgroundColor: '#2a4a2a',
    borderColor: '#44ff44',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifiedText: {
    color: '#44ff44',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  deviceList: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
  },
  deviceListTitle: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 8,
  },
  deviceItem: {
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceId: {
    color: '#666666',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  logsContainer: {
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333344',
  },
  logsTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    color: '#4488ff',
    fontSize: 14,
  },
  logsScroll: {
    maxHeight: 200,
    padding: 12,
  },
  logLine: {
    color: '#aaaaaa',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
