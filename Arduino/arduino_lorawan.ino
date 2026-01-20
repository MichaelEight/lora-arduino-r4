#include <ArduinoBLE.h>
#include <RadioLib.h>

// SX1276 pin configuration
#define NSS_PIN   10
#define DIO0_PIN  2
#define DIO1_PIN  3
#define RESET_PIN 5
SX1276 radio = new Module(NSS_PIN, DIO0_PIN, RESET_PIN, DIO1_PIN);
LoRaWANNode node(&radio, &EU868);

// LoRaWAN OTAA credentials - GET THESE FROM TTN CONSOLE
// joinEUI: Application EUI from TTN (8 bytes as hex, e.g. 0x0000000000000001)
uint64_t joinEUI = 0x0000000000000000;
// devEUI: Device EUI from TTN (8 bytes as hex, e.g. 0x70B0007ED0000001)
uint64_t devEUI  = 0x0000000000000000;
// appKey: Application Key from TTN (16 bytes as hex array)
uint8_t appKey[] = {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00};
// nwkKey: Network Key from TTN (16 bytes as hex array, same as appKey for LoRaWAN 1.0.x)
uint8_t nwkKey[] = {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00};

// BLE UUIDs
const char* GPS_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const char* GPS_LOCATION_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";
const char* DEVICE_NAME = "GPS-ARDUINO";
BLEService gpsService(GPS_SERVICE_UUID);
BLECharacteristic locationChar(GPS_LOCATION_CHAR_UUID, BLERead | BLEWrite | BLEWriteWithoutResponse, 200);
String lastReadResponse = "READY";

// Queue for received BLE data (stores last 3 locations)
#define QUEUE_SIZE 3
struct MsgQueue {
  String data[QUEUE_SIZE];
  uint8_t head = 0; // next pop
  uint8_t tail = 0; // next push
  uint8_t count = 0;
  bool push(const String &item) {
    if (count == QUEUE_SIZE) {
      head = (head + 1) % QUEUE_SIZE; // overwrite oldest
      count--;
    }

    data[tail] = item;
    tail = (tail + 1) % QUEUE_SIZE;
    count++;
    return true;
  }

  bool pop(String &out) {
    if (count == 0) return false;
    out = data[head];
    head = (head + 1) % QUEUE_SIZE;
    count--;
    return true;
  }

  bool isEmpty() const { return count == 0; }
};
static MsgQueue msgQueue;

// Airtime throttling: max 30 s / hour (conservative for EU868 1% duty cycle)
#define AIRTIME_BUDGET_MS 30000UL
#define AIRTIME_WINDOW_MS 3600000UL
struct AirtimeEntry { unsigned long t; float ms; };
static AirtimeEntry airtimeLog[16];
static uint8_t airtimeCount = 0;
static uint8_t airtimeHead = 0; // oldest
static uint8_t airtimeTail = 0; // next write
static unsigned long lastTxMs = 0;

// Uplink interval (5 min => 12/h for TTN fair-use)
#define UPLINK_INTERVAL_MS 300000UL
#define POST_TX_DELAY 2000
#define MAX_LORA_PAYLOAD 12 // binary format: lat/lon/acc/alt
// Minimum gap between TX attempts (ms) - fair use: 60 s
#define MIN_SEND_GAP_MS 60000UL
// Safe airtime budget (ms) in 1h window, below 30s limit for safety margin
#define SAFE_AIRTIME_BUDGET_MS 20000UL

// Simple Base64 decoder
String base64Decode(const String &input) {
  const char* b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  int len = input.length();
  int i = 0, j = 0, in = 0;
  unsigned char char_array_4[4], char_array_3[3];
  String out = "";
  while (len-- && (input[in] != '=') && isAscii(input[in])) {
    const char* p = strchr(b64, input[in]);
    if (!p) { in++; continue; }
    char_array_4[i++] = (unsigned char)(p - b64);
    in++;
    if (i == 4) {
      char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
      char_array_3[1] = ((char_array_4[1] & 0xF) << 4) + ((char_array_4[2] & 0x3C) >> 2);
      char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
      for (i = 0; i < 3; i++) out += (char)char_array_3[i];
      i = 0;
    }
  }

  if (i) {
    for (j = i; j < 4; j++) char_array_4[j] = 0;
    char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
    char_array_3[1] = ((char_array_4[1] & 0xF) << 4) + ((char_array_4[2] & 0x3C) >> 2);
    char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
    for (j = 0; j < i - 1; j++) out += (char)char_array_3[j];
  }

  return out;
}

bool isAscii(char c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=' || c == '\n' || c == '\r';
}

// Airtime estimate (LoRa EU868, SF7 BW125 CR4/5)
float estimateAirtimeMs(size_t payloadSize) {
  const float bw = 125000.0; // Hz
  const int sf = 7;
  const int cr = 1; // 4/(4+cr) => 4/5
  const bool ih = false; // explicit header
  const bool de = false; // low data rate opt (sf<11 => false)
  const float tSym = (float)(1UL << sf) / bw * 1000.0;
  const float tPreamble = (8.0 + 4.25) * tSym;
  float payloadSym = 8.0 + max(ceil((8.0 * payloadSize - 4.0 * sf + 28 + 16 - 20 * ih) / (4.0 * (sf - 2 * de))) * (cr + 4), 0.0);
  float tPayload = payloadSym * tSym;
  return tPreamble + tPayload;
}

