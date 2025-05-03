document.addEventListener('DOMContentLoaded', () => {
    const rigsCard = document.getElementById('rigs-card');

    if (rigsCard) {
        rigsCard.addEventListener('click', () => {
            checkTokenAndFetchData();
        });
    }
});

function checkTokenAndFetchData() {
    const token = localStorage.getItem('token');

    if (!token) {
        alert('You need to be logged in to view this data.');
        window.location.href = '../../login.html';
        return;
    }

    fetchRigsData(token);
}

function fetchRigsData(token) {
    axios.get('http://127.0.0.1:8000/rigsdata/waterlevels/', {
            headers: {
                'Authorization': 'Token ' + token
            }
        })
        .then(response => {
            const data = response.data;
            console.log('Rigs Data:', data);

            // Render the table with the fetched data
            renderTableInOverlay(data);

            // Handle CTA for free and corporate users
            if (data.cta) {
                const ctaContainer = document.getElementById('cta-container');
                ctaContainer.style.display = 'block'; // Show the CTA container
                ctaContainer.innerHTML = `
                    <div class="alert alert-info">
                        <strong>${data.cta.message}</strong><br>
                        <a href="${data.cta.upgrade_url}" class="btn btn-primary">Upgrade Now</a>
                    </div>
                `;
            }

            // Show the overlay
            document.getElementById('data-overlay').style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching rigs data:', error);
            alert('Failed to load rigs data.');
        });
}



function renderTableInOverlay(data) {
    const tableContainer = document.getElementById('table-container');
    tableContainer.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    table.classList.add('table', 'table-striped');

    // Create table header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    
    // Create a mapping from column names to the actual keys in the row data
    const keyMapping = {
        'Rig Sensor ID': 'rig_sensor_id',
        'Location': 'rig_location',
        'Latitude': 'rig_latitude',
        'Longitude': 'rig_longitude',
        'Water Level': 'water_level',
        'Humidity': 'humidity_data',
        'Temperature': 'temperature_data',
        'Timestamp': 'timestamp_'
    };

    // Set up the header and map to actual data keys
    Object.keys(keyMapping).forEach(col => {
        const th = document.createElement('th');
        th.textContent = col; // Set header text
        headerRow.appendChild(th);
    });

    // Create table body
    const body = table.createTBody();
    data.rows.forEach(row => {
        const bodyRow = body.insertRow();
        Object.keys(keyMapping).forEach(col => {
            const cell = bodyRow.insertCell();
            const key = keyMapping[col]; // Get the actual key from mapping

            // Log the key and check if it exists in the row
            console.log(`Checking key: "${key}" in row:`, row);

            // Set cell text based on existence in row
            if (row[key] !== undefined) {
                cell.textContent = row[key];
            } else {
                console.warn(`Key "${key}" not found in row. Defaulting to 'N/A'.`);
                cell.textContent = 'N/A'; // Handle undefined
            }
        });
    });

    tableContainer.appendChild(table);
}





function closeOverlay() {
    document.getElementById('data-overlay').style.display = 'none'; // Hide overlay
}

function initiateAnalysis() {
    // Blur the background
    document.body.classList.add('blurred');

    // Show the loading spinner
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'flex'; // Make it visible

    // Simulate a delay for analysis (replace with your actual analysis logic)
    setTimeout(() => {
        // Hide the spinner
        spinner.style.display = 'none';

        // Remove the blur
        document.body.classList.remove('blurred');

        // Hide the rigs data overlay
        const tableContainer = document.getElementById('table-container');
        const dataOverlay = document.getElementById('data-overlay');
        if (dataOverlay) {
            dataOverlay.style.display = 'none'; // Hide the overlay
        }

        // Show the analysis card
        const analysisCard = document.getElementById('analysis-card');
        analysisCard.style.display = 'block';

        // Display analyzed accuracies or results
        displayAnalyzedAccuracies();

        alert('Model analysis initiated based on the displayed data.');
    }, 2000); // Adjust the time as needed
}

function displayAnalyzedAccuracies() {
    const analysisCard = document.getElementById('analysis-card');
    
    // Clear previous content in the analysis card (if needed)
    analysisCard.innerHTML = '<h3>Analysis Results</h3>'; // Reset header

    showDrawnPredictedValues();
}



