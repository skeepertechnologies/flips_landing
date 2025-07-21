// Track initial load for loader
let isInitialLoad = true;

// Function to show the loader during initial load
function showLoader(loadingMessage) {
    if (isInitialLoad) {
        const spinner = document.getElementById('spinner');
        if (spinner) {
            spinner.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span class="ms-2 text-muted">${loadingMessage}</span>
            `;
            spinner.style.display = 'flex';
        }
        const rigsTable = document.getElementById('rigsTable');
        if (rigsTable) rigsTable.style.opacity = '0.5';
        const lineGraph = document.getElementById('lineGraph');
        if (lineGraph) lineGraph.style.opacity = '0.5';
    }
}

// Function to hide the loader
function hideLoader() {
    if (isInitialLoad) {
        const spinner = document.getElementById('spinner');
        if (spinner) spinner.style.display = 'none';
        const rigsTable = document.getElementById('rigsTable');
        if (rigsTable) rigsTable.style.opacity = '1';
        const lineGraph = document.getElementById('lineGraph');
        if (lineGraph) lineGraph.style.opacity = '1';
        isInitialLoad = false;
    }
}

// Initialize data fetching on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchRigsAndSubscriptionData();
});

// Main function to fetch subscription and rig data
function fetchRigsAndSubscriptionData() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        alert('You need to be logged in to view this data.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('Loading Rig Data...');

    fetchSubscriptionDetails(token)
        .then(subscriptionData => {
            fetchRigsData(token, subscriptionData);
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            let message = 'Failed to load subscription details. Please try again.';
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            } else if (error.response && error.response.status === 403) {
                message = error.response.data.cta?.message || 'Access restricted. Please upgrade your plan.';
            }
            displayError('errorContainer', message);
        })
        .finally(() => {
            hideLoader();
        });
}

// Fetch subscription details
function fetchSubscriptionDetails(token) {
    return axios.get('https://api.flipsintel.org/subscription/details/', {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => {
            console.log('Subscription Details:', response.data);
            return response.data;
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            throw error;
        });
}

// Fetch rig data and render table/graph
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

    axios.get(`https://api.flipsintel.org/rigsdata/waterlevels/?${params.toString()}`, {
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
                    <div class="alert alert-info alert-dismissible fade show" role="alert">
                        <strong>${ctaMessage}</strong>
                        <a href="${ctaUrl}" class="btn btn-primary btn-sm ms-2">Upgrade Now</a>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error fetching rigs data:', error);
            let message = 'Failed to load rigs data. Please check your subscription plan.';
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            } else if (error.response && error.response.status === 403) {
                message = error.response.data.cta?.message || 'Access restricted. Please upgrade.';
            }
            displayError('errorContainer', message);
        })
        .finally(() => {
            hideLoader();
        });
}

