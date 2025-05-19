// main.js
const BASE_URL = 'https://api.flipsintel.org';
const ENDPOINTS = {
    MODEL_CREATE: '/modelbuilder/create/',
    RIGS: '/monitor/rigs/',
    USER_MODELS: '/modelbuilder/user-models/',
    MODEL_REPORT: '/modelbuilder/report/',
    SETTINGS: '/settings/settings/',
    ACTIVITIES: '/activity/activities/',
    MAPBOX_TOKEN: '/api/get-mapbox-token/',
    GIS_AOI: '/gis/aoi/',
    GIS_MAPPING: '/gis/gismapping/',
    GRAPH_DATA: '/monitor/graph-data/',
    USER_INFO: '/api/user-info/',
    LOGOUT: '/logout/',
    SUBSCRIPTION: '/subscription/details/',
};

// Dropdown interactions (Bootstrap collapse)
$(document).ready(() => {
    $('.dropdown-header').on('click', (e) => {
        e.stopPropagation();
        const target = $(e.currentTarget).data('target');
        $(target).collapse('toggle');
    });

    $('.collapse').on('show.bs.collapse', (e) => {
        $(e.currentTarget).closest('.dropdown-menu').addClass('keep-open');
    }).on('hide.bs.collapse', (e) => {
        $(e.currentTarget).closest('.dropdown-menu').removeClass('keep-open');
    });

    $('.dropdown-menu').on('click', (e) => {
        if ($(e.currentTarget).hasClass('keep-open')) {
            e.stopPropagation();
        }
    });
});

// Centralized error handling
function handleApiError(error, defaultMessage, callback = null) {
    console.error(defaultMessage, error);
    let message = defaultMessage;
    let upgradeUrl = '../payment.html';

    if (error.response) {
        if (error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
            return;
        } else if (error.response.status === 403) {
            message = error.response.data.cta?.message || error.response.data.error || 'Access restricted by your plan. Please upgrade.';
            upgradeUrl = error.response.data.cta?.upgrade_url || upgradeUrl;
        } else {
            message = error.response.data?.error || error.response.data?.detail || message;
        }
    }

    if (callback) {
        callback(message, upgradeUrl);
    } else {
        alert(message);
    }
}

// Check subscription access
async function checkSubscription(token, requiredService, errorCallback) {
    try {
        const response = await axios.get(`${BASE_URL}${ENDPOINTS.SUBSCRIPTION}`, {
            headers: { 'Authorization': `Token ${token}` },
        });
        const { services = [], tier = 'Free', usage_limits = {}, cta } = response.data;
        console.log('Subscription Details:', response.data);

        if (!requiredService || services.includes(requiredService)) {
            return { allowed: true, tier, usage_limits };
        }

        const message = cta?.message || `Your ${tier} plan does not include ${requiredService}. Please upgrade.`;
        const upgradeUrl = cta?.upgrade_url || '../payment.html';
        errorCallback(message, upgradeUrl);
        return { allowed: false };
    } catch (error) {
        handleApiError(error, 'Error fetching subscription details', errorCallback);
        return { allowed: false };
    }
}

// Loader utilities
function showLoader(containerId = 'report-status') {
    const element = document.getElementById(containerId);
    if (element) {
        element.innerHTML = 'Loading... Please wait.';
    }
}

function hideLoader(containerId = 'report-status') {
    const element = document.getElementById(containerId);
    if (element) {
        element.innerHTML = '';
    }
}

// Model creation
function saveModel() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    const name = document.getElementById('modelName')?.value.trim();
    const description = document.getElementById('modelDescription')?.value.trim();
    const sensorId = document.getElementById('rigSelect')?.value;
    const attributes = Array.from(document.getElementById('attributesSelect')?.selectedOptions || []).map(option => option.value);
    const mlModel = document.getElementById('mlModelSelect')?.value;

    if (!name || !sensorId || attributes.length === 0 || !mlModel) {
        alert('All fields are required.');
        console.log('Validation failed: Missing input fields.');
        return;
    }

    showLoader('model-status');
    checkSubscription(token, 'model_builder', (message, upgradeUrl) => {
        hideLoader('model-status');
        displayError('model-status', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        axios.post(`${BASE_URL}${ENDPOINTS.MODEL_CREATE}`, {
            name,
            description,
            rig_id: sensorId,
            attributes,
            ml_model: mlModel,
        }, {
            headers: { 'Authorization': `Token ${token}` },
        })
        .then(response => {
            console.log('Model creation successful:', response.data);
            alert('Model created successfully!');
            const modelForm = document.getElementById('modelForm');
            if (modelForm) modelForm.reset();
            const modal = document.getElementById('modelModal');
            if (modal) modal.querySelector('.btn-close')?.click();

            const viewModelsBtn = document.getElementById('viewModelsBtn');
            if (viewModelsBtn) {
                viewModelsBtn.style.display = 'block';
                viewModelsBtn.addEventListener('click', fetchUserModels);
            }

            fetchUserModels();
        })
        .catch(error => {
            handleApiError(error, 'Failed to create model', (msg, url) => displayError('model-status', msg, url));
        })
        .finally(() => hideLoader('model-status'));
    });
}

