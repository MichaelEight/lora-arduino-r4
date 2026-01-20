# LoRa GPS Tracker (Arduino R4 + Mobile App)

A GPS tracking system that receives location data from a smartphone via BLE and transmits it to The Things Network (TTN) using LoRaWAN on the EU868 band.

## Components

- **Arduino R4** with SX1276 LoRa module - receives GPS via BLE, sends to TTN
- **Mobile App** (React Native) - reads phone GPS and sends via BLE

## Setup

### Arduino

1. Install required libraries in Arduino IDE:
   - `ArduinoBLE`
   - `RadioLib`

2. Wire the SX1276 module:
   - NSS -> Pin 10
   - DIO0 -> Pin 2
   - DIO1 -> Pin 3
   - RESET -> Pin 9
   - VCC -> 3.3V
   - GND -> GND

3. Register a device on TTN Console (EU868 region)

4. Update credentials in `arduino_lorawan.ino`:
   - `joinEUI`
   - `devEUI`
   - `appKey`
   - `nwkKey`

5. Upload the sketch to Arduino R4

### Mobile App

1. Navigate to `Android` directory

2. Install dependencies:

   ```
   npm install
   ```

3. Build and install on Android device:
   ```
   npx expo run:android
   ```

## How to Run

1. Power on the Arduino - it will join TTN and start BLE advertising as "GPS-ARDUINO"

2. Open the mobile app on your phone

3. In "Scan" mode, tap "Start Scan" and connect to "GPS-ARDUINO"

4. Tap "Start Sending GPS" to begin transmitting your location

5. View location data in TTN Console

## How to Use

- **Interval slider** - adjust GPS send frequency (minimum 60 seconds enforced)
- **Logs panel** - view BLE/LoRa status and transmission confirmations
- **Settings tab** - manage permissions and test GPS independently

## Legal Rules (EU868 - Poland/Europe)

This project operates on the EU868 ISM band which has strict duty cycle limitations:

### Regulatory Requirements

- **1% duty cycle** - devices may only transmit for 1% of the time (36 seconds per hour)
- This is mandated by ETSI EN 300 220 for the 868 MHz band in Europe

### How the Code Addresses Fair Use

1. **Minimum 60-second gap** between transmissions (`MIN_SEND_GAP_MS = 60000`)

2. **30-second hourly airtime budget** (`AIRTIME_BUDGET_MS = 30000`)

3. **Safe budget threshold** (`SAFE_AIRTIME_BUDGET_MS = 20000`)

4. **Airtime estimation** - calculates actual on-air time for each packet based on SF7/BW125 parameters
