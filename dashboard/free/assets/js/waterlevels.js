let refreshTimers = {};
let isInitialLoad = true;
let currentDashboard = null;
let dashboardInitialized = false;
let activeChartType = 'waterLevelChart';
let smallChartTypes = ['humidityChart', 'temperatureChart'];
let mainChartType = 'line';
let isUpdating = false; // Prevent concurrent updates

// Function to show the loader
function showLoader(loadingMessage) {
    const loader = document.getElementById('chartLoader');
    if (loader && isInitialLoad) {
        loader.classList.remove('d-none');
        document.getElementById('loaderText').textContent = loadingMessage;
        const container = document.getElementById('dashboard-col-0');
        if (container) container.style.opacity = '0.5';
    }
}

// Function to hide the loader
function hideLoader() {
    const loader = document.getElementById('chartLoader');
    if (loader && isInitialLoad) {
        loader.classList.add('d-none');
        const container = document.getElementById('dashboard-col-0');
        if (container) container.style.opacity = '1';
        isInitialLoad = false;
    }
}

// Function to filter data for the last 30 minutes
function filterRecentData(data, minutes = 30) {
    if (!data || !data.current_data) return { current_data: {} };

    const now = Date.now();
    const timeThreshold = now - minutes * 60 * 1000;

    const filteredData = { current_data: {} };
    const rigs = Object.keys(data.current_data);

    rigs.forEach(rig => {
        const rigData = data.current_data[rig];
        const filteredIndices = rigData.timestamps
            .map((ts, i) => ({ ts: Date.parse(ts), index: i }))
            .filter(item => item.ts >= timeThreshold)
            .map(item => item.index);

        filteredData.current_data[rig] = {
            timestamps: filteredIndices.map(i => rigData.timestamps[i] || null),
            levels: filteredIndices.map(i => rigData.levels[i] || null),
            humidities: filteredIndices.map(i => rigData.humidities[i] || null),
            temperatures: filteredIndices.map(i => rigData.temperatures[i] || null),
        };
    });

    return filteredData;
}

// Function to format API data for Highcharts Dashboard
function formatDataForDashboard(data, chartType) {
    if (!data || !data.current_data || !Object.keys(data.current_data).length) {
        console.warn('No valid data received for', chartType);
        return [['Timestamp'], ['Latest']];
    }

    const rigs = Object.keys(data.current_data);
    const dataKey = chartType === 'waterLevelChart' ? 'levels' :
                    chartType === 'humidityChart' ? 'humidities' : 'temperatures';
    const headers = ['Timestamp', ...rigs.map(rig => `${rig}_${dataKey}`)];

    const allDataPoints = [];
    rigs.forEach(rig => {
        const rigData = data.current_data[rig];
        rigData.timestamps.forEach((timestamp, i) => {
            if (timestamp && rigData[dataKey][i] != null) {
                allDataPoints.push({
                    timestamp: Date.parse(timestamp),
                    rig,
                    value: rigData[dataKey][i],
                });
            }
        });
    });

    allDataPoints.sort((a, b) => a.timestamp - b.timestamp);

    const uniqueTimestamps = [...new Set(allDataPoints.map(p => p.timestamp))];
    const rows = uniqueTimestamps.map(ts => {
        const row = [ts];
        rigs.forEach(rig => {
            const point = allDataPoints.find(p => p.timestamp === ts && p.rig === rig);
            row.push(point && point.value != null ? point.value : null);
        });
        return row;
    });

    const latestRow = ['Latest'];
    rigs.forEach(rig => {
        const latestValue = data.current_data[rig][dataKey].slice(-1)[0] || null;
        latestRow.push(latestValue != null ? Number(latestValue).toFixed(2) : 'N/A');
    });
    rows.push(latestRow);

    return [headers, ...rows];
}

// Chart configuration
const chartConfig = {
    waterLevelChart: {
        title: 'Water Levels',
        yAxisTitle: 'Water Level (ft)',
        unit: 'ft',
        connectorId: 'Water-Levels',
        dataKey: 'levels',
        subtitle: 'Live Water Level Data (Last 30 Minutes)',
        accessibilityDesc: 'water level',
        cellId: 'dashboard-col-0',
        smallTitleId: null,
        defaultChartType: 'line',
    },
    humidityChart: {
        title: 'Humidity',
        yAxisTitle: 'Humidity (%)',
        unit: '%',
        connectorId: 'Humidity',
        dataKey: 'humidities',
        subtitle: 'Live Humidity Data (Last 30 Minutes)',
        accessibilityDesc: 'humidity',
        cellId: 'dashboard-col-1',
        smallTitleId: 'small-chart-title-1',
        defaultChartType: 'line',
    },
    temperatureChart: {
        title: 'Temperature',
        yAxisTitle: 'Temperature (°C)',
        unit: '°C',
        connectorId: 'Temperature',
        dataKey: 'temperatures',
        subtitle: 'Live Temperature Data (Last 30 Minutes)',
        accessibilityDesc: 'temperature',
        cellId: 'dashboard-col-2',
        smallTitleId: 'small-chart-title-2',
        defaultChartType: 'column',
    },
};