// Fetch rigs for model creation
function fetchRigs() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('rig-status');
    checkSubscription(token, 'rig_monitoring', (message, upgradeUrl) => {
        hideLoader('rig-status');
        displayError('rig-status', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        axios.get(`${BASE_URL}${ENDPOINTS.RIGS}`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        .then(response => {
            console.log('Rigs fetched successfully:', response.data);
            const rigs = response.data;
            const rigSelect = document.getElementById('rigSelect');
            if (rigSelect) {
                rigSelect.innerHTML = '<option value="" disabled selected>Select a rig</option>';
                rigs.forEach(rig => {
                    const option = document.createElement('option');
                    option.value = rig.sensor_id;
                    option.textContent = `${rig.sensor_id} (${rig.location})`;
                    rigSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            handleApiError(error, 'Failed to fetch rigs', (msg, url) => displayError('rig-status', msg, url));
        })
        .finally(() => hideLoader('rig-status'));
    });
}

// Fetch and render user models
function fetchUserModels() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('models-status');
    checkSubscription(token, 'model_builder', (message, upgradeUrl) => {
        hideLoader('models-status');
        displayError('models-status', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        axios.get(`${BASE_URL}${ENDPOINTS.USER_MODELS}`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        .then(response => {
            console.log('User models fetched successfully:', response.data);
            renderUserModels(response.data);
        })
        .catch(error => {
            handleApiError(error, 'Failed to fetch user models', (msg, url) => displayError('models-status', msg, url));
        })
        .finally(() => hideLoader('models-status'));
    });
}

function renderUserModels(models) {
    const container = document.getElementById('userModelsContainer');
    if (!container) {
        console.error('User models container not found');
        return;
    }

    container.innerHTML = '<h3>Your Models</h3>';
    if (models.length === 0) {
        container.innerHTML += '<p>No models available.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Model Name</th>
                <th>Description</th>
                <th>Rig</th>
                <th>ML Model</th>
                <th>Created At</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${models.map(model => `
                <tr>
                    <td>${model.name}</td>
                    <td>${model.description}</td>
                    <td>${model.rig_name}</td>
                    <td>${model.ml_model}</td>
                    <td>${new Date(model.created_at).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="viewReport(${model.id})">View Report</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);
}

// Generate model report
function viewReport(modelId) {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    const reportModal = document.getElementById('reportModal');
    if (!reportModal) {
        console.error('Report modal not found');
        return;
    }

    showLoader('reportStatus');
    checkSubscription(token, 'model_builder', (message, upgradeUrl) => {
        hideLoader('reportStatus');
        displayError('reportStatus', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        const modal = new bootstrap.Modal(reportModal);
        modal.show();

        const progressSpinner = document.getElementById('progressSpinner');
        const reportStatus = document.getElementById('reportStatus');
        const downloadLink = document.getElementById('downloadReportLink');

        if (progressSpinner) progressSpinner.classList.remove('d-none');
        if (reportStatus) reportStatus.innerText = 'Please wait while the report is being generated...';
        if (downloadLink) downloadLink.classList.add('d-none');

        axios.post(`${BASE_URL}${ENDPOINTS.MODEL_REPORT}${modelId}/`, {}, {
            headers: { 'Authorization': `Token ${token}` },
            responseType: 'blob',
        })
        .then(response => {
            if (!(response.data instanceof Blob)) {
                throw new Error('Invalid PDF response');
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            if (downloadLink) {
                downloadLink.href = url;
                downloadLink.download = `Model_${modelId}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                downloadLink.classList.remove('d-none');
            }

            if (progressSpinner) progressSpinner.classList.add('d-none');
            if (reportStatus) reportStatus.innerText = 'Report generated successfully!';
        })
        .catch(error => {
            handleApiError(error, 'Failed to generate report', (msg, url) => displayError('reportStatus', msg, url));
        })
        .finally(() => hideLoader('reportStatus'));
    });
}

// User settings and subscriptions
function fetchUserSettings() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('settings-status');
    axios.get(`${BASE_URL}${ENDPOINTS.SETTINGS}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const data = response.data;
        const subscriptionDiv = document.getElementById('subscriptions');
        const recommendedDiv = document.getElementById('recommended_plans');

        if (subscriptionDiv) {
            subscriptionDiv.innerHTML = data.active_subscriptions.map(sub => `
                <div>${sub.name} - $${sub.price}</div>
            `).join('');
        }

        if (recommendedDiv) {
            recommendedDiv.innerHTML = data.recommended_plans.map(plan => `
                <div>${plan.name} - $${plan.price}</div>
            `).join('');
        }

        const modalUsername = document.getElementById('modalUsername');
        const modalEmail = document.getElementById('modalEmail');
        const modalSubscriptionLevel = document.getElementById('modalSubscriptionLevel');
        const modalBillingAddress = document.getElementById('modalBillingAddress');

        if (modalUsername) modalUsername.textContent = data.profile.user.username || 'N/A';
        if (modalEmail) modalEmail.textContent = data.profile.user.email || 'N/A';
        if (modalSubscriptionLevel) modalSubscriptionLevel.textContent = data.profile.subscription_level || 'N/A';
        if (modalBillingAddress) modalBillingAddress.textContent = data.profile.billing_address || 'N/A';

        const accountSettingsModal = document.getElementById('accountSettingsModal');
        if (accountSettingsModal) {
            new bootstrap.Modal(accountSettingsModal).show();
        }
    })
    .catch(error => {
        handleApiError(error, 'Error fetching settings', (msg, url) => displayError('settings-status', msg, url));
    })
    .finally(() => hideLoader('settings-status'));
}

// User activities
function fetchUserActivities() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    showLoader('activities-status');
    checkSubscription(token, 'activity_tracking', (message, upgradeUrl) => {
        hideLoader('activities-status');
        displayError('activities-status', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        axios.get(`${BASE_URL}${ENDPOINTS.ACTIVITIES}`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        .then(response => {
            renderUserActivities(response.data);
        })
        .catch(error => {
            handleApiError(error, 'Error fetching user activities', (msg, url) => displayError('activities-status', msg, url));
        })
        .finally(() => hideLoader('activities-status'));
    });
}

function renderUserActivities(activities) {
    const recentResourcesDiv = document.getElementById('recentResources');
    if (!recentResourcesDiv) {
        console.error('Recent resources container not found');
        return;
    }

    recentResourcesDiv.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <p><strong>Path:</strong> ${activity.path}</p>
            <p><strong>Method:</strong> ${activity.method}</p>
            <p><strong>Timestamp:</strong> ${new Date(activity.timestamp).toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${activity.ip_address}</p>
            <p><strong>User Agent:</strong> ${activity.user_agent}</p>
            <hr>
        </div>
    `).join('');
}

// Water flow analysis map
async function showWaterFlowAnalysisMap() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    const content = document.querySelector('.content');
    if (!content) {
        console.error('Content container not found');
        return;
    }

    content.innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Water Flow Analysis</h2>
            <div id="waterFlowMap" style="height: 600px;"></div>
            <div id="waterFlowInfo" class="mt-4">
                <p><strong>Latitude Range:</strong> <span id="latitudeRange"></span></p>
                <p><strong>Longitude Range:</strong> <span id="longitudeRange"></span></p>
                <div id="map-error" class="mt-3"></div>
            </div>
        </div>
    `;

    checkSubscription(token, 'gis_mapping', (message, upgradeUrl) => {
        displayError('map-error', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (allowed) initializeWaterFlowMap();
    });
}

async function initializeWaterFlowMap() {
    const token = sessionStorage.getItem('token');
    try {
        const tokenResponse = await axios.get(`${BASE_URL}${ENDPOINTS.MAPBOX_TOKEN}`, {
            headers: { 'Authorization': `Token ${token}` },
        });
        const mapboxToken = tokenResponse.data.mapbox_access_token;

        mapboxgl.accessToken = mapboxToken;
        const map = L.map('waterFlowMap').setView([-1.286389, 36.817223], 7);

        L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`, {
            maxZoom: 18,
            attribution: '© Mapbox © OpenStreetMap © DigitalGlobe',
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, (event) => {
            const layer = event.layer;
            drawnItems.addLayer(layer);
            const coordinates = layer.getLatLngs()[0].map(latLng => [latLng.lng, latLng.lat]);
            sendROICoordinates(coordinates, map);
        });

        fetchWaterFlowData(map);
        addRigMarkersOnLoad(map);
    } catch (error) {
        handleApiError(error, 'Failed to load map', (msg, url) => displayError('map-error', msg, url));
    }
}

