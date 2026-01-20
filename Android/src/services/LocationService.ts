/**
 * Location service for GPS tracking.
 */

import * as Location from 'expo-location';

export interface LocationServiceCallbacks {
  onLocation?: (location: Location.LocationObject) => void;
  onError?: (error: string) => void;
}

class LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private callbacks: LocationServiceCallbacks = {};
  private hasPermission = false;

  setCallbacks(callbacks: LocationServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';

      if (!this.hasPermission) {
        this.callbacks.onError?.('Location permission denied');
      }

      return this.hasPermission;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Permission request failed';
      this.callbacks.onError?.(message);
      return false;
    }
  }

  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    if (!this.hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return null;
    }

    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get location';
      this.callbacks.onError?.(message);
      return null;
    }
  }

  async startWatching(intervalMs: number): Promise<boolean> {
    if (!this.hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
    }

    // Stop existing subscription
    this.stopWatching();

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalMs,
          distanceInterval: 0, // Get updates based on time only
        },
        (location) => {
          this.callbacks.onLocation?.(location);
        }
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start watching';
      this.callbacks.onError?.(message);
      return false;
    }
  }

  stopWatching(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  isWatching(): boolean {
    return this.subscription !== null;
  }
}

// Export singleton instance
export const locationService = new LocationService();
