// rigsdata.js
const BASE_URL = 'https://api.flipsintel.org';

document.addEventListener('DOMContentLoaded', () => {
    checkTokenAndFetchData();
});

function checkTokenAndFetchData() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view this data.');
        window.location.href = '../login/login.html';
        return;
    }
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'block';

    fetchSubscriptionDetails(token)
        .then(subscriptionData => {
            fetchRigsData(token, subscriptionData);
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            displayError('errorContainer', 'Failed to load subscription details. Please try again.');
            if (error.response && error.response.status === 401) {
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
        })
        .finally(() => {
            if (spinner) spinner.style.display = 'none';
        });
}

function fetchRigsData(token, subscriptionData) {
    const allowedServices = subscriptionData.services || [];
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 0 };
    const subscriptionTier = subscriptionData.tier || 'Free';

    const serviceToFields = {
        water_level: ['water_level'],
        humidity: ['humidity_data'],
        temperature: ['temperature_data'],
    };

    const allowedFields = Object.keys(serviceToFields)
        .filter(service => allowedServices.includes(service))
        .flatMap(service => serviceToFields[service]);

    const params = new URLSearchParams();
    if (usageLimits.historical_data_days) {
        params.append('days', usageLimits.historical_data_days);
    }

    axios.get(`${BASE_URL}/rigsdata/waterlevels/?${params.toString()}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => {
            const data = response.data;
            console.log('Rigs Data:', data);

            // Filter rig data based on allowed fields
            const filteredRows = data.rows.map(row => {
                const filteredRow = { ...row };
                Object.keys(filteredRow).forEach(key => {
                    if (!['rig_sensor_id', 'rig_location', 'rig_latitude', 'rig_longitude', 'timestamp_'].includes(key) &&
                        !allowedFields.includes(key)) {
                        filteredRow[key] = 'N/A';
                    }
                });
                return filteredRow;
            });

            // Limit rigs based on tier
            let maxRigs = 1;
            if (subscriptionTier === 'Premium') maxRigs = 5;
            else if (subscriptionTier === 'Corporate') maxRigs = Infinity;
            const limitedRows = filteredRows.slice(0, maxRigs);

            // Render table
            renderTable(limitedRows);

            // Render Highcharts graph
            renderGraph(limitedRows);

            // Handle CTA
            const ctaContainer = document.getElementById('cta-container');
            if (ctaContainer && (data.cta || limitedRows.length === 0)) {
                ctaContainer.style.display = 'block';
                const ctaMessage = data.cta?.message || `Your ${subscriptionTier} plan limits rig data access. Upgrade to view more.`;
                const ctaUrl = data.cta?.upgrade_url || '../payment.html';
                ctaContainer.innerHTML = `
                    <div class="alert alert-info">
                        <strong>${ctaMessage}</strong><br>
                        <a href="${ctaUrl}" class="btn btn-primary mt-2">Upgrade Now</a>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error fetching rigs data:', error);
            let message = 'Failed to load rigs data. Please check your subscription plan.';
            if (error.response) {
                if (error.response.status === 401) {
                    alert('Session expired. Please log in again.');
                    sessionStorage.clear();
                    window.location.href = '../login/login.html';
                    return;
                } else if (error.response.status === 403) {
                    message = error.response.data.cta?.message || 'Access restricted. Please upgrade.';
                }
            }
            displayError('errorContainer', message);
        });
}

