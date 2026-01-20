/**
 * BLE configuration constants.
 * These must match the Arduino's arduino_lorawan.ino settings.
 */

export const GPS_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
export const GPS_LOCATION_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';

// Device name to look for when scanning (must match Arduino DEVICE_NAME)
export const DEVICE_NAME = 'GPS-ARDUINO';

// Transmission interval bounds (milliseconds)
// Minimum 60 seconds to comply with EU868 LoRaWAN fair-use policy
export const MIN_INTERVAL_MS = 60000;
export const MAX_INTERVAL_MS = 600000;
export const DEFAULT_INTERVAL_MS = 60000;

// Persistent device ID storage key
export const DEVICE_ID_STORAGE_KEY = '@lora_gps_tracker:device_id';
