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
        // Optionally show an alert to the user
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

// Function to render the chart
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
    const seriesData = rigs.map((rig) => ({
        name: rig,
        data: data.current_data[rig][dataKey].map((value, index) => [
            Date.parse(data.current_data[rig].timestamps[index]),
            value,
        ]),
    }));

    Highcharts.chart('dominantChart', {
        chart: {
            type: 'areaspline',
            zoomType: 'x',
        },
        title: {
            text: title,
        },
        xAxis: {
            type: 'datetime',
            title: {
                text: 'Date',
            },
        },
        yAxis: {
            title: {
                text: yAxisTitle,
            },
        },
        series: seriesData,
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
    });
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