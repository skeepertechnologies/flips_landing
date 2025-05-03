// Base URL for all AJAX requests
const BASE_URL = 'http://66.23.232.40:8000';

$(document).ready(function () {
    // Prevent the dropdown from closing when clicking inside submenus
    $('.dropdown-header').on('click', function (e) {
        e.stopPropagation(); // Prevent click event from bubbling up
        var target = $(this).data('target'); // Get the target submenu
        $(target).collapse('toggle'); // Toggle the submenu manually
    });

    // Ensure the dropdown stays open when a submenu is toggled
    $('.collapse').on('show.bs.collapse', function () {
        $(this).closest('.dropdown-menu').addClass('keep-open');
    }).on('hide.bs.collapse', function () {
        $(this).closest('.dropdown-menu').removeClass('keep-open');
    });

    // Prevent the dropdown from collapsing when clicking inside the submenu area
    $('.dropdown-menu').on('click', function (e) {
        if ($(this).hasClass('keep-open')) {
            e.stopPropagation();
        }
    });
});

document.getElementById('saveModelBtn').addEventListener('click', saveModel);

function saveModel() {
    const name = document.getElementById('modelName').value.trim();
    const description = document.getElementById('modelDescription').value.trim();
    const sensorId = document.getElementById('rigSelect').value; // Use sensor_id
    const attributes = Array.from(document.getElementById('attributesSelect').selectedOptions).map(option => option.value);
    const mlModel = document.getElementById('mlModelSelect').value;
    const token = localStorage.getItem('token');

    if (!name || !sensorId || attributes.length === 0 || !mlModel) {
        alert('All fields are required.');
        console.log('Validation failed: Missing input fields.');
        return;
    }

    console.log('Sending model creation request:', { name, description, sensorId, attributes, mlModel });

    axios.post(`${BASE_URL}/modelbuilder/create/`, {
        name,
        description,
        rig_id: sensorId, // Send sensor_id as rig_id
        attributes,
        ml_model: mlModel
    }, {
        headers: { Authorization: `Token ${token}` }
    })
    .then(response => {
        console.log('Model creation successful:', response.data);
        alert('Model created successfully!');
        document.getElementById('modelForm').reset();
        document.getElementById('modelModal').querySelector('.btn-close').click();

        // Display the "View Models" button
        const viewModelsBtn = document.getElementById('viewModelsBtn');
        viewModelsBtn.style.display = 'block';
        viewModelsBtn.addEventListener('click', fetchUserModels);

        // Fetch and display user models
        fetchUserModels();
    })
    .catch(error => {
        console.error('Error creating model:', error);
        alert('Failed to create model.');
    });
}

