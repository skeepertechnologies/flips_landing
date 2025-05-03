// Get the modal and elements
var modal = document.getElementById("generateReportModal");
var btn = document.getElementById("createReportCard");
var span = document.getElementsByClassName("close")[0];

// Open the modal when the button is clicked
btn.onclick = function() {
  modal.style.display = "block";
}

// Close the modal when the close button (x) is clicked
span.onclick = function() {
  modal.style.display = "none";
}

// Close the modal when user clicks outside of it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

// Handle form submission using Axios
document.getElementById("generateReportForm").onsubmit = async function(e) {
  e.preventDefault();

  // Get form data
  const format = document.getElementById("report-format").value;
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  try {
    // Call the report API using Axios
    const response = await axios.get('http://127.0.0.1:8000/reports/reports/', {
      params: {
        format: format,
        start_date: startDate,
        end_date: endDate
      },
      headers: {
        'Authorization': 'Token ' + token
    },
      responseType: format === 'pdf' ? 'blob' : 'text'
    });

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
      document.getElementById("report-result").innerHTML = `<pre>${response.data}</pre>`;
    }
  } catch (error) {
    alert(error.response?.data?.detail || "Failed to generate report.");
  }
}
