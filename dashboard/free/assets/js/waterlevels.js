// Global variables
let refreshTimers = {};
let isInitialLoad = true;
let currentDashboard = null;
let dashboardInitialized = false;
let activeChartType = 'waterLevelChart';
let smallChartTypes = ['humidityChart', 'temperatureChart', 'networkGraph'];
let mainChartType = 'line';
let isUpdating = false;

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
        legendEnabled: true,
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
        legendEnabled: true,
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
        legendEnabled: true,
    },
    networkGraph: {
        title: 'Rig Network',
        yAxisTitle: null,
        unit: '',
        connectorId: 'Network-Graph',
        dataKey: 'network',
        subtitle: 'Rig Interaction Network',
        accessibilityDesc: 'rig interactions',
        cellId: 'dashboard-col-3',
        smallTitleId: 'small-chart-title-3',
        defaultChartType: 'networkgraph',
        legendEnabled: false,
    },
};

// Show loader
function showLoader(loadingMessage) {
    const loader = document.getElementById('chartLoader');
    if (loader && isInitialLoad) {
        loader.classList.remove('d-none');
        document.getElementById('loaderText').textContent = loadingMessage;
        document.getElementById('dashboard-col-0').style.opacity = '0.5';
    }
}

// Hide loader
function hideLoader() {
    const loader = document.getElementById('chartLoader');
    if (loader) {
        loader.classList.add('d-none');
        document.getElementById('dashboard-col-0').style.opacity = '1';
        isInitialLoad = false;
    }
}

// Filter data for the last 30 minutes
function filterRecentData(data, minutes = 30) {
    if (!data || !data.current_data) return { current_data: {} };

    const now = Date.now();
    const timeThreshold = now - minutes * 60 * 1000;
    const filteredData = { current_data: {} };

    Object.keys(data.current_data).forEach(rig => {
        const rigData = data.current_data[rig];
        const filteredIndices = rigData.timestamps
            .map((ts, i) => ({ ts: Date.parse(ts), index: i }))
            .filter(item => !isNaN(item.ts) && item.ts >= timeThreshold)
            .map(item => item.index);

        filteredData.current_data[rig] = {
            timestamps: filteredIndices.map(i => rigData.timestamps[i] || null),
            levels: filteredIndices.map(i => rigData.levels[i] != null ? Number(rigData.levels[i]) : null),
            humidities: filteredIndices.map(i => rigData.humidities[i] != null ? Number(rigData.humidities[i]) : null),
            temperatures: filteredIndices.map(i => rigData.temperatures[i] != null ? Number(rigData.temperatures[i]) : null),
        };
    });

    return filteredData;
}

// Format network graph data
function formatNetworkGraphData(data) {
    if (!data || !data.current_data) return { nodes: [], links: [] };

    const rigs = Object.keys(data.current_data);
    const nodes = rigs.map(rig => ({ id: rig }));
    const links = [];

    for (let i = 0; i < rigs.length; i++) {
        for (let j = i + 1; j < rigs.length; j++) {
            const rig1 = data.current_data[rigs[i]];
            const rig2 = data.current_data[rigs[j]];
            const latestLevel1 = rig1.levels.slice(-1)[0] || 0;
            const latestLevel2 = rig2.levels.slice(-1)[0] || 0;
            if (Math.abs(latestLevel1 - latestLevel2) < 5) {
                links.push({ from: rigs[i], to: rigs[j], weight: 1 });
            }
        }
    }

    return { nodes, links };
}

