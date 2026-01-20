/**
 * BLE Central service for scanning, connecting, and sending data.
 */

import { BleManager, Device, State, BleError } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { GPS_SERVICE_UUID, GPS_LOCATION_CHAR_UUID } from '../constants/ble';

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface BleServiceCallbacks {
  onStateChange?: (state: ConnectionState) => void;
  onDeviceFound?: (device: Device) => void;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
  onDataReceived?: (data: any) => void;
}

class BleService {
  private manager: BleManager;
  private device: Device | null = null;
  private callbacks: BleServiceCallbacks = {};
  private isInitialized = false;

  constructor() {
    this.manager = new BleManager();
  }

  setCallbacks(callbacks: BleServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  private emitState(state: ConnectionState): void {
    this.callbacks.onStateChange?.(state);
  }

  private emitError(error: string): void {
    this.callbacks.onError?.(error);
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${timestamp}] ${message}`;
    console.log(`[BLE Central] ${fullMessage}`);
    this.callbacks.onLog?.(fullMessage);
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    return new Promise((resolve) => {
      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        this.log('BLE initialization timeout');
        this.emitError('Bluetooth initialization timeout');
        resolve(false);
      }, 5000);

      const subscription = this.manager.onStateChange((state) => {
        this.log(`BLE state: ${state}`);
        if (state === State.PoweredOn) {
          clearTimeout(timeout);
          this.isInitialized = true;
          subscription.remove();
          resolve(true);
        } else if (state === State.PoweredOff || state === State.Unauthorized) {
          clearTimeout(timeout);
          subscription.remove();
          this.emitError('Bluetooth is not available or not authorized');
          resolve(false);
        }
      }, true);
    });
  }

  async startScan(timeoutMs: number = 10000): Promise<void> {
    this.log('startScan called');

    if (!this.isInitialized) {
      this.log('Initializing BLE manager...');
      const success = await this.initialize();
      if (!success) {
        this.log('BLE initialization failed');
        return;
      }
      this.log('BLE initialized successfully');
    }

    this.log('Starting device scan...');
    this.emitState('scanning');

    // Stop any existing scan
    this.manager.stopDeviceScan();

    this.manager.startDeviceScan(
      null, // Scan for all devices (we'll filter by name)
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          this.log(`Scan error: ${error.message}`);
          this.emitError(`Scan error: ${error.message}`);
          this.emitState('disconnected');
          return;
        }

        if (device && device.name) {
          this.log(`Found device: ${device.name} (${device.id})`);
          this.callbacks.onDeviceFound?.(device);
        }
      }
    );

    this.log(`Scan started, will stop in ${timeoutMs}ms`);

    // Auto-stop scan after timeout
    setTimeout(() => {
      this.log('Scan timeout reached, stopping');
      this.stopScan();
    }, timeoutMs);
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
    if (!this.device) {
      this.emitState('disconnected');
    }
  }

  async connect(deviceId: string): Promise<boolean> {
    try {
      this.stopScan();
      this.emitState('connecting');

      // Connect to device
      this.device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
      });

      // Discover services and characteristics
      await this.device.discoverAllServicesAndCharacteristics();

      // Set up disconnect listener
      this.device.onDisconnected((error, device) => {
        console.log('Device disconnected', error?.message);
        this.device = null;
        this.emitState('disconnected');
      });

      this.emitState('connected');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      this.emitError(message);
      this.device = null;
      this.emitState('disconnected');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.device = null;
    }
    this.emitState('disconnected');
  }

  async sendPing(): Promise<boolean> {
    if (!this.device) {
      this.emitError('Not connected to a device');
      return false;
    }

    try {
      this.log('Sending PING...');

      // Send PING
      const pingData = Buffer.from('PING').toString('base64');
      await this.device.writeCharacteristicWithoutResponseForService(
        GPS_SERVICE_UUID,
        GPS_LOCATION_CHAR_UUID,
        pingData
      );

      // Small delay to let server process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Read response
      const response = await this.device.readCharacteristicForService(
        GPS_SERVICE_UUID,
        GPS_LOCATION_CHAR_UUID
      );

      if (response?.value) {
        const decoded = Buffer.from(response.value, 'base64').toString('utf-8');
        this.log(`Received: ${decoded}`);

        if (decoded === 'PONG') {
          this.log('Server verified! PONG received.');
          return true;
        } else {
          this.log(`Unexpected response: ${decoded}`);
          return false;
        }
      }

      this.log('No response received');
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ping failed';
      this.log(`Ping error: ${message}`);
      this.emitError(message);
      return false;
    }
  }

  async writeGpsData(base64Data: string): Promise<boolean> {
    if (!this.device) {
      this.emitError('Not connected to a device');
      return false;
    }

    try {
      // Use writeWithoutResponse for better compatibility
      await this.device.writeCharacteristicWithoutResponseForService(
        GPS_SERVICE_UUID,
        GPS_LOCATION_CHAR_UUID,
        base64Data
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Write failed';
      this.log(`Write error: ${message}`);
      this.emitError(message);
      // Check if still connected
      try {
        const isConnected = await this.device.isConnected();
        if (!isConnected) {
          this.log('Device disconnected during write');
          this.device = null;
          this.emitState('disconnected');
        }
      } catch {
        // Ignore connection check errors
      }
      return false;
    }
  }

  async subscribeToNotifications(): Promise<boolean> {
    if (!this.device) {
      this.emitError('Not connected to a device');
      return false;
    }

    try {
      this.log('Subscribing to GPS notifications...');

      this.device.monitorCharacteristicForService(
        GPS_SERVICE_UUID,
        GPS_LOCATION_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            this.log(`Notification error: ${error.message}`);
            return;
          }

          if (characteristic?.value) {
            try {
              // Decode base64 value
              const decoded = Buffer.from(characteristic.value, 'base64').toString('utf-8');
              const data = JSON.parse(decoded);
              this.log(`Received GPS: ${data.lat?.toFixed(6)}, ${data.lon?.toFixed(6)}`);
              this.callbacks.onDataReceived?.(data);
            } catch (e) {
              this.log(`Failed to parse notification: ${e}`);
            }
          }
        }
      );

      this.log('Subscribed to notifications successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscribe failed';
      this.emitError(message);
      return false;
    }
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  getConnectedDevice(): Device | null {
    return this.device;
  }

  destroy(): void {
    this.manager.stopDeviceScan();
    this.disconnect();
    this.manager.destroy();
  }
}

// Export singleton instance
export const bleService = new BleService();
