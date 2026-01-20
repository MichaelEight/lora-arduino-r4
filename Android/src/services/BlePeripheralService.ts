/**
 * BLE Peripheral service using native module.
 * With comprehensive logging for debugging.
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

export const GPS_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
export const GPS_LOCATION_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';

export type PeripheralState = 'stopped' | 'starting' | 'advertising';

export interface BlePeripheralCallbacks {
  onStateChange?: (state: PeripheralState) => void;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
  onClientConnected?: (address: string) => void;
  onClientDisconnected?: (address: string) => void;
}

// Try to get native module, may not exist
const BlePeripheralModule = NativeModules.BlePeripheralModule;

class BlePeripheralService {
  private callbacks: BlePeripheralCallbacks = {};
  private isAdvertising = false;
  private eventEmitter: NativeEventEmitter | null = null;
  private eventSubscriptions: any[] = [];

  constructor() {
    this.log(`BlePeripheralModule available: ${!!BlePeripheralModule}`);
    if (BlePeripheralModule) {
      this.eventEmitter = new NativeEventEmitter(BlePeripheralModule);
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (!this.eventEmitter) return;

    // Listen for native events
    this.eventSubscriptions.push(
      this.eventEmitter.addListener('onAdvertisingStarted', () => {
        this.log('Native: Advertising started successfully');
      })
    );

    this.eventSubscriptions.push(
      this.eventEmitter.addListener('onAdvertisingFailed', (event: any) => {
        this.log(`Native: Advertising FAILED with code ${event?.errorCode}`);
        this.emitError(`Advertising failed: code ${event?.errorCode}`);
      })
    );

    this.eventSubscriptions.push(
      this.eventEmitter.addListener('onDeviceConnected', (event: any) => {
        this.log(`Native: Device CONNECTED: ${event?.address}`);
        this.callbacks.onClientConnected?.(event?.address);
      })
    );

    this.eventSubscriptions.push(
      this.eventEmitter.addListener('onDeviceDisconnected', (event: any) => {
        this.log(`Native: Device DISCONNECTED: ${event?.address}`);
        this.callbacks.onClientDisconnected?.(event?.address);
      })
    );
  }

  setCallbacks(callbacks: BlePeripheralCallbacks): void {
    this.callbacks = callbacks;
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${timestamp}] ${message}`;
    console.log(`[BLE] ${fullMessage}`);
    this.callbacks.onLog?.(fullMessage);
  }

  private emitState(state: PeripheralState): void {
    this.log(`State changed: ${state}`);
    this.callbacks.onStateChange?.(state);
  }

  private emitError(error: string): void {
    this.log(`ERROR: ${error}`);
    this.callbacks.onError?.(error);
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      this.log('Not Android, skipping permissions');
      return true;
    }

    this.log(`Android version: ${Platform.Version}`);

    try {
      const permissions: any[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];

      // Android 12+ (API 31+)
      if (Platform.Version >= 31) {
        this.log('Android 12+, requesting BLE permissions');
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
        );
      }

      this.log(`Requesting permissions: ${permissions.join(', ')}`);
      const results = await PermissionsAndroid.requestMultiple(permissions);

      for (const [perm, status] of Object.entries(results)) {
        this.log(`  ${perm}: ${status}`);
      }

      const allGranted = Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        this.emitError('Some permissions not granted');
      } else {
        this.log('All permissions granted');
      }

      return allGranted;
    } catch (e) {
      this.emitError(`Permission request failed: ${e}`);
      return false;
    }
  }

  async startAdvertising(): Promise<boolean> {
    this.log('startAdvertising() called');
    this.emitState('starting');

    // Request permissions first
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      this.log('No permissions, aborting');
      this.emitState('stopped');
      return false;
    }

    if (!BlePeripheralModule) {
      this.log('WARNING: Native module not available!');
      this.log('BLE will not actually work');
      this.isAdvertising = true;
      this.emitState('advertising');
      return true;
    }

    try {
      this.log(`Calling native startAdvertising...`);
      this.log(`  Service UUID: ${GPS_SERVICE_UUID}`);
      this.log(`  Char UUID: ${GPS_LOCATION_CHAR_UUID}`);

      await BlePeripheralModule.startAdvertising(GPS_SERVICE_UUID, GPS_LOCATION_CHAR_UUID);

      this.log('Native startAdvertising returned successfully');
      this.isAdvertising = true;
      this.emitState('advertising');
      return true;
    } catch (error: any) {
      const message = error?.message || String(error);
      this.emitError(`startAdvertising failed: ${message}`);
      this.emitState('stopped');
      return false;
    }
  }

  async stopAdvertising(): Promise<void> {
    this.log('stopAdvertising() called');

    if (BlePeripheralModule) {
      try {
        await BlePeripheralModule.stopAdvertising();
        this.log('Native stopAdvertising returned');
      } catch (e) {
        this.log(`stopAdvertising error (ignored): ${e}`);
      }
    }

    this.isAdvertising = false;
    this.emitState('stopped');
  }

  async updateGpsData(data: object): Promise<boolean> {
    if (!this.isAdvertising) {
      return false;
    }

    if (!BlePeripheralModule) {
      // No native module - just log
      this.log(`GPS data (no BLE): ${JSON.stringify(data)}`);
      return true;
    }

    try {
      const json = JSON.stringify(data);
      this.log(`Sending GPS notification: ${json.substring(0, 50)}...`);

      await BlePeripheralModule.notifyCharacteristicChanged(
        GPS_SERVICE_UUID,
        GPS_LOCATION_CHAR_UUID,
        json
      );

      this.log('Notification sent successfully');
      return true;
    } catch (error: any) {
      this.log(`Notification failed: ${error?.message || error}`);
      return false;
    }
  }

  getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  destroy(): void {
    this.log('Destroying service');
    for (const sub of this.eventSubscriptions) {
      sub.remove();
    }
    this.eventSubscriptions = [];
  }
}

export const blePeripheralService = new BlePeripheralService();
