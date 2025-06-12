let refreshTimers = {};
let isInitialLoad = true;
let currentDashboard = null;
let dashboardInitialized = false;
let activeChartType = 'waterLevelChart';
let smallChartTypes = ['humidityChart', 'temperatureChart'];

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
        subtitle: 'Live Water Level Data',
        accessibilityDesc: 'water level',
        cellId: 'dashboard-col-0',
        smallTitleId: null,
    },
    humidityChart: {
        title: 'Humidity',
        yAxisTitle: 'Humidity (%)',
        unit: '%',
        connectorId: 'Humidity',
        dataKey: 'humidities',
        subtitle: 'Live Humidity Data',
        accessibilityDesc: 'humidity',
        cellId: 'dashboard-col-1',
        smallTitleId: 'small-chart-title-1',
    },
    temperatureChart: {
        title: 'Temperature',
        yAxisTitle: 'Temperature (°C)',
        unit: '°C',
        connectorId: 'Temperature',
        dataKey: 'temperatures',
        subtitle: 'Live Temperature Data',
        accessibilityDesc: 'temperature',
        cellId: 'dashboard-col-2',
        smallTitleId: 'small-chart-title-2',
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

    // Global Highcharts options (adapted from example)
    Highcharts.setOptions({
        chart: {
            type: 'area',
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
            enabled: false,
        },
        xAxis: {
            crosshair: true,
            type: 'datetime',
            labels: {
                format: '{value:%Y-%m-%d %H:%M}',
            },
            accessibility: {
                description: 'Date and time',
            },
        },
        yAxis: {
            title: {
                text: null,
            },
        },
        tooltip: {
            fixed: true,
            position: {
                align: 'right',
                relativeTo: 'spacingBox',
                y: -2,
            },
            padding: 2,
            pointFormat: '{point.y}',
            headerFormat: '',
            shadow: false,
            valueDecimals: 1,
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
                enabled: false, // Managed manually via HTML
            },
            components: Object.keys(chartConfig).map(key => {
                const config = chartConfig[key];
                return {
                    renderTo: config.cellId,
                    type: 'Highcharts',
                    connector: {
                        id: config.connectorId,
                        columnAssignment: rigs.map(rig => ({
                            seriesId: rig,
                            data: ['Timestamp', `${rig}_${config.dataKey}`],
                        })),
                    },
                    sync: {
                        highlight: true,
                    },
                    chartOptions: {
                        chart: {
                            animation: false,
                            type: 'area',
                        },
                        title: {
                            text: config.title,
                        },
                        subtitle: {
                            text: config.cellId === 'dashboard-col-0' ? config.subtitle : null,
                        },
                        yAxis: {
                            title: {
                                text: config.yAxisTitle,
                            },
                            min: 0,
                        },
                        tooltip: {
                            valueSuffix: ` ${config.unit}`,
                            valueDecimals: 1,
                        },
                        series: rigs.map(rig => ({
                            id: rig,
                            name: rig,
                            type: 'area',
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
                            description: `The chart displays live ${config.accessibilityDesc} data for multiple rigs over time.`,
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

        console.log('Dashboard initialized successfully');
        dashboardInitialized = true;
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        dashboardInitialized = false;
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
                            formattedData.slice(1, -1).map(row => [row[0], row[index + 1]])
                        );
                    }
                });
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

    // Update active and small chart types
    const oldActive = activeChartType;
    activeChartType = chartType;
    const index = smallChartTypes.indexOf(chartType);
    smallChartTypes[index] = oldActive;

    // Update cell assignments
    chartConfig[chartType].cellId = 'dashboard-col-0';
    chartConfig[oldActive].cellId = `dashboard-col-${index + 1}`;

    // Update titles
    const titleElement = document.getElementById('chartTitle');
    if (titleElement) titleElement.textContent = chartConfig[chartType].title;
    const smallTitle = document.getElementById(`small-chart-title-${index + 1}`);
    if (smallTitle) smallTitle.textContent = chartConfig[oldActive].title;

    // Reinitialize dashboard to apply new layout
    fetchAndUpdateDashboard();
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
            if (!dashboardInitialized) {
                initializeDashboard(response.data);
            } else {
                updateDashboardData(response.data);
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

    const container = document.getElementById('dashboard-col-0');
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