function fetchRigs() {
    const token = localStorage.getItem('token');

    console.log('Fetching rigs...');
    axios.get(`${BASE_URL}/monitor/rigs/`, {
        headers: { Authorization: `Token ${token}` }
    })
    .then(response => {
        console.log('Rigs fetched successfully:', response.data);
        const rigs = response.data;
        const rigSelect = document.getElementById('rigSelect');
        rigSelect.innerHTML = '<option value="" disabled selected>Select a rig</option>';
        rigs.forEach(rig => {
            const option = document.createElement('option');
            option.value = rig.sensor_id; // Use sensor_id
            option.textContent = `${rig.sensor_id} (${rig.location})`;
            rigSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error fetching rigs:', error);
        alert('Failed to fetch rigs.');
    });
}

function fetchUserModels() {
    const token = localStorage.getItem('token');

    console.log('Fetching user models...');
    axios.get(`${BASE_URL}/modelbuilder/user-models/`, {
        headers: { Authorization: `Token ${token}` }
    })
    .then(response => {
        console.log('User models fetched successfully:', response.data);
        renderUserModels(response.data);
    })
    .catch(error => {
        console.error('Error fetching user models:', error);
        alert('Failed to fetch user models.');
    });
}

function renderUserModels(models) {
    const container = document.getElementById('userModelsContainer');
    container.innerHTML = '<h3>Your Models</h3>';

    if (models.length === 0) {
        container.innerHTML += '<p>No models available.</p>';
        console.log('No models to display.');
        return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped';

    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Model Name</th>
            <th>Description</th>
            <th>Rig</th>
            <th>ML Model</th>
            <th>Created At</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    models.forEach(model => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${model.name}</td>
            <td>${model.description}</td>
            <td>${model.rig_name}</td>
            <td>${model.ml_model}</td>
            <td>${new Date(model.created_at).toLocaleString()}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewReport(${model.id})">View Report</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);
}

function viewReport(modelId) {
    console.log('Starting report generation for model:', modelId);

    // Show the modal
    const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    reportModal.show();

    const token = localStorage.getItem('token');

    // Reset modal content
    document.getElementById('progressSpinner').classList.remove('d-none');
    document.getElementById('reportStatus').innerText = "Please wait while the report is being generated...";
    document.getElementById('downloadReportLink').classList.add('d-none');

    axios.post(`${BASE_URL}/modelbuilder/report/${modelId}/`, {}, {
        headers: { Authorization: `Token ${token}` },
        responseType: 'blob', // Important for file downloads
    })
    .then(response => {
        console.log('Report generated successfully.');

        // Create a downloadable link for the PDF
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const downloadLink = document.getElementById('downloadReportLink');
        downloadLink.href = url;
        downloadLink.download = `Model_${modelId}_Report.pdf`;

        // Update modal content
        document.getElementById('progressSpinner').classList.add('d-none');
        document.getElementById('reportStatus').innerText = "Report generated successfully!";
        downloadLink.classList.remove('d-none');
    })
    .catch(error => {
        console.error('Error generating report:', error);
        document.getElementById('progressSpinner').classList.add('d-none');
        document.getElementById('reportStatus').innerText = "Failed to generate the report. Please try again.";
    });
}

// Fetch rigs on modal open
document.getElementById('modelModal').addEventListener('show.bs.modal', fetchRigs);

document.addEventListener('DOMContentLoaded', function () {
    // Ensure BASE_URL is defined
    const BASE_URL = 'http://66.23.232.40:8000'; // Define BASE_URL if not already defined globally

    // Event listener for Subscriptions card click
    const subscriptionsCard = document.getElementById('subscriptionsCard');
    if (subscriptionsCard) {
        subscriptionsCard.addEventListener('click', function () {
            // Fetch user settings via the API using Axios
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found in localStorage');
                return;
            }

            axios.get(`${BASE_URL}/settings/settings/`, {
                headers: {
                    'Authorization': 'Token ' + token,
                },
            })
            .then(function (response) {
                const data = response.data;

                // Display active subscriptions
                const subscriptionDiv = document.getElementById('subscriptions');
                if (subscriptionDiv) {
                    subscriptionDiv.innerHTML = ''; // Clear previous subscriptions
                    data.active_subscriptions.forEach(subscription => {
                        const subElement = document.createElement('div');
                        subElement.textContent = `${subscription.name} - $${subscription.price}`;
                        subscriptionDiv.appendChild(subElement);
                    });
                }

                // Display recommended plans
                const recommendedDiv = document.getElementById('recommended_plans');
                if (recommendedDiv) {
                    recommendedDiv.innerHTML = ''; // Clear previous plans
                    data.recommended_plans.forEach(plan => {
                        const planElement = document.createElement('div');
                        planElement.textContent = `${plan.name} - $${plan.price}`;
                        recommendedDiv.appendChild(planElement);
                    });
                }
            })
            .catch(function (error) {
                console.error('Error fetching settings:', error);
            });
        });
    } else {
        console.warn('Element with ID "subscriptionsCard" not found');
    }

    // Event listener for Account Settings dropdown click
    const accountSettingsLink = document.getElementById('accountSettingsLink');
    if (accountSettingsLink) {
        accountSettingsLink.addEventListener('click', function () {
            // Fetch user settings for account details
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No token found in localStorage');
                return;
            }

            axios.get(`${BASE_URL}/settings/settings/`, {
                headers: {
                    'Authorization': 'Token ' + token,
                },
            })
            .then(function (response) {
                const data = response.data;

                // Populate modal with user profile info
                const modalUsername = document.getElementById('modalUsername');
                const modalEmail = document.getElementById('modalEmail');
                const modalSubscriptionLevel = document.getElementById('modalSubscriptionLevel');
                const modalBillingAddress = document.getElementById('modalBillingAddress');

                if (modalUsername && modalEmail && modalSubscriptionLevel && modalBillingAddress) {
                    modalUsername.textContent = data.profile.user.username || 'N/A';
                    modalEmail.textContent = data.profile.user.email || 'N/A';
                    modalSubscriptionLevel.textContent = data.profile.subscription_level || 'N/A';
                    modalBillingAddress.textContent = data.profile.billing_address || 'N/A';

                    // Show the modal
                    $('#accountSettingsModal').modal('show'); // Fixed curly apostrophe
                } else {
                    console.error('One or more modal elements not found');
                }
            })
            .catch(function (error) {
                console.error('Error fetching account settings:', error);
            });
        });
    } else {
        console.warn('Element with ID "accountSettingsLink" not found');
    }
});

function showLoader() {
    const reportStatusElement = document.getElementById("report-status");
    if (reportStatusElement) {
        reportStatusElement.innerHTML = "Generating report... Please wait.";
    }
}

function hideLoader() {
    const reportStatusElement = document.getElementById("report-status");
    if (reportStatusElement) {
        reportStatusElement.innerHTML = "";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // Function to fetch user activities with debounce
    const fetchUserActivities = debounce(() => {
        axios.get(`${BASE_URL}/activity/activities/`, {
            headers: {
                'Authorization': 'Token ' + token,
            },
        }).then((response) => {
            const activities = response.data;
            renderUserActivities(activities);
        }).catch((error) => {
            console.error('Error fetching user activities:', error);
        });
    }, 300); // Debounce time of 300ms

    // Function to render user activities
    const renderUserActivities = (activities) => {
        const recentResourcesDiv = document.getElementById('recentResources');
        recentResourcesDiv.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <p><strong>Path:</strong> ${activity.path}</p>
                <p><strong>Method:</strong> ${activity.method}</p>
                <p><strong>Timestamp:</strong> ${new Date(activity.timestamp).toLocaleString()}</p>
                <p><strong>IP Address:</strong> ${activity.ip_address}</p>
                <p><strong>User Agent:</strong> ${activity.user_agent}</p>
                <hr>
            </div>
        `).join(''); // Join and set innerHTML in one go
    };

    // Debounce function to limit API calls
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Fetch activities when the page loads
    fetchUserActivities();
});

async function showWaterFlowAnalysisMap() {
    document.querySelector('.content').innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Water Flow Analysis</h2>
            <div id="waterFlowMap" style="height: 600px;"></div>
            <div id="waterFlowInfo" class="mt-4">
                <p><strong>Latitude Range:</strong> <span id="latitudeRange"></span></p>
                <p><strong>Longitude Range:</strong> <span id="longitudeRange"></span></p>
            </div>
        </div>
    `;
    initializeWaterFlowMap();
}

async function initializeWaterFlowMap() {
    try {
        // Fetch Mapbox token
        const token = localStorage.getItem('token');
        const tokenResponse = await axios.get(`${BASE_URL}/api/get-mapbox-token/`, {
            headers: { 'Authorization': 'Token ' + token }
        });
        const mapboxToken = tokenResponse.data.mapbox_access_token;

        // Initialize Mapbox with the fetched token, focused on Kenya
        mapboxgl.accessToken = mapboxToken;
        const map = L.map('waterFlowMap').setView([-1.286389, 36.817223], 7); // Focus on Kenya

        // Add Mapbox satellite tile layer
        L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`, {
            maxZoom: 18,
            attribution: '© Mapbox © OpenStreetMap © DigitalGlobe'
        }).addTo(map);

        // Initialize drawing control
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems }
        });
        map.addControl(drawControl);

        // Event for area selection
        map.on(L.Draw.Event.CREATED, function (event) {
            const layer = event.layer;
            drawnItems.addLayer(layer);
            const coordinates = layer.getLatLngs()[0].map(latLng => [latLng.lng, latLng.lat]);
            sendROICoordinates(coordinates, map);
        });

        fetchWaterFlowData(map);
        addRigMarkersOnLoad(map);
    } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        alert('Failed to load map. Please try again later.');
    }
}

async function addRigMarkersOnLoad(map) {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${BASE_URL}/monitor/rig-locations/`, {
            headers: { 'Authorization': 'Token ' + token },
        });

        const rigLocations = response.data.rig_locations;
        rigLocations.forEach(([lat, lon]) => {
            const marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup(`Rig Location<br>Lat: ${lat}, Lon: ${lon}`);
        });
    } catch (error) {
        console.error('Error loading rig markers:', error);
    }
}

async function sendROICoordinates(coordinates, map) {
    const token = localStorage.getItem('token');
    const formattedCoordinates = coordinates.map(coord => [coord[1], coord[0]]);
    const dataToSend = { coordinates: formattedCoordinates };

    try {
        const response = await axios.post(`${BASE_URL}/gis/aoi/`, dataToSend, {
            headers: { 'Authorization': 'Token ' + token },
        });

        if (response.data.dem_data_url) {
            alert('No rigs found. Displaying DEM data.');
            loadDEMData(response.data.dem_data_url, map);
        } else if (response.data.rig_locations) {
            alert('No data found, but rigs are available. Adding markers.');
            addRigMarkers(response.data.rig_locations, map);
        } else {
            alert('Water flow data available. Displaying data.');
            updateWaterFlowInfo(response.data);
        }
    } catch (error) {
        console.error('Error sending AOI:', error);
    }
}

function loadDEMData(demDataUrl, map) {
    fetch(demDataUrl)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer).then(georaster => {
        const demLayer = new GeoRasterLayer({ georaster, opacity: 0.7 });
        map.addLayer(demLayer);
        map.fitBounds(demLayer.getBounds());
    }))
    .catch(error => console.error('Error loading DEM data:', error));
}

function addRigMarkers(rigLocations, map) {
    rigLocations.forEach(([lat, lon]) => {
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`Rig Location<br>Lat: ${lat}, Lon: ${lon}`);
    });
}

