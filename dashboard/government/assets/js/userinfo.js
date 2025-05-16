// userinfo.js
const BASE_URL = 'https://api.flipsintel.org';

// Function to fetch user information
function fetchUserInfo() {
    const token = sessionStorage.getItem('token');
    const isVerified = sessionStorage.getItem('is_verified') === 'true';
    const email = sessionStorage.getItem('email');

    console.log('Session data on page load:', { token, isVerified, email });

    // Check if token exists
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '../login/login.html';
        return;
    }

    // Check if email is verified
    if (!isVerified) {
        console.log('Email not verified, redirecting to verify-email');
        window.location.href = '../login/verify-email.html';
        return;
    }

    // Fetch user information from the API
    axios.get(`${BASE_URL}/api/user-info/`, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        const userData = response.data;
        console.log('User info:', userData);

        // Validate email consistency
        if (userData.email !== email) {
            console.warn('Email mismatch between sessionStorage and API');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
            return;
        }

        // Update the email in the dropdown
        const emailElement = document.getElementById('userEmail');
        emailElement.textContent = userData.email || 'User';

        // Store additional user data
        sessionStorage.setItem('username', userData.username || '');
    })
    .catch(error => {
        console.error('Failed to fetch user info:', error);
        if (error.response && error.response.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            alert('Failed to load user data. Please try again.');
        }
    });
}

// Logout function
function handleLogout() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        sessionStorage.clear();
        window.location.href = '../index.html';
        return;
    }

    axios.post(`${BASE_URL}/logout/`, {}, {
        headers: {
            'Authorization': `Token ${token}`,
        },
    })
    .then(response => {
        console.log('Logout successful');
        sessionStorage.clear();
        window.location.href = '../index.html';
    })
    .catch(error => {
        console.error('Logout failed:', error);
        sessionStorage.clear();
        window.location.href = '../index.html';
    });
}

// Initialize user information when the page loads
document.addEventListener('DOMContentLoaded', fetchUserInfo);