async function addRigMarkersOnLoad(map) {
    const token = sessionStorage.getItem('token');
    try {
        const response = await axios.get(`${BASE_URL}/monitor/rig-locations/`, {
            headers: { 'Authorization': `Token ${token}` },
        });
        response.data.rig_locations.forEach(([lat, lon]) => {
            const marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup(`Rig Location<br>Lat: ${lat}, Lon: ${lon}`);
        });
    } catch (error) {
        handleApiError(error, 'Error loading rig markers');
    }
}

async function sendROICoordinates(coordinates, map) {
    const token = sessionStorage.getItem('token');
    const formattedCoordinates = coordinates.map(coord => [coord[1], coord[0]]);
    try {
        const response = await axios.post(`${BASE_URL}${ENDPOINTS.GIS_AOI}`, {
            coordinates: formattedCoordinates,
        }, {
            headers: { 'Authorization': `Token ${token}` },
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
        handleApiError(error, 'Error sending AOI', (msg, url) => displayError('map-error', msg, url));
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
    const token = sessionStorage.getItem('token');
    try {
        const response = await axios.get(`${BASE_URL}${ENDPOINTS.GIS_MAPPING}`, {
            headers: { 'Authorization': `Token ${token}` },
        });
        const data = response.data;
        const latitudeRange = document.getElementById('latitudeRange');
        const longitudeRange = document.getElementById('longitudeRange');

        if (latitudeRange) latitudeRange.innerText = `${data.latitude_range[0]}, ${data.latitude_range[1]}`;
        if (longitudeRange) longitudeRange.innerText = `${data.longitude_range[0]}, ${data.longitude_range[1]}`;

        if(data.tiff_url) {
            loadGeoTIFFLayer(data.tiff_url, map);
        }
    } catch (error) {
        handleApiError(error, 'Error fetching water flow data', (msg, url) => displayError('map-error', msg, url));
    }
}

function updateWaterFlowInfo(data) {
    const latitudeRange = document.getElementById('latitudeRange');
    const longitudeRange = document.getElementById('longitudeRange');
    if (latitudeRange) latitudeRange.innerText = `${data.latitude_range[0]}, ${data.latitude_range[1]}`;
    if (longitudeRange) longitudeRange.innerText = `${data.longitude_range[0]}, ${data.longitude_range[1]}`;
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
                },
            });
            map.addLayer(layer);
            map.fitBounds(layer.getBounds());
        }))
        .catch(error => console.error('Error loading GeoTIFF layer:', error));
}

