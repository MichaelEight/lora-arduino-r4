/**
 * Device ID Service - Generates and stores a persistent unique device identifier.
 * This ID is created once on first launch and never changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEVICE_ID_STORAGE_KEY } from '../constants/ble';

class DeviceIdService {
  private deviceId: string | null = null;

  /**
   * Generate a UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get or create the persistent device ID.
   * Creates a new UUID on first call, then returns the same ID forever.
   */
  async getDeviceId(): Promise<string> {
    // Return cached ID if available
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // Try to load existing ID from storage
      const storedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

      if (storedId) {
        this.deviceId = storedId;
        console.log(`[DeviceId] Loaded existing ID: ${storedId}`);
        return storedId;
      }

      // Generate new ID if none exists
      const newId = this.generateUUID();
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
      this.deviceId = newId;
      console.log(`[DeviceId] Generated new ID: ${newId}`);
      return newId;

    } catch (error) {
      // Fallback: generate ID but don't persist (will change on restart)
      console.error('[DeviceId] Storage error, using temporary ID:', error);
      const tempId = this.generateUUID();
      this.deviceId = tempId;
      return tempId;
    }
  }

  /**
   * Get a short version of the device ID for display/advertising.
   * Format: First 8 characters of the UUID (e.g., "a1b2c3d4")
   */
  async getShortId(): Promise<string> {
    const fullId = await this.getDeviceId();
    return fullId.substring(0, 8).toUpperCase();
  }

  /**
   * Get the device name for BLE advertising.
   * Format: "GPS-{shortId}" (e.g., "GPS-A1B2C3D4")
   */
  async getAdvertisingName(): Promise<string> {
    const shortId = await this.getShortId();
    return `GPS-${shortId}`;
  }

  /**
   * Get cached device ID (sync version, returns null if not loaded yet)
   */
  getCachedDeviceId(): string | null {
    return this.deviceId;
  }
}

export const deviceIdService = new DeviceIdService();
