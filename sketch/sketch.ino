#include <Modulino.h>
#include <Arduino_RouterBridge.h>

// Create object instance
ModulinoThermo thermo;

unsigned long previousMillis = 0; 	// Stores last time values were updated
const long interval = 1000; 		//Every second

void setup() {
  Bridge.begin();

  // Initialize Modulino I2C communication
  Modulino.begin(Wire1);
  
  // Detect and connect to temperature/humidity sensor module
  thermo.begin();
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

    // TODO: Read from your other sensors here
    float pressure = 0.0; // Placeholder for pressure in hPa
    float lux = 0.0; // Placeholder for light intensity in lux
    int raindrop = 0; // Placeholder for raindrop sensor
    float uv_index = 0.0; // Placeholder for UV index
    float tvoc = 0.0; // Placeholder for TVOC in ppb
    float eco2 = 0.0; // Placeholder for eCO2 in ppm

    Bridge.notify("record_sensor_samples", celsius, humidity, pressure, lux, raindrop, uv_index, tvoc, eco2);
  }
}