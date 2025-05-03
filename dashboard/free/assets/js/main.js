const fetchUserActivity = (token) => {
    axios.get('http://127.0.0.1:8000/activity/activities/', {
        headers: {
            Authorization: 'Token ' + token,
        },
    }).then((response) => {
        renderUserActivity(response.data);
    }).catch((error) => {
        console.error('Error fetching user activity:', error);
        document.getElementById('recentResources').textContent = 'Failed to load user activity.';
    });
};

const renderUserActivity = (activities) => {
    const recentResourcesDiv = document.getElementById('recentResources');
    recentResourcesDiv.innerHTML = ''; // Clear existing content

    if (activities.length === 0) {
        recentResourcesDiv.textContent = 'No recent activities found.';
        return;
    }

    activities.forEach(activity => {
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-item';
        activityElement.innerHTML = `
            <p><strong>${activity.resource_name}</strong></p>
            <p>${new Date(activity.timestamp).toLocaleString()}</p>
            <p>${activity.action}</p>
        `;
        recentResourcesDiv.appendChild(activityElement);
    });
};

// Call fetchUserActivity in the checkTokenAndFetchData function
const checkTokenAndFetchData = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || localStorage.getItem('token');

    if (token) {
        fetchDataAndRenderCharts(token);
        fetchUserActivity(token); // Fetch user activity here
    } else {
        alert('No token found in URL or localStorage.');
        window.location.href = '../../index.html';
    }
};