// Render table with rig data
function renderTable(rows) {
    const rigsTable = document.getElementById('rigsTable');
    if (!rigsTable) {
        console.error('Element with ID rigsTable not found!');
        return;
    }
    rigsTable.innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th scope="col">Sensor ID</th>
                        <th scope="col">Location</th>
                        <th scope="col">Latitude</th>
                        <th scope="col">Longitude</th>
                        <th scope="col">Water Level (ft)</th>
                        <th scope="col">Humidity (%)</th>
                        <th scope="col">Temperature (°C)</th>
                        <th scope="col">Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length === 0 ? `
                        <tr>
                            <td colspan="8" class="text-center text-muted">No data available. Please upgrade your plan.</td>
                        </tr>
                    ` : rows.map(row => `
                        <tr>
                            <td>${row.rig_sensor_id || 'N/A'}</td>
                            <td>${row.rig_location || 'N/A'}</td>
                            <td>${row.rig_latitude ? parseFloat(row.rig_latitude).toFixed(6) : 'N/A'}</td>
                            <td>${row.rig_longitude ? parseFloat(row.rig_longitude).toFixed(6) : 'N/A'}</td>
                            <td>${row.water_level !== 'N/A' ? parseFloat(row.water_level).toFixed(2) : 'N/A'}</td>
                            <td>${row.humidity_data !== 'N/A' ? parseFloat(row.humidity_data).toFixed(2) : 'N/A'}</td>
                            <td>${row.temperature_data !== 'N/A' ? parseFloat(row.temperature_data).toFixed(2) : 'N/A'}</td>
                            <td>${row.timestamp_ ? new Date(row.timestamp_).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render Highcharts graph
function renderGraph(rows) {
    const lineGraph = document.getElementById('lineGraph');
    if (!lineGraph) {
        console.error('Element with ID lineGraph not found!');
        return;
    }

    const seriesData = [
        {
            name: 'Water Level (ft)',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.water_level !== 'N/A' ? parseFloat(row.water_level) : null,
            })).filter(d => d.x && d.y !== null),
            color: '#007bff',
        },
        {
            name: 'Humidity (%)',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.humidity_data !== 'N/A' ? parseFloat(row.humidity_data) : null,
            })).filter(d => d.x && d.y !== null),
            color: '#28a745',
        },
        {
            name: 'Temperature (°C)',
            data: rows.map(row => ({
                x: row.timestamp_ ? Date.parse(row.timestamp_) : null,
                y: row.temperature_data !== 'N/A' ? parseFloat(row.temperature_data) : null,
            })).filter(d => d.x && d.y !== null),
            color: '#dc3545',
        },
    ].filter(series => series.data.length > 0);

    Highcharts.chart('lineGraph', {
        chart: {
            type: 'line',
            zoomType: 'x',
            height: 400,
        },
        title: {
            text: 'Water Levels, Humidity, and Temperature Trends',
            style: { fontSize: '18px' },
        },
        xAxis: {
            type: 'datetime',
            title: { text: 'Date', style: { fontWeight: 'bold' } },
            labels: { format: '{value:%b %d, %Y %H:%M}' },
        },
        yAxis: {
            title: { text: 'Value', style: { fontWeight: 'bold' } },
        },
        series: seriesData,
        tooltip: {
            shared: true,
            valueDecimals: 2,
        },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
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
        accessibility: {
            enabled: true,
        },
    });
}

// Fetch and display subscription details in modal
function checkTokenAndFetchSubscriptionDetails() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        alert('You need to be logged in to view subscription details.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('Loading Subscription Details...');

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
            let message = 'Failed to load subscription details.';
            if (error.response && error.response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                alert('Your session is invalid. Please sign in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
            displayError('errorContainer', message);
        })
        .finally(() => {
            hideLoader();
        });
}

// Render subscription details in modal
function renderSubscriptionDetailsInModal(data) {
    const detailsContainer = document.getElementById('subscriptionDetails');
    if (!detailsContainer) {
        console.error('Element with ID subscriptionDetails not found!');
        return;
    }
    detailsContainer.innerHTML = `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Subscription Details</h5>
            </div>
            <div class="card-body">
                <p class="mb-2"><strong>Plan:</strong> ${data.tier || 'N/A'}</p>
                <p class="mb-2"><strong>Services:</strong> ${data.services ? data.services.join(', ') : 'None'}</p>
                <p class="mb-2"><strong>Historical Data:</strong> ${data.usage_limits ? data.usage_limits.historical_data_days + ' days' : 'N/A'}</p>
                <p class="mb-0"><strong>Reports:</strong> ${data.usage_limits ? data.usage_limits.report_count : 'N/A'}</p>
            </div>
        </div>
    `;
}

// Fetch available upgrades
function fetchAvailableUpgrades(token) {
    return axios.get('https://api.flipsintel.org/subscription/upgrade/', {
        headers: { 'Authorization': `Token ${token}` },
    })
        .then(response => response.data)
        .catch(error => {
            console.error('Error fetching available upgrades:', error);
            throw error;
        });
}

// Render upgrade options in modal
function renderUpgradeOptionsInModal(upgradeData, token) {
    const upgradeContainer = document.getElementById('upgradeOptions');
    if (!upgradeContainer) {
        console.error('Element with ID upgradeOptions not found!');
        return;
    }
    upgradeContainer.innerHTML = upgradeData.available_upgrades && upgradeData.available_upgrades.length > 0
        ? `
            <h4 class="mt-4 mb-3">Available Upgrades</h4>
            <div class="list-group">
                ${upgradeData.available_upgrades.map(upgrade => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${upgrade.name}</strong> - ${upgrade.description}<br>
                            <small class="text-muted">Price: KES ${upgrade.price}/month</small>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="handleUpgrade('${upgrade.id}')">Upgrade</button>
                    </div>
                `).join('')}
            </div>
        `
        : '<p class="text-muted">No upgrade options available.</p>';
}

// Handle plan upgrade
function handleUpgrade(upgradeId) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        alert('You need to be logged in to upgrade.');
        window.location.href = '../login/login.html';
        return;
    }

    // Store the current page for redirect fallback
    const previousPage = sessionStorage.getItem('lastPage') || '../index.html';

    axios.get(`https://api.flipsintel.org/subscription/plans/${upgradeId}/`, {
        headers: { Authorization: `Token ${token}` },
    })
        .then(response => {
            let planData = response.data;
            if (Array.isArray(response.data)) {
                planData = response.data.find(plan => plan.id === parseInt(upgradeId));
                if (!planData) {
                    throw new Error(`Plan with id ${upgradeId} not found`);
                }
            }
            const planPrice = parseFloat(planData.price) || 0;

            if (planPrice === 0) {
                // Free plan: subscribe directly
                return axios.post(`https://api.flipsintel.org/subscription/subscribe/`, { planId: upgradeId }, {
                    headers: { Authorization: `Token ${token}` },
                })
                    .then(subscribeResponse => {
                        if (subscribeResponse.status === 201) {
                            alert('Successfully subscribed to the free plan! Redirecting to dashboard...');
                            // Fetch dashboard URL
                            return axios.get(`https://api.flipsintel.org/subscription/getDashboard/`, {
                                headers: { Authorization: `Token ${token}` },
                            })
                                .then(dashboardResponse => {
                                    window.location.href = dashboardResponse.data.url || '../index.html';
                                });
                        } else {
                            throw new Error(subscribeResponse.data.message || 'Failed to subscribe to free plan.');
                        }
                    });
            } else {
                // Paid plan: redirect to payment page
                return axios.post(`https://api.flipsintel.org/subscription/subscribe/`, { planId: upgradeId }, {
                    headers: { Authorization: `Token ${token}` },
                })
                    .then(response => {
                        alert(response.data.message || 'Please complete payment to activate subscription.');
                        window.location.href = `../payment/payment.html?planId=${upgradeId}`;
                    });
            }
        })
        .catch(error => {
            console.error('Error initiating upgrade:', error.response ? error.response.data : error.message);
            let message = error.response?.data?.error || error.message || 'Failed to initiate upgrade. Returning to previous page...';
            alert(message);
            if (error.response && error.response.status === 401) {
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            } else {
                setTimeout(() => {
                    window.location.href = previousPage;
                }, 2000);
            }
        });
}

// Display error messages
function displayError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }
}