// Live charts
function showCharts() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in.');
        window.location.href = '../login/login.html';
        return;
    }

    const content = document.querySelector('.content');
    if (!content) {
        console.error('Content container not found');
        return;
    }

    content.innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Live Data - Water Levels, Temperature, and Humidity</h2>
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div id="dominantChart"></div>
                            <div id="chart-error" class="mt-3"></div>
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

    checkSubscription(token, 'rig_monitoring', (message, upgradeUrl) => {
        displayError('chart-error', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (allowed) switchChart('waterLevelChart');
    });
}

let refreshTimers = {};

function initializeChart(chartType) {
    const token = sessionStorage.getItem('token');
    checkSubscription(token, 'rig_monitoring', (message, upgradeUrl) => {
        displayError('chart-error', message, upgradeUrl);
    }).then(({ allowed }) => {
        if (!allowed) return;

        axios.get(`${BASE_URL}${ENDPOINTS.GRAPH_DATA}`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        .then(response => {
            renderChart(chartType, response.data);
        })
        .catch(error => {
            handleApiError(error, `Error fetching ${chartType} data`, (msg, url) => displayError('chart-error', msg, url));
        });
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
    const seriesData = rigs.map(rig => ({
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
        title: { text: title },
        xAxis: {
            type: 'datetime',
            title: { text: 'Date' },
            minRange: 0.5 * 3600 * 1000,
            events: {
                afterSetExtremes: function (e) {
                    const minRange = this.minRange;
                    if (e.max - e.min < minRange) {
                        setTimeout(() => {
                            this.setExtremes(e.min, e.min + minRange, true, false);
                        }, 0);
                    }
                },
            },
        },
        yAxis: { title: { text: yAxisTitle } },
        series: seriesData,
        navigator: { enabled: true },
        scrollbar: { enabled: true },
    });
}

function switchChart(chartType) {
    clearRefreshTimers();
    const dominantChart = document.getElementById('dominantChart');
    if (dominantChart) dominantChart.innerHTML = '';
    initializeChart(chartType);
    refreshTimers[chartType] = setInterval(() => initializeChart(chartType), 5000);
}

function clearRefreshTimers() {
    Object.keys(refreshTimers).forEach(chartType => {
        clearInterval(refreshTimers[chartType]);
    });
    refreshTimers = {};
}

// Sidebar toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('.content');
    if (!sidebar || !content) return;

    sidebar.classList.toggle('active');
    content.style.marginLeft = sidebar.classList.contains('active') ? '250px' : '0';
}

document.addEventListener('click', (event) => {
    const sidebar = document.getElementById('sidebar');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    if (sidebar && hamburgerMenu && sidebar.classList.contains('active') &&
        !sidebar.contains(event.target) && !hamburgerMenu.contains(event.target)) {
        sidebar.classList.remove('active');
        document.querySelector('.content').style.marginLeft = '0';
    }
});

// Logout
function handleLogout() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        window.location.href = '../login/login.html';
        return;
    }

    axios.post(`${BASE_URL}${ENDPOINTS.LOGOUT}`, {}, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(() => {
        sessionStorage.clear();
        window.location.href = '../../index.html';
    })
    .catch(error => {
        console.error('Logout failed', error);
        sessionStorage.clear();
        window.location.href = '../../index.html';
    });
}

// Inactivity timeout
function setupInactivityTimeout() {
    let inactivityTimeout;
    const timeoutDuration = 30 * 60 * 1000; // 30 minutes
    const resetTimeout = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            alert('You have been logged out due to inactivity.');
            handleLogout();
        }, timeoutDuration);
    };

    document.addEventListener('mousemove', resetTimeout);
    document.addEventListener('keypress', resetTimeout);
    resetTimeout();
}

