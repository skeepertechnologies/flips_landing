 // Function to fetch user information
    function fetchUserInfo() {
        const token = localStorage.getItem('token'); // Get the token from localStorage

        // Check if the token exists
        if (!token) {
            alert('No token found. Please log in.');
            window.location.href = '../../login.html'; // Redirect to login page
            return;
        }

        // Fetch user information from the API
        axios.get('http://127.0.0.1:8000/api/user-info/', {
            headers: {
                'Authorization': `Token ${token}`,
            },
        })
        .then(response => {
            const userData = response.data;

            // Update the username in the dropdown
            const usernameElement = document.getElementById('username');
            usernameElement.textContent = userData.username || 'Unknown User';

            // Optionally, you can store additional user data in localStorage
            localStorage.setItem('userEmail', userData.email || '');
        })
        .catch(error => {
            console.error('Failed to fetch user info:', error);

            // Handle token expiration or invalid token
            if (error.response && error.response.status === 401) {
                alert('Session expired. Please log in again.');
                localStorage.removeItem('token'); // Clear invalid token
                window.location.href = 'login.html'; // Redirect to login page
            }
        });
    }

    // Initialize the user information when the page loads
    document.addEventListener('DOMContentLoaded', fetchUserInfo);



    // logout fucntion
function handleLogout() {
            const token = localStorage.getItem('token');
            axios.post('http://127.0.0.1:8000/logout/', {}, {
                headers: {
                    'Authorization': 'Token ' + token,
                },
            }).then(function (response) {
                localStorage.removeItem('token');
                localStorage.removeItem('graphDataCache'); // Clear the graph data from localStorage
                window.location.href = '../../index.html';
            }).catch(function (error) {
                console.error('Logout failed', error);
            });
        }