async function fetchWaterFlowData(map) {
    const token = localStorage.getItem('token');
    const config = { headers: { 'Authorization': 'Token ' + token } };

    try {
        const response = await axios.get(`${BASE_URL}/gis/gismapping/`, config);
        const data = response.data;

        document.getElementById("latitudeRange").innerText = `${data.latitude_range[0]}, ${data.latitude_range[1]}`;
        document.getElementById("longitudeRange").innerText = `${data.longitude_range[0]}, ${data.longitude_range[1]}`;

        loadGeoTIFFLayer(data.tiff_url, map);
    } catch (error) {
        console.error('Error fetching water flow data:', error);
    }
}

function updateWaterFlowInfo(data) {
    document.getElementById("latitudeRange").innerText = `${data.latitude_range[0]}, ${data.latitude_range[1]}`;
    document.getElementById("longitudeRange").innerText = `${data.longitude_range[0]}, ${data.longitude_range[1]}`;

    if (data.tiff_url) {
        loadGeoTIFFLayer(data.tiff_url, map);
    }
}

function loadGeoTIFFLayer(url, map) {
    fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer).then(georaster => {
        const layer = new GeoRasterLayer({
            georaster,
            opacity: 0.7,
            pixelValuesToColorFn: values => {
                const [value] = values;
                return value === null ? null : `rgba(0, 0, 255, ${value / 100})`;
            }
        });
        map.addLayer(layer);
        map.fitBounds(layer.getBounds());
    }))
    .catch(error => console.error('Error loading GeoTIFF layer:', error));
}

