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
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error(`No authentication token found for ${chartType}. Redirecting to login.`);
        alert('Your session has expired. Please sign in again.');
        window.location.href = '../login/login.html'; // Standardized path
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
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
            hideLoader();
        });
}

// Function to render status cards for each rig
function renderStatusCards(chartType, data) {
    const rigs = Object.keys(data.current_data);
    const chartConfig = {
        waterLevelChart: {
            dataKey: 'levels',
            unit: 'ft',
            label: 'Water Level',
            icon: 'bi-water',
        },
        humidityChart: {
            dataKey: 'humidities',
            unit: '%',
            label: 'Humidity',
            icon: 'bi-droplet',
        },
        temperatureChart: {
            dataKey: 'temperatures',
            unit: '°C',
            label: 'Temperature',
            icon: 'bi-thermometer',
        },
    };

    const { dataKey, unit, label, icon } = chartConfig[chartType];
    const statusCards = document.getElementById('statusCards');
    statusCards.innerHTML = ''; // Clear existing cards

    rigs.forEach((rig) => {
        const latestValue = data.current_data[rig][dataKey].slice(-1)[0] || 0;
        const timestamp = data.current_data[rig].timestamps.slice(-1)[0] || 'N/A';
        const formattedValue = latestValue.toFixed(2);
        const time = timestamp !== 'N/A' ? new Date(timestamp).toLocaleTimeString() : 'N/A';

        const card = document.createElement('div');
        card.className = 'card small-card';
        card.innerHTML = `
            <div class="card-body text-center">
                <i class="bi ${icon} mb-2" style="font-size: 1.5rem; color: #4caf50;"></i>
                <h5 class="card-title">${rig}</h5>
                <p class="card-text">${label}: ${formattedValue} ${unit}</p>
                <p class="card-text text-muted" style="font-size: 0.8rem;">Updated: ${time}</p>
            </div>
        `;
        statusCards.appendChild(card);
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

    // Update status cards
    renderStatusCards(chartType, data);

    // Update chart title
    document.getElementById('chartTitle').textContent = title;
}

// Function to switch the dominant chart
function switchChart(chartType, chartTitle) {
    clearRefreshTimers();
    document.getElementById('chartTitle').textContent = chartTitle;
    initializeChart(chartType);
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