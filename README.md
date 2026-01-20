# LoRa GPS Tracker (Arduino R4 + Mobile App)

A GPS tracking system that receives location data from a smartphone via BLE and transmits it to **The Things Network (TTN)** using **LoRaWAN (EU868 band)**.

---

## Components

- **Arduino UNO R4 WiFi** with SX1276 LoRa module — receives GPS data via BLE and sends uplinks to TTN  
- **Mobile App** (React Native / Expo) — reads phone GPS and sends it to Arduino over BLE

---

## Setup

### Arduino

1. Install required libraries in **Arduino IDE**:
   - `ArduinoBLE`
   - `RadioLib`

2. SX1276 wiring example:
   - NSS -> Pin 10  
   - DIO0 -> Pin 2  
   - DIO1 -> Pin 3  
   - RESET -> Pin 9  
   - VCC -> 3.3V  
   - GND -> GND  

3. Register a device in **TTN Console** (EU868 region).

4. Update credentials in `arduino_lorawan.ino`:
   - `JoinEUI`
   - `DevEUI`
   - `AppKey`
   - `NwkKey`

5. Upload the sketch to **Arduino UNO R4 WiFi**.

---

## Mobile App

1. Navigate to the mobile app directory (Expo project).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build and run on Android:
   ```bash
   npx expo run:android
   ```
4. The app scans for BLE devices and connects to **GPS-ARDUINO**.

---

## How to Run

1. Power on the Arduino — it will attempt to join TTN and start BLE advertising as **GPS-ARDUINO**.  
2. Open the mobile app.  
3. In *Scan* mode, tap **Start Scan** and connect to **GPS-ARDUINO**.  
4. Tap **Start Sending GPS** to begin transmitting location data.  
5. View uplinks in **TTN Console**.

---

## Usage

- **Interval slider** — controls GPS send frequency (minimum 60 seconds enforced in code)  
- **Logs panel** — displays BLE / LoRa status and transmission results  
- **Settings** — permissions management and standalone GPS testing  

---

## Legal Rules & Fair Use (IMPORTANT)

### EU868 Regulations (Europe / Poland)

- The EU868 ISM band typically operates under a **1% duty cycle limit**  
- This equals **36 seconds of transmission per hour** (≈ 864 seconds per day)  
- This is a **regulatory radio limit**, independent of TTN policies

### TTN Fair Use Policy

- TTN applies a **Fair Use Policy** for its public, free network
- In practice, much lower limits than 1% duty cycle are expected
- A commonly referenced guideline is **~30 seconds of airtime per device per day**
- **Fair Use is a platform policy, not a legal guarantee**, and may change

### Important Disclaimer

- **All airtime values in this project are estimated**
- Airtime depends on:
  - Spreading Factor (SF)
  - Coding Rate
  - Payload size
  - Network conditions
  - Retransmissions and joins
- The code implements **best-effort limits only**
- **Compliance with TTN Fair Use or legal regulations is NOT guaranteed**

This project is intended for **educational and experimental use**.

**Practical recommendation:**  
➡️ **1 uplink every 10–15 minutes** when using the public TTN network.

---

## TTN – Where to Find the Keys

1. Open **The Things Stack Console**
2. Select your **Application**
3. Go to **End Devices** → select your device
4. In **Overview / General settings**:
   - `DevEUI`
   - `JoinEUI`
5. In **Keys / Root Keys / Security**:
   - `AppKey`
   - `NwkKey`
6. Copy the values **exactly** into `arduino_lorawan.ino`  
   (byte order matters)

---

## Common Arduino R4 / RadioLib Errors

### Error `-1116`

**Meaning:**
- Device is most likely **outside of LoRaWAN coverage**

**Possible causes:**
- Too far from a gateway
- Heavy signal attenuation (buildings, concrete, metal)
- Antenna not connected or damaged
- Wrong frequency band configuration

**Recommended actions:**
- Move closer to a known gateway
- Check antenna connection
- Verify EU868 configuration

---

### Error `-1118`

**Meaning:**
- Device is at the **edge of signal coverage**
- Can also occur during the **first join attempt**
- May indicate **incorrect keys**

**Typical scenarios:**
- First join fails, next attempt succeeds
- Weak or unstable signal
- Incorrect `AppKey`, `NwkKey`, `JoinEUI`, or `DevEUI`

**Recommended actions:**
- Retry join
- Verify keys byte-by-byte
- Improve signal quality

---

## Versions Used

- **ArduinoBLE:** 1.5.0  
- **RadioLib:** 7.4.0  
- **Board:** Arduino UNO R4 WiFi  
- **Arduino core / compiler version:** 1.5.1  

