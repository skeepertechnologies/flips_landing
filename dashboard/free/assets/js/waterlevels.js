let refreshTimers = {};
let isInitialLoad = true;
let currentDashboard = null;
let currentChartType = 'waterLevelChart';
let dashboardInitialized = false;

// Function to show the loader
function showLoader(loadingMessage) {
    const loader = document.getElementById('chartLoader');
    if (loader && isInitialLoad) {
        loader.classList.remove('d-none');
        document.getElementById('loaderText').textContent = loadingMessage;
        const container = document.getElementById('dashboard-container');
        if (container) container.style.opacity = '0.5';
    }
}

// Function to hide the loader
function hideLoader() {
    const loader = document.getElementById('chartLoader');
    if (loader && isInitialLoad) {
        loader.classList.add('d-none');
        const container = document.getElementById('dashboard-container');
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
    const rows = [];

    const maxLength = Math.max(
        ...rigs.map(rig => (data.current_data[rig].timestamps || []).length)
    );

    for (let i = 0; i < maxLength; i++) {
        const row = [null];
        rigs.forEach(rig => {
            const timestamp = data.current_data[rig].timestamps[i];
            const value = data.current_data[rig][dataKey][i];
            row[0] = timestamp ? Date.parse(timestamp) : null;
            row.push(value != null ? value : null);
        });
        rows.push(row);
    }

    const latestRow = ['Latest'];
    rigs.forEach(rig => {
        const latestValue = data.current_data[rig][dataKey].slice(-1)[0] || null;
        latestRow.push(latestValue != null ? Number(latestValue).toFixed(2) : 'N/A');
    });
    rows.push(latestRow);

    return [headers, ...rows];
}

// Function to initialize the dashboard
async function initializeDashboard(chartType, data) {
    console.log('Initializing dashboard for:', chartType);
    const chartConfig = {
        waterLevelChart: {
            title: 'Water Levels Over Time',
            yAxisTitle: 'Water Level (ft)',
            unit: 'ft',
            connectorId: 'Water-Levels',
            dataKey: 'levels',
            subtitle: 'Live Water Level Data',
            accessibilityDesc: 'water level',
        },
        humidityChart: {
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            unit: '%',
            connectorId: 'Humidity',
            dataKey: 'humidities',
            subtitle: 'Live Humidity Data',
            accessibilityDesc: 'humidity',
        },
        temperatureChart: {
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            unit: '°C',
            connectorId: 'Temperature',
            dataKey: 'temperatures',
            subtitle: 'Live Temperature Data',
            accessibilityDesc: 'temperature',
        },
    };

    const { title, yAxisTitle, unit, connectorId, dataKey, subtitle, accessibilityDesc } = chartConfig[chartType];
    const formattedData = formatDataForDashboard(data, chartType);
    const rigs = data.current_data ? Object.keys(data.current_data) : [];

    // Ensure dashboard-container exists
    let container = document.getElementById('dashboard-container');
    if (!container) {
        console.error('Dashboard container not found, attempting to recreate');
        container = document.createElement('div');
        container.id = 'dashboard-container';
        container.style.minHeight = '600px';
        container.style.position = 'relative';
        document.querySelector('.card-body').appendChild(container);
    }

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

    Highcharts.setOptions({
        chart: {
            styledMode: true,
        },
    });

    try {
        console.log('Creating new dashboard');
        currentDashboard = await Dashboards.board('dashboard-container', {
            dataPool: {
                connectors: [{
                    id: connectorId,
                    type: 'JSON',
                    options: {
                        data: formattedData,
                    },
                }],
            },
            gui: {
                enabled: true,
                layouts: [{
                    id: 'layout-1',
                    rows: [{
                        cells: [{
                            id: 'dashboard-col-1',
                            width: '7/10',
                        }, {
                            id: 'dashboard-col-2',
                            width: '3/10',
                        }],
                    }],
                }],
            },
            components: [{
                renderTo: 'dashboard-col-1',
                type: 'Highcharts',
                connector: {
                    id: connectorId,
                    columnAssignment: rigs.map(rig => ({
                        seriesId: rig,
                        data: ['Timestamp', `${rig}_${dataKey}`],
                    })),
                },
                sync: {
                    highlight: true,
                },
                chartOptions: {
                    chart: {
                        animation: false,
                        type: 'areaspline',
                        zoomType: 'x',
                    },
                    title: {
                        text: title,
                    },
                    subtitle: {
                        text: subtitle,
                    },
                    xAxis: {
                        type: 'datetime',
                        title: {
                            text: 'Date',
                        },
                        accessibility: {
                            description: 'Date and time',
                        },
                    },
                    yAxis: {
                        title: {
                            text: yAxisTitle,
                        },
                    },
                    tooltip: {
                        shared: true,
                        split: true,
                        stickOnContact: true,
                        valueSuffix: ` ${unit}`,
                    },
                    series: rigs.map(rig => ({
                        id: rig,
                        name: rig,
                    })),
                    exporting: {
                        enabled: true,
                    },
                    navigator: {
                        enabled: true,
                    },
                    scrollbar: {
                        enabled: true,
                    },
                    accessibility: {
                        description: `The chart displays live ${accessibilityDesc} data for multiple rigs over time.`,
                    },
                },
            }, {
                renderTo: 'dashboard-col-2',
                type: 'DataGrid',
                connector: {
                    id: connectorId,
                },
                sync: {
                    highlight: true,
                },
                dataGridOptions: {
                    credits: {
                        enabled: false,
                    },
                    columns: [{
                        id: 'Timestamp',
                        cells: {
                            formatter: function () {
                                if (this.value === 'Latest') return this.value;
                                return new Date(this.value).toLocaleString();
                            },
                        },
                    }, ...rigs.map(rig => ({
                        id: `${rig}_${dataKey}`,
                        header: rig,
                    }))],
                },
            }],
        });

        // Update chart title
        const titleElement = document.getElementById('chartTitle');
        if (titleElement) titleElement.textContent = title;
        console.log('Dashboard initialized successfully');
        dashboardInitialized = true;
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        dashboardInitialized = false;
    }
}

// Function to update dashboard data without reinitializing
function updateDashboardData(chartType, data) {
    if (!currentDashboard || !dashboardInitialized) {
        console.log('Dashboard not initialized, initializing now');
        return initializeDashboard(chartType, data);
    }

    const chartConfig = {
        waterLevelChart: { connectorId: 'Water-Levels', dataKey: 'levels' },
        humidityChart: { connectorId: 'Humidity', dataKey: 'humidities' },
        temperatureChart: { connectorId: 'Temperature', dataKey: 'temperatures' },
    };

    const { connectorId, dataKey } = chartConfig[chartType];
    const formattedData = formatDataForDashboard(data, chartType);
    const rigs = data.current_data ? Object.keys(data.current_data) : [];

    try {
        console.log('Updating dashboard data');
        // Update Highcharts component
        const chartComponent = currentDashboard.getComponentByCellId('dashboard-col-1');
        if (chartComponent && chartComponent.chart) {
            const chart = chartComponent.chart;
            rigs.forEach((rig, index) => {
                const series = chart.series[index];
                if (series) {
                    series.setData(
                        formattedData.slice(1, -1).map(row => [row[0], row[index + 1]])
                    );
                }
            });
        }

        // Update DataGrid component
        const gridComponent = currentDashboard.getComponentByCellId('dashboard-col-2');
        if (gridComponent && gridComponent.dataGrid) {
            gridComponent.dataGrid.setData(formattedData);
        }

        return true;
    } catch (error) {
        console.error('Error updating dashboard data:', error);
        return initializeDashboard(chartType, data);
    }
}

// Function to fetch and update dashboard data
function fetchAndUpdateDashboard(chartType) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error(`No authentication token found for ${chartType}. Redirecting to login.`);
        alert('Your session has expired. Please sign in again.');
        window.location.href = '../login/login.html';
        return;
    }

    const loadingMessages = {
        waterLevelChart: 'Loading Water Levels...',
        humidityChart: 'Loading Humidity Data...',
        temperatureChart: 'Loading Temperature Data...',
    };

    showLoader(loadingMessages[chartType]);

    axios
        .get('https://api.flipsintel.org/monitor/graph-data/', {
            headers: { Authorization: `Token ${token}` },
        })
        .then((response) => {
            console.log('API response received:', response.data);
            const container = document.getElementById('dashboard-container');
            if (!container) {
                console.error('Dashboard container not found during refresh, reinitializing');
                initializeDashboard(chartType, response.data);
            } else if (dashboardInitialized) {
                updateDashboardData(chartType, response.data);
            } else {
                initializeDashboard(chartType, response.data);
            }
            hideLoader();
        })
        .catch((error) => {
            console.error(`Error fetching ${chartType} data:`, error);
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
            hideLoader();
        });
}

// Function to switch the dashboard
function switchChart(chartType, chartTitle) {
    console.log('Switching chart to:', chartType);
    clearRefreshTimers();
    currentChartType = chartType;
    const titleElement = document.getElementById('chartTitle');
    if (titleElement) titleElement.textContent = chartTitle;
    fetchAndUpdateDashboard(chartType);
    refreshTimers[chartType] = setInterval(() => fetchAndUpdateDashboard(chartType), 5000);
}

// Function to clear all refresh timers
function clearRefreshTimers() {
    Object.keys(refreshTimers).forEach((chartType) => {
        clearInterval(refreshTimers[chartType]);
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
    switchChart('waterLevelChart', 'Water Levels');
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, starting initialization');
    initializeWithRetry();
});