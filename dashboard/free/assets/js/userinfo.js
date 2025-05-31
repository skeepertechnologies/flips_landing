// userinfo.js
const BASE_URL = 'https://api.flipsintel.org';

// Fetch user information
function fetchUserInfo() {
    const token = sessionStorage.getItem('token');
    const isVerified = sessionStorage.getItem('is_verified') === 'true';
    const email = sessionStorage.getItem('email');

    console.log('Session data on page load:', { token, isVerified, email });

    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '../login/login.html';
        return;
    }

    if (!isVerified) {
        console.log('Email not verified, redirecting to verify-email');
        window.location.href = '../login/verify-email.html';
        return;
    }

    axios.get(`${BASE_URL}/api/user-info/`, {
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(response => {
        const userData = response.data;
        console.log('User info:', userData);

        if (userData.email !== email) {
            console.warn('Email mismatch between sessionStorage and API');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
            return;
        }

        const emailElement = document.getElementById('userEmail');
        if (emailElement) {
            emailElement.textContent = userData.email || 'User';
        } else {
            console.warn('Element #userEmail not found in DOM');
        }

        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = userData.username || 'User';
        }

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
        headers: { 'Authorization': `Token ${token}` },
    })
    .then(() => {
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', fetchUserInfo);