# SPDX-FileCopyrightText: Copyright (C) 2025 ARDUINO SA <http://www.arduino.cc>
#
# SPDX-License-Identifier: MPL-2.0

import datetime
import math
import random
import threading
import time
from arduino.app_bricks.dbstorage_tsstore import TimeSeriesStore
from arduino.app_bricks.web_ui import WebUI
from arduino.app_utils import App, Bridge

db = TimeSeriesStore()

def on_get_samples(resource: str, start: str, aggr_window: str):
    samples = db.read_samples(measure=resource, start_from=start, aggr_window=aggr_window, aggr_func="mean", limit=180) # 3 hours of data at 1 sample/min
    return [{"ts": s[1], "value": s[2]} for s in samples]

ui = WebUI()
ui.expose_api("GET", "/get_samples/{resource}/{start}/{aggr_window}", on_get_samples)

def generate_startup_data():
    print("Generating startup data for the last 3 hours...")
    now = datetime.datetime.now()
    for i in range(180):  # 3 hours * 60 minutes
        ts = int((now - datetime.timedelta(minutes=i)).timestamp() * 1000)

        celsius = round(random.uniform(15.0, 30.0), 2)
        humidity = round(random.uniform(40.0, 90.0), 2)
        pressure = round(random.uniform(980.0, 1030.0), 2)
        lux = round(random.uniform(0.0, 20000.0), 2)
        raindrop = random.randint(0, 1)
        uv_index = round(random.uniform(0.0, 10.0), 2)
        tvoc = round(random.uniform(0.0, 1000.0), 2)
        eco2 = round(random.uniform(400.0, 2000.0), 2)

        db.write_sample("temperature", float(celsius), ts)
        db.write_sample("humidity", float(humidity), ts)
        db.write_sample("pressure", float(pressure), ts)
        db.write_sample("lux", float(lux), ts)
        db.write_sample("raindrop", int(raindrop), ts)
        db.write_sample("uv_index", float(uv_index), ts)
        db.write_sample("tvoc", float(tvoc), ts)
        db.write_sample("eco2", float(eco2), ts)
    print("Startup data generation complete.")

def record_sensor_samples(celsius: float, humidity: float, pressure: float, lux: float, raindrop: int, uv_index: float, tvoc: float, eco2: float):
    """Callback invoked by the board sketch via Bridge.notify to send sensor samples.
    Stores temperature and humidity samples in the time-series DB and forwards them to the Web UI.
    """
    if celsius is None or humidity is None:
        print("Received invalid sensor samples: celsius=%s, humidity=%s" % (celsius, humidity))
        return

    # If data from sketch is 0, it means it's a placeholder. Let's randomize it.
    if pressure == 0.0:
        pressure = round(random.uniform(980.0, 1030.0), 2)
    if lux == 0.0:
        lux = round(random.uniform(0.0, 20000.0), 2)
    if raindrop == 0:
        raindrop = random.randint(0, 1)
    if uv_index == 0.0:
        uv_index = round(random.uniform(0.0, 10.0), 2)
    if tvoc == 0.0:
        tvoc = round(random.uniform(0.0, 1000.0), 2)
    if eco2 == 0.0:
        eco2 = round(random.uniform(400.0, 2000.0), 2)

    ts = int(datetime.datetime.now().timestamp() * 1000)
    # Write samples to time-series DB
    db.write_sample("temperature", float(celsius), ts)
    db.write_sample("humidity", float(humidity), ts)
    db.write_sample("pressure", float(pressure), ts)
    db.write_sample("lux", float(lux), ts)
    db.write_sample("raindrop", int(raindrop), ts)
    db.write_sample("uv_index", float(uv_index), ts)
    db.write_sample("tvoc", float(tvoc), ts)
    db.write_sample("eco2", float(eco2), ts)

    # Push realtime updates to the UI
    ui.send_message('temperature', {"value": float(celsius), "ts": ts})
    ui.send_message('humidity', {"value": float(humidity), "ts": ts})
    ui.send_message('pressure', {"value": float(pressure), "ts": ts})
    ui.send_message('lux', {"value": float(lux), "ts": ts})
    ui.send_message('raindrop', {"value": int(raindrop), "ts": ts})
    ui.send_message('uv_index', {"value": float(uv_index), "ts": ts})
    ui.send_message('tvoc', {"value": float(tvoc), "ts": ts})
    ui.send_message('eco2', {"value": float(eco2), "ts": ts})


print("Registering 'record_sensor_samples' callback.")
Bridge.provide("record_sensor_samples", record_sensor_samples)

# Generate historical data for the last 3 hours on startup
generate_startup_data()

print("Starting App...")
App.run()