// Function to initialize the dashboard
async function initializeDashboard(data) {
    console.log('Initializing dashboard');
    const rigs = data.current_data ? Object.keys(data.current_data) : [];

    // Destroy existing dashboard
    if (currentDashboard && typeof currentDashboard.destroy === 'function') {
        try {
            console.log('Destroying previous dashboard');
            currentDashboard.destroy();
            currentDashboard = null;
        } catch (e) {
            console.warn('Error destroying previous dashboard:', e);
        }
    }

    // Global Highcharts options
    Highcharts.setOptions({
        chart: {
            spacingTop: 20,
            spacingBottom: 20,
            styledMode: true,
        },
        title: {
            align: 'left',
            margin: 0,
            x: 30,
        },
        credits: {
            enabled: false,
        },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            itemStyle: {
                fontSize: '12px',
            },
        },
        xAxis: {
            crosshair: true,
            type: 'datetime',
            labels: {
                format: '{value:%H:%M}',
            },
            accessibility: {
                description: 'Time (Last 30 Minutes)',
            },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
        },
        yAxis: {
            title: {
                text: null,
            },
        },
        tooltip: {
            shared: true,
            valueDecimals: 1,
            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b> {series.options.tooltip.valueSuffix}<br/>',
        },
    });

    try {
        console.log('Creating new dashboard');
        currentDashboard = await Dashboards.board('dashboard-container', {
            dataPool: {
                connectors: Object.keys(chartConfig).map(key => ({
                    id: chartConfig[key].connectorId,
                    type: 'JSON',
                    options: {
                        data: formatDataForDashboard(data, key),
                    },
                })),
            },
            gui: {
                enabled: true,
                layouts: [{
                    id: 'layout-1',
                    rows: [{
                        cells: [{
                            id: 'dashboard-col-0',
                            width: '100%',
                            height: '400px',
                        }],
                    }, {
                        cells: [{
                            id: 'dashboard-col-1',
                            width: '1/2',
                            height: '180px',
                        }, {
                            id: 'dashboard-col-2',
                            width: '1/2',
                            height: '180px',
                        }],
                    }],
                }],
            },
            components: Object.keys(chartConfig).map(key => {
                const config = chartConfig[key];
                return {
                    cell: config.cellId,
                    type: 'Highcharts',
                    connector: {
                        id: chartConfig[key].connectorId,
                        columnAssignment: rigs.length ? rigs.map(rig => ({
                            seriesId: rig,
                            data: ['Timestamp', `${rig}_${config.dataKey}`],
                        })) : [],
                    },
                    sync: {
                        highlight: {
                            enabled: true,
                            type: 'highlight',
                        },
                    },
                    chartOptions: {
                        chart: {
                            animation: false,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                        },
                        title: {
                            text: null,
                        },
                        subtitle: {
                            text: config.subtitle,
                        },
                        yAxis: {
                            title: {
                                text: config.yAxisTitle,
                            },
                            min: 0,
                        },
                        tooltip: {
                            valueSuffix: ` ${config.unit}`,
                        },
                        series: rigs.length ? rigs.map(rig => ({
                            id: rig,
                            name: rig,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                        })) : [{ id: 'empty', name: 'No Data', data: [] }],
                        exporting: {
                            enabled: config.cellId === 'dashboard-col-0',
                        },
                        navigator: {
                            enabled: config.cellId === 'dashboard-col-0',
                        },
                        scrollbar: {
                            enabled: config.cellId === 'dashboard-col-0',
                        },
                        accessibility: {
                            description: `The chart displays live ${config.accessibilityDesc} data for multiple rigs over the last 30 minutes.`,
                        },
                    },
                };
            }),
        }, true);

        // Update titles
        const titleElement = document.getElementById('chartTitle');
        if (titleElement) titleElement.textContent = chartConfig[activeChartType].title;
        smallChartTypes.forEach((type, index) => {
            const smallTitle = document.getElementById(`small-chart-title-${index + 1}`);
            if (smallTitle) smallTitle.textContent = chartConfig[type].title;
        });

        // Add click handlers for small charts
        smallChartTypes.forEach((type, index) => {
            const cell = document.getElementById(chartConfig[type].cellId);
            if (cell) {
                cell.addEventListener('click', () => switchChart(type));
            }
        });

        // Add chart type change handler
        const chartTypeSelect = document.getElementById('chartTypeSelect');
        if (chartTypeSelect) {
            chartTypeSelect.value = mainChartType;
            chartTypeSelect.addEventListener('change', (e) => {
                mainChartType = e.target.value;
                updateMainChartType();
            });
        }

        console.log('Dashboard initialized successfully');
        dashboardInitialized = true;
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        dashboardInitialized = false;
    }
}

// Function to update main chart type
function updateMainChartType() {
    const component = currentDashboard.getComponentByCellId('dashboard-col-0');
    if (component && component.chart) {
        const chart = component.chart;
        chart.series.forEach(series => {
            if (series) {
                series.update({ type: mainChartType }, false);
            }
        });
        chart.redraw();
    }
}

