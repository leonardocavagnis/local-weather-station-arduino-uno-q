// SPDX-FileCopyrightText: Copyright (C) 2025 ARDUINO SA <http://www.arduino.cc>
//
// SPDX-License-Identifier: MPL-2.0

const socket = io(`http://${window.location.host}`);

// Temperature and Humidity chart objects
const temperatureLive = { canvas: null, chart: null, data: newChartData('orange', 'rgba(255,165,0,0.1)'), unit: '°C' };
const humidityLive = { canvas: null, chart: null, data: newChartData('teal', 'rgba(0,128,128,0.08)'), unit: '%' };
const pressureLive = { canvas: null, chart: null, data: newChartData('grey', 'rgba(128,128,128,0.1)'), unit: 'hPa' };

// Air Quality chart
const airQualityLive = { canvas: null, chart: null, data: newCombinedChartData(), units: { tvoc: 'ppb', eco2: 'ppm' } };

const noDataTimeout = 10000; // 10 seconds

let errorContainer;
let mockingStarted = false;

// Store latest TVOC and eCO2 values for Air Quality calculation
let latestTvoc = 0;
let latestEco2 = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize canvases
    temperatureLive.canvas = document.getElementById('temperature-live-chart');
    humidityLive.canvas = document.getElementById('humidity-live-chart');
    pressureLive.canvas = document.getElementById('pressure-live-chart');
    airQualityLive.canvas = document.getElementById('air-quality-live-chart');

    errorContainer = document.getElementById('error-container');

    // Try to fetch last 3 hours of data for live charts
    const tempSamples = await listSamples("temperature", "-3h", "10m");

    if (tempSamples === undefined || tempSamples.length === 0) {
        // Backend not available, generate local mock data
        console.log("Backend not available. Starting local mocking.");
        await generateLocalHistoricalData();
        if (!mockingStarted) {
            startLocalMocking();
            mockingStarted = true;
        }
    } else {
        // Backend available, render data from it
        renderChartData(temperatureLive, tempSamples, 180, true, false);
        if (tempSamples && tempSamples.length > 0) updateSensorValueInTitle('temperature', tempSamples[tempSamples.length - 1].value, '°C', 1);
        const humSamples = await listSamples("humidity", "-3h", "10m");
        renderChartData(humidityLive, humSamples, 180, true, false);
        if (humSamples && humSamples.length > 0) updateSensorValueInTitle('humidity', humSamples[humSamples.length - 1].value, '%', 1);
        const presSamples = await listSamples("pressure", "-3h", "10m");
        renderChartData(pressureLive, presSamples, 180, true, false);
        if (presSamples && presSamples.length > 0) updateSensorValueInTitle('pressure', presSamples[presSamples.length - 1].value, 'hPa', 0);

        const tvocSamples = await listSamples("tvoc", "-3h", "10m");
        const eco2Samples = await listSamples("eco2", "-3h", "10m");
        renderCombinedChartData(airQualityLive, tvocSamples, eco2Samples, 180, true, false);

        // Update custom sensor displays with historical data
        const luxSamples = await listSamples("lux", "-3h", "10m");
        if (luxSamples && luxSamples.length > 0) updateLuxDisplay(luxSamples[luxSamples.length - 1].value, 'live');
        const raindropSamples = await listSamples("raindrop", "-3h", "10m");
        if (raindropSamples && raindropSamples.length > 0) updateRaindropDisplay(raindropSamples[raindropSamples.length - 1].value, 'live');
        const uvIndexSamples = await listSamples("uv_index", "-3h", "10m");
        if (uvIndexSamples && uvIndexSamples.length > 0) updateUvIndexDisplay(uvIndexSamples[uvIndexSamples.length - 1].value, 'live');

        // Update Air Quality display with latest historical data
        const hasTvocHist = tvocSamples && tvocSamples.length > 0;
        const hasEco2Hist = eco2Samples && eco2Samples.length > 0;
        if (hasTvocHist) latestTvoc = tvocSamples[tvocSamples.length - 1].value;
        if (hasEco2Hist) latestEco2 = eco2Samples[eco2Samples.length - 1].value;

        if (!hasTvocHist && !hasEco2Hist) {
            updateAirQualityDisplay(-1, -1, 'live');
        } else {
            updateAirQualityDisplay(latestTvoc, latestEco2, 'live');
        }
    }

    initSocketIO();
});