function showDrawnPredictedValues() {
    document.querySelector('.content').innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Model Predictions and Accuracies</h2>
            <div class="row">
                <div class="col-md-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div id="modelPredictionChart"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    initializePredictionChart();
}

function initializePredictionChart() {
    const token = localStorage.getItem('token');
    axios.get(`${BASE_URL}/monitor/predicted-data/`, {
        headers: {
            'Authorization': 'Token ' + token,
        },
    })
    .then((response) => {
        const data = response.data;
        console.log('API Response Data:', data);

        if (!data || !data.predicted_data || !data.model_details || !data.model_details.accuracies) {
            console.error('Invalid data structure:', data);
            return;
        }

        renderPredictionChart(data);
    })
    .catch((error) => {
        console.error('Error fetching predictive model data:', error);
    });
}

function renderPredictionChart(data) {
    const predictedData = data.predicted_data;
    const accuracies = data.model_details.accuracies;
    const previousPredictions = data.previous_predictions;

    console.log('Predicted Data:', predictedData);
    console.log('Accuracies:', accuracies);
    console.log('Previous Predictions:', previousPredictions);

    const seriesData = Object.keys(predictedData).map(model => ({
        name: `${model} Prediction (Accuracy: ${accuracies[model].toFixed(2)})`,
        data: predictedData[model].map(entry => ({
            name: entry.name,
            y: entry.y
        }))
    }));

    // Add the previous predictions fetched from the database
    const previousSeriesData = previousPredictions.map(entry => ({
        name: `DB Prediction at ${entry.timestamp}`,
        data: entry.predicted_level
    }));

    const combinedSeries = [...seriesData, ...previousSeriesData];

    // Assuming all models have same location categories
    const categories = predictedData[Object.keys(predictedData)[0]].map(entry => entry.name);

    console.log('Series Data:', combinedSeries);

    Highcharts.chart('modelPredictionChart', {
        chart: {
            type: 'line'
        },
        title: {
            text: 'Model Predictions and Accuracies'
        },
        xAxis: {
            title: {
                text: 'Locations'
            },
            categories: categories
        },
        yAxis: {
            title: {
                text: 'Water Levels'
            }
        },
        tooltip: {
            shared: true,
            useHTML: true,
            headerFormat: '<small>{point.key}</small><table>',
            pointFormat: '<tr><td style="color: {series.color}">{series.name}: </td>' +
                '<td style="text-align: right"><b>{point.y}</b></td></tr>',
            footerFormat: '</table>',
            valueDecimals: 2
        },
        series: combinedSeries
    });
}

