document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chart
    initializeLineGraph();

    // Start fetching data periodically
    setInterval(fetchRigsData, 5000); // Fetch new data every 5 seconds
});

let lineChart; // Global variable to store the chart instance

function fetchRigsData() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view this data.');
        window.location.href = '../../login.html';
        return;
    }

    axios.get('http://127.0.0.1:8000/rigsdata/waterlevels/', {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
        .then((response) => {
            const data = response.data;
            console.log('Rigs Data:', data);

            // Render table
            renderRigsTable(data);

            // Update line graph
            updateLineGraph(data);
        })
        .catch((error) => {
            console.error('Error fetching rigs data:', error);
            alert('Failed to load rigs data.');
        });
}

function renderRigsTable(data) {
    const rigsTableContainer = document.getElementById('rigsTable');
    rigsTableContainer.innerHTML = ''; // Clear previous table content

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped', 'table-hover');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = [
        'Rig Sensor ID',
        'Location',
        'Latitude',
        'Longitude',
        'Water Level',
        'Humidity',
        'Temperature',
        'Timestamp',
    ];

    headers.forEach((header) => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    data.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.rig_sensor_id || 'N/A'}</td>
            <td>${row.rig_location || 'N/A'}</td>
            <td>${row.rig_latitude || 'N/A'}</td>
            <td>${row.rig_longitude || 'N/A'}</td>
            <td>${row.water_level || 'N/A'}</td>
            <td>${row.humidity_data || 'N/A'}</td>
            <td>${row.temperature_data || 'N/A'}</td>
            <td>${row.timestamp_ || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    rigsTableContainer.appendChild(table);
}

function initializeLineGraph() {
    // Initialize the chart with empty series
    lineChart = Highcharts.chart('lineGraph', {
        chart: {
            type: 'line',
        },
        title: {
            text: 'Live Trends by Rig Location',
        },
        xAxis: {
            categories: [], // Initialize empty
            title: {
                text: 'Timestamps',
            },
        },
        yAxis: {
            title: {
                text: 'Values',
            },
        },
        series: [
            {
                name: 'Water Level',
                data: [],
            },
            {
                name: 'Humidity',
                data: [],
            },
            {
                name: 'Temperature',
                data: [],
            },
        ],
    });
}

function updateLineGraph(data) {
    const timestamps = data.rows.map((row) => row.timestamp_ || 'N/A');
    const waterLevels = data.rows.map((row) => row.water_level || 0);
    const humidityData = data.rows.map((row) => row.humidity_data || 0);
    const temperatureData = data.rows.map((row) => row.temperature_data || 0);

    // Update categories (timestamps) dynamically
    lineChart.xAxis[0].setCategories(timestamps, false); // Do not redraw immediately

    // Update series data
    addPointsToSeries(lineChart.series[0], waterLevels);
    addPointsToSeries(lineChart.series[1], humidityData);
    addPointsToSeries(lineChart.series[2], temperatureData);

    lineChart.redraw(); // Redraw the chart after updating series
}

function addPointsToSeries(series, newPoints) {
    newPoints.forEach((point, index) => {
        // Add point to the series
        series.addPoint(point, false, series.data.length >= 50); // Limit to 50 points
    });
}
