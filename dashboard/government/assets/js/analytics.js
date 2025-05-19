// analytics.js
const BASE_URL = 'https://api.flipsintel.org';
const PREDICTED_DATA_ENDPOINT = '/monitor/predicted-data/';
const REPORTS_ENDPOINT = '/reports/reports/';
const SUBSCRIPTION_ENDPOINT = '/subscription/details/';

// Dropdown interactions (Bootstrap collapse)
$(document).ready(() => {
    // Toggle collapse on dropdown header click
    $('.dropdown-header').on('click', (e) => {
        e.stopPropagation();
        const target = $(e.currentTarget).data('target');
        $(target).collapse('toggle');
    });

    // Keep dropdown open when collapse is shown
    $('.collapse').on('show.bs.collapse', (e) => {
        $(e.currentTarget).closest('.dropdown-menu').addClass('keep-open');
    }).on('hide.bs.collapse', (e) => {
        $(e.currentTarget).closest('.dropdown-menu').removeClass('keep-open');
    });

    // Prevent dropdown close when clicking inside keep-open menu
    $('.dropdown-menu').on('click', (e) => {
        if ($(e.currentTarget).hasClass('keep-open')) {
            e.stopPropagation();
        }
    });
});

// Initialize charts on DOM load
document.addEventListener('DOMContentLoaded', () => {
    showSpinner();
    showDrawnPredictedValues(); // Load prediction chart by default
});

// Show loading spinner (assumes spinner HTML exists)
function showSpinner() {
    const content = document.querySelector('.content');
    if (content) {
        content.innerHTML = `
            <div class="container-fluid p-4 m-0">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Display prediction chart
function showDrawnPredictedValues() {
    const content = document.querySelector('.content');
    if (!content) {
        console.error('Content container not found');
        return;
    }

    content.innerHTML = `
        <div class="container-fluid p-4 m-0">
            <h2>Model Predictions and Accuracies</h2>
            <div class="row">
                <div class="col-md-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div id="modelPredictionChart"></div>
                            <div id="prediction-error" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    initializePredictionChart();
}

// Fetch and render prediction chart
function initializePredictionChart() {
    const token = sessionStorage.getItem('token'); // Use sessionStorage
    if (!token) {
        alert('You need to be logged in to view analytics.');
        window.location.href = '../login/login.html';
        return;
    }

    // Fetch subscription details
    axios.get(`${BASE_URL}${SUBSCRIPTION_ENDPOINT}`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const subscriptionData = response.data;
        console.log('Subscription Details:', subscriptionData);

        // Check if predictive analytics is allowed
        const allowedServices = subscriptionData.services || [];
        const subscriptionTier = subscriptionData.tier || 'Free';
        if (!allowedServices.includes('predictive_analytics')) {
            const message = subscriptionData.cta?.message ||
                `Your ${subscriptionTier} plan does not include predictive analytics. Please upgrade.`;
            const upgradeUrl = subscriptionData.cta?.upgrade_url || '../payment.html';
            displayError(message, upgradeUrl);
            return;
        }

        // Fetch predictive data
        axios.get(`${BASE_URL}${PREDICTED_DATA_ENDPOINT}`, {
            headers: { 'Authorization': `Token ${token}` },
            params: { days: subscriptionData.usage_limits?.historical_data_days || 7 },
        })
        .then(response => {
            const data = response.data;
            console.log('Predicted Data:', data);
            renderPredictionChart(data);
        })
        .catch(error => {
            handleApiError(error, 'Error fetching predictive model data');
        });
    })
    .catch(error => {
        handleApiError(error, 'Error fetching subscription details');
    });
}

