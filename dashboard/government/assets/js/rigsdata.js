const BASE_URL = 'https://api.flipsintel.org';

document.addEventListener('DOMContentLoaded', () => {
    const rigsCard = document.getElementById('rigs-card');
    const subscriptionsCard = document.getElementById('subscriptionsCardsModal');

    if (rigsCard) {
        rigsCard.addEventListener('click', () => {
            checkTokenAndFetchData();
        });
    }

    if (subscriptionsCard) {
        subscriptionsCard.addEventListener('click', () => {
            checkTokenAndFetchSubscriptionDetails();
        });
    }
});

function checkTokenAndFetchData() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view this data.');
        window.location.href = '../login/login.html';
        return;
    }
    fetchSubscriptionDetails(token)
        .then(subscriptionData => {
            fetchRigsData(token, subscriptionData);
        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);
            alert('Failed to load subscription details. Please try again.');
            if (error.response && error.response.status === 401) {
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            }
        });
}

function fetchRigsData(token, subscriptionData) {
    // Determine allowed services and limits from subscription
    const allowedServices = subscriptionData.services || [];
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 0, report_count: 0 };
    const subscriptionTier = subscriptionData.tier || 'Free';

    // Define which data fields are allowed based on services
    const serviceToFields = {
        water_level: ['water_level'],
        humidity: ['humidity_data'],
        temperature: ['temperature_data'],
    };

    // Filter fields to display based on allowed services
    const allowedFields = Object.keys(serviceToFields)
        .filter(service => allowedServices.includes(service))
        .flatMap(service => serviceToFields[service]);

    // Add query parameters to limit data based on subscription (e.g., historical data days)
    const params = new URLSearchParams();
    if (usageLimits.historical_data_days) {
        params.append('days', usageLimits.historical_data_days);
    }

    axios.get(`${BASE_URL}/rigsdata/waterlevels/?${params.toString()}`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
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
                    filteredRow[key] = 'N/A'; // Mask unauthorized fields
                }
            });
            return filteredRow;
        });

        // Limit the number of rigs based on subscription tier (example logic)
        let maxRigs = 1; // Default for Free tier
        if (subscriptionTier === 'Premium') maxRigs = 5;
        else if (subscriptionTier === 'Corporate') maxRigs = Infinity; // No limit
        const limitedRows = filteredRows.slice(0, maxRigs);

        // Render the filtered and limited data
        renderTableInOverlay({
            ...data,
            rows: limitedRows,
            cta: data.cta || (limitedRows.length === 0 ? {
                message: `Your ${subscriptionTier} plan does not include access to rig data. Upgrade to view more.`,
                upgrade_url: '../payment.html'
            } : null)
        });

        // Handle CTA for subscription-based restrictions
        if (data.cta || limitedRows.length === 0) {
            const ctaContainer = document.getElementById('cta-container');
            if (ctaContainer) {
                ctaContainer.style.display = 'block';
                const ctaMessage = data.cta?.message || `Your ${subscriptionTier} plan limits rig data access. Upgrade to view more.`;
                const ctaUrl = data.cta?.upgrade_url || '../payment.html';
                ctaContainer.innerHTML = `
                    <div class="alert alert-info">
                        <strong>${ctaMessage}</strong><br>
                        <a href="${ctaUrl}" class="btn btn-primary">Upgrade Now</a>
                    </div>
                `;
            }
        }

        // Show the overlay
        const dataOverlay = document.getElementById('data-overlay');
        if (dataOverlay) {
            dataOverlay.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error fetching rigs data:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert('Failed to load rigs data. Please check your subscription plan.');
        }
    });
}

function checkTokenAndFetchSubscriptionDetails() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view subscription details.');
        window.location.href = '../login/login.html';
        return;
    }

    Promise.all([
        fetchSubscriptionDetails(token),
        fetchAvailableUpgrades(token),
    ])
    .catch(error => {
        console.error('Error fetching subscription details:', error);
        const status = error.response ? error.response.status : 'Network Error';
        const message = error.response ? error.response.data?.message || 'An error occurred.' : 'Please check your internet connection.';
        alert(`Failed to load subscription details. Status: ${status}, Message: ${message}`);
    });
}

function fetchSubscriptionDetails(token) {
    return axios.get(`${BASE_URL}/subscription/details/`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        const data = response.data;
        console.log('Subscription Details:', data);
        renderSubscriptionDetailsInModal(data);
        const modal = new bootstrap.Modal(document.getElementById('subscriptionModal'));
        modal.show();
        return data; // Return data for use in fetchRigsData
    })
    .catch(error => {
        console.error('Error fetching subscription details:', error);
        const status = error.response?.status || 'Network Error';
        const message = error.response?.data?.message || 'An unknown error occurred';
        if (status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert(`Failed to load subscription details. Status: ${status}, Message: ${message}`);
        }
        throw error; // Rethrow to propagate error
    });
}

