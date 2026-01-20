/**
 * GPS data encoding for BLE transmission.
 */

import { Buffer } from 'buffer';
import * as Location from 'expo-location';

export interface GpsPayload {
  lat: number;
  lon: number;
  acc: number;
  alt: number | null;
  ts: number;
  spd: number | null;
}

/**
 * Encode a location object to Base64 string for BLE transmission.
 */
export function encodeGpsData(location: Location.LocationObject): string {
  const payload: GpsPayload = {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    acc: location.coords.accuracy ?? 0,
    alt: location.coords.altitude,
    ts: location.timestamp,
    spd: location.coords.speed,
  };

  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8').toString('base64');
}
