// Reading of 2 ultraonic sensores

const int TRIG_UP = 8;
const int ECHO_UP = 9;

const int TRIG_DN = 10;
const int ECHO_DN = 11;

const unsigned long TIMEOUT_US = 30000;  // tieout if not working
const unsigned long SEND_MS = 33;        // output frequency
const float ALPHA = 0.25;                // smooting (0-1) reducdes jerky motions

float upFilt = 40.0;
float dnFilt = 40.0;

unsigned long lastSend = 0;

float readDistanceCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long dur = pulseIn(echoPin, HIGH, TIMEOUT_US);
  if (dur == 0) return NAN;

  return dur / 58.2; // cm
}

float smooth(float prev, float x) {
  return prev + ALPHA * (x - prev);
}

void setup() {
  pinMode(TRIG_UP, OUTPUT);
  pinMode(ECHO_UP, INPUT);

  pinMode(TRIG_DN, OUTPUT);
  pinMode(ECHO_DN, INPUT);

  Serial.begin(115200);
  delay(200);
}

void loop() {
  // Alternate to reduce interference
  float upCm = readDistanceCm(TRIG_UP, ECHO_UP);
  delay(20);
  float dnCm = readDistanceCm(TRIG_DN, ECHO_DN);
  delay(20);

  if (!isnan(upCm)) upFilt = smooth(upFilt, upCm);
  if (!isnan(dnCm)) dnFilt = smooth(dnFilt, dnCm);

  unsigned long now = millis();
  if (now - lastSend >= SEND_MS) {
    lastSend = now;

    Serial.print(upFilt, 2);
    Serial.print(",");
    Serial.println(dnFilt, 2);
  }
}