// Subscription card
document.addEventListener('DOMContentLoaded', () => {
    const subscriptionsCard = document.getElementById('subscriptionsCardsModal');

    if (subscriptionsCard) {
        subscriptionsCard.addEventListener('click', () => {
            checkTokenAndFetchSubscriptionDetails();
        });
    }

    // Ensure subscription details are rendered after the modal is opened.
    document.getElementById('subscriptionsCardsModal').addEventListener('show.bs.modal', () => {
        // Call function to fetch details only when the modal is shown
        checkTokenAndFetchSubscriptionDetails();
    });
});


function checkTokenAndFetchSubscriptionDetails() {
    const token = localStorage.getItem('token');

    if (!token) {
        alert('You need to be logged in to view subscription details.');
        window.location.href = '../../login.html';
        return;
    }

    Promise.all([
        fetchSubscriptionDetails(token),
        fetchAvailableUpgrades(token)
    ]).catch(error => {
        console.error('Error fetching subscription details:', error);
        const status = error.response ? error.response.status : 'Network Error';
        const message = error.response ? error.response.data?.message || 'An error occurred.' : 'Please check your internet connection.';
        alert(`Failed to load subscription details. Status: ${status}, Message: ${message}`);
    });
    
}

function fetchSubscriptionDetails(token) {
    return axios.get('http://127.0.0.1:8000/subscription/details', {
            headers: {
                'Authorization': 'Token ' + token
            }
        })
        .then(response => {
            const data = response.data;
            console.log('Subscription Details:', data);
            renderSubscriptionDetailsInModal(data);
            $('#subscriptionModal').modal('show'); // Show the modal after rendering
            document.getElementById('subscriptionDetails').style.display = 'block';        })
        .catch(error => {
            console.error('Error fetching subscription details:', error);

            // Enhanced error handling
            const status = error.response?.status || 'Network Error';
            const message = error.response?.data?.message || 'An unknown error occurred';
            alert(`Failed to load subscription details. Status: ${status}, Message: ${message}`);
        });
}


function renderSubscriptionDetailsInModal(data) {
    const detailsContainer = document.getElementById('subscriptionDetails');
    if (!detailsContainer) {
        console.error('Element with ID subscriptionDetails not found!');
        return; // Early exit to avoid further errors
    }
    detailsContainer.innerHTML = ''; // Clear previous details if any

    // Start building the details HTML
    let detailsHtml = `
        <h3>Current Plan: ${data.tier}</h3>
        <p>Services: ${data.services.join(", ")}</p>
        <p>Usage Limits: ${data.usage_limits.historical_data_days} days of historical data, ${data.usage_limits.report_count} reports</p>
        <p>Price: ${data.pricing}</p>
        <p class="cta-message">${data.cta_message || 'Upgrade for more features!'}</p>
    `;

    // Add a section for upgrade options
    detailsHtml += '<h4>Available Upgrades</h4><div id="upgradeOptionsContainer"></div>';

    detailsContainer.innerHTML = detailsHtml;

    // Fetch available upgrades and render them
    // fetchAvailableUpgrades(data.token); // Make sure to pass the correct token here
}

function fetchAvailableUpgrades(token) {
    return axios.get('http://127.0.0.1:8000/subscription/upgrade/', {
            headers: {
                'Authorization': 'Token ' + token
            }
        })
        .then(response => {
            const upgradeData = response.data;
            console.log('Available Upgrades:', upgradeData);
            // renderUpgradeOptionsInModal(upgradeData);
        })
        .catch(error => {
            console.error('Error fetching available upgrades:', error);
            alert('Failed to load upgrade options.');
        });
}
// Render upgrade options in the modal and fetch upgrade data if needed
function renderUpgradeOptionsInModal(token) {
    const upgradeContainer = document.getElementById('upgradeOptions');
    upgradeContainer.innerHTML = ''; // Clear previous upgrade options if any

    fetchAvailableUpgrades(token)
        .then(upgradeData => {
            // Log the received upgrade data for debugging
            console.log('Received upgrade data:', upgradeData);

            if (upgradeData.available_upgrades && upgradeData.available_upgrades.length > 0) {
                let upgradeHtml = '<ul class="list-group">';
                upgradeData.available_upgrades.forEach(upgrade => {
                    upgradeHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${upgrade.name}</strong> - ${upgrade.description}<br>
                                Price: ${upgrade.price}
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
        })
        .catch(error => {
            console.error('Error fetching available upgrades:', error);
            upgradeContainer.innerHTML = '<p>Failed to load upgrade options.</p>';
        });
}






function closeOverlay() {
    document.getElementById('data-overlay').style.display = 'none'; // Hide overlay
}

function handleUpgrade(upgradeId) {
    alert(`Proceeding to payment for upgrade ID: ${upgradeId}.`);
    // Add payment handling logic here
}