// Function to update dashboard data
function updateDashboardData(data) {
    if (!currentDashboard || !dashboardInitialized || isUpdating) {
        console.log('Dashboard not initialized or update in progress, initializing now');
        return initializeDashboard(data);
    }

    isUpdating = true;

    try {
        console.log('Updating dashboard data');
        const rigs = data.current_data ? Object.keys(data.current_data) : [];

        Object.keys(chartConfig).forEach(key => {
            const config = chartConfig[key];
            const formattedData = formatDataForDashboard(data, key);
            const component = currentDashboard.getComponentByCellId(config.cellId);
            if (component && component.chart) {
                const chart = component.chart;

                // Update existing series or add new ones
                rigs.forEach((rig, index) => {
                    let series = chart.series.find(s => s.options.id === rig);
                    if (!series && formattedData[0][index + 1]) {
                        chart.addSeries({
                            id: rig,
                            name: rig,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                            data: [],
                        }, false);
                        series = chart.series[chart.series.length - 1];
                    }
                    if (series) {
                        const seriesData = formattedData.slice(1, -1)
                            .map(row => [row[0], row[index + 1]])
                            .filter(d => d[0] != null && d[1] != null);
                        series.setData(seriesData, false);
                    }
                });

                // Remove series for rigs no longer present
                chart.series.slice().forEach(series => {
                    if (series.options.id !== 'empty' && !rigs.includes(series.options.id)) {
                        series.remove(false);
                    }
                });

                chart.redraw();
            }
        });

        isUpdating = false;
        return true;
    } catch (error) {
        console.error('Error updating dashboard data:', error);
        isUpdating = false;
        return initializeDashboard(data);
    }
}

// Function to switch charts
function switchChart(chartType) {
    if (chartType === activeChartType || isUpdating) return;
    console.log('Switching chart to:', chartType);

    const oldActive = activeChartType;
    activeChartType = chartType;
    const index = smallChartTypes.indexOf(chartType);
    smallChartTypes[index] = oldActive;

    // Update cell assignments in chartConfig
    chartConfig[chartType].cellId = 'dashboard-col-0';
    chartConfig[oldActive].cellId = `dashboard-col-${index + 1}`;

    // Update titles
    const titleElement = document.getElementById('chartTitle');
    if (titleElement) titleElement.textContent = chartConfig[chartType].title;
    const smallTitle = document.getElementById(`small-chart-title-${index + 1}`);
    if (smallTitle) smallTitle.textContent = chartConfig[oldActive].title;

    // Update dashboard layout
    const layout = currentDashboard.layouts[0];
    const components = currentDashboard.components;

    components.forEach(component => {
        const config = Object.values(chartConfig).find(c => c.connectorId === component.connector.id);
        if (config) {
            component.cell = config.cellId;
            if (component.chart) {
                component.chart.series.forEach(series => {
                    if (series) {
                        series.update({
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType
                        }, false);
                    }
                });
                component.chart.redraw();
            }
        }
    });

    layout.redraw();
}

// Function to fetch and update dashboard data
function fetchAndUpdateDashboard() {
    if (isUpdating) {
        console.log('Update already in progress, skipping');
        return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        alert('Your session has expired. Please sign in again.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader(`Loading ${chartConfig[activeChartType].title}...`);

    axios
        .get('https://api.flipsintel.org/monitor/graph-data/', {
            headers: { Authorization: `Token ${token}` },
        })
        .then((response) => {
            console.log('API response received:', response.data);
            const filteredData = filterRecentData(response.data, 30);
            if (!dashboardInitialized) {
                initializeDashboard(filteredData);
            } else {
                updateDashboardData(filteredData);
            }
            hideLoader();
        })
        .catch((error) => {
            console.error('Error fetching data:', error);
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
            hideLoader();
        });
}

// Function to clear all refresh timers
function clearRefreshTimers() {
    Object.keys(refreshTimers).forEach((key) => {
        clearInterval(refreshTimers[key]);
    });
    refreshTimers = {};
}

// Initialize on page load with retry mechanism
function initializeWithRetry(attempts = 3, delay = 100) {
    if (attempts === 0) {
        console.error('Failed to initialize dashboard after retries');
        return;
    }

    const container = document.getElementById('dashboard-container');
    const col0 = document.getElementById('dashboard-col-0');
    const col1 = document.getElementById('dashboard-col-1');
    const col2 = document.getElementById('dashboard-col-2');
    if (!container || !col0 || !col1 || !col2) {
        console.warn(`Required DOM elements not found, retrying in ${delay}ms (${attempts} attempts left)`);
        setTimeout(() => initializeWithRetry(attempts - 1, delay * 2), delay);
        return;
    }

    console.log('Dashboard containers found, starting initialization');
    fetchAndUpdateDashboard();
    refreshTimers['dashboard'] = setInterval(() => fetchAndUpdateDashboard(), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, starting initialization');
    initializeWithRetry();
});