// Render Highcharts line chart for predictions
function renderPredictionChart(data) {
    const errorContainer = document.getElementById('prediction-error');
    if (errorContainer) errorContainer.innerHTML = ''; // Clear errors

    if (!data.predicted_data || !data.model_details?.accuracies) {
        displayError('Invalid predictive data format.');
        return;
    }

    const predictedData = data.predicted_data;
    const accuracies = data.model_details.accuracies;

    // Prepare series data
    const seriesData = Object.keys(predictedData).map(model => ({
        name: `${model} Prediction (Accuracy: ${accuracies[model]?.toFixed(2)}%)`,
        data: predictedData[model].map(entry => ({
            name: entry.name,
            y: entry.y,
        })),
    }));

    // Extract categories (locations)
    const categories = predictedData[Object.keys(predictedData)[0]]?.map(entry => entry.name) || [];

    Highcharts.chart('modelPredictionChart', {
        chart: { type: 'line' },
        title: { text: 'Model Predictions and Accuracies' },
        xAxis: {
            title: { text: 'Locations' },
            categories: categories,
        },
        yAxis: {
            title: { text: 'Water Levels' },
        },
        tooltip: {
            shared: true,
            useHTML: true,
            headerFormat: '<small>{point.key}</small><table>',
            pointFormat: '<tr><td style="color: {series.color}">{series.name}: </td>' +
                '<td style="text-align: right"><b>{point.y}</b></td></tr>',
            footerFormat: '</table>',
            valueDecimals: 2,
        },
        series: seriesData,
    });
}

// Handle report generation modal
function generateReport() {
    const modal = document.getElementById('generateReportModal');
    const reportForm = document.getElementById('generateReportForm');
    const closeModalSpan = document.getElementsByClassName('close')[0];

    // Validate DOM elements
    if (!modal || !reportForm || !closeModalSpan) {
        console.error('Report modal elements missing:', {
            modal: !!modal,
            reportForm: !!reportForm,
            closeModalSpan: !!closeModalSpan,
        });
        return;
    }

    // Open modal
    modal.style.display = 'block';
    reportForm.reset();

    // Close modal
    closeModalSpan.onclick = () => {
        modal.style.display = 'none';
        reportForm.reset();
    };

    // Close on outside click
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            reportForm.reset();
        }
    };

    // Handle form submission
    reportForm.onsubmit = async (e) => {
        e.preventDefault();

        const token = sessionStorage.getItem('token'); // Use sessionStorage
        if (!token) {
            alert('You need to be logged in to generate reports.');
            window.location.href = '../login/login.html';
            return;
        }

        const submitBtn = reportForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generating...';
        }

        try {
            // Fetch subscription details
            const subscriptionResponse = await axios.get(`${BASE_URL}${SUBSCRIPTION_ENDPOINT}`, {
                headers: { 'Authorization': `Token ${token}` },
            });
            const subscriptionData = subscriptionResponse.data;
            console.log('Subscription Details:', subscriptionData);

            // Check if reports are allowed
            const allowedServices = subscriptionData.services || [];
            const subscriptionTier = subscriptionData.tier || 'Free';
            const usageLimits = subscriptionData.usage_limits || { report_count: 1 };
            if (!allowedServices.includes('reports') || usageLimits.report_count <= 0) {
                const message = subscriptionData.cta?.message ||
                    `Your ${subscriptionTier} plan does not allow report generation. Please upgrade.`;
                const upgradeUrl = subscriptionData.cta?.upgrade_url || '../payment.html';
                alert(message);
                displayReportError(message, upgradeUrl);
                return;
            }

            // Get form values
            const format = document.getElementById('report-format')?.value;
            const startDate = document.getElementById('start-date')?.value;
            const endDate = document.getElementById('end-date')?.value;

            if (!format || !startDate || !endDate) {
                alert('Please fill all form fields.');
                return;
            }

            // Fetch report
            const response = await axios.get(`${BASE_URL}${REPORTS_ENDPOINT}`, {
                params: {
                    format,
                    start_date: startDate,
                    end_date: endDate,
                    days: usageLimits.historical_data_days || 7,
                },
                headers: { 'Authorization': `Token ${token}` },
                responseType: format === 'pdf' ? 'blob' : 'text',
            });

            // Handle response
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

            // Close modal on success
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