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
function initializeChart(chartType) {
    const token = sessionStorage.getItem('token'); // Changed from localStorage to sessionStorage
    if (!token) {
        console.error(`No authentication token found for ${chartType}. Redirecting to login.`);
        alert('Your session has expired. Please sign in again.');
        window.location.href = '../login.html'; // Adjust the path to your login page
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
            renderChart(chartType, response.data);
            hideLoader();
        })
        .catch((error) => {
            console.error(`Error fetching ${chartType} data:`, error);
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear(); // Clear sessionStorage to prevent further unauthorized requests
                window.location.href = '../login.html'; // Adjust the path to your login page
            }
            hideLoader();
        });
}

// Function to render the chart using Flot
function renderChart(chartType, data) {
    const rigs = Object.keys(data.current_data);
    const chartConfig = {
        waterLevelChart: {
            title: 'Water Level Over Time',
            yAxisTitle: 'Water Level (ft)',
            dataKey: 'levels',
        },
        humidityChart: {
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            dataKey: 'humidities',
        },
        temperatureChart: {
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            dataKey: 'temperatures',
        },
    };

    const { title, yAxisTitle, dataKey } = chartConfig[chartType];
    const plotData = rigs.map((rig) => ({
        label: rig,
        data: data.current_data[rig][dataKey].map((value, index) => [
            Date.parse(data.current_data[rig].timestamps[index]),
            value,
        ]),
    }));

    // Clear previous chart
    $('#dominantChart').empty();

    // Render Flot chart
    $.plot('#dominantChart', plotData, {
        series: {
            lines: {
                show: true,
                fill: true, // Mimic areaspline with filled area
                fillColor: { colors: [{ opacity: 0.2 }, { opacity: 0.4 }] }, // Gradient fill
            },
            points: { show: false }, // No points, similar to Highcharts areaspline
        },
        xaxis: {
            mode: 'time',
            timeformat: '%Y-%m-%d %H:%M', // Format for readability
            timezone: 'browser', // Use browser timezone
            axisLabel: 'Date',
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelPadding: 10,
        },
        yaxis: {
            axisLabel: yAxisTitle,
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelPadding: 10,
        },
        grid: {
            borderWidth: 1,
            borderColor: '#ddd',
            hoverable: true, // Enable tooltips
        },
        legend: {
            show: true,
            position: 'nw', // Top-left corner
        },
        colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'], // Color palette
    });

    // Add tooltip functionality
    let previousPoint = null;
    $('#dominantChart').bind('plothover', function (event, pos, item) {
        if (item) {
            if (previousPoint !== item.dataIndex) {
                previousPoint = item.dataIndex;
                $('#tooltip').remove();
                const x = new Date(item.datapoint[0]).toLocaleString();
                const y = item.datapoint[1].toFixed(2);
                showTooltip(
                    item.pageX,
                    item.pageY,
                    `${item.series.label}<br>${x}<br>${yAxisTitle}: ${y}`
                );
            }
        } else {
            $('#tooltip').remove();
            previousPoint = null;
        }
    });

    // Update chart title
    document.getElementById('chartTitle').textContent = title;
}

// Tooltip helper function
function showTooltip(x, y, contents) {
    $('<div id="tooltip" style="position: absolute; display: none; border: 1px solid #ddd; padding: 8px; background-color: #f9f9f9; opacity: 0.9; border-radius: 4px; font-size: 12px; z-index: 1000;">' + contents + '</div>').css({
        top: y - 50,
        left: x + 10,
    }).appendTo('body').fadeIn(200);
}

// Function to switch the dominant chart
function switchChart(chartType, chartTitle) {
    clearRefreshTimers(); // Clear existing timers
    document.getElementById('chartTitle').textContent = chartTitle; // Update chart title
    initializeChart(chartType); // Load the chart
    refreshTimers[chartType] = setInterval(() => initializeChart(chartType), 5000);
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