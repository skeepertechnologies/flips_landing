const BASE_URL = 'https://api.flipsintel.org';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chart
    initializeLineGraph();

    // Start fetching data periodically
    setInterval(fetchRigsData, 5000); // Fetch every 5 seconds
});

let lineChart; // Global variable to store the chart instance

// Show loader
function showLoader(message = 'Loading...') {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.querySelector('p').textContent = message;
        spinner.style.display = 'block';
    }
}

// Hide loader
function hideLoader() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'none';
}

// Filter data for the last 30 minutes
function filterRecentData(data, minutes = 30) {
    if (!data || !data.rows) return { rows: [] };

    const now = Date.now();
    const timeThreshold = now - minutes * 60 * 1000;
    const filteredRows = data.rows
        .map(row => ({
            ...row,
            timestamp_: row.timestamp_ && !isNaN(Date.parse(row.timestamp_)) ? row.timestamp_ : null,
            water_level: row.water_level !== 'N/A' && row.water_level != null ? Number(row.water_level) : null,
            humidity_data: row.humidity_data !== 'N/A' && row.humidity_data != null ? Number(row.humidity_data) : null,
            temperature_data: row.temperature_data !== 'N/A' && row.temperature_data != null ? Number(row.temperature_data) : null,
        }))
        .filter(row => row.timestamp_ && Date.parse(row.timestamp_) >= timeThreshold);

    return { ...data, rows: filteredRows };
}

// Format data for Highcharts with gap filling
function formatDataForChart(data) {
    if (!data || !data.rows || !data.rows.length) {
        console.warn('No valid data for chart');
        return { timestamps: [], waterLevels: [], humidityData: [], temperatureData: [] };
    }

    const now = Date.now();
    const timeThreshold = now - 30 * 60 * 1000;
    const interval = 10 * 1000; // 10-second intervals
    const timeline = [];
    let currentTime = timeThreshold;
    while (currentTime <= now) {
        timeline.push(currentTime);
        currentTime += interval;
    }

    const rigs = [...new Set(data.rows.map(row => row.rig_sensor_id))];
    const waterLevels = {};
    const humidityData = {};
    const temperatureData = {};

    rigs.forEach(rig => {
        waterLevels[rig] = [];
        humidityData[rig] = [];
        temperatureData[rig] = [];
    });

    data.rows.forEach(row => {
        const ts = row.timestamp_ ? Date.parse(row.timestamp_) : null;
        if (ts && !isNaN(ts)) {
            const rig = row.rig_sensor_id;
            waterLevels[rig].push({ timestamp: ts, value: row.water_level });
            humidityData[rig].push({ timestamp: ts, value: row.humidity_data });
            temperatureData[rig].push({ timestamp: ts, value: row.temperature_data });
        }
    });

    const result = {
        timestamps: timeline.map(ts => new Date(ts).toISOString()),
        waterLevels: [],
        humidityData: [],
        temperatureData: [],
    };

    rigs.forEach(rig => {
        const wlSeries = { name: `${rig} Water Level`, data: [] };
        const humSeries = { name: `${rig} Humidity`, data: [] };
        const tempSeries = { name: `${rig} Temperature`, data: [] };

        timeline.forEach(ts => {
            const wlPoint = waterLevels[rig].find(p => p.timestamp === ts) || 
                           waterLevels[rig].filter(p => p.timestamp < ts).slice(-1)[0];
            const humPoint = humidityData[rig].find(p => p.timestamp === ts) || 
                            humidityData[rig].filter(p => p.timestamp < ts).slice(-1)[0];
            const tempPoint = temperatureData[rig].find(p => p.timestamp === ts) || 
                             temperatureData[rig].filter(p => p.timestamp < ts).slice(-1)[0];

            wlSeries.data.push(wlPoint && wlPoint.value != null ? wlPoint.value : null);
            humSeries.data.push(humPoint && humPoint.value != null ? humPoint.value : null);
            tempSeries.data.push(tempPoint && tempPoint.value != null ? tempPoint.value : null);
        });

        result.waterLevels.push(wlSeries);
        result.humidityData.push(humSeries);
        result.temperatureData.push(tempSeries);
    });

    return result;
}

