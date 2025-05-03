// Base URL for all AJAX requests
const BASE_URL = 'http://flipsintel.org:8000';

function storeUserData(token) {
    return axios.get(`${BASE_URL}/api/user-info/`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
    .then(function(response) {
        localStorage.setItem("username", response.data.username);
        localStorage.setItem("token", token);
        document.getElementById("userEmail").textContent = response.data.email || 'User';
        console.log("User data fetched and stored:", response.data);
    })
    .catch(function(error) {
        console.error("Error fetching user data:", error.response ? error.response.data : error.message);
        document.getElementById("userEmail").textContent = "Failed to load user data";
    });
}

function loadPlans() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log('No token available, redirecting to login');
        window.location.href = "../login/login.html";
        return;
    }

    axios.get(`${BASE_URL}/subscription/plans/`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
    .then(function(response) {
        const plansContainer = document.getElementById("plansContainer");
        plansContainer.innerHTML = "";
        response.data.forEach((plan, index) => {
            const promotionBadge = plan.is_promotion_active ? '<span class="badge bg-primary">Promotion Active</span>' : '';
            const middleCardClass = index === 1 ? "middle-card" : "";
            plansContainer.insertAdjacentHTML("beforeend", `
                <div class="col-md-4 mb-5">
                    <div class="card text-center h-100 card-props ${middleCardClass}">
                        <div class="card-body d-flex flex-column align-items-center">
                            <h5 class="card-title fw-bold fs-4 mb-2">${plan.name}</h5>
                            ${promotionBadge}
                            <p class="card-text mb-1">
                                <span class="price-small">KES</span>
                                <span class="price-large">${plan.price}</span>
                                <span class="price-small">/mon</span>
                            </p>
                            <p class="card-text mb-4 mt-5">${plan.description}</p>
                            <button class="btn mt-auto" onclick="subscribeToPlan('${plan.id}')" style="background: #1d0979; color: #fff; font-weight: bold; width: 60%;">Subscribe</button>
                        </div>
                    </div>
                </div>
            `);
        });
    })
    .catch(function(error) {
        console.error("Error loading plans:", error.response ? error.response.data : error.message);
        document.getElementById("plansContainer").innerHTML = "<p class='text-center text-danger'>Error loading plans. Please try again later.</p>";
    });
}

function subscribeToPlan(planId) {
    console.log("Attempting to subscribe to plan with ID:", planId);
    window.location.href = `payment/payment.html?planId=${encodeURIComponent(planId)}`;
}

function redirectToDashboard() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log('No token, redirecting to login');
        window.location.href = "../login/login.html";
        return;
    }

    axios.get(`${BASE_URL}/subscription/get-dashboard-url/`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
    .then(function(response) {
        console.log('Redirection URL:', response.data.url);
        window.location.href = response.data.url || "../index.html";
    })
    .catch(function(error) {
        console.error("Error getting dashboard URL:", error.response ? error.response.data : error.message);
        alert("Failed to get dashboard URL. Please try again.");
    });
}

function checkSubscriptionStatus() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log('No token, redirecting to login');
        window.location.href = "../login/login.html";
        return;
    }

    axios.get(`${BASE_URL}/subscription/status/`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
    .then(function(response) {
        const statusElement = document.getElementById("subscriptionStatus");
        if (response.data.isSubscribed) {
            let details = `You are subscribed to: ${response.data.planName}`;
            details += response.data.planPrice > 0 ? ` at $${response.data.planPrice} per month.` : " - Free Plan";
            statusElement.classList.remove("alert-danger", "alert-warning");
            statusElement.classList.add("alert-success");
            statusElement.textContent = details;
        } else {
            statusElement.classList.remove("alert-success", "alert-danger");
            statusElement.classList.add("alert-warning");
            statusElement.textContent = "You are not currently subscribed to any plan.";
        }
    })
    .catch(function(error) {
        console.error("Error checking subscription status:", error.response ? error.response.data : error.message);
        document.getElementById("subscriptionStatus").classList.remove("alert-success", "alert-warning");
        document.getElementById("subscriptionStatus").classList.add("alert-danger");
        document.getElementById("subscriptionStatus").textContent = "Failed to check subscription status.";
    });
}

function handleLogout() {
    const token = localStorage.getItem("token");
    if (!token) {
        localStorage.clear();
        window.location.href = "../login/login.html";
        return;
    }

    axios.post(`${BASE_URL}/logout/`, {}, {
        headers: {
            Authorization: `Token ${token}`,
        },
    })
    .then(function(response) {
        console.log("Logout successful:", response.data);
        localStorage.clear();
        window.location.href = "../login/login.html";
    })
    .catch(function(error) {
        console.error("Logout failed:", error.response ? error.response.data : error.message);
        localStorage.clear();
        window.location.href = "../login/login.html";
    });
}

// Initialize Page
document.addEventListener("DOMContentLoaded", function() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = "../login/login.html";
        return;
    }
    storeUserData(token);
    loadPlans();
    checkSubscriptionStatus();
});