function showDrawnPerformanceValues() {
    document.querySelector('.content').innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Model Performance</h2>
            <div class="row">
                <div class="col-md-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div id="modelPredictionChart"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    fetchPerformanceData();
}

function fetchPerformanceData() {
    const token = localStorage.getItem('token');
    axios.get(`${BASE_URL}/monitor/performance/`, {
        headers: {
            'Authorization': 'Token ' + token,
        },
    })
    .then((response) => {
        const data = response.data;
        console.log('API Response Data:', data);

        // Check if the necessary properties exist in the data
        if (!data || !data.current_performance_data || !data.model_accuracies || !data.accuracy_percentages) {
            console.error('Invalid data structure:', data);
            return;
        }

        // Extract relevant data
        const currentPerformanceData = data.current_performance_data;
        const modelAccuracies = data.model_accuracies;
        const accuracyPercentages = data.accuracy_percentages;

        console.log('Current Performance Data:', currentPerformanceData);
        console.log('Model Accuracies:', modelAccuracies);
        console.log('Accuracy Percentages:', accuracyPercentages);

        // Call the renderPerformance function with the newly structured data
        renderPerformance(currentPerformanceData, modelAccuracies, accuracyPercentages);
    })
    .catch((error) => {
        console.error('Error fetching predictive model data:', error);
    });
}