// Initialize the line graph
function initializeLineGraph() {
    Highcharts.setOptions({
        chart: {
            backgroundColor: '#f0feff', // Match page background
            animation: { duration: 500 },
        },
        xAxis: {
            type: 'datetime',
            labels: { format: '{value:%H:%M:%S}' },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
        },
        yAxis: {
            title: { text: 'Values' },
            gridLineColor: '#e6e6e6',
        },
        plotOptions: {
            series: {
                animation: false,
                turboThreshold: 1000,
                connectNulls: true, // Ensure continuous lines
            },
        },
        tooltip: {
            shared: true,
            valueDecimals: 1,
            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>',
        },
    });

    lineChart = Highcharts.chart('lineGraph', {
        chart: {
            type: 'line',
            backgroundColor: '#f0feff',
        },
        title: { text: 'Live Trends by Rig Location' },
        xAxis: {
            type: 'datetime',
            labels: { format: '{value:%H:%M:%S}' },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
            title: { text: 'Timestamps' },
        },
        yAxis: {
            title: { text: 'Values' },
            gridLineColor: '#e6e6e6',
        },
        series: [],
        exporting: { enabled: true },
        navigator: { enabled: true },
        scrollbar: { enabled: true },
        accessibility: {
            description: 'Live water level, humidity, and temperature trends for rigs over the last 30 minutes.',
        },
    });
}

// Update the line graph with sliding effect
function updateLineGraph(data) {
    if (!lineChart || !data.rows || !data.rows.length) {
        lineChart.series.forEach(series => series.setData([]));
        return;
    }

    const formattedData = formatDataForChart(data);
    const now = Date.now();
    const timeThreshold = now - 30 * 60 * 1000;

    // Update x-axis
    lineChart.xAxis[0].update({
        min: timeThreshold,
        max: now,
    }, false);

    // Update series
    const allSeries = [
        ...formattedData.waterLevels.map(s => ({ ...s, type: 'line', visible: s.data.some(v => v != null) })),
        ...formattedData.humidityData.map(s => ({ ...s, type: 'line', visible: s.data.some(v => v != null) })),
        ...formattedData.temperatureData.map(s => ({ ...s, type: 'line', visible: s.data.some(v => v != null) })),
    ];

    // Remove old series
    lineChart.series.slice().forEach(series => {
        if (!allSeries.find(s => s.name === series.name)) {
            series.remove(false);
        }
    });

    // Add or update series
    allSeries.forEach(newSeries => {
        let series = lineChart.series.find(s => s.name === newSeries.name);
        if (!series) {
            lineChart.addSeries({
                name: newSeries.name,
                type: newSeries.type,
                data: [],
                visible: newSeries.visible,
                connectNulls: true,
            }, false);
            series = lineChart.series[lineChart.series.length - 1];
        }

        // Add new points
        newSeries.data.forEach((value, i) => {
            const ts = Date.parse(formattedData.timestamps[i]);
            if (ts >= timeThreshold && !series.data.some(d => d.x === ts)) {
                series.addPoint([ts, value], false, false);
            }
        });

        // Remove old points
        while (series.data.length > 0 && series.data[0].x < timeThreshold) {
            series.removePoint(0, false);
        }
    });

    lineChart.redraw();
}

// Fetch rigs data
function fetchRigsData() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('Session expired. Please log in again.');
        window.location.href = '../../login.html';
        return;
    }

    showLoader('Loading Rigs Data...');

    // Fetch subscription details
    axios.get(`${BASE_URL}/subscription/details/`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const subscriptionData = response.data;
        console.log('Subscription Details:', subscriptionData);
        fetchRigsDataWithSubscription(token, subscriptionData);
    })
    .catch(error => {
        console.error('Error fetching subscription details:', error);
        handleApiError(error, 'Error fetching subscription details');
        hideLoader();
    });
}

