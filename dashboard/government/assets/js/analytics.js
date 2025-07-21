const BASE_URL = 'https://api.flipsintel.org';
const PREDICTED_DATA_ENDPOINT = '/monitor/predicted-data/';
const REPORTS_ENDPOINT = '/reports/reports/';
const SUBSCRIPTION_ENDPOINT = '/subscription/details/';

// Dropdown interactions
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

document.addEventListener('DOMContentLoaded', () => {
    showSpinner();
    initializePredictionChart();
});

// Show loading spinner
function showSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.querySelector('p').textContent = 'Loading Predictions...';
        spinner.style.display = 'block';
    }
}

// Hide spinner
function hideLoader() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'none';
}

// Filter predicted data for the last 30 minutes
function filterPredictedData(data, minutes = 30) {
    if (!data || !data.predicted_data) return { predicted_data: {}, model_details: data.model_details || {} };

    const now = Date.now();
    const timeThreshold = now - minutes * 60 * 1000;
    const filteredData = { predicted_data: {}, model_details: data.model_details };

    Object.keys(data.predicted_data).forEach(model => {
        filteredData.predicted_data[model] = data.predicted_data[model]
            .filter(entry => entry.timestamp && !isNaN(Date.parse(entry.timestamp)) && Date.parse(entry.timestamp) >= timeThreshold)
            .map(entry => ({
                timestamp: entry.timestamp,
                name: entry.name,
                y: Number(entry.y) || null,
            }));
    });

    return filteredData;
}

// Format data for prediction chart
function formatPredictionData(data) {
    if (!data.predicted_data || !Object.keys(data.predicted_data).length) {
        console.warn('No valid prediction data');
        return { timestamps: [], seriesData: [] };
    }

    const now = Date.now();
    const timeThreshold = now - 30 * 60 * 1000;
    const interval = 10 * 1000; // 10-second intervals
    const timeline = [];
    let currentTime = timeThreshold;
    while (currentTime <= now) {
        timeline.push(currentTime);
        currentTime += interval;
    }

    const models = Object.keys(data.predicted_data);
    const seriesData = models.map(model => {
        const modelData = data.predicted_data[model];
        const series = { name: `${model} Prediction (Accuracy: ${data.model_details.accuracies[model]?.toFixed(2)}%)`, data: [] };

        timeline.forEach(ts => {
            const point = modelData.find(p => Date.parse(p.timestamp) === ts) || 
                         modelData.filter(p => Date.parse(p.timestamp) < ts).slice(-1)[0];
            series.data.push(point && point.y != null ? point.y : null);
        });

        return series;
    });

    return {
        timestamps: timeline.map(ts => new Date(ts).toISOString()),
        seriesData,
    };
}