function renderPerformance(currentPerformanceData, modelAccuracies, accuracyPercentages) {
    // Check if accuracyPercentages is valid before proceeding
    if (accuracyPercentages && typeof accuracyPercentages === 'object') {
        console.log(Object.keys(accuracyPercentages));
    } else {
        console.error('accuracyPercentages is not valid:', accuracyPercentages);
        return; // Exit the function if data is not valid
    }

    // Prepare series data for each model based on the predicted data
    const seriesData = Object.keys(currentPerformanceData).map(location => {
        return Object.keys(modelAccuracies).map(model => {
            return {
                name: `${model} Prediction (Accuracy: ${accuracyPercentages[model].toFixed(2)}%)`,
                data: currentPerformanceData[location].levels.map((level, index) => ({
                    name: new Date(currentPerformanceData[location].timestamps[index]).toLocaleString(), // Use timestamps for x-axis
                    y: level
                })),
                color: getModelColor(model), // Assign each model a unique color
                marker: { enabled: true }
            };
        });
    }).flat(); // Flatten the array to combine all series

    // Get unique timestamps for x-axis categories (assuming they are the same across all models)
    const categories = currentPerformanceData[Object.keys(currentPerformanceData)[0]].timestamps.map(ts => new Date(ts).toLocaleString());

    Highcharts.chart('modelPredictionChart', {
        chart: {
            type: 'line'
        },
        title: {
            text: 'Model Predictions with Accuracies and Historical Data'
        },
        subtitle: {
            text: 'Prediction reliability based on model accuracy'
        },
        xAxis: {
            title: {
                text: 'Time'
            },
            categories: categories // Use the timestamps as categories
        },
        yAxis: {
            title: {
                text: 'Water Levels'
            },
            plotLines: [{
                color: '#FF0000',
                width: 2,
                value: 0, // Assuming you want a fixed value for the threshold
                label: {
                    text: 'Threshold Level',
                    align: 'center',
                    style: {
                        color: '#FF0000'
                    }
                }
            }]
        },
        tooltip: {
            shared: true,
            useHTML: true,
            headerFormat: '<small>{point.key}</small><table>',
            pointFormat: '<tr><td style="color: {series.color}">{series.name}: </td>' +
                '<td style="text-align: right"><b>{point.y}</b></td></tr>',
            footerFormat: '</table>',
            valueDecimals: 2
        },
        series: seriesData
    });
}

function getModelColor(model) {
    const colors = {
        knn: '#4572A7',
        linear_regression: '#AA4643',
        decision_tree: '#89A54E',
        random_forest: '#80699B',
        svr: '#3D96AE'
    };
    return colors[model] || '#000000'; // Default color
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('.content');
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) {
        content.style.marginLeft = '250px';
    } else {
        content.style.marginLeft = '0';
    }
}

document.addEventListener('click', function (event) {
    const sidebar = document.getElementById('sidebar');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    if (sidebar.classList.contains('active') && !sidebar.contains(event.target) && !hamburgerMenu.contains(event.target)) {
        sidebar.classList.remove('active');
        document.querySelector('.content').style.marginLeft = '0';
    }
});

