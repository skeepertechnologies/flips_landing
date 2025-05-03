function checkAPIStatus() {
    const endpoints = [
        { url: 'http://127.0.0.1:8000/api/login/', elementId: 'loginStatus' },
        { url: 'http://127.0.0.1:8000/api/user-info/', elementId: 'userInfoStatus' },
        { url: 'http://127.0.0.1:8000/api/logout/', elementId: 'logoutStatus' }
    ];

    // Clear previous statuses
    const statusList = document.getElementById('statusList');
    statusList.innerHTML = '';

    endpoints.forEach(endpoint => {
        fetch(endpoint.url, {
                method: 'GET', // Adjust method as necessary
                headers: {
                    'Authorization': 'Token ' + localStorage.getItem('token'), // If authentication is needed
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                const status = response.ok ? 'Online' : 'Offline';
                statusList.innerHTML += `<div class="alert alert-${response.ok ? 'success' : 'danger'}">${endpoint.url} - ${status}</div>`;
            })
            .catch(error => {
                statusList.innerHTML += `<div class="alert alert-danger">${endpoint.url} - Error</div>`;
            });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Initial check
    checkAPIStatus();

    // Set to refresh every 10 seconds (10000 milliseconds)
    setInterval(checkAPIStatus, 10000);
});