// Initialize prediction chart
function initializePredictionChart() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('Session expired. Please log in again.');
        window.location.href = '../login/login.html';
        return;
    }

    showSpinner();

    Highcharts.setOptions({
        chart: {
            backgroundColor: '#f0feff',
            animation: { duration: 500 },
        },
        xAxis: {
            type: 'datetime',
            labels: { format: '{value:%H:%M:%S}' },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
        },
        yAxis: {
            title: { text: 'Water Levels' },
            gridLineColor: '#e6e6e6',
        },
        plotOptions: {
            series: {
                animation: false,
                turboThreshold: 1000,
                connectNulls: true,
            },
        },
        tooltip: {
            shared: true,
            valueDecimals: 2,
            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>',
        },
    });

    const chart = Highcharts.chart('modelPredictionChart', {
        chart: { type: 'line', backgroundColor: '#f0feff' },
        title: { text: 'Model Predictions and Accuracies' },
        xAxis: {
            type: 'datetime',
            labels: { format: '{value:%H:%M:%S}' },
            min: Date.now() - 30 * 60 * 1000,
            max: Date.now(),
            title: { text: 'Timestamps' },
        },
        yAxis: {
            title: { text: 'Water Levels' },
            gridLineColor: '#e6e6e6',
        },
        series: [],
        exporting: { enabled: true },
        navigator: { enabled: true },
        scrollbar: { enabled: true },
        accessibility: {
            description: 'Predicted water levels for multiple models over the last 30 minutes.',
        },
    });

    // Fetch subscription and data
    axios.get(`${BASE_URL}${SUBSCRIPTION_ENDPOINT}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const subscriptionData = response.data;
        console.log('Subscription Details:', subscriptionData);

        if (!subscriptionData.services.includes('predictive_analytics')) {
            const message = subscriptionData.cta?.message || 
                           `Your ${subscriptionData.tier || 'Free'} plan does not include predictive analytics. Please upgrade.`;
            const upgradeUrl = subscriptionData.cta?.upgrade_url || '../payment.html';
            displayError(message, upgradeUrl);
            hideLoader();
            return;
        }

        axios.get(`${BASE_URL}${PREDICTED_DATA_ENDPOINT}`, {
            headers: { 'Authorization': `Token ${token}` },
            params: { days: subscriptionData.usage_limits?.historical_data_days || 7 },
        })
        .then(response => {
            const data = filterPredictedData(response.data, 30);
            console.log('Filtered Predicted Data:', data);
            renderPredictionChart(data, chart);
            hideLoader();
        })
        .catch(error => {
            handleApiError(error, 'Error fetching predictive model data');
            hideLoader();
        });
    })
    .catch(error => {
        handleApiError(error, 'Error fetching subscription details');
        hideLoader();
    });
}

// Render prediction chart with sliding effect
function renderPredictionChart(data, chart) {
    const errorContainer = document.getElementById('prediction-error');
    if (errorContainer) errorContainer.innerHTML = '';

    if (!data.predicted_data || !data.model_details?.accuracies) {
        displayError('Invalid predictive data format.');
        return;
    }

    const formattedData = formatPredictionData(data);
    const now = Date.now();
    const timeThreshold = now - 30 * 60 * 1000;

    chart.xAxis[0].update({
        min: timeThreshold,
        max: now,
    }, false);

    // Remove old series
    chart.series.slice().forEach(series => {
        if (!formattedData.seriesData.find(s => s.name === series.name)) {
            series.remove(false);
        }
    });

    // Add or update series
    formattedData.seriesData.forEach(newSeries => {
        let series = chart.series.find(s => s.name === newSeries.name);
        if (!series) {
            chart.addSeries({
                name: newSeries.name,
                type: 'line',
                data: [],
                visible: newSeries.data.some(v => v != null),
                connectNulls: true,
            }, false);
            series = chart.series[chart.series.length - 1];
        }

        newSeries.data.forEach((value, i) => {
            const ts = Date.parse(formattedData.timestamps[i]);
            if (ts >= timeThreshold && !series.data.some(d => d.x === ts)) {
                series.addPoint([ts, value], false, false);
            }
        });

        while (series.data.length > 0 && series.data[0].x < timeThreshold) {
            series.removePoint(0, false);
        }
    });

    chart.redraw();
}

// Handle report generation modal
function generateReport() {
    const modal = document.getElementById('generateReportModal');
    const reportForm = document.getElementById('generateReportForm');
    const closeModalSpan = document.getElementsByClassName('close')[0];

    if (!modal || !reportForm || !closeModalSpan) {
        console.error('Report modal elements missing:', {
            modal: !!modal,
            reportForm: !!reportForm,
            closeModalSpan: !!closeModalSpan,
        });
        return;
    }

    modal.style.display = 'block';
    reportForm.reset();

    closeModalSpan.onclick = () => {
        modal.style.display = 'none';
        reportForm.reset();
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            reportForm.reset();
        }
    };

    reportForm.onsubmit = async (e) => {
        e.preventDefault();

        const token = sessionStorage.getItem('token');
        if (!token) {
            alert('Session expired. Please log in again.');
            window.location.href = '../login/login.html';
            return;
        }

        const submitBtn = reportForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generating...';
        }

        try {
            const subscriptionResponse = await axios.get(`${BASE_URL}${SUBSCRIPTION_ENDPOINT}`, {
                headers: { 'Authorization': `Token ${token}` },
            });
            const subscriptionData = subscriptionResponse.data;

            if (!subscriptionData.services.includes('reports') || subscriptionData.usage_limits.report_count <= 0) {
                const message = subscriptionData.cta?.message ||
                               `Your ${subscriptionData.tier || 'Free'} plan does not allow report generation. Please upgrade.`;
                const upgradeUrl = subscriptionData.cta?.upgrade_url || '../payment.html';
                alert(message);
                displayReportError(message, upgradeUrl);
                return;
            }

            const format = document.getElementById('report-format')?.value;
            const startDate = document.getElementById('start-date')?.value;
            const endDate = document.getElementById('end-date')?.value;

            if (!format || !startDate || !endDate) {
                alert('Please fill all form fields.');
                return;
            }

            const response = await axios.get(`${BASE_URL}${REPORTS_ENDPOINT}`, {
                params: {
                    format,
                    start_date: startDate,
                    end_date: endDate,
                    days: subscriptionData.usage_limits.historical_data_days || 7,
                },
                headers: { 'Authorization': `Token ${token}` },
                responseType: format === 'pdf' ? 'blob' : 'text',
            });

            if (format === 'pdf') {
                if (!(response.data instanceof Blob)) {
                    throw new Error('Invalid PDF response');
                }
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `report_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                const resultContainer = document.getElementById('report-result');
                if (resultContainer) {
                    resultContainer.innerHTML = `<pre>${response.data}</pre>`;
                } else {
                    console.warn('Report result container not found');
                    alert('Report generated, but display area is missing.');
                }
            }

            modal.style.display = 'none';
            reportForm.reset();
        } catch (error) {
            handleApiError(error, 'Error generating report');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Generate Report';
            }
        }
    };
}

// Display error message for prediction chart
function displayError(message, upgradeUrl = null) {
    const errorContainer = document.getElementById('prediction-error');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="alert alert-danger">
                <strong>${message}</strong>
                ${upgradeUrl ? `<br><a href="${upgradeUrl}" class="btn btn-primary mt-2">Upgrade Now</a>` : ''}
            </div>
        `;
    }
}

// Display error message for report generation
function displayReportError(message, upgradeUrl) {
    const resultContainer = document.getElementById('report-result') || document.getElementById('generateReportModal');
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="alert alert-danger">
                <strong>${message}</strong>
                <br><a href="${upgradeUrl}" class="btn btn-primary mt-2">Upgrade Now</a>
            </div>
        `;
    }
}

// Handle API errors
function handleApiError(error, defaultMessage) {
    console.error(defaultMessage, error);
    let message = defaultMessage + '. Please try again.';
    let upgradeUrl = '../payment.html';

    if (error.response) {
        if (error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
            return;
        } else if (error.response.status === 403) {
            message = error.response.data.cta?.message || 
                     error.response.data.error || 'Access restricted by your plan. Please upgrade.';
            upgradeUrl = error.response.data.cta?.upgrade_url || upgradeUrl;
        } else {
            message = error.response.data?.error || error.response.data?.detail || message;
        }
    }

    if (defaultMessage.includes('predictive model data')) {
        displayError(message, upgradeUrl);
    } else {
        alert(message);
        if (error.response?.status === 403) {
            displayReportError(message, upgradeUrl);
        }
    }
}