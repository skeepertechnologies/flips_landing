let refreshTimers = {};
let isInitialLoad = true;
let currentDashboard = null;
let dashboardInitialized = false;
let activeChartType = 'waterLevelChart';
let smallChartTypes = ['humidityChart', 'temperatureChart'];
let mainChartType = 'line'; // Default chart type for main chart

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
    if (!data || !data.current_data) return data;

    const now = Date.now();
    const timeThreshold = now - minutes * 60 * 1000; // Convert minutes to milliseconds

    const filteredData = { current_data: {} };
    const rigs = Object.keys(data.current_data);

    rigs.forEach(rig => {
        const rigData = data.current_data[rig];
        const filteredIndices = rigData.timestamps
            .map((ts, i) => ({ ts: Date.parse(ts), index: i }))
            .filter(item => item.ts >= timeThreshold)
            .map(item => item.index);

        filteredData.current_data[rig] = {
            timestamps: filteredIndices.map(i => rigData.timestamps[i]),
            levels: filteredIndices.map(i => rigData.levels[i]),
            humidities: filteredIndices.map(i => rigData.humidities[i]),
            temperatures: filteredIndices.map(i => rigData.temperatures[i]),
        };
    });

    return filteredData;
}

// Function to format API data for Highcharts Dashboard
function formatDataForDashboard(data, chartType) {
    if (!data || !data.current_data) {
        console.warn('No valid data received from API');
        return [['Timestamp'], ['Latest']];
    }

    const rigs = Object.keys(data.current_data);
    const dataKey = chartType === 'waterLevelChart' ? 'levels' :
                    chartType === 'humidityChart' ? 'humidities' : 'temperatures';
    const headers = ['Timestamp', ...rigs.map(rig => `${rig}_${dataKey}`)];

    // Collect all data points with timestamps
    const allDataPoints = [];
    rigs.forEach(rig => {
        const rigData = data.current_data[rig];
        rigData.timestamps.forEach((timestamp, i) => {
            allDataPoints.push({
                timestamp: Date.parse(timestamp),
                rig,
                value: rigData[dataKey][i],
            });
        });
    });

    // Sort by timestamp in ascending order
    allDataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // Group by unique timestamps
    const uniqueTimestamps = [...new Set(allDataPoints.map(p => p.timestamp))];
    const rows = uniqueTimestamps.map(ts => {
        const row = [ts];
        rigs.forEach(rig => {
            const point = allDataPoints.find(p => p.timestamp === ts && p.rig === rig);
            row.push(point && point.value != null ? point.value : null);
        });
        return row;
    });

    // Add latest row
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

    // Destroy existing dashboard if it exists
    if (currentDashboard && typeof currentDashboard.destroy === 'function') {
        try {
            console.log('Destroying previous dashboard');
            currentDashboard.destroy();
        } catch (e) {
            console.warn('Error destroying previous dashboard:', e);
        }
    }
    currentDashboard = null;

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
                        id: config.connectorId,
                        columnAssignment: rigs.map(rig => ({
                            seriesId: rig,
                            data: ['Timestamp', `${rig}_${config.dataKey}`],
                        })),
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
                        series: rigs.map(rig => ({
                            id: rig,
                            name: rig,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                        })),
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
            series.update({ type: mainChartType }, false);
        });
        chart.redraw();
    }
}

// Function to update dashboard data
function updateDashboardData(data) {
    if (!currentDashboard || !dashboardInitialized) {
        console.log('Dashboard not initialized, initializing now');
        return initializeDashboard(data);
    }

    try {
        console.log('Updating dashboard data');
        Object.keys(chartConfig).forEach(key => {
            const config = chartConfig[key];
            const formattedData = formatDataForDashboard(data, key);
            const rigs = data.current_data ? Object.keys(data.current_data) : [];
            const component = currentDashboard.getComponentByCellId(config.cellId);
            if (component && component.chart) {
                const chart = component.chart;
                rigs.forEach((rig, index) => {
                    const series = chart.series[index];
                    if (series) {
                        series.setData(
                            formattedData.slice(1, -1).map(row => [row[0], row[index + 1]]),
                            false
                        );
                    }
                });
                chart.redraw();
            }
        });
        return true;
    } catch (error) {
        console.error('Error updating dashboard data:', error);
        return initializeDashboard(data);
    }
}

// Function to switch charts
function switchChart(chartType) {
    if (chartType === activeChartType) return;
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
                    series.update({
                        type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType
                    }, false);
                });
                component.chart.redraw();
            }
        }
    });

    layout.redraw();
}

// Function to fetch and update dashboard data
function fetchAndUpdateDashboard() {
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
            const filteredData = filterRecentData(response.data, 30); // Filter to last 30 minutes
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
    if (!container) {
        console.warn(`Dashboard container not found, retrying in ${delay}ms (${attempts} attempts left)`);
        setTimeout(() => initializeWithRetry(attempts - 1, delay * 2), delay);
        return;
    }

    console.log('Dashboard container found, starting initialization');
    fetchAndUpdateDashboard();
    refreshTimers['dashboard'] = setInterval(() => fetchAndUpdateDashboard(), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, starting initialization');
    initializeWithRetry();
});