let refreshTimers = {};
let isInitialLoad = true; // Track if it is the first time loading the chart

// Function to show the loader during the initial load
function showLoader(loadingMessage) {
    if (isInitialLoad) {
        document.getElementById('chartLoader').style.display = 'flex';
        document.getElementById('loaderText').textContent = loadingMessage;
        document.getElementById('dominantChart').style.opacity = '0.5'; // Dim the chart during loading
    }
}

// Function to hide the loader
function hideLoader() {
    if (isInitialLoad) {
        document.getElementById('chartLoader').style.display = 'none';
        document.getElementById('dominantChart').style.opacity = '1'; // Restore full opacity
        isInitialLoad = false; // Disable the loader for subsequent refreshes
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
// Function to render the chart
function renderChart(chartType, data) {
    const chartConfig = {
        waterLevelChart: {
            chartType: 'areaspline', // Filled area chart (already working)
            title: 'Water Level Over Time',
            yAxisTitle: 'Water Level (ft)',
            dataKey: 'levels',
            plotOptions: {
                fillOpacity: 0.3, // Transparency for the filled area
                marker: {
                    enabled: true,
                    radius: 3,
                },
                connectNulls: false,
            },
        },
        humidityChart: {
            chartType: 'spline', // Smooth polyline (no fill)
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            dataKey: 'humidities',
            plotOptions: {
                lineWidth: 2, // Thicker line for visibility
                marker: {
                    enabled: true,
                    radius: 4,
                    symbol: 'circle', // Circular markers for data points
                },
                connectNulls: false,
            },
        },
        temperatureChart: {
            chartType: 'column', // Bar/column chart
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            dataKey: 'temperatures',
            plotOptions: {
                column: {
                    pointPadding: 0.1, // Space between columns
                    borderWidth: 0, // No border on columns
                    groupPadding: 0.2, // Space between groups
                },
            },
        },
    };

    const { chartType: highchartsType, title, yAxisTitle, dataKey, plotOptions } = chartConfig[chartType];
    const rigs = Object.keys(data.current_data);

    // Prepare series data with validation
    const seriesData = rigs.map((rig) => {
        const rigData = data.current_data[rig];
        console.log(`Processing rig ${rig}:`, rigData); // Debug log

        // Validate timestamps and dataKey
        if (!rigData.timestamps || !rigData[dataKey]) {
            console.warn(`Missing timestamps or ${dataKey} for rig ${rig}`);
            return { name: rig, data: [] }; // Return empty series for this rig
        }

        // Ensure timestamps and data arrays have the same length
        if (rigData.timestamps.length !== rigData[dataKey].length) {
            console.warn(`Mismatch in lengths for rig ${rig}: timestamps (${rigData.timestamps.length}), ${dataKey} (${rigData[dataKey].length})`);
            return { name: rig, data: [] };
        }

        // Map the data, validating each point
        const points = rigData.timestamps.map((timestamp, index) => {
            const value = rigData[dataKey][index];
            const parsedTime = Date.parse(timestamp);

            // Validate timestamp
            if (isNaN(parsedTime)) {
                console.warn(`Invalid timestamp for rig ${rig} at index ${index}:`, timestamp);
                return null; // Skip invalid timestamps
            }

            // Validate value
            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) {
                console.warn(`Invalid ${dataKey} value for rig ${rig} at index ${index}:`, value);
                return [parsedTime, null]; // Allow Highcharts to handle null values (creates gaps)
            }

            return [parsedTime, numericValue];
        }).filter(point => point !== null); // Remove invalid points

         // Define colors for each chart type
        const colors = {
            waterLevelChart: '#1E90FF', // DodgerBlue for water levels
            humidityChart: '#32CD32',   // LimeGreen for humidity
            temperatureChart: '#FF4500' // OrangeRed for temperature
        };

        return {
            name: rig,
            data: points,
            color: colors[chartType], // Assign a color based on chart type
        };
    }).filter(series => series.data.length > 0); // Filter out empty series

    // Log the final series data for debugging
    console.log(`Series data for ${chartType}:`, seriesData);

    // Render the chart
    Highcharts.chart('dominantChart', {
        chart: {
            type: highchartsType, // Dynamically set the chart type
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
                format: '{value:%Y-%m-%d %H:%M}', // Format timestamps
            },
        },
        yAxis: {
            title: {
                text: yAxisTitle,
            },
            min: chartType === 'waterLevelChart' ? 0 : null, // Only enforce min: 0 for water levels
        },
        series: seriesData.length > 0 ? seriesData : [{ name: 'No Data', data: [] }], // Fallback for no data
        plotOptions: {
            [highchartsType]: plotOptions, // Apply chart-specific plot options
        },
        tooltip: {
            xDateFormat: '%Y-%m-%d %H:%M:%S', // Format tooltip date
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