// Fetch rigs data with subscription checks
function fetchRigsDataWithSubscription(token, subscriptionData) {
    const allowedServices = subscriptionData.services || [];
    const subscriptionTier = subscriptionData.tier || 'Free';
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 7, report_count: 1 };

    const relevantServices = ['water_level', 'humidity', 'temperature'];
    if (!allowedServices.some(service => relevantServices.includes(service))) {
        alert(`Your ${subscriptionTier} plan does not include access to rig data. Please upgrade.`);
        document.getElementById('rigsTable').innerHTML = `
            <div class="alert alert-info">
                <strong>Your ${subscriptionTier} plan does not include rig data.</strong><br>
                <a href="../payment.html" class="btn btn-primary">Upgrade Now</a>
            </div>
        `;
        lineChart.series.forEach(series => series.setData([]));
        hideLoader();
        return;
    }

    const params = new URLSearchParams();
    if (usageLimits.historical_data_days) {
        params.append('days', usageLimits.historical_data_days);
    }

    axios.get(`${BASE_URL}/rigsdata/waterlevels/?${params.toString()}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const data = filterRecentData(response.data, 30);
        console.log('Filtered Rigs Data:', data);

        const serviceToFields = {
            water_level: ['water_level'],
            humidity: ['humidity_data'],
            temperature: ['temperature_data'],
        };
        const allowedFields = relevantServices
            .filter(service => allowedServices.includes(service))
            .flatMap(service => serviceToFields[service]);

        let maxRigs = subscriptionTier === 'Free' ? 1 : subscriptionTier === 'Premium' ? 5 : Infinity;
        const filteredRows = data.rows.slice(0, maxRigs).map(row => {
            const filteredRow = { ...row };
            ['water_level', 'humidity_data', 'temperature_data'].forEach(field => {
                if (!allowedFields.includes(field)) {
                    filteredRow[field] = 'N/A';
                }
            });
            return filteredRow;
        });

        renderRigsTable({ ...data, rows: filteredRows });
        updateLineGraph({ ...data, rows: filteredRows });

        const ctaContainer = document.getElementById('cta-container');
        if (filteredRows.length === 0 || data.cta) {
            ctaContainer.innerHTML = `
                <div class="alert alert-info">
                    <strong>${data.cta?.message || `Your ${subscriptionTier} plan limits rig data access. Upgrade to view more.`}</strong><br>
                    <a href="${data.cta?.upgrade_url || '../payment.html'}" class="btn btn-primary">Upgrade Now</a>
                </div>
            `;
        } else {
            ctaContainer.innerHTML = '';
        }

        hideLoader();
    })
    .catch(error => {
        console.error('Error fetching rigs data:', error);
        handleApiError(error, 'Error fetching rigs data');
        hideLoader();
    });
}

// Render rigs table
function renderRigsTable(data) {
    const rigsTableContainer = document.getElementById('rigsTable');
    rigsTableContainer.innerHTML = '';

    if (!data.rows || data.rows.length === 0) {
        rigsTableContainer.innerHTML = '<p>No rig data available.</p>';
        return;
    }

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped', 'table-hover');

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

// Handle API errors
function handleApiError(error, defaultMessage) {
    console.error(defaultMessage, error);
    let message = defaultMessage + '. Please try again.';
    let upgradeUrl = '../payment.html';

    if (error.response) {
        if (error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../../login.html';
            return;
        } else if (error.response.status === 403) {
            message = error.response.data.cta?.message || error.response.data.error || 'Access restricted by your plan. Please upgrade.';
            upgradeUrl = error.response.data.cta?.upgrade_url || upgradeUrl;
        } else {
            message = error.response.data?.error || error.response.data?.detail || message;
        }
    }

    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="alert alert-danger">
                <strong>${message}</strong>
                ${upgradeUrl ? `<br><a href="${upgradeUrl}" class="btn btn-primary mt-2">Upgrade Now</a>` : ''}
            </div>
        `;
    }
}