async function generateLocalHistoricalData() {
    console.log("Generating local historical data.");
    const now = new Date();
    const tempSamples = [];
    const humSamples = [];
    const presSamples = [];
    const tvocSamples = [];
    const eco2Samples = [];
    let luxSamples = [];
    let raindropSamples = [];
    let uvIndexSamples = [];

    for (let i = 180; i >= 0; i--) {
        const ts = new Date(now.getTime() - i * 60 * 1000).toISOString();
        tempSamples.push({ value: parseFloat((Math.random() * (30.0 - 15.0) + 15.0).toFixed(2)), ts: ts });
        humSamples.push({ value: parseFloat((Math.random() * (90.0 - 40.0) + 40.0).toFixed(2)), ts: ts });
        presSamples.push({ value: parseFloat((Math.random() * (1030.0 - 980.0) + 980.0).toFixed(2)), ts: ts });
        tvocSamples.push({ value: parseFloat((Math.random() * 1000.0).toFixed(2)), ts: ts });
        eco2Samples.push({ value: parseFloat((Math.random() * (2000.0 - 400.0) + 400.0).toFixed(2)), ts: ts });
    }
    // Only need the last value for these
    const lastTs = new Date().toISOString();
    luxSamples.push({ value: parseFloat((Math.random() * 1000.0).toFixed(2)), ts: lastTs });
    raindropSamples.push({ value: Math.round(Math.random()), ts: lastTs });
    uvIndexSamples.push({ value: parseFloat((Math.random() * 10.0).toFixed(2)), ts: lastTs });

    renderChartData(temperatureLive, tempSamples, 180, true, false);
    if (tempSamples && tempSamples.length > 0) updateSensorValueInTitle('temperature', tempSamples[tempSamples.length - 1].value, '°C', 1);
    renderChartData(humidityLive, humSamples, 180, true, false);
    if (humSamples && humSamples.length > 0) updateSensorValueInTitle('humidity', humSamples[humSamples.length - 1].value, '%', 1);
    renderChartData(pressureLive, presSamples, 180, true, false);
    if (presSamples && presSamples.length > 0) updateSensorValueInTitle('pressure', presSamples[presSamples.length - 1].value, 'hPa', 0);
    renderCombinedChartData(airQualityLive, tvocSamples, eco2Samples, 180, true, false);

    if (luxSamples.length > 0) updateLuxDisplay(luxSamples[luxSamples.length - 1].value, 'live');
    if (raindropSamples.length > 0) updateRaindropDisplay(raindropSamples[raindropSamples.length - 1].value, 'live');
    if (uvIndexSamples.length > 0) updateUvIndexDisplay(uvIndexSamples[uvIndexSamples.length - 1].value, 'live');

    if (tvocSamples.length > 0) latestTvoc = tvocSamples[tvocSamples.length - 1].value;
    if (eco2Samples.length > 0) latestEco2 = eco2Samples[eco2Samples.length - 1].value;
    updateAirQualityDisplay(latestTvoc, latestEco2, 'live');
}

