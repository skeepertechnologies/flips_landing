// getcharts.js
const BASE_URL = 'https://api.flipsintel.org';
const REPORTS_ENDPOINT = '/reports/reports/';

// Get modal and form elements
const modal = document.getElementById('generateReportModal');
const openModalBtn = document.getElementById('createReportCard');
const closeModalSpan = document.getElementsByClassName('close')[0];
const reportForm = document.getElementById('generateReportForm');

// Validate DOM elements
if (!modal || !openModalBtn || !closeModalSpan || !reportForm) {
    console.error('Required DOM elements missing:', {
        modal: !!modal,
        openModalBtn: !!openModalBtn,
        closeModalSpan: !!closeModalSpan,
        reportForm: !!reportForm,
    });
}

// Open the modal
if (openModalBtn) {
    openModalBtn.onclick = () => {
        modal.style.display = 'block';
        reportForm.reset(); // Reset form fields
    };
}

// Close the modal
if (closeModalSpan) {
    closeModalSpan.onclick = () => {
        modal.style.display = 'none';
        reportForm.reset(); // Reset form on close
    };
}

// Close modal when clicking outside
window.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
        reportForm.reset(); // Reset form on outside click
    }
};

// Handle form submission
if (reportForm) {
    reportForm.onsubmit = async (e) => {
        e.preventDefault();

        const token = sessionStorage.getItem('token');
        if (!token) {
            alert('You need to be logged in to generate reports.');
            window.location.href = '../login/login.html';
            return;
        }

        // Disable form during submission
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generating...';
        }

        try {
            // Fetch subscription details
            const subscriptionResponse = await axios.get(`${BASE_URL}/subscription/details/`, {
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
                displayUpgradePrompt(message, upgradeUrl);
                return;
            }

            // Get form values
            const format = document.getElementById('report-format').value;
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;

            // Fetch report
            const response = await axios.get(`${BASE_URL}${REPORTS_ENDPOINT}`, {
                params: {
                    format: format,
                    start_date: startDate,
                    end_date: endDate,
                    days: usageLimits.historical_data_days || 7, // Limit historical data
                },
                headers: {
                    'Authorization': `Token ${token}`,
                },
                responseType: format === 'pdf' ? 'blob' : 'text',
            });

            // Handle response based on format
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
            console.error('Error generating report:', error);
            let message = 'Failed to generate report. Please try again.';
            if (error.response) {
                if (error.response.status === 401) {
                    alert('Session expired. Please log in again.');
                    sessionStorage.clear();
                    window.location.href = '../login/login.html';
                    return;
                } else if (error.response.status === 403) {
                    message = error.response.data.cta?.message || 
                        'Report generation not allowed with your plan. Please upgrade.';
                    const upgradeUrl = error.response.data.cta?.upgrade_url || '../payment.html';
                    displayUpgradePrompt(message, upgradeUrl);
                } else {
                    message = error.response.data?.error || error.response.data?.detail || message;
                }
            }
            alert(message);
        } finally {
            // Re-enable form
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Generate Report';
            }
        }
    };
}

// Display upgrade prompt in modal or result area
function displayUpgradePrompt(message, upgradeUrl) {
    const resultContainer = document.getElementById('report-result') || modal;
    resultContainer.innerHTML = `
        <div class="alert alert-info">
            <strong>${message}</strong><br>
            <a href="${upgradeUrl}" class="btn btn-primary">Upgrade Now</a>
        </div>
    `;
}