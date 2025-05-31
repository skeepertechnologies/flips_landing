// performance.js
function showDrawnPerformanceValues() {
    // Update chart title instead of overwriting .content
    document.getElementById('chartTitle').textContent = 'Model Performance';
    fetchPerformanceData();
}

function fetchPerformanceData() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('You need to be logged in to view performance data.');
        window.location.href = '../login/login.html';
        return;
    }

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
    const allowedServices = subscriptionData.services || [];
    const subscriptionTier = subscriptionData.tier || 'Free';
    const usageLimits = subscriptionData.usage_limits || { historical_data_days: 7, report_count: 1 };

    if (!allowedServices.includes('water_level')) {
        alert(`Your ${subscriptionTier} plan does not include access to predictive water level data. Please upgrade.`);
        document.getElementById('chartTitle').textContent = 'Model Performance';
        document.getElementById('dominantChart').innerHTML = `
            <div class="alert alert-info text-center">
                <strong>Your ${subscriptionTier} plan does not include predictive data.</strong><br>
                <a href="../payment.html" class="btn btn-primary mt-2">Upgrade Now</a>
            </div>
        `;
        return;
    }

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

    // Prepare Flot data series
    const plotData = Object.keys(predictedData).map(model => ({
        label: `${model} Prediction (${accuracyPercentages[model].toFixed(2)}%)`,
        data: predictedData[model].map(entry => [
            entry.name, // Use location name as x-axis (string)
            entry.y
        ]),
    }));

    // Add historical predictions
    const maxHistorical = subscriptionTier === 'Free' ? 1 : subscriptionTier === 'Premium' ? 5 : 10;
    const historicalData = previousPredictions.slice(0, maxHistorical).map(entry => ({
        label: `Historical - ${new Date(entry.timestamp).toLocaleString()}`,
        data: predictedData[Object.keys(predictedData)[0]].map(() => [
            '', // Empty x-axis for constant line
            entry.predicted_level
        ]),
        lines: { show: true, lineWidth: 1, dashPattern: [5, 5] }, // Dotted line
        color: '#cccccc'
    }));

    const combinedData = [...plotData, ...historicalData];

    // Clear previous chart
    $('#dominantChart').empty();

    // Render Flot chart
    $.plot('#dominantChart', combinedData, {
        series: {
            lines: {
                show: true,
                fill: true,
                fillColor: { colors: [{ opacity: 0.2 }, { opacity: 0.4 }] },
            },
            points: { show: true, radius: 3 },
        },
        xaxis: {
            axisLabel: 'Locations',
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelPadding: 10,
            ticks: predictedData[Object.keys(predictedData)[0]].map(entry => entry.name), // Use location names
        },
        yaxis: {
            axisLabel: 'Water Levels',
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelPadding: 10,
            gridLines: data.threshold ? [{
                value: data.threshold,
                color: '#FF0000',
                width: 2,
                label: { text: 'Threshold Level', align: 'center', style: { color: '#FF0000' } }
            }] : []
        },
        grid: {
            borderWidth: 1,
            borderColor: '#ddd',
            hoverable: true,
        },
        legend: {
            show: true,
            position: 'nw',
        },
        colors: ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE'], // Match Highcharts colors
    });

    // Add tooltip
    let previousPoint = null;
    $('#dominantChart').bind('plothover', function (event, pos, item) {
        if (item) {
            if (previousPoint !== item.dataIndex) {
                previousPoint = item.dataIndex;
                $('#tooltip').remove();
                const x = item.datapoint[0];
                const y = item.datapoint[1].toFixed(2);
                showTooltip(
                    item.pageX,
                    item.pageY,
                    `${item.series.label}<br>Location: ${x}<br>Water Level: ${y}`
                );
            }
        } else {
            $('#tooltip').remove();
            previousPoint = null;
        }
    });
}

// Tooltip helper function (same as waterlevels.js)
function showTooltip(x, y, contents) {
    $('<div id="tooltip" style="position: absolute; display: none; border: 1px solid #ddd; padding: 8px; background-color: #f9f9f9; opacity: 0.9; border-radius: 4px; font-size: 12px; z-index: 1000;">' + contents + '</div>').css({
        top: y - 50,
        left: x + 10,
    }).appendTo('body').fadeIn(200);
}