// Format data for Highcharts Dashboard with gap filling
function formatDataForDashboard(data, chartType) {
    if (chartType === 'networkGraph') {
        const networkData = formatNetworkGraphData(data);
        return {
            series: [{
                type: 'networkgraph',
                dataLabels: { enabled: true },
                nodes: networkData.nodes,
                data: networkData.links,
            }],
        };
    }

    if (!data || !data.current_data || !Object.keys(data.current_data).length) {
        console.warn(`No valid data for ${chartType}`);
        return [['Timestamp'], ['Latest']];
    }

    const rigs = Object.keys(data.current_data);
    const dataKey = chartType === 'waterLevelChart' ? 'levels' :
                    chartType === 'humidityChart' ? 'humidities' : 'temperatures';
    const headers = ['Timestamp', ...rigs.map(rig => `${rig}_${dataKey}`)];
    const allDataPoints = [];

    // Collect all valid data points
    rigs.forEach(rig => {
        const rigData = data.current_data[rig];
        rigData.timestamps.forEach((timestamp, i) => {
            if (timestamp && !isNaN(Date.parse(timestamp)) && rigData[dataKey][i] != null) {
                allDataPoints.push({
                    timestamp: Date.parse(timestamp),
                    rig,
                    value: Number(rigData[dataKey][i]),
                });
            }
        });
    });

    // Sort and create a unified timeline
    allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
    const uniqueTimestamps = [...new Set(allDataPoints.map(p => p.timestamp))];
    if (!uniqueTimestamps.length) {
        console.warn(`No valid timestamps for ${chartType}`);
        return [headers, ['Latest', ...rigs.map(() => null)]];
    }

    // Generate a continuous timeline with 10-second intervals
    const now = Date.now();
    const timeThreshold = now - 30 * 60 * 1000;
    const interval = 10 * 1000; // 10 seconds
    const timeline = [];
    let currentTime = Math.max(uniqueTimestamps[0], timeThreshold);
    while (currentTime <= now) {
        timeline.push(currentTime);
        currentTime += interval;
    }

    // Fill data for each timestamp
    const rows = timeline.map(ts => {
        const row = [ts];
        rigs.forEach(rig => {
            const point = allDataPoints.find(p => p.timestamp === ts && p.rig === rig);
            if (point && point.value != null) {
                row.push(point.value);
            } else {
                // Interpolate or use last known value to avoid gaps
                const previousPoint = allDataPoints
                    .filter(p => p.rig === rig && p.timestamp < ts)
                    .sort((a, b) => b.timestamp - a.timestamp)[0];
                row.push(previousPoint && previousPoint.value != null ? previousPoint.value : null);
            }
        });
        return row;
    });

    // Add latest values
    const latestRow = ['Latest'];
    rigs.forEach(rig => {
        const latestValue = data.current_data[rig][dataKey].slice(-1)[0];
        latestRow.push(latestValue != null ? Number(latestValue).toFixed(2) : null);
    });
    rows.push(latestRow);

    return [headers, ...rows];
}