function renderTable(rows) {
    const rigsTable = document.getElementById('rigsTable');
    if (!rigsTable) {
        console.error('Element with ID rigsTable not found!');
        return;
    }
    rigsTable.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Sensor ID</th>
                    <th>Location</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Water Level</th>
                    <th>Humidity</th>
                    <th>Temperature</th>
                    <th>Timestamp</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${row.rig_sensor_id || 'N/A'}</td>
                        <td>${row.rig_location || 'N/A'}</td>
                        <td>${row.rig_latitude || 'N/A'}</td>
                        <td>${row.rig_longitude || 'N/A'}</td>
                        <td>${row.water_level || 'N/A'}</td>
                        <td>${row.humidity_data || 'N/A'}</td>
                        <td>${row.temperature_data || 'N/A'}</td>
                        <td>${row.timestamp_ ? new Date(row.timestamp_).toLocaleString() : 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderGraph(rows) {
    const lineGraph = document.getElementById('lineGraph');
    if (!lineGraph) {
        console.error('Element with ID lineGraph not found!');
        return;
    }

    const seriesData = [
        {
            name: 'Water Level',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.water_level !== 'N/A' ? parseFloat(row.water_level) : null,
            })).filter(d => d.x && d.y !== null),
        },
        {
            name: 'Humidity',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.humidity_data !== 'N/A' ? parseFloat(row.humidity_data) : null,
            })).filter(d => d.x && d.y !== null),
        },
        {
            name: 'Temperature',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.temperature_data !== 'N/A' ? parseFloat(row.temperature_data) : null,
            })).filter(d => d.x && d.y !== null),
        },
    ].filter(series => series.data.length > 0);

    Highcharts.chart('lineGraph', {
        chart: { type: 'line' },
        title: { text: 'Water Levels, Humidity, and Temperature Trends' },
        xAxis: { type: 'datetime', title: { text: 'Date' } },
        yAxis: { title: { text: 'Value' } },
        series: seriesData,
        accessibility: { enabled: true },
    });
}

function fetchSubscriptionDetails(token) {
    return axios.get(`${BASE_URL}/subscription/details/`, {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => {
            const data = response.data;
            console.log('Subscription Details:', data);
            return data;
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            throw error;
        });
}

function checkTokenAndFetchSubscriptionDetails() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view subscription details.');
        window.location.href = '../login/login.html';
        return;
    }

    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'block';

    Promise.all([
        fetchSubscriptionDetails(token),
        fetchAvailableUpgrades(token),
    ])
        .then(([subscriptionData, upgradeData]) => {
            renderSubscriptionDetailsInModal(subscriptionData);
            renderUpgradeOptionsInModal(upgradeData, token);
            const modal = new bootstrap.Modal(document.getElementById('subscriptionModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            displayError('errorContainer', 'Failed to load subscription details.');
            if (error.response && error.response.status === 401) {
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
        })
        .finally(() => {
            if (spinner) spinner.style.display = 'none';
        });
}

function renderSubscriptionDetailsInModal(data) {
    const detailsContainer = document.getElementById('subscriptionDetails');
    if (!detailsContainer) {
        console.error('Element with ID subscriptionDetails not found!');
        return;
    }
    detailsContainer.innerHTML = `
        <p><strong>Plan:</strong> ${data.tier || 'N/A'}</p>
        <p><strong>Services:</strong> ${data.services ? data.services.join(', ') : 'None'}</p>
        <p><strong>Historical Data:</strong> ${data.usage_limits ? data.usage_limits.historical_data_days + ' days' : 'N/A'}</p>
        <p><strong>Reports:</strong> ${data.usage_limits ? data.usage_limits.report_count : 'N/A'}</p>
    `;
}

function fetchAvailableUpgrades(token) {
    return axios.get(`${BASE_URL}/subscription/upgrade/`, {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => response.data)
        .catch(error => {
            console.error('Error fetching available upgrades:', error);
            throw error;
        });
}

function renderUpgradeOptionsInModal(upgradeData, token) {
    const upgradeContainer = document.getElementById('upgradeOptions');
    if (!upgradeContainer) {
        console.error('Element with ID upgradeOptions not found!');
        return;
    }
    upgradeContainer.innerHTML = upgradeData.available_upgrades && upgradeData.available_upgrades.length > 0
        ? `<h4>Available Upgrades</h4><ul class="list-group">${
            upgradeData.available_upgrades.map(upgrade => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${upgrade.name}</strong> - ${upgrade.description}<br>
                        Price: KES ${upgrade.price}/month
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="handleUpgrade('${upgrade.id}')">Upgrade</button>
                </li>
            `).join('')
        }</ul>`
        : '<p>No upgrade options available.</p>';
}

function handleUpgrade(upgradeId) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to upgrade.');
        window.location.href = '../login/login.html';
        return;
    }

    axios.post(`${BASE_URL}/subscription/subscribe/`, { planId: upgradeId }, {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => {
            alert(response.data.message || 'Please complete payment to activate subscription.');
            window.location.href = `../payment.html?planId=${upgradeId}`;
        })
        .catch(error => {
            console.error('Error initiating upgrade:', error);
            alert('Failed to initiate upgrade. Please try again.');
        });
}

function displayError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}