function handleLogout() {
    const token = localStorage.getItem('token');
    axios.post(`${BASE_URL}/logout/`, {}, {
        headers: {
            'Authorization': 'Token ' + token,
        },
    }).then(function (response) {
        localStorage.removeItem('token');
        localStorage.removeItem('graphDataCache'); // Clear the graph data from localStorage
        window.location.href = '../../index.html';
    }).catch(function (error) {
        console.error('Logout failed', error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    let inactivityTimeout;
    const resetTimeout = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(logOutDueToInactivity, 18000000000); // 30 minutes
    };
    const logOutDueToInactivity = () => {
        alert('You have been logged out due to inactivity.');
        handleLogout();
    };
    document.addEventListener('mousemove', resetTimeout);
    document.addEventListener('keypress', resetTimeout);
    document.addEventListener('DOMContentLoaded', resetTimeout);

    const fetchDataAndRenderCharts = (token) => {
        axios.get(`${BASE_URL}/api/user-info/`, {
            headers: {
                Authorization: 'Token ' + token,
            },
        }).then((response) => {
            localStorage.setItem('username', response.data.username);
            localStorage.setItem('token', token);
            document.getElementById('username').textContent = response.data.username;
        }).catch((error) => {
            console.error('Error loading user data:', error);
            document.getElementById('userEmail').textContent = 'Failed to load user data';
        });
    };

    const initializeCharts = () => {
        const cachedGraphData = localStorage.getItem('graphDataCache');
        if (cachedGraphData) {
            const graphData = JSON.parse(cachedGraphData);
            renderCharts(graphData);
        }

        const token = localStorage.getItem('token');
        axios.get(`${BASE_URL}/monitor/graph-data/`, {
            headers: {
                Authorization: 'Token ' + token,
            },
        }).then((response) => {
            renderCharts(response.data);
            localStorage.setItem('graphDataCache', JSON.stringify(response.data));
        }).catch((error) => {
            console.error('Error fetching graph data:', error);
        });
    };

    const renderCharts = (data) => {
        const rigs = Object.keys(data.current_data);

        renderRigCharts('waterLevelChart', 'Water Level over Time', 'Water Level (ft)', rigs, data.current_data, 'levels');
        renderRigCharts('temperatureChart', 'Temperature over Time', 'Temperature (°C)', rigs, data.current_data, 'temperatures');
        renderRigCharts('humidityChart', 'Humidity over Time', 'Humidity (%)', rigs, data.current_data, 'humidities');
    };

    const renderRigCharts = (containerId, title, yAxisTitle, rigs, data, dataKey) => {
        const seriesData = rigs.map(rig => {
            return {
                name: rig,
                data: data[rig][dataKey].map((value, index) => [Date.parse(data[rig]['timestamps'][index]), value])
            };
        });

        Highcharts.chart(containerId, {
            chart: {
                type: 'areaspline',
                zoomType: 'x'
            },
            title: {
                text: title
            },
            xAxis: {
                type: 'datetime',
                title: {
                    text: 'Date'
                },
                minRange: 0.5 * 3600 * 1000, // 30 minutes in milliseconds
                events: {
                    afterSetExtremes: function (e) {
                        const minRange = this.minRange;
                        const xAxis = this;
                        if (e.max - e.min < minRange) {
                            setTimeout(() => {
                                xAxis.setExtremes(e.min, e.min + minRange, true, false);
                            }, 0);
                        }
                    }
                }
            },
            yAxis: {
                title: {
                    text: yAxisTitle
                }
            },
            series: seriesData,
            accessibility: {
                enabled: true
            },
            navigator: {
                enabled: true,
                adaptToUpdatedData: true,
                series: {
                    type: 'line',
                }
            },
            scrollbar: {
                enabled: true
            }
        });
    };

    const checkTokenAndFetchData = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || localStorage.getItem('token');

        if (token) {
            fetchDataAndRenderCharts(token);
        } else {
            alert('No token found in URL or localStorage.');
            window.location.href = '../../index.html';
        }
    };

    checkTokenAndFetchData();

    // Setting up auto-refresh every 30 seconds
    setInterval(initializeCharts, 3000);
});

let refreshTimers = {}; // To store refresh intervals for each chart

