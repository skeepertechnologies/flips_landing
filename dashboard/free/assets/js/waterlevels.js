let refreshTimers = {};
let isLoading = false; // Track loading state
let currentRequest = null; // Track ongoing request

// Function to show the loader
function showLoader(loadingMessage) {
    if (!isLoading) {
        console.log(`Showing loader: ${loadingMessage}`);
        isLoading = true;
        const chartLoader = document.getElementById('chartLoader');
        const loaderText = document.getElementById('loaderText');
        const dominantChart = document.getElementById('dominantChart');

        if (!chartLoader || !loaderText || !dominantChart) {
            console.error('Loader elements not found:', { chartLoader, loaderText, dominantChart });
            isLoading = false;
            return;
        }

        chartLoader.style.display = 'flex';
        loaderText.textContent = loadingMessage;
        loaderText.classList.remove('text-danger'); // Reset error style
        dominantChart.style.opacity = '0.5';
    } else {
        console.log(`Loader already active, skipping showLoader: ${loadingMessage}`);
    }
}

// Function to show error in loader
function showLoaderError(errorMessage) {
    console.log(`Showing loader error: ${errorMessage}`);
    const chartLoader = document.getElementById('chartLoader');
    const loaderText = document.getElementById('loaderText');
    const dominantChart = document.getElementById('dominantChart');

    if (!chartLoader || !loaderText || !dominantChart) {
        console.error('Loader elements not found:', { chartLoader, loaderText, dominantChart });
        return;
    }

    chartLoader.style.display = 'flex';
    loaderText.textContent = errorMessage;
    loaderText.classList.add('text-danger');
    dominantChart.style.opacity = '0.5';
    isLoading = false; // Allow new requests
}

// Function to hide loader
function hideLoader() {
    if (isLoading) {
        console.log('Hiding loader');
        isLoading = false;
        const chartLoader = document.getElementById('chartLoader');
        const dominantChart = document.getElementById('dominantChart');

        if (!chartLoader || !dominantChart) {
            console.error('Loader elements not found:', { chartLoader, dominantChart });
            return;
        }

        chartLoader.style.display = 'none';
        dominantChart.style.opacity = '1';
    } else {
        console.log('Loader already hidden, skipping hideLoader');
    }
}

// Function to initialize the dominant chart with live data
function initializeChart(chartType, retries = 2) {
    if (isLoading) {
        console.log(`Request for ${chartType} already in progress. Skipping.`);
        return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error(`No authentication token found for ${chartType}.`);
        showLoaderError('No authentication token. Redirecting to login...');
        setTimeout(() => {
            window.location.href = '../login.html';
        }, 2000);
        return;
    }

    const loadingMessages = {
        waterLevelChart: 'Loading Water Levels...',
        humidityChart: 'Loading Humidity Data...',
        temperatureChart: 'Loading Temperature Data...',
    };

    showLoader(loadingMessages[chartType]);

    if (currentRequest) {
        currentRequest.cancel('New chart request initiated');
    }

    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    currentRequest = source;

    console.log(`Initiating API request for ${chartType} with ${retries} retries remaining`);

    axios
        .get('https://api.flipsintel.org/monitor/graph-data/', {
            headers: {
                Authorization: `Token ${token}`,
            },
            cancelToken: source.token,
            timeout: 15000, // Increased to 15 seconds
        })
        .then((response) => {
            const data = response.data;
            console.log(`API Response for ${chartType}:`, data);

            try {
                if (!data || !data.current_data || typeof data.current_data !== 'object') {
                    console.error('Invalid API response: current_data is missing or not an object', data);
                    showLoaderError('No data available. Please try again later.');
                    renderChart(chartType, { current_data: {} });
                    return;
                }

                const rigs = Object.keys(data.current_data);
                if (!rigs.length) {
                    console.warn('No rigs found in current_data');
                    showLoaderError('No rigs available for this chart.');
                    renderChart(chartType, { current_data: {} });
                    return;
                }

                renderChart(chartType, data);
            } catch (error) {
                console.error(`Error processing ${chartType} data:`, error);
                showLoaderError('Error processing chart data.');
                renderChart(chartType, { current_data: {} });
            } finally {
                hideLoader();
                currentRequest = null;
            }
        })
        .catch((error) => {
            currentRequest = null;
            if (axios.isCancel(error)) {
                console.log(`Request for ${chartType} was cancelled:`, error.message);
                return;
            }
            console.error(`Error fetching ${chartType} data:`, error);

            let errorMessage = 'Failed to load chart data. Please try again.';
            if (error.code === 'ECONNABORTED') {
                console.error('Request timed out');
                errorMessage = 'Request timed out. Please check your connection.';
            } else if (error.response) {
                if (error.response.status === 401) {
                    console.error('Unauthorized: Invalid or expired token.');
                    errorMessage = 'Session expired. Redirecting to login...';
                    setTimeout(() => {
                        sessionStorage.clear();
                        window.location.href = '../login.html';
                    }, 2000);
                    showLoaderError(errorMessage);
                    return;
                } else if (error.response.status === 403) {
                    errorMessage = 'You do not have permission to access this data.';
                } else if (error.response.status === 404) {
                    errorMessage = 'Data not found. Please try again later.';
                } else {
                    errorMessage = `Server error (${error.response.status}). Please try again.`;
                }
            } else if (error.request) {
                errorMessage = 'No response from server. Please check your connection.';
            }

            if (retries > 0) {
                console.log(`Retrying ${chartType} request. ${retries} retries left.`);
                setTimeout(() => initializeChart(chartType, retries - 1), 2000);
            } else {
                showLoaderError(errorMessage);
                renderChart(chartType, { current_data: {} });
                hideLoader();
            }
        });
}

