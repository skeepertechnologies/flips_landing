const BASE_URL = 'https://api.flipsintel.org';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chart
    initializeLineGraph();

    // Start fetching data periodically
    setInterval(fetchRigsData, 5000); // Fetch new data every 5 seconds
});

let lineChart; // Global variable to store the chart instance

function fetchRigsData() {
    const token = sessionStorage.getItem('token'); // Changed to sessionStorage
    if (!token) {
        alert('You need to be logged in to view this data.');
        window.location.href = '../../login.html';
        return;
    }

    // Fetch subscription details first
    axios.get(`${BASE_URL}/subscription/details/`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        const subscriptionData = response.data;
        console.log('Subscription Details:', subscriptionData);
        fetchRigsDataWithSubscription(token, subscriptionData);
    })
    .catch(error => {
        console.error('Error fetching subscription details:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../../login.html';
        } else {
            alert('Failed to load subscription details. Please try again.');
        }
    });
}

function fetchRigsDataWithSubscription(token, subscriptionData) {
    // Determine allowed services and limits
    const allowedServices = subscriptionData.services || [];
    const subscriptionTier = subscriptionData.tier || 'Free';
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 7, report_count: 1 };

    // Check if any relevant services are allowed
    const relevantServices = ['water_level', 'humidity', 'temperature'];
    if (!allowedServices.some(service => relevantServices.includes(service))) {
        alert(`Your ${subscriptionTier} plan does not include access to rig data. Please upgrade.`);
        document.getElementById('rigsTable').innerHTML = `
            <div class="alert alert-info">
                <strong>Your ${subscriptionTier} plan does not include rig data.</strong><br>
                <a href="../payment.html" class="btn btn-primary">Upgrade Now</a>
            </div>
        `;
        lineChart.series.forEach(series => series.setData([])); // Clear graph
        return;
    }

    // Add query parameter for historical data limit
    const params = new URLSearchParams();
    if (usageLimits.historical_data_days) {
        params.append('days', usageLimits.historical_data_days);
    }

    axios.get(`${BASE_URL}/rigsdata/waterlevels/?${params.toString()}`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then((response) => {
        const data = response.data;
        console.log('Rigs Data:', data);

        // Filter data based on allowed services
        const serviceToFields = {
            water_level: ['water_level'],
            humidity: ['humidity_data'],
            temperature: ['temperature_data'],
        };
        const allowedFields = relevantServices
            .filter(service => allowedServices.includes(service))
            .flatMap(service => serviceToFields[service]);

        // Limit rows based on subscription tier
        let maxRigs = subscriptionTier === 'Free' ? 1 : subscriptionTier === 'Premium' ? 5 : Infinity;
        const filteredRows = data.rows.slice(0, maxRigs).map(row => {
            const filteredRow = { ...row };
            ['water_level', 'humidity_data', 'temperature_data'].forEach(field => {
                if (!allowedFields.includes(field)) {
                    filteredRow[field] = 'N/A'; // Mask unauthorized fields
                }
            });
            return filteredRow;
        });

        // Render table and update graph with filtered data
        renderRigsTable({ ...data, rows: filteredRows });
        updateLineGraph({ ...data, rows: filteredRows });

        // Handle CTA if provided or if no data is available
        const ctaContainer = document.getElementById('cta-container') || document.createElement('div');
        ctaContainer.id = 'cta-container';
        if (filteredRows.length === 0 || data.cta) {
            ctaContainer.innerHTML = `
                <div class="alert alert-info">
                    <strong>${data.cta?.message || `Your ${subscriptionTier} plan limits rig data access. Upgrade to view more.`}</strong><br>
                    <a href="${data.cta?.upgrade_url || '../payment.html'}" class="btn btn-primary">Upgrade Now</a>
                </div>
            `;
            document.getElementById('rigsTable').prepend(ctaContainer);
        } else {
            ctaContainer.innerHTML = '';
        }
    })
    .catch((error) => {
        console.error('Error fetching rigs data:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../../login.html';
        } else {
            alert('Failed to load rigs data. Please try again.');
        }
    });
}

function renderRigsTable(data) {
    const rigsTableContainer = document.getElementById('rigsTable');
    rigsTableContainer.innerHTML = ''; // Clear previous table content

    if (!data.rows || data.rows.length === 0) {
        rigsTableContainer.innerHTML = '<p>No rig data available.</p>';
        return;
    }

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped', 'table-hover');

    // Create table header, only including allowed fields
    const headerRow = document.createElement('tr');
    const headers = [
        { display: 'Rig Sensor ID', field: 'rig_sensor_id' },
        { display: 'Location', field: 'rig_location' },
        { display: 'Latitude', field: 'rig_latitude' },
        { display: 'Longitude', field: 'rig_longitude' },
        { display: 'Water Level', field: 'water_level' },
        { display: 'Humidity', field: 'humidity_data' },
        { display: 'Temperature', field: 'temperature_data' },
        { display: 'Timestamp', field: 'timestamp_' },
    ];

    // Determine which fields have data to avoid empty columns
    const availableFields = new Set();
    data.rows.forEach(row => {
        headers.forEach(header => {
            if (row[header.field] !== 'N/A' && row[header.field] !== undefined) {
                availableFields.add(header.field);
            }
        });
    });

    headers.forEach(header => {
        if (availableFields.has(header.field) || ['rig_sensor_id', 'rig_location', 'rig_latitude', 'rig_longitude', 'timestamp_'].includes(header.field)) {
            const th = document.createElement('th');
            th.textContent = header.display;
            headerRow.appendChild(th);
        }
    });

    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            if (availableFields.has(header.field) || ['rig_sensor_id', 'rig_location', 'rig_latitude', 'rig_longitude', 'timestamp_'].includes(header.field)) {
                const td = document.createElement('td');
                td.textContent = row[header.field] || 'N/A';
                tr.appendChild(td);
            }
        });
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
                visible: false, // Initially hidden, shown if allowed
            },
            {
                name: 'Humidity',
                data: [],
                visible: false,
            },
            {
                name: 'Temperature',
                data: [],
                visible: false,
            },
        ],
    });
}

function updateLineGraph(data) {
    if (!data.rows || data.rows.length === 0) {
        lineChart.series.forEach(series => series.setData([]));
        return;
    }

    const timestamps = data.rows.map((row) => row.timestamp_ || 'N/A');
    const waterLevels = data.rows.map((row) => (row.water_level !== 'N/A' && row.water_level !== undefined ? row.water_level : 0));
    const humidityData = data.rows.map((row) => (row.humidity_data !== 'N/A' && row.humidity_data !== undefined ? row.humidity_data : 0));
    const temperatureData = data.rows.map((row) => (row.temperature_data !== 'N/A' && row.temperature_data !== undefined ? row.temperature_data : 0));

    // Update categories (timestamps) dynamically
    lineChart.xAxis[0].setCategories(timestamps, false);

    // Update series data and visibility based on available data
    const seriesData = [
        { series: lineChart.series[0], data: waterLevels, field: 'water_level' },
        { series: lineChart.series[1], data: humidityData, field: 'humidity_data' },
        { series: lineChart.series[2], data: temperatureData, field: 'temperature_data' },
    ];

    seriesData.forEach(({ series, data, field }) => {
        const hasData = data.some(value => value !== 0);
        series.setData(data, false);
        series.update({ visible: hasData }, false);
    });

    lineChart.redraw(); // Redraw the chart after updating series
}