function renderSubscriptionDetailsInModal(data) {
    const detailsContainer = document.getElementById('subscriptionDetails');
    if (!detailsContainer) {
        console.error('Element with ID subscriptionDetails not found!');
        return;
    }
    detailsContainer.innerHTML = '';

    let detailsHtml = `
        <h3>Current Plan: ${data.tier || 'N/A'}</h3>
        <p>Services: ${data.services ? data.services.join(', ') : 'None'}</p>
        <p>Usage Limits: ${data.usage_limits ? `${data.usage_limits.historical_data_days} days of historical data, ${data.usage_limits.report_count} reports` : 'N/A'}</p>
        <p>Price: ${data.pricing || 'N/A'}</p>
        <p>Start Date: ${data.start_date || 'N/A'}</p>
        <p>End Date: ${data.end_date || 'N/A'}</p>
    `;
    detailsContainer.innerHTML = detailsHtml;
}

function fetchAvailableUpgrades(token) {
    return axios.get(`${BASE_URL}/subscription/upgrade/`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        const upgradeData = response.data;
        console.log('Available Upgrades:', upgradeData);
        renderUpgradeOptionsInModal(upgradeData, token);
    })
    .catch(error => {
        console.error('Error fetching available upgrades:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert('Failed to load upgrade options.');
        }
    });
}

function renderUpgradeOptionsInModal(upgradeData, token) {
    const upgradeContainer = document.getElementById('upgradeOptions');
    if (!upgradeContainer) {
        console.error('Element with ID upgradeOptions not found!');
        return;
    }
    upgradeContainer.innerHTML = '';

    if (upgradeData.available_upgrades && upgradeData.available_upgrades.length > 0) {
        let upgradeHtml = '<h4>Available Upgrades</h4><ul class="list-group">';
        upgradeData.available_upgrades.forEach(upgrade => {
            upgradeHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${upgrade.name}</strong> - ${upgrade.description}<br>
                        Price: KES ${upgrade.price}/month
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="handleUpgrade('${upgrade.id}')">Upgrade</button>
                </li>
            `;
        });
        upgradeHtml += '</ul>';
        upgradeContainer.innerHTML = upgradeHtml;
    } else {
        upgradeContainer.innerHTML = '<p>No upgrade options available at this time.</p>';
    }
}

function handleUpgrade(upgradeId) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to upgrade.');
        window.location.href = '../login/login.html';
        return;
    }

    axios.post(`${BASE_URL}/subscription/subscribe/`, {
        planId: upgradeId,
    }, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        alert(response.data.message || 'Please complete payment to activate subscription.');
        window.location.href = '../payment.html?planId=' + upgradeId;
    })
    .catch(error => {
        console.error('Error initiating upgrade:', error);
        alert('Failed to initiate upgrade. Please try again.');
    });
}

function renderTableInOverlay(data) {
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) {
        console.error('Element with ID table-container not found!');
        return;
    }
    tableContainer.innerHTML = '';

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped');

    const header = table.createTHead();
    const headerRow = header.insertRow();
    const keyMapping = {
        'Rig Sensor ID': 'rig_sensor_id',
        'Location': 'rig_location',
        'Latitude': 'rig_latitude',
        'Longitude': 'rig_longitude',
        'Water Level': 'water_level',
        'Humidity': 'humidity_data',
        'Temperature': 'temperature_data',
        'Timestamp': 'timestamp_',
    };

    // Filter headers based on available data fields (to avoid showing N/A-only columns)
    const availableFields = new Set();
    data.rows.forEach(row => {
        Object.keys(row).forEach(key => availableFields.add(key));
    });

    Object.entries(keyMapping).forEach(([col, key]) => {
        if (availableFields.has(key) || ['rig_sensor_id', 'rig_location', 'rig_latitude', 'rig_longitude', 'timestamp_'].includes(key)) {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        }
    });

    const body = table.createTBody();
    data.rows.forEach(row => {
        const bodyRow = body.insertRow();
        Object.entries(keyMapping).forEach(([col, key]) => {
            if (availableFields.has(key) || ['rig_sensor_id', 'rig_location', 'rig_latitude', 'rig_longitude', 'timestamp_'].includes(key)) {
                const cell = bodyRow.insertCell();
                cell.textContent = row[key] !== undefined ? row[key] : 'N/A';
            }
        });
    });

    tableContainer.appendChild(table);
}

function closeOverlay() {
    const dataOverlay = document.getElementById('data-overlay');
    if (dataOverlay) {
        dataOverlay.style.display = 'none';
    }
}

function initiateAnalysis() {
    document.body.classList.add('blurred');
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'flex';

    setTimeout(() => {
        spinner.style.display = 'none';
        document.body.classList.remove('blurred');
        const dataOverlay = document.getElementById('data-overlay');
        if (dataOverlay) {
            dataOverlay.style.display = 'none';
        }
        const analysisCard = document.getElementById('analysis-card');
        if (analysisCard) {
            analysisCard.style.display = 'block';
            displayAnalyzedAccuracies();
        }
        alert('Model analysis initiated based on the displayed data.');
    }, 2000);
}

function displayAnalyzedAccuracies() {
    const analysisCard = document.getElementById('analysis-card');
    if (analysisCard) {
        analysisCard.innerHTML = '<h3>Analysis Results</h3><p>Analysis data will be displayed here.</p>';
    }
}