function startLocalMocking() {
    console.log("Starting local data mocking for real-time updates.");
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }

    setInterval(() => {
        const ts = new Date().toISOString();
        const celsius = Math.random() * (30.0 - 15.0) + 15.0;
        const humidity = Math.random() * (90.0 - 40.0) + 40.0;
        const pressure = Math.random() * (1030.0 - 980.0) + 980.0;
        const lux = Math.random() * 1000.0;
        const raindrop = Math.round(Math.random());
        const uv_index = Math.random() * 10.0;
        const tvoc = Math.random() * 1000.0;
        const eco2 = Math.random() * (2000.0 - 400.0) + 400.0;

        renderChartData(temperatureLive, [{ value: parseFloat(celsius.toFixed(2)), ts: ts }], 180, true, false);
        updateSensorValueInTitle('temperature', celsius, '°C', 1);
        renderChartData(humidityLive, [{ value: parseFloat(humidity.toFixed(2)), ts: ts }], 180, true, false);
        updateSensorValueInTitle('humidity', humidity, '%', 1);
        renderChartData(pressureLive, [{ value: parseFloat(pressure.toFixed(2)), ts: ts }], 180, true, false);
        updateSensorValueInTitle('pressure', pressure, 'hPa', 0);

        const tvocMsg = { value: parseFloat(tvoc.toFixed(2)), ts: ts };
        updateCombinedChart(airQualityLive, tvocMsg, 'tvoc', 180);
        latestTvoc = tvocMsg.value;

        const eco2Msg = { value: parseFloat(eco2.toFixed(2)), ts: ts };
        updateCombinedChart(airQualityLive, eco2Msg, 'eco2', 180);
        latestEco2 = eco2Msg.value;

        updateAirQualityDisplay(latestTvoc, latestEco2, 'live');
        updateLuxDisplay(lux, 'live');
        updateRaindropDisplay(raindrop, 'live');
        updateUvIndexDisplay(uv_index, 'live');
    }, 2000);
}

function initSocketIO() {
    socket.on('connect', () => {
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
        }
    });

    socket.on('disconnect', (reason) => {
        if (mockingStarted) return;
        if (errorContainer) {
            errorContainer.textContent = 'Connection to the board lost. Please check the connection.';
            errorContainer.style.display = 'block';
        }
    });

    socket.on('connect_error', (err) => {
        if (!mockingStarted) {
            console.log("Connection error, switching to local mocking.", err);
            generateLocalHistoricalData();
            startLocalMocking();
            mockingStarted = true;
        }
    });

    // Live updates for charts
    socket.on('temperature', (message) => {
        renderChartData(temperatureLive, [message], 180, true, false);
        updateSensorValueInTitle('temperature', message.value, '°C', 1);
    });

    socket.on('humidity', (message) => {
        renderChartData(humidityLive, [message], 180, true, false);
        updateSensorValueInTitle('humidity', message.value, '%', 1);
    });

    socket.on('pressure', (message) => {
        renderChartData(pressureLive, [message], 180, true, false);
        updateSensorValueInTitle('pressure', message.value, 'hPa', 0);
    });

    socket.on('tvoc', (message) => {
        updateCombinedChart(airQualityLive, message, 'tvoc', 180);
        latestTvoc = message.value;
        updateAirQualityDisplay(latestTvoc, latestEco2, 'live');
    });
    socket.on('eco2', (message) => {
        updateCombinedChart(airQualityLive, message, 'eco2', 180);
        latestEco2 = message.value;
        updateAirQualityDisplay(latestTvoc, latestEco2, 'live');
    });

    // Live updates for custom sensor displays
    socket.on('lux', (message) => {
        updateLuxDisplay(message.value, 'live');
    });
    socket.on('raindrop', (message) => {
        updateRaindropDisplay(message.value, 'live');
    });
    socket.on('uv_index', (message) => {
        updateUvIndexDisplay(message.value, 'live');
    });
}

