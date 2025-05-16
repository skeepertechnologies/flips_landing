// getcharts.js
const BASE_URL = 'https://api.flipsintel.org';

// Get the modal and elements
const modal = document.getElementById('generateReportModal');
const btn = document.getElementById('createReportCard');
const span = document.getElementsByClassName('close')[0];

// Open the modal
if (btn) {
    btn.onclick = function () {
        modal.style.display = 'block';
    };
}

// Close the modal
if (span) {
    span.onclick = function () {
        modal.style.display = 'none';
    };
}

// Close the modal when clicking outside
window.onclick = function (event) {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Handle form submission
const reportForm = document.getElementById('generateReportForm');
if (report LamarForm) {
    reportForm.onsubmit = async function (e) {
        e.preventDefault();

        const token = sessionStorage.getItem('token');
        if (!token) {
            alert('You need to be logged in to generate reports.');
            window.location.href = '../login/login.html';
            return;
        }

        const format = document.getElementById('report-format').value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        try {
            const response = await axios.get(`${BASE_URL}/reports/reports/`, {
                params: {
                    format: format,
                    start_date: startDate,
                    end_date: endDate,
                },
                headers: {
                    'Authorization': `Token ${token}`,
                },
                responseType: format === 'pdf' ? 'blob' : 'text',
            });

            if (format === 'pdf') {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'report.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                const resultContainer = document.getElementById('report-result');
                if (resultContainer) {
                    resultContainer.innerHTML = `<pre>${response.data}</pre>`;
                }
            }
        } catch (error) {
            console.error('Error generating report:', error);
            if (error.response && error.response.status === 401) {
                alert('Session expired. Please log in again.');
                sessionStorage.clear();
                window.location.href = '../login/login.html';
            } else {
                alert(error.response?.data?.detail || 'Failed to generate report.');
            }
        }
    };
}