void addAirtime(float ms) {
  unsigned long now = millis();
  // purge old entries
  while (airtimeCount > 0) {
    AirtimeEntry &e = airtimeLog[airtimeHead];
    if ((now - e.t) <= AIRTIME_WINDOW_MS) break;
    airtimeHead = (airtimeHead + 1) % 16;
    airtimeCount--;
  }
  
  airtimeLog[airtimeTail] = { now, ms };
  airtimeTail = (airtimeTail + 1) % 16;
  if (airtimeCount < 16) airtimeCount++;
  else { airtimeHead = airtimeTail; }
}

float usedAirtimeMs() {
  unsigned long now = millis();
  float sum = 0;
  for (uint8_t i = 0, idx = airtimeHead; i < airtimeCount; i++) {
    AirtimeEntry &e = airtimeLog[idx];
    if ((now - e.t) <= AIRTIME_WINDOW_MS) sum += e.ms;
    idx = (idx + 1) % 16;
  }

  return sum;
}

float airtimeRemainingMs() {
  float used = usedAirtimeMs();
  float remaining = AIRTIME_BUDGET_MS - used;
  return remaining < 0 ? 0 : remaining;
}

unsigned long nextWindowReleaseMs() {
  if (airtimeCount == 0) return 0;
  unsigned long now = millis();
  unsigned long oldestAge = now - airtimeLog[airtimeHead].t;
  if (oldestAge >= AIRTIME_WINDOW_MS) return 0;
  return AIRTIME_WINDOW_MS - oldestAge;
}

#define MAX_JOIN_ATTEMPTS 3

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  delay(2000);
  Serial.println("Start BLE + LoRaWAN (EU868)");
  Serial.println("Check SX1276 power supply (3.3V, ~120mA during TX)");

  // BLE init
  if (!BLE.begin()) {
    Serial.println("BLE init failed");
    while (true) { delay(1000); }
  }

  BLE.setLocalName(DEVICE_NAME);
  BLE.setDeviceName(DEVICE_NAME);
  BLE.setAdvertisedService(gpsService);
  gpsService.addCharacteristic(locationChar);
  BLE.addService(gpsService);
  locationChar.writeValue(lastReadResponse.c_str());
  BLE.advertise();
  Serial.println("BLE advertising ready");

  // LoRa init
  Serial.print("Radio init...");
  int state = radio.begin();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("fail "); Serial.println(state);
    while (true) { delay(1000); }
  }

  Serial.println("OK");
  Serial.print("LoRaWAN node init...");
  state = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("fail "); Serial.println(state);
    while (true) { delay(1000); }
  }

  node.setADR(true);
  Serial.println("OK");

  Serial.println("Joining network (retry logic)...");
  bool joinSuccess = false;
  for (int attempt = 1; attempt <= MAX_JOIN_ATTEMPTS; attempt++) {
    Serial.print("Attempt "); Serial.print(attempt); Serial.print("/"); Serial.println(MAX_JOIN_ATTEMPTS);
    state = node.activateOTAA();
    if (state == RADIOLIB_ERR_NONE) { joinSuccess = true; break; }
    Serial.print("Join failed: "); Serial.println(state);
    if (attempt < MAX_JOIN_ATTEMPTS) {
      Serial.println("Retry in 5s with radio reset...");
      delay(5000);
      radio.reset();
      delay(100);
      radio.begin();
    }
  }

  if (!joinSuccess) {
    Serial.println("Join failed after retries");
    while (true) { delay(2000); }
  }

  Serial.println("Joined TTN");
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    while (central.connected()) {
      BLE.poll();
      if (locationChar.written()) handleIncomingWrite();
      processUplinkSchedule();
    }

    lastReadResponse = "READY";
    locationChar.writeValue(lastReadResponse.c_str());
  } else {
    BLE.poll();
    processUplinkSchedule();
  }

  delay(5);
}

void handleIncomingWrite() {
  int len = locationChar.valueLength();
  if (len <= 0) return;
  if (len > 190) len = 190;
  uint8_t buffer[191];
  memcpy(buffer, locationChar.value(), len);
  buffer[len] = 0;
  String incomingBase64 = String((char*)buffer);
  String decoded = base64Decode(incomingBase64);
  decoded.trim();
  // If decoder returned nothing but looks like JSON, use raw text
  if (decoded.length() == 0 && incomingBase64.startsWith("{")) {
    decoded = incomingBase64;
  }

  Serial.println("--- Incoming write ---");
  Serial.print("Base64: "); Serial.println(incomingBase64);
  Serial.print("Decoded: "); Serial.println(decoded);
  if (decoded.length() == 0) return;
  msgQueue.push(decoded);
  Serial.println("Queued BLE payload; attempting immediate LoRa send...");
  trySendQueued();
  lastReadResponse = "STORED";
  locationChar.writeValue(lastReadResponse.c_str());
  Serial.println("----------------------");
}

