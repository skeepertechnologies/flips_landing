$(document).ready(function () {
    // Dropdown interactions
    $('.dropdown-header').on('click', function (e) {
        e.stopPropagation();
        var target = $(this).data('target');
        $(target).collapse('toggle');
    });

    $('.collapse').on('show.bs.collapse', function () {
        $(this).closest('.dropdown-menu').addClass('keep-open');
    }).on('hide.bs.collapse', function () {
        $(this).closest('.dropdown-menu').removeClass('keep-open');
    });

    $('.dropdown-menu').on('click', function (e) {
        if ($(this).hasClass('keep-open')) {
            e.stopPropagation();
        }
    });

    // Initialize Charts on DOM Load
    document.addEventListener('DOMContentLoaded', () => {
        showSpinner();
        fetchPerformanceData(); // Load performance chart by default
    });
});

// Analytics-specific Functions
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
    axios.get('http://127.0.0.1:8000/monitor/predicted-data/', {
        headers: { 'Authorization': 'Token ' + token },
    })
        .then(response => {
            const data = response.data;
            renderPredictionChart(data);
        })
        .catch(error => {
            console.error('Error fetching predictive model data:', error);
        });
}

function renderPredictionChart(data) {
    const predictedData = data.predicted_data;
    const accuracies = data.model_details.accuracies;

    const seriesData = Object.keys(predictedData).map(model => ({
        name: `${model} Prediction (Accuracy: ${accuracies[model].toFixed(2)}%)`,
        data: predictedData[model].map(entry => ({
            name: entry.name,
            y: entry.y
        }))
    }));

    const categories = predictedData[Object.keys(predictedData)[0]].map(entry => entry.name);

    Highcharts.chart('modelPredictionChart', {
        chart: { type: 'line' },
        title: { text: 'Model Predictions and Accuracies' },
        xAxis: { title: { text: 'Locations' }, categories: categories },
        yAxis: { title: { text: 'Water Levels' } },
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


// Modal for Report Generation
function generateReport() {
    const token = localStorage.getItem('token');
    document.getElementById("generateReportForm").onsubmit = function (e) {
        e.preventDefault();
        const format = document.getElementById("report-format").value;
        const startDate = document.getElementById("start-date").value;
        const endDate = document.getElementById("end-date").value;

        axios.get('http://127.0.0.1:8000/reports/reports/', {
            params: { format, start_date: startDate, end_date: endDate },
            headers: { 'Authorization': 'Token ' + token },
            responseType: format === 'pdf' ? 'blob' : 'text',
        })
            .then(response => {
                if (format === 'pdf') {
                    const blob = new Blob([response.data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "report.pdf";
                    a.click();
                } else {
                    document.getElementById("report-result").innerHTML = `<pre>${response.data}</pre>`;
                }
            })
            .catch(error => {
                console.error('Error generating report:', error);
            });
    };
}

// Initialize Charts
function initializeCharts() {
    document.addEventListener('DOMContentLoaded', () => {
        showDrawnPredictedValues(); // Default analytics view
    });
}
