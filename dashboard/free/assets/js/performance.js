function showDrawnPerfromanceValues() {
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
    const token = sessionStorage.getItem('token'); // Changed from localStorage to sessionStorage
    if (!token) {
        alert('You need to be logged in to view performance data.');
        window.location.href = '../login/login.html'; // Adjust path as needed
        return;
    }

    // Fetch subscription details to determine allowed services
    axios.get('https://api.flipsintel.org/subscription/details/', {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        const subscriptionData = response.data;
        console.log('Subscription Details:', subscriptionData);
        fetchModelData(token, subscriptionData);
    })
    .catch(error => {
        console.error('Error fetching subscription details:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert('Failed to load subscription details. Please try again.');
        }
    });
}

function fetchModelData(token, subscriptionData) {
    // Determine allowed services from subscription
    const allowedServices = subscriptionData.services || [];
    const subscriptionTier = subscriptionData.tier || 'Free';
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 7, report_count: 1 };

    // Only fetch water level predictions if allowed by subscription
    if (!allowedServices.includes('water_level')) {
        alert(`Your ${subscriptionTier} plan does not include access to predictive water level data. Please upgrade.`);
        document.querySelector('.content').innerHTML = `
            <div class="container-fluid p-4 m-0">
                <h2>Model Performance</h2>
                <div class="alert alert-info">
                    <strong>Your ${subscriptionTier} plan does not include predictive data.</strong><br>
                    <a href="../payment.html" class="btn btn-primary">Upgrade Now</a>
                </div>
            </div>
        `;
        return;
    }

    // Add query parameter for historical data limit
    const params = new URLSearchParams();
    if (usageLimits.historical_data_days) {
        params.append('days', usageLimits.historical_data_days);
    }

    axios.get(`https://api.flipsintel.org/monitor/predicted-data/?${params.toString()}`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then((response) => {
        const data = response.data;
        console.log('API Response Data:', data);

        if (!data || !data.predicted_data || !data.model_details || !data.model_details.accuracies) {
            console.error('Invalid data structure:', data);
            alert('Invalid data received from server.');
            return;
        }

        renderPerformance(data, subscriptionData);
    })
    .catch((error) => {
        console.error('Error fetching predictive model data:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert('Failed to load predictive model data. Please try again.');
        }
    });
}

function renderPerformance(data, subscriptionData) {
    const predictedData = data.predicted_data;
    const accuracies = data.model_details.accuracies;
    const accuracyPercentages = data.model_details.accuracy_percentages;
    const previousPredictions = data.previous_predictions || [];
    const subscriptionTier = subscriptionData.tier || 'Free';

    // Structure series data for predicted values with accuracy labels
    const seriesData = Object.keys(predictedData).map(model => ({
        name: `${model} Prediction (Accuracy: ${accuracyPercentages[model].toFixed(2)}%)`,
        data: predictedData[model].map(entry => ({
            name: entry.name,
            y: entry.y
        })),
        color: getModelColor(model),
        marker: { enabled: true }
    }));

    // Add previous predictions for historical analysis, limited by subscription
    const maxHistorical = subscriptionTier === 'Free' ? 1 : subscriptionTier === 'Premium' ? 5 : 10; // Example limits
    const previousSeriesData = previousPredictions.slice(0, maxHistorical).map(entry => ({
        name: `Historical Prediction - ${new Date(entry.timestamp).toLocaleString()}`,
        data: Array(predictedData.knn.length).fill(entry.predicted_level),
        dashStyle: 'ShortDot',
        color: '#cccccc',
        marker: { enabled: false }
    }));

    const combinedSeries = [...seriesData, ...previousSeriesData];
    const categories = predictedData[Object.keys(predictedData)[0]].map(entry => entry.name);

    Highcharts.chart('modelPredictionChart', {
        chart: {
            type: 'line'
        },
        title: {
            text: 'Model Predictions with Accuracies and Historical Data'
        },
        subtitle: {
            text: `Prediction reliability based on model accuracy (${subscriptionTier} Plan)`
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
            },
            plotLines: data.threshold ? [{
                color: '#FF0000',
                width: 2,
                value: data.threshold,
                label: {
                    text: 'Threshold Level',
                    align: 'center',
                    style: {
                        color: '#FF0000'
                    }
                }
            }] : []
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