// Initialize Highcharts Dashboard
async function initializeDashboard(data) {
    console.log('Initializing dashboard');
    const rigs = data.current_data ? Object.keys(data.current_data) : [];

    // Destroy existing dashboard
    if (currentDashboard) {
        try {
            currentDashboard.destroy();
        } catch (e) {
            console.warn('Error destroying dashboard:', e);
        }
    }

    // Global Highcharts options
    Highcharts.setOptions({
        chart: {
            spacingTop: 20,
            spacingBottom: 20,
            styledMode: true,
            backgroundColor: '#f0feff', // Match page background
            animation: {
                duration: 500,
            },
        },
        title: {
            align: 'left',
            margin: 0,
            x: 30,
        },
        credits: { enabled: false },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            itemStyle: { fontSize: '12px' },
        },
        xAxis: {
            crosshair: true,
            type: 'datetime',
            labels: { format: '{value:%H:%M:%S}' },
            accessibility: { description: 'Time (Last 30 Minutes)' },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
        },
        yAxis: {
            title: { text: null },
            gridLineColor: '#e6e6e6',
        },
        tooltip: {
            shared: true,
            valueDecimals: 1,
            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b> {series.options.tooltip.valueSuffix}<br/>',
        },
        plotOptions: {
            series: {
                animation: false,
                turboThreshold: 1000,
                connectNulls: true, // Ensure continuous lines
            },
        },
    });

    try {
        currentDashboard = await Dashboards.board('dashboard-container', {
            dataPool: {
                connectors: Object.keys(chartConfig).map(key => ({
                    id: chartConfig[key].connectorId,
                    type: 'JSON',
                    options: { data: formatDataForDashboard(data, key) },
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
                            width: '1/3',
                            height: '180px',
                        }, {
                            id: 'dashboard-col-2',
                            width: '1/3',
                            height: '180px',
                        }, {
                            id: 'dashboard-col-3',
                            width: '1/3',
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
                        columnAssignment: rigs.length && key !== 'networkGraph' ? rigs.map(rig => ({
                            seriesId: rig,
                            data: ['Timestamp', `${rig}_${config.dataKey}`],
                        })) : [],
                    },
                    sync: {
                        highlight: { enabled: true, type: 'highlight' },
                        tooltip: { enabled: true, type: 'tooltip' },
                        crosshair: { enabled: true, type: 'crosshair' },
                    },
                    chartOptions: {
                        chart: {
                            type: key === 'networkGraph' ? 'networkgraph' : 
                                  config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                            backgroundColor: '#f0feff',
                        },
                        title: { text: null },
                        subtitle: { text: config.subtitle },
                        legend: { enabled: config.legendEnabled },
                        yAxis: key !== 'networkGraph' ? {
                            title: { text: config.yAxisTitle },
                            min: 0,
                            gridLineColor: '#e6e6e6',
                        } : { visible: false },
                        xAxis: key === 'networkGraph' ? { visible: false } : {
                            type: 'datetime',
                            min: Date.now() - 30 * 60 * 1000,
                            max: Date.now(),
                            labels: { format: '{value:%H:%M:%S}' },
                        },
                        tooltip: key === 'networkGraph' ? {
                            formatter: function () {
                                return `<b>${this.point.id}</b><br>Connections: ${this.point.linksFrom.length}`;
                            },
                        } : { valueSuffix: ` ${config.unit}` },
                        series: key === 'networkGraph' ? [{
                            type: 'networkgraph',
                            dataLabels: { enabled: true },
                            nodes: formatNetworkGraphData(data).nodes,
                            data: formatNetworkGraphData(data).links,
                        }] : rigs.length ? rigs.map(rig => ({
                            id: rig,
                            name: rig,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                            data: formatDataForDashboard(data, key).slice(1, -1)
                                .map(row => [row[0], row[rigs.indexOf(rig) + 1]])
                                .filter(d => d[0] != null && d[1] != null),
                        })) : [{ id: 'empty', name: 'No Data', data: [] }],
                        exporting: { enabled: config.cellId === 'dashboard-col-0' },
                        navigator: { enabled: config.cellId === 'dashboard-col-0' },
                        scrollbar: { enabled: config.cellId === 'dashboard-col-0' },
                        accessibility: {
                            description: `Live ${config.accessibilityDesc} data for multiple rigs over the last 30 minutes.`,
                        },
                    },
                };
            }),
        }, true);

        // Update titles
        document.getElementById('chartTitle').textContent = chartConfig[activeChartType].title;
        smallChartTypes.forEach((type, index) => {
            const smallTitle = document.getElementById(`small-chart-title-${index + 1}`);
            if (smallTitle) smallTitle.textContent = chartConfig[type].title;
        });

        // Add click handlers for small charts
        smallChartTypes.forEach(type => {
            const cell = document.getElementById(chartConfig[type].cellId);
            if (cell) cell.addEventListener('click', () => switchChart(type));
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

        console.log('Dashboard initialized');
        dashboardInitialized = true;
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        dashboardInitialized = false;
    }
}

// Update main chart type
function updateMainChartType() {
    const component = currentDashboard.getComponentByCellId('dashboard-col-0');
    if (component?.chart) {
        component.chart.series.forEach(series => {
            if (series) series.update({ type: mainChartType }, false);
        });
        component.chart.redraw();
    }
}

// Update dashboard data with sliding effect
function updateDashboardData(data) {
    if (!currentDashboard || !dashboardInitialized || isUpdating) {
        console.log('Dashboard not ready, initializing');
        return initializeDashboard(data);
    }

    isUpdating = true;
    try {
        const rigs = data.current_data ? Object.keys(data.current_data) : [];
        const now = Date.now();
        const timeThreshold = now - 30 * 60 * 1000;

        Object.keys(chartConfig).forEach(key => {
            const config = chartConfig[key];
            const component = currentDashboard.getComponentByCellId(config.cellId);
            if (!component?.chart) return;

            const chart = component.chart;

            if (key === 'networkGraph') {
                const networkData = formatNetworkGraphData(data);
                chart.series[0].update({
                    nodes: networkData.nodes,
                    data: networkData.links,
                }, false);
            } else {
                // Time-series charts: Implement sliding effect
                const formattedData = formatDataForDashboard(data, key);
                const rigs = formattedData[0].slice(1).map(h => h.split('_')[0]);

                // Update x-axis range
                const timestamps = formattedData.slice(1).map(row => row[0]).filter(ts => ts != null);
                const minTime = Math.min(...timestamps, now - 30 * 60 * 1000);
                const maxTime = Math.max(...timestamps, now);

                chart.xAxis[0].update({
                    min: minTime,
                    max: maxTime,
                }, false);

                // Update series data
                rigs.forEach((rig, index) => {
                    let series = chart.series.find(s => s.options.id === rig);
                    if (!series && formattedData[0][index + 1]) {
                        chart.addSeries({
                            id: rig,
                            name: rig,
                            type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                            data: [],
                            connectNulls: true,
                        }, false);
                        series = chart.series[chart.series.length - 1];
                    }

                    if (series) {
                        const seriesData = formattedData.slice(1, -1)
                            .map(row => [row[0], row[index + 1]])
                            .filter(d => d[0] != null && d[1] != null);

                        // Add new points
                        seriesData.forEach(point => {
                            const exists = series.data.some(d => d.x === point[0]);
                            if (!exists) {
                                series.addPoint(point, false, false);
                            }
                        });

                        // Remove old points
                        while (series.data.length > 0 && series.data[0].x < timeThreshold) {
                            series.removePoint(0, false);
                        }
                    }
                });

                chart.series.slice().forEach(series => {
                    if (series.options.id !== 'empty' && !rigs.includes(series.options.id)) {
                        series.remove(false);
                    }
                });
            }

            chart.redraw();
        });

        isUpdating = false;
        return true;
    } catch (error) {
        console.error('Error updating dashboard:', error);
        isUpdating = false;
        return initializeDashboard(data);
    }
}

// Switch chart
function switchChart(chartType) {
    if (chartType === activeChartType || isUpdating) return;
    console.log(`Switching to ${chartType}`);

    const oldActive = activeChartType;
    activeChartType = chartType;
    const index = smallChartTypes.indexOf(chartType);
    smallChartTypes[index] = oldActive;

    // Update cell assignments
    chartConfig[chartType].cellId = 'dashboard-col-0';
    chartConfig[oldActive].cellId = `dashboard-col-${index + 1}`;

    // Update titles
    document.getElementById('chartTitle').textContent = chartConfig[chartType].title;
    const smallTitle = document.getElementById(`small-chart-title-${index + 1}`);
    if (smallTitle) smallTitle.textContent = chartConfig[oldActive].title;

    // Update dashboard
    const components = currentDashboard.components;
    components.forEach(component => {
        const config = Object.values(chartConfig).find(c => c.connectorId === component.connector.id);
        if (config) {
            component.cell = config.cellId;
            if (component.chart) {
                component.chart.update({
                    legend: { enabled: config.legendEnabled },
                    chart: {
                        type: config.cellId === 'dashboard-col-0' && config.defaultChartType !== 'networkgraph' ? 
                               mainChartType : config.defaultChartType,
                        backgroundColor: '#f0feff', // Ensure background consistency
                    },
                    xAxis: config.dataKey !== 'network' ? {
                        type: 'datetime',
                        min: Date.now() - 30 * 60 * 1000,
                        max: Date.now(),
                        labels: { format: '{value:%H:%M:%S}' },
                    } : { visible: false },
                }, false);

                if (config.dataKey !== 'network') {
                    const formattedData = formatDataForDashboard(
                        currentDashboard.dataPool.connectors.find(c => c.id === config.connectorId).options.data,
                        config.dataKey
                    );
                    const rigs = formattedData[0].slice(1).map(h => h.split('_')[0]);
                    component.chart.series.slice().forEach(series => {
                        if (series.options.id !== 'empty' && !rigs.includes(series.options.id)) {
                            series.remove(false);
                        }
                    });
                    rigs.forEach((rig, idx) => {
                        let series = component.chart.series.find(s => s.options.id === rig);
                        if (!series && formattedData[0][idx + 1]) {
                            component.chart.addSeries({
                                id: rig,
                                name: rig,
                                type: config.cellId === 'dashboard-col-0' ? mainChartType : config.defaultChartType,
                                data: [],
                                connectNulls: true,
                            }, false);
                            series = component.chart.series[component.chart.series.length - 1];
                        }
                        if (series) {
                            const seriesData = formattedData.slice(1, -1)
                                .map(row => [row[0], row[idx + 1]])
                                .filter(d => d[0] != null && d[1] != null);
                            series.setData(seriesData, false);
                        }
                    });
                } else {
                    const networkData = formatNetworkGraphData(
                        currentDashboard.dataPool.connectors.find(c => c.id === config.connectorId).options.data
                    );
                    component.chart.series[0].update({
                        nodes: networkData.nodes,
                        data: networkData.links,
                    }, false);
                }

                component.chart.redraw();
            }
        }
    });

    currentDashboard.layouts[0].redraw();
}

// Fetch and update dashboard
function fetchAndUpdateDashboard() {
    if (isUpdating) {
        console.log('Update in progress, skipping');
        return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('No token, redirecting to login');
        alert('Session expired. Please sign in.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader(`Loading ${chartConfig[activeChartType].title}...`);

    axios.get('https://api.flipsintel.org/monitor/graph-data/', {
        headers: { Authorization: `Token ${token}` },
    })
    .then(response => {
        console.log('API response:', response.data);
        const filteredData = filterRecentData(response.data, 30);
        if (!dashboardInitialized) {
            initializeDashboard(filteredData);
        } else {
            updateDashboardData(filteredData);
        }
        hideLoader();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        if (error.response?.status === 401) {
            alert('Invalid session. Please sign in.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        }
        hideLoader();
    });
}

// Clear refresh timers
function clearRefreshTimers() {
    Object.values(refreshTimers).forEach(timer => clearInterval(timer));
    refreshTimers = {};
}

// Initialize with retry
function initializeWithRetry(attempts = 3, delay = 100) {
    if (attempts === 0) {
        console.error('Failed to initialize dashboard');
        return;
    }

    const requiredIds = ['dashboard-container', 'dashboard-col-0', 'dashboard-col-1', 'dashboard-col-2', 'dashboard-col-3'];
    if (requiredIds.some(id => !document.getElementById(id))) {
        console.warn(`DOM elements missing, retrying in ${delay}ms (${attempts} left)`);
        setTimeout(() => initializeWithRetry(attempts - 1, delay * 2), delay);
        return;
    }

    console.log('Starting initialization');
    fetchAndUpdateDashboard();
    refreshTimers['dashboard'] = setInterval(fetchAndUpdateDashboard, 5000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing');
    initializeWithRetry();
});