void processUplinkSchedule() {
  static unsigned long lastAttempt = 0;
  unsigned long now = millis();
  if (msgQueue.isEmpty()) {
    return; // nothing to send
  }

  if (now - lastAttempt < MIN_SEND_GAP_MS) {
    return; // wait for minimum gap
  }

  bool sent = trySendQueued();
  lastAttempt = now;
  if (sent) {
    delay(POST_TX_DELAY);
  }
}

// Extract number from simple JSON (e.g. "lat":51.1)
float parseJsonNumber(const String &json, const char* key, bool *ok) {
  *ok = false;
  int k = json.indexOf(key);
  if (k < 0) return 0;
  k = json.indexOf(':', k);
  if (k < 0) return 0;
  int end = json.indexOf(',', k + 1);
  if (end < 0) end = json.indexOf('}', k + 1);
  if (end < 0) return 0;
  String num = json.substring(k + 1, end);
  num.trim();
  *ok = true;
  return num.toFloat();
}

bool buildBinaryPayload(const String &json, uint8_t *out, size_t *outLen) {
  bool okLat, okLon, okAcc, okAlt;
  float lat = parseJsonNumber(json, "lat", &okLat);
  float lon = parseJsonNumber(json, "lon", &okLon);
  float acc = parseJsonNumber(json, "acc", &okAcc);
  float alt = parseJsonNumber(json, "alt", &okAlt);
  if (!okLat || !okLon) return false;
  // Scale 1e7 as in TTN formatter
  int32_t latScaled = (int32_t)lround(lat * 10000000.0);
  int32_t lonScaled = (int32_t)lround(lon * 10000000.0);
  uint16_t accScaled = (uint16_t)constrain((long)lround(acc * 10.0), 0, 65535);
  uint16_t altScaled = (uint16_t)constrain((long)lround(alt), 0, 65535);

  out[0] = (latScaled >> 24) & 0xFF;
  out[1] = (latScaled >> 16) & 0xFF;
  out[2] = (latScaled >> 8) & 0xFF;
  out[3] = latScaled & 0xFF;

  out[4] = (lonScaled >> 24) & 0xFF;
  out[5] = (lonScaled >> 16) & 0xFF;
  out[6] = (lonScaled >> 8) & 0xFF;
  out[7] = lonScaled & 0xFF;

  out[8] = (accScaled >> 8) & 0xFF;
  out[9] = accScaled & 0xFF;

  out[10] = (altScaled >> 8) & 0xFF;
  out[11] = altScaled & 0xFF;

  *outLen = 12;
  return true;
}

// Try sending oldest from queue with airtime control; returns true if sent
bool trySendQueued() {
  if (msgQueue.isEmpty()) {
    Serial.println("Queue empty, nothing to send");
    return false;
  }

  unsigned long now = millis();
  if (now - lastTxMs < MIN_SEND_GAP_MS) {
    unsigned long waitMs = MIN_SEND_GAP_MS - (now - lastTxMs);
    Serial.print("Cooldown active, wait "); Serial.print(waitMs/1000.0,1); Serial.println(" s");
    return false;
  }

  String payloadStr;
  if (!msgQueue.pop(payloadStr)) return false;
  uint8_t buffer[MAX_LORA_PAYLOAD];
  size_t len = 0;
  if (!buildBinaryPayload(payloadStr, buffer, &len)) {
    Serial.println("Payload parse failed (missing lat/lon)");
    return false;
  }

  float est = estimateAirtimeMs(len);
  float used = usedAirtimeMs();
  float remaining = airtimeRemainingMs();
  unsigned long waitMs = nextWindowReleaseMs();
  Serial.print("[LoRa Attempt] len="); Serial.print(len);
  Serial.print(" estAir="); Serial.print(est, 1);
  Serial.print(" used="); Serial.print(used, 1);
  Serial.print(" rem="); Serial.print(remaining, 1);
  Serial.print(" wait~"); Serial.print(waitMs/1000.0,1); Serial.println(" s");

  if (used + est > SAFE_AIRTIME_BUDGET_MS) {
    Serial.println("Airtime limit hit, postponing");
    msgQueue.push(payloadStr);
    return false;
  }

  Serial.println("TX -> LoRaWAN...");
  uint8_t down[16]; size_t downLen = 0;
  int state = node.sendReceive(buffer, len, 1, down, &downLen);
  if (state == RADIOLIB_ERR_NONE || state == 1) {
    addAirtime(est);
    lastTxMs = now;
    Serial.print("Uplink sent. Airtime used now: "); Serial.print(usedAirtimeMs(),1);
    Serial.print(" / "); Serial.println(AIRTIME_BUDGET_MS);
    return true;
  }

  Serial.print("TX fail: "); Serial.println(state);
  msgQueue.push(payloadStr);
  return false;
}