// User info and initialization
function initializeApp() {
    const token = sessionStorage.getItem('token') || new URLSearchParams(window.location.search).get('token');
    if (!token) {
        alert('No token found.');
        window.location.href = '../login/login.html';
        return;
    }

    sessionStorage.setItem('token', token);

    axios.get(`${BASE_URL}${ENDPOINTS.USER_INFO}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        sessionStorage.setItem('username', response.data.username);
        const usernameElement = document.getElementById('username');
        if (usernameElement) usernameElement.textContent = response.data.username;
    })
    .catch(error => {
        handleApiError(error, 'Error loading user data');
    });

    // Initialize features
    setupInactivityTimeout();
    fetchUserActivities();
    showCharts(); // Default view
    fetchRigsData(); // From history.js
}

// Error display
function displayError(containerId, message, upgradeUrl = null) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>${message}</strong>
                ${upgradeUrl ? `<br><a href="${upgradeUrl}" class="btn btn-primary mt-2">Upgrade Now</a>` : ''}
            </div>
        `;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    const saveModelBtn = document.getElementById('saveModelBtn');
    if (saveModelBtn) saveModelBtn.addEventListener('click', saveModel);

    const modelModal = document.getElementById('modelModal');
    if (modelModal) modelModal.addEventListener('show.bs.modal', fetchRigs);

    const subscriptionsCard = document.getElementById('subscriptionsCard');
    if (subscriptionsCard) subscriptionsCard.addEventListener('click', fetchUserSettings);

    const accountSettingsLink = document.getElementById('accountSettingsLink');
    if (accountSettingsLink) accountSettingsLink.addEventListener('click', fetchUserSettings);
});