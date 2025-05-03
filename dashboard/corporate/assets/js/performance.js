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
    const token = localStorage.getItem('token');
    axios.get('http://127.0.0.1:8000/monitor/predicted-data/', {
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

            renderPerformance(data);
        })
        .catch((error) => {
            console.error('Error fetching predictive model data:', error);
        });
}

function renderPerformance(data) {
    const predictedData = data.predicted_data;
    const accuracies = data.model_details.accuracies;
    const accuracyPercentages = data.model_details.accuracy_percentages;
    const previousPredictions = data.previous_predictions;

    // Structure series data for predicted values with accuracy labels
    const seriesData = Object.keys(predictedData).map(model => ({
        name: `${model} Prediction (Accuracy: ${accuracyPercentages[model].toFixed(2)}%)`,
        data: predictedData[model].map(entry => ({
            name: entry.name,
            y: entry.y
        })),
        color: getModelColor(model), // Assign each model a unique color
        marker: { enabled: true }
    }));

    // Add previous predictions for historical analysis
    const previousSeriesData = previousPredictions.map(entry => ({
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
            text: 'Prediction reliability based on model accuracy'
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
            plotLines: [{
                color: '#FF0000',
                width: 2,
                value: data.threshold, // Assuming a critical threshold if needed
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