// Function to render the chart
function renderChart(chartType, data) {
    const chartConfig = {
        waterLevelChart: {
            chartType: 'areaspline',
            title: 'Water Level Over Time',
            yAxisTitle: 'Water Level (ft)',
            dataKey: 'levels',
            plotOptions: {
                areaspline: {
                    fillColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#1E90FF'],
                            [1, 'rgba(30, 144, 255, 0.3)'],
                        ],
                    },
                    marker: {
                        enabled: true,
                        radius: 3,
                    },
                    connectNulls: false,
                },
            },
        },
        humidityChart: {
            chartType: 'areaspline',
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            dataKey: 'humidities',
            plotOptions: {
                areaspline: {
                    fillColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#32CD32'],
                            [1, 'rgba(50, 205, 50, 0.2)'],
                        ],
                    },
                    lineWidth: 2,
                    marker: {
                        enabled: true,
                        radius: 4,
                        symbol: 'circle',
                    },
                    connectNulls: false,
                },
            },
        },
        temperatureChart: {
            chartType: 'column',
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            dataKey: 'temperatures',
            plotOptions: {
                column: {
                    color: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#FF4500'],
                            [1, 'rgba(255, 69, 0, 0.5)'],
                        ],
                    },
                    pointPadding: 0.1,
                    borderWidth: 0,
                    groupPadding: 0.2,
                },
            },
        },
    };

    const { chartType: highchartsType, title, yAxisTitle, dataKey, plotOptions } = chartConfig[chartType];
    const rigs = data.current_data ? Object.keys(data.current_data) : [];

    // Prepare series data with validation
    const seriesData = rigs.map((rig) => {
        const rigData = data.current_data[rig];
        console.log(`Processing rig ${rig}:`, rigData);

        if (!rigData || !rigData.timestamps || !rigData[dataKey]) {
            console.warn(`Missing timestamps or ${dataKey} for rig ${rig}`);
            return { name: rig, data: [] };
        }

        if (rigData.timestamps.length !== rigData[dataKey].length) {
            console.warn(`Mismatch in lengths for rig ${rig}: timestamps (${rigData.timestamps.length}), ${dataKey} (${rigData[dataKey].length})`);
            return { name: rig, data: [] };
        }

        const points = rigData.timestamps.map((timestamp, index) => {
            const value = rigData[dataKey][index];
            const parsedTime = Date.parse(timestamp);

            if (isNaN(parsedTime)) {
                console.warn(`Invalid timestamp for rig ${rig} at index ${index}:`, timestamp);
                return null;
            }

            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) {
                console.warn(`Invalid ${dataKey} value for rig ${rig} at index ${index}:`, value);
                return [parsedTime, null];
            }

            return [parsedTime, numericValue];
        }).filter(point => point !== null);

        return {
            name: rig,
            data: points,
        };
    }).filter(series => series.data.length > 0);

    console.log(`Series data for ${chartType}:`, seriesData);

    try {
        Highcharts.chart('dominantChart', {
            chart: {
                type: highchartsType,
                zoomType: 'x',
                events: {
                    load: function () {
                        console.log(`${chartType} chart loaded successfully`);
                    },
                    redraw: function () {
                        console.log(`${chartType} chart redrawn`);
                    },
                },
            },
            title: {
                text: title,
            },
            xAxis: {
                type: 'datetime',
                title: {
                    text: 'Date',
                },
                labels: {
                    format: '{value:%Y-%m-%d %H:%M}',
                },
            },
            yAxis: {
                title: {
                    text: yAxisTitle,
                },
                min: chartType === 'waterLevelChart' ? 0 : null,
            },
            series: seriesData.length > 0 ? seriesData : [{ name: 'No Data', data: [] }],
            plotOptions: plotOptions,
            tooltip: {
                xDateFormat: '%Y-%m-%d %H:%M:%S',
                pointFormat: '{series.name}: <b>{point.y}</b> ' + yAxisTitle,
            },
            exporting: {
                enabled: true,
                buttons: {
                    contextButton: {
                        menuItems: ['downloadPNG', 'downloadJPEG', 'downloadPDF', 'downloadSVG'],
                    },
                },
            },
            navigator: {
                enabled: true,
            },
            scrollbar: {
                enabled: true,
            },
            noData: {
                style: {
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: '#303030',
                },
                text: 'No data available for this chart.',
            },
        });
    } catch (error) {
        console.error(`Error rendering ${chartType} chart:`, error);
        showLoaderError('Failed to render chart. Please try again.');
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Function to switch the dominant chart
const switchChart = debounce((chartType, chartTitle) => {
    clearRefreshTimers();
    document.getElementById('chartTitle').textContent = chartTitle;
    initializeChart(chartType);
    refreshTimers[chartType] = setInterval(() => {
        console.log(`Refreshing ${chartType} chart...`);
        initializeChart(chartType);
    }, 60000); // Increased to 60 seconds
}, 300);

// Function to clear all refresh timers
// Function to clear all refresh timers
function clearRefreshTimers() {
    Object.keys(refreshTimers).forEach((chartType) => {
        clearInterval(refreshTimers[chartType]);
        console.log(`Cleared timer for ${chartType}`);

    });
    refreshTimers = {};
}

// Load the Water Levels chart as the default when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    switchChart('waterLevelChart', 'Water Levels');
});