function showCharts() {
    document.querySelector('.content').innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Live Data - Water Levels, Temperature, and Humidity</h2>
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div id="dominantChart"></div>
                        </div>
                    </div>
                </div>
                <div class="col-12 d-flex justify-content-center mt-3">
                    <button class="btn btn-outline-primary mx-2" onclick="switchChart('waterLevelChart')">Water Level</button>
                    <button class="btn btn-outline-primary mx-2" onclick="switchChart('temperatureChart')">Temperature</button>
                    <button class="btn btn-outline-primary mx-2" onclick="switchChart('humidityChart')">Humidity</button>
                </div>
            </div>
        </div>
    `;
    // Initialize charts with Water Level as default dominant chart
    switchChart('waterLevelChart');
}

function initializeChart(chartType) {
    const token = localStorage.getItem('token');
    axios.get(`${BASE_URL}/monitor/graph-data/`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    }).then((response) => {
        renderChart(chartType, response.data);
    }).catch((error) => {
        console.error(`Error fetching ${chartType} data:`, error);
    });
}

function renderChart(chartType, data) {
    const rigs = Object.keys(data.current_data);
    const chartConfig = {
        waterLevelChart: {
            title: 'Water Level Over Time',
            yAxisTitle: 'Water Level (ft)',
            dataKey: 'levels',
        },
        temperatureChart: {
            title: 'Temperature Over Time',
            yAxisTitle: 'Temperature (°C)',
            dataKey: 'temperatures',
        },
        humidityChart: {
            title: 'Humidity Over Time',
            yAxisTitle: 'Humidity (%)',
            dataKey: 'humidities',
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
        navigator: {
            enabled: true,
        },
        scrollbar: {
            enabled: true,
        },
    });
}

function switchChart(chartType) {
    clearRefreshTimers(); // Clear existing refresh timers
    document.getElementById('dominantChart').innerHTML = ''; // Clear current chart
    initializeChart(chartType); // Load new chart

    // Set independent refresh for the selected chart
    refreshTimers[chartType] = setInterval(() => initializeChart(chartType), 5000);
}

function clearRefreshTimers() {
    // Clear all existing refresh intervals
    Object.keys(refreshTimers).forEach((chartType) => {
        clearInterval(refreshTimers[chartType]);
    });
    refreshTimers = {};
}

// Initialize the charts when the page loads
document.addEventListener('DOMContentLoaded', () => {
    showCharts();
});

// Get the modal and elements
var modal = document.getElementById("generateReportModal");
var btn = document.getElementById("createReportCard");
var span = document.getElementsByClassName("close")[0];

function showLoader() {
    const reportStatusElement = document.getElementById("report-status");
    if (reportStatusElement) {
        reportStatusElement.innerHTML = "Generating report... Please wait.";
    }
}

function hideLoader() {
    const reportStatusElement = document.getElementById("report-status");
    if (reportStatusElement) {
        reportStatusElement.innerHTML = "";
    }
}

// Open the modal when the button is clicked
btn.onclick = function () {
    modal.style.display = "block";
}

// Close the modal when the close button (x) is clicked
span.onclick = function () {
    modal.style.display = "none";
}

// Close the modal when user clicks outside of it
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

document.getElementById("generateReportForm").onsubmit = async function (e) {
    e.preventDefault();
    showLoader();  // Start loading

    const format = document.getElementById("report-format").value;
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    const token = localStorage.getItem('token');

    try {
        // Determine which API endpoint to call
        let endpoint = `${BASE_URL}/reports/reports/`; // Default

        // Simulate subscription logic (replace with real logic)
        const userSubscription = await getUserSubscriptionType();

        if (userSubscription === 'government' && format === 'pdf') {
            endpoint = `${BASE_URL}/reports/subscription-report/`;
        }

        // API Call to generate the report
        const response = await axios.get(endpoint, {
            params: {
                format: format,
                start_date: startDate,
                end_date: endDate,
            },
            headers: {
                'Authorization': 'Token ' + token,
            },
            responseType: format === 'pdf' ? 'blob' : 'text',
        });

        // Handle PDF report download
        if (format === 'pdf') {
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "report.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            // Handle text format display (e.g., CSV)
            document.getElementById("report-result").innerHTML = `<pre>${response.data}</pre>`;
        }
    } catch (error) {
        console.error('Request failed:', error);

        // Specific error handling
        if (error.response) {
            alert(`Failed to generate report: ${error.response.data.detail || "error."}`);
        } else if (error.request) {
            alert("No response from the server. Check the server or network connection.");
        } else {
            alert("An error occurred while configuring the request.");
        }
    } finally {
        hideLoader();  // Stop loading
    }
};

// Example function to get user subscription type (replace with actual logic)
async function getUserSubscriptionType() {
    const token = localStorage.getItem('token');
    try {
        const userProfileResponse = await axios.get(`${BASE_URL}/api/user-info/`, {
            headers: {
                'Authorization': 'Token ' + token,
            },
        });
        return userProfileResponse.data.subscription_plan;
    } catch (error) {
        console.error("Failed to fetch user profile:", error);
        return 'free';  // Default to free subscription
    }
}