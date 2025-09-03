#include <Modulino.h>
#include <Arduino_RouterBridge.h>
#include "Arduino_NiclaSenseEnv.h"
#include <Adafruit_BMP280.h>

// Create object instance
ModulinoThermo thermo;
Adafruit_BMP280 bmp(&Wire);

#define RAIN_SENSOR_PIN D2
#define UV_SENSOR_PIN A0
#define AMBIENT_LIGHT_SENSOR_PIN A1

unsigned long previousMillis = 0; 	// Stores last time values were updated
const long interval = 1000; 		// Every second

bool sgp_initialised = false;
bool bmp_initialised = false;

NiclaSenseEnv device;

void setup() {
  Bridge.begin();
  Monitor.begin();

  // Initialize Modulino I2C communication
  Modulino.begin(Wire1);

  // Initialize sensors
  thermo.begin();
  pinMode(RAIN_SENSOR_PIN, INPUT); // Rain sensor pin

  if (device.begin()) {
    Monitor.println("Nicla Sense Env - Init OK");
    IndoorAirQualitySensor indoorAirQualitySensor = device.indoorAirQualitySensor();
    indoorAirQualitySensor.setMode(IndoorAirQualitySensorMode::indoorAirQuality);
    sgp_initialised = true;
  } else {
    Monitor.println("Nicla Sense Env - Init FAIL");
    sgp_initialised = false;
  }

  if (bmp.begin(0x76)) {
    Monitor.println("BMP280 - Init OK");
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,     /* Operating Mode. */
                Adafruit_BMP280::SAMPLING_X2,     /* Temp. oversampling */
                Adafruit_BMP280::SAMPLING_X16,    /* Pressure oversampling */
                Adafruit_BMP280::FILTER_X16,      /* Filtering. */
                Adafruit_BMP280::STANDBY_MS_500); /* Standby time. */
    bmp_initialised = true;
  } else {
    Monitor.println("BMP280 - Init FAIL");
    bmp_initialised = false;
  }
}

void loop() {
  unsigned long currentMillis = millis(); // Get the current time
  if (currentMillis - previousMillis >= interval) {
    // Save the last time you updated the values
    previousMillis = currentMillis;

    // Read temperature in Celsius from the sensor
    float celsius = thermo.getTemperature();

    // Read humidity percentage from the sensor
    float humidity = thermo.getHumidity();

    // Read pressure from the sensor
    float pressure = -255;
    if (bmp_initialised) {
      pressure = bmp.readPressure() / 100; // Pa -> hPA
    }

    // Read raw light level from the sensor and convert in lux
    int light_raw = analogRead(AMBIENT_LIGHT_SENSOR_PIN);
    float light_volt = light_raw * (5.0 / 1023.0);
    float lux = light_volt * 200;

    // Read rain sensor value
    int raindrop = (digitalRead(RAIN_SENSOR_PIN) == HIGH) ? 0 : 1;

    // Read UV sensor value
    int uv_raw = analogRead(UV_SENSOR_PIN);
    float uv_volt = uv_raw * (5.0 / 1023);
    float uv_index = uv_volt * 10.0;

    // Read air quality from SGP30 sensor
    float tvoc = -255;
    float eco2 = -255;
    
    if (sgp_initialised) {
      if (device.indoorAirQualitySensor().enabled()) {
        auto iaqMode = device.indoorAirQualitySensor().mode();

        if (iaqMode == IndoorAirQualitySensorMode::indoorAirQuality || iaqMode == IndoorAirQualitySensorMode::indoorAirQualityLowPower) {
          tvoc = device.indoorAirQualitySensor().TVOC();
          eco2 = device.indoorAirQualitySensor().CO2();
        }
      }
    }

    Monitor.print("Temperature (°C): " + String(celsius));
    Monitor.print(" Humidity (%): " + String(humidity));
    Monitor.print(" Pressure (hPA): " + String(pressure));
    Monitor.print(" Light (lux): " + String(lux));
    Monitor.print(" Rain detected (yes-1,no-0): " + String(raindrop));
    Monitor.print(" UV index: " + String(uv_index));
    Monitor.print(" TVOC (ppb): " + String(tvoc));
    Monitor.println(" eCO2 (ppm): " + String(eco2));

    Bridge.notify("record_sensor_samples", celsius, humidity, pressure, lux, raindrop, uv_index, tvoc, eco2);
  }
}