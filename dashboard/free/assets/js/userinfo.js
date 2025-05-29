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

        // Update username in navbar
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = userData.username || 'User';
        } else {
            console.warn('Element #username not found in DOM');
        }

        // Update modal fields
        const modalUsername = document.getElementById('modalUsername');
        const modalEmail = document.getElementById('modalEmail');
        if (modalUsername) {
            modalUsername.textContent = userData.username || 'User';
        }
        if (modalEmail) {
            modalEmail.textContent = userData.email || 'N/A';
        }

        sessionStorage.setItem('username', userData.username || '');
    })
    .catch(error => {
        console.error('Failed to fetch user info:', error);
        if (error.response && error.response.status === 401) {
            console.log('Session expired. Redirecting to login.');
            sessionStorage.clear();
            window.location.href = '../login/login.html';
        } else {
            console.log('Failed to load user data. Continuing without user info.');
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