async function listSamples(resource, start, aggr_window) {
    try {
        const response = await fetch(`http://${window.location.host}/get_samples/${resource}/${start}/${aggr_window}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) {
            console.log(`Failed to get samples: ${data.error}`);
            return;
        }
        return data;
    } catch (error) {
        console.log(`Error fetching samples: ${error.message}`);
    }
}

function renderChartData(obj, messages, maxPoints = 20, showMinutes = true, showSeconds = true) {
    const noDataDiv = document.getElementById((obj.canvas && obj.canvas.id) + '-nodata');
    const realTimeValueDiv = obj.canvas ? obj.canvas.parentElement.querySelector('.graph-real-time-value') : null;

    if (!messages || messages.length === 0) {
        if (realTimeValueDiv) realTimeValueDiv.style.display = 'none';
        if (noDataDiv) noDataDiv.style.display = 'flex';
        if (obj.canvas) obj.canvas.style.display = 'none';
        if (obj.chart) { obj.chart.destroy(); obj.chart = null; }
        return;
    }

    if (realTimeValueDiv) realTimeValueDiv.style.display = 'flex';

    for (const message of messages) {
        if (!message.ts) {
            console.warn('Invalid message format:', message);
            continue;
        }

        let date = new Date(message.ts);
        if (showMinutes && showSeconds) {
            date = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else if (showMinutes) {
            date = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else {
            date = date.toLocaleTimeString([], {hour: '2-digit'});
        }

        obj.data.labels.push(date);
        obj.data.datasets[0].data.push(message.value);

        // Keep only the n points
        if (obj.data.labels.length > maxPoints) {
            obj.data.labels.shift();
            obj.data.datasets[0].data.shift();
        }
    }

    const noDataDivVisible = obj.data.labels.length === 0 || obj.data.datasets[0].data.length === 0;
    if (obj.canvas) obj.canvas.style.display = noDataDivVisible ? 'none' : 'block';
    if (noDataDiv) noDataDiv.style.display = noDataDivVisible ? 'flex' : 'none';
    if (realTimeValueDiv) realTimeValueDiv.style.display = noDataDivVisible ? 'none' : 'flex';

    if (noDataDivVisible) {
        if (obj.chart) {
            obj.chart.destroy();
            obj.chart = null;
        }
    } else {
        if (!obj.chart) {
            obj.chart = newChart(obj.canvas.getContext('2d'), obj);
        } else {
            obj.chart.update();
        }
    }
}

function renderCombinedChartData(obj, tvocMessages, eco2Messages, maxPoints = 20, showMinutes = true, showSeconds = true) {
    // Clear existing data
    obj.data.labels = [];
    obj.data.datasets[0].data = [];
    obj.data.datasets[1].data = [];

    const tvocMap = new Map((tvocMessages || []).map(m => [m.ts, m.value]));
    const eco2Map = new Map((eco2Messages || []).map(m => [m.ts, m.value]));

    const allTimestamps = [...new Set([...(tvocMessages || []).map(m => m.ts), ...(eco2Messages || []).map(m => m.ts)])].sort();

    let processedTimestamps = 0;
    // Iterate from the end to get the latest timestamps first
    for (let i = allTimestamps.length - 1; i >= 0; i--) {
        if (processedTimestamps >= maxPoints) break;
        const ts = allTimestamps[i];

        const date = new Date(ts);
        let label;
        if (showMinutes && showSeconds) {
            label = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else if (showMinutes) {
            label = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else {
            label = date.toLocaleTimeString([], {hour: '2-digit'});
        }

        obj.data.labels.unshift(label); // Add to the beginning
        obj.data.datasets[0].data.unshift(tvocMap.get(ts) ?? null); // tvoc
        obj.data.datasets[1].data.unshift(eco2Map.get(ts) ?? null); // eco2
        processedTimestamps++;
    }

    const noDataDiv = document.getElementById((obj.canvas && obj.canvas.id) + '-nodata');
    const noDataDivVisible = obj.data.labels.length === 0;
    if (obj.canvas) obj.canvas.style.display = noDataDivVisible ? 'none' : 'block';
    if (noDataDiv) noDataDiv.style.display = noDataDivVisible ? 'flex' : 'none';

    if (noDataDivVisible) {
        if (obj.chart) {
            obj.chart.destroy();
            obj.chart = null;
        }
    } else {
        if (!obj.chart) {
            obj.chart = newCombinedChart(obj.canvas.getContext('2d'), obj);
        } else {
            obj.chart.update();
        }
    }
}

function updateCombinedChart(obj, message, type, maxPoints = 20, showMinutes = true, showSeconds = true, doUpdate = true) {
    if (!message || !message.ts) {
        console.warn('Invalid message format:', message);
        return;
    }

    const noDataDiv = document.getElementById((obj.canvas && obj.canvas.id) + '-nodata');
    const datasetIndex = type === 'tvoc' ? 0 : 1;

    let date = new Date(message.ts);
    if (showMinutes && showSeconds) {
        date = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (showMinutes) {
        date = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        date = date.toLocaleTimeString([], { hour: '2-digit' });
    }

    obj.data.labels.push(date);
    obj.data.datasets[datasetIndex].data.push(message.value);

    // Keep only the n points
    if (obj.data.labels.length > maxPoints) {
        obj.data.labels.shift();
        // Shift data from both datasets to keep them in sync
        if (obj.data.datasets[0].data.length > maxPoints) obj.data.datasets[0].data.shift();
        if (obj.data.datasets[1].data.length > maxPoints) obj.data.datasets[1].data.shift();
    }

    const noDataDivVisible = obj.data.labels.length === 0;
    if (obj.canvas) obj.canvas.style.display = noDataDivVisible ? 'none' : 'block';
    if (noDataDiv) noDataDiv.style.display = noDataDivVisible ? 'flex' : 'none';

    if (noDataDivVisible) {
        if (obj.chart) {
            obj.chart.destroy();
            obj.chart = null;
        }
    } else {
        if (!obj.chart) {
            obj.chart = newCombinedChart(obj.canvas.getContext('2d'), obj);
        } else if (doUpdate) {
            obj.chart.update();
        }
    }
}


function newChart(ctx, obj) {
    return new Chart(ctx, {
        type: 'line',
        data: obj.data,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            scales: {
                y: obj.unit === '%' ? { min: 0, max: 100 } : {},
                x: {
                    grid: { display: false },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Showing last 3 hours',
                        padding: 0
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                            const unit = context.chart && context.chart.options && context.chart.options._unit ? context.chart.options._unit : (obj.unit || '');
                            // store unit in chart options for future reference
                            if (!context.chart.options._unit) context.chart.options._unit = obj.unit;
                            return `${context.label} - ${context.parsed.y.toFixed(1)} ${unit}`;
                        }
                    }
                },
                noDataMessage: true
            }
        }
    });
}

function newCombinedChart(ctx, obj) {
    return new Chart(ctx, {
        type: 'line',
        data: obj.data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y_tvoc: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'TVOC (ppb)'
                    }
                },
                y_eco2: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'eCO2 (ppm)'
                    },
                    grid: {
                        drawOnChartArea: false // only draw grid for left axis
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Showing last 3 hours',
                        padding: 0
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: true },
                tooltip: {
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                                if (context.dataset.yAxisID === 'y_tvoc') {
                                    label += ' ppb';
                                } else if (context.dataset.yAxisID === 'y_eco2') {
                                    label += ' ppm';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function newChartData(borderColor, backgroundColor) {
    return {
        labels: [],
        datasets: [{
            data: [],
            borderColor: borderColor,
            backgroundColor: backgroundColor,
            fill: true,
        }]
    };
}

function newCombinedChartData() {
    return {
        labels: [],
        datasets: [{
            label: 'TVOC',
            data: [],
            borderColor: 'brown',
            backgroundColor: 'rgba(165,42,42,0.1)',
            fill: true,
            yAxisID: 'y_tvoc'
        }, {
            label: 'eCO2',
            data: [],
            borderColor: 'green',
            backgroundColor: 'rgba(0,128,0,0.1)',
            fill: true,
            yAxisID: 'y_eco2'
        }]
    };
}

function updateSensorValueInTitle(baseName, value, unit, precision) {
    const valueElement = document.getElementById(`${baseName}-live-value`);
    if (valueElement) {
        valueElement.textContent = `${value.toFixed(precision)} ${unit}`;
    }

    if (baseName === 'pressure') {
        listSamples("pressure", "-3h", "60m").then(samples => {
            const iconSvgElement = document.getElementById('pressure-live-trend-icon-svg');
            const iconTextElement = document.getElementById('pressure-live-trend-icon-text');
            if (!iconSvgElement || !iconTextElement) return;

            // Default state: hide image, clear text
            iconSvgElement.style.display = 'none';
            iconTextElement.textContent = '';

            if (!samples || samples.length < 2) {
                return; // No data, leave icons hidden/empty
            }

            const latestTimestamp = new Date(samples[samples.length - 1].ts).getTime();
            let pressure3HoursAgo = null;

            for (let i = samples.length - 1; i >= 0; i--) {
                const sample = samples[i];
                if (latestTimestamp - new Date(sample.ts).getTime() >= 3 * 60 * 60 * 1000) {
                    pressure3HoursAgo = sample.value;
                    break;
                }
            }

            if (pressure3HoursAgo === null) {
                pressure3HoursAgo = samples[0].value;
            }

            const latestPressure = samples[samples.length - 1].value;
            const diff = latestPressure - pressure3HoursAgo;

            if (diff > 3) {
                iconSvgElement.src = './img/pressure-top.svg';
                iconSvgElement.style.display = 'inline';
            } else if (diff < -3) {
                iconSvgElement.src = './img/pressure-bottom.svg';
                iconSvgElement.style.display = 'inline';
            } else {
                iconTextElement.textContent = '—';
            }
        });
    }
}

// Function to update pressure trend icon
function updatePressureTrendIcon(pressureSamples, tabId) {
    // Let's try to modify the element next to it.
    const valueElement = document.getElementById(`pressure-${tabId}-value`);
    if (valueElement) {
        valueElement.textContent += ' TEST';
    }
}

// Function to update Lux display
function updateLuxDisplay(value, tabId) {
    const content = document.getElementById(`lux-${tabId}-content`);
    const noData = document.getElementById(`lux-${tabId}-nodata`);

    if (value < 0) {
        content.style.display = 'none';
        noData.style.display = 'flex';
        return;
    }

    content.style.display = 'block';
    noData.style.display = 'none';

    const valueElement = document.getElementById(`lux-${tabId}-value`);
    const progressBar = document.getElementById(`lux-${tabId}-progress`);
    const iconElement = document.getElementById(`lux-${tabId}-icon`);
    const unitElement = valueElement ? valueElement.nextSibling : null;

    if (valueElement) valueElement.textContent = value.toFixed(0);
    if (unitElement && unitElement.nodeType === Node.TEXT_NODE && !unitElement.textContent.includes('lux')) {
        unitElement.textContent = ' lux';
    }
    if (progressBar) progressBar.value = value;

    let iconSrc = '';
    if (value >= 0 && value <= 100) {
        iconSrc = './img/no-sun.svg';
    } else if (value > 100 && value <= 900) {
        iconSrc = './img/middle-sun.svg';
    } else if (value > 900) {
        iconSrc = './img/sun.svg';
    }
    if (iconElement) iconElement.src = iconSrc;
}

// Function to update Raindrop display
function updateRaindropDisplay(value, tabId) {
    const content = document.getElementById(`raindrop-${tabId}-content`);
    const noData = document.getElementById(`raindrop-${tabId}-nodata`);

    if (value < 0) {
        content.style.display = 'none';
        noData.style.display = 'flex';
        return;
    }

    content.style.display = 'block';
    noData.style.display = 'none';

    const iconElement = document.getElementById(`raindrop-${tabId}-icon`);
    const textElement = document.getElementById(`raindrop-${tabId}-text`);
    let iconSrc = '';
    let text = '';

    // Assuming value is 0 for no rain, 1 for rain
    if (value > 0) {
        iconSrc = './img/rain.svg';
        text = "It's raining";
    } else {
        iconSrc = './img/no-rain.svg';
        text = "It isn't raining";
    }
    if (iconElement) iconElement.src = iconSrc;
    if (textElement) textElement.textContent = text;
}

// Function to update UV Index display
function updateUvIndexDisplay(value, tabId) {
    const content = document.getElementById(`uv_index-${tabId}-content`);
    const noData = document.getElementById(`uv_index-${tabId}-nodata`);

    if (value < 0) {
        content.style.display = 'none';
        noData.style.display = 'flex';
        return;
    }

    content.style.display = 'block';
    noData.style.display = 'none';

    const valueElement = document.getElementById(`uv_index-${tabId}-value`);
    const progressBar = document.getElementById(`uv_index-${tabId}-progress`);
    const iconElement = document.getElementById(`uv_index-${tabId}-icon`);
    const unitElement = valueElement ? valueElement.nextSibling : null;

    if (valueElement) valueElement.textContent = value.toFixed(0);
    if (unitElement && unitElement.nodeType === Node.TEXT_NODE && !unitElement.textContent.includes('UV')) {
        unitElement.textContent = ' UV';
    }
    if (progressBar) progressBar.value = value;

    let iconSrc = '';
    if (value <= 2) {
        iconSrc = './img/uv-low.svg';
    } else if (value <= 5) {
        iconSrc = './img/uv-moderate.svg';
    } else { // Assuming > 5 is high
        iconSrc = './img/uv-high.svg';
    }
    if (iconElement) iconElement.src = iconSrc;
}

// Function to update Air Quality display
function updateAirQualityDisplay(tvocValue, eco2Value, tabId) {
    const airQualitySection = document.querySelector('.air-quality-section');
    const content = document.getElementById(`air-quality-${tabId}-content`);
    const noData = document.getElementById(`air-quality-${tabId}-nodata`);
    const iconElement = document.getElementById(`air-quality-icon-${tabId}`);
    const labelElement = document.getElementById(`air-quality-label-${tabId}`);
    const tvocElement = document.getElementById(`tvoc-value-${tabId}`);
    const eco2Element = document.getElementById(`eco2-value-${tabId}`);

    // Chart section elements
    const chartCanvas = document.getElementById('air-quality-live-chart');
    const chartNoData = document.getElementById('air-quality-live-chart-nodata');

    if (tvocValue < 0 || eco2Value < 0) {
        if (airQualitySection) {
            airQualitySection.style.display = 'flex';
            if (content) content.style.display = 'none';
            if (noData) noData.style.display = 'none';
            if (iconElement) iconElement.style.display = 'none';
            if (labelElement) labelElement.textContent = '';
            if (tvocElement) tvocElement.textContent = '';
            if (eco2Element) eco2Element.textContent = '';
        }
        if (chartCanvas) chartCanvas.style.display = 'none';
        if (chartNoData) chartNoData.style.display = 'flex';
        return;
    }

    if (airQualitySection) airQualitySection.style.display = 'flex';
    if (content) content.style.display = 'block';
    if (noData) noData.style.display = 'none';
    if (iconElement) iconElement.style.display = 'inline';
    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartNoData) chartNoData.style.display = 'none';

    let iconSrc = '';
    let label = '';
    let color = '';

    if (tvocValue > 500 || eco2Value > 1200) {
        iconSrc = './img/air-poor.svg';
        label = 'Poor';
        color = 'red';
    } else if ((tvocValue >= 250 && tvocValue <= 500) || (eco2Value >= 800 && eco2Value <= 1200)) {
        iconSrc = './img/air-moderate.svg';
        label = 'Moderate';
        color = 'orange';
    } else {
        iconSrc = './img/air-good.svg';
        label = 'Good';
        color = 'green';
    }

    if (iconElement) iconElement.src = iconSrc;
    if (labelElement) {
        labelElement.textContent = label;
        labelElement.style.color = color;
    }
    if (tvocElement) tvocElement.textContent = `TVOC: ${tvocValue.toFixed(0)} ppb`;
    if (eco2Element) eco2Element.textContent = `eCO2: ${eco2Value.toFixed(0)} ppm`;
}
