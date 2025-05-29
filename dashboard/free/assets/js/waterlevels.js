let refreshTimers = {};
let isInitialLoad = true; // Track if it is the first time loading the chart

let refreshTimers = {};
let isLoading = false; // Track loading state

// Function to show the loader
function showLoader(loadingMessage) {
    if (!isLoading) {
        isLoading = true;
        const chartLoader = document.getElementById('chartLoader');
        const loaderText = document.getElementById('loaderText');
        const dominantChart = document.getElementById('dominantChart');
        
        if (chartLoader && loaderText && dominantChart) {
            chartLoader.style.display = 'flex';
            loaderText.textContent = loadingMessage;
            dominantChart.style.opacity = '0.5'; // Dim the chart during loading
        }
    }
}

// Function to hide the loader
function hideLoader() {
    if (isLoading) {
        isLoading = false;
        const chartLoader = document.getElementById('chartLoader');
        const dominantChart = document.getElementById('dominantChart');
        
        if (chartLoader && dominantChart) {
            chartLoader.style.display = 'none';
            dominantChart.style.opacity = '1'; // Restore full opacity
        }
    }
}

// Function to initialize the dominant chart with live data
// Function to initialize the dominant chart with live data
function initializeChart(chartType) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error(`No authentication token found for ${chartType}. Redirecting to login.`);
        alert('Your session has expired. Please sign in again.');
        window.location.href = '../login.html';
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
            headers: {
                Authorization: `Token ${token}`,
            },
        })
        .then((response) => {
            const data = response.data;
            console.log(`API Response for ${chartType}:`, data); // Debug log

            // Validate the API response structure
            if (!data || !data.current_data || typeof data.current_data !== 'object') {
                console.error('Invalid API response: current_data is missing or not an object', data);
                alert('Failed to load chart data. Please try again later.');
                hideLoader();
                return;
            }

            // Check if there are any rigs
            const rigs = Object.keys(data.current_data);
            if (!rigs.length) {
                console.warn('No rigs found in current_data');
                renderChart(chartType, { current_data: {} }); // Render an empty chart
                hideLoader();
                return;
            }

            renderChart(chartType, data);
            hideLoader();
        })
        .catch((error) => {
            console.error(`Error fetching ${chartType} data:`, error);
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login.html';
            } else {
                alert('An error occurred while fetching chart data. Please try again.');
            }
            hideLoader();
        });
}

// Function to render the chart
// Function to render the chart
function renderChart(chartType, data) {
    const chartConfig = {
        waterLevelChart: {
            chartType: 'areaspline', // Filled area chart
            title: 'Water Level Over Time',
            yAxisTitle: 'Water Level (ft)',
            dataKey: 'levels',
            plotOptions: {
                areaspline: {
                    fillColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#1E90FF'], // DodgerBlue at the top
                            [1, 'rgba(30, 144, 255, 0.3)'] // Lighter blue at the bottom
                        ]
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
            chartType: 'areaspline', // Changed from spline to areaspline to fill below the line
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            dataKey: 'humidities',
            plotOptions: {
                areaspline: {
                    fillColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#32CD32'], // LimeGreen at the top
                            [1, 'rgba(50, 205, 50, 0.2)'] // Lighter green at the bottom
                        ]
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
            chartType: 'column', // Bar/column chart
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            dataKey: 'temperatures',
            plotOptions: {
                column: {
                    color: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        stops: [
                            [0, '#FF4500'], // OrangeRed at the top
                            [1, 'rgba(255, 69, 0, 0.5)'] // Lighter orange at the bottom
                        ]
                    },
                    pointPadding: 0.1,
                    borderWidth: 0,
                    groupPadding: 0.2,
                },
            },
        },
    };

    const { chartType: highchartsType, title, yAxisTitle, dataKey, plotOptions } = chartConfig[chartType];
    const rigs = Object.keys(data.current_data);

    // Prepare series data with validation
    const seriesData = rigs.map((rig) => {
        const rigData = data.current_data[rig];
        console.log(`Processing rig ${rig}:`, rigData);

        if (!rigData.timestamps || !rigData[dataKey]) {
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

        // Colors are now handled in plotOptions, so remove series-level color
        return {
            name: rig,
            data: points,
        };
    }).filter(series => series.data.length > 0);

    console.log(`Series data for ${chartType}:`, seriesData);

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
        plotOptions: plotOptions, // Apply chart-specific plot options
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
        },
    });
}

// Function to switch the dominant chart
// Function to switch the dominant chart
function switchChart(chartType, chartTitle) {
    clearRefreshTimers(); // Clear existing timers
    document.getElementById('chartTitle').textContent = chartTitle; // Update chart title
    initializeChart(chartType); // Load the chart
    refreshTimers[chartType] = setInterval(() => {
        console.log(`Refreshing ${chartType} chart...`);
        initializeChart(chartType);
    }, 5000);
}

// Function to clear all refresh timers
function clearRefreshTimers() {
    Object.keys(refreshTimers).forEach((chartType) => {
        clearInterval(refreshTimers[chartType]);
    });
    refreshTimers = {};
}

// Load the Water Levels chart as the default when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    switchChart('waterLevelChart', 'Water Levels');
});