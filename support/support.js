function toggleSupportBot() {
    const bot = document.getElementById('supportBotContainer');
    if (bot.style.display === 'none' || bot.style.display === '') {
        bot.style.display = 'block';

        // Display initial message
        const chatOutput = document.getElementById('chatOutput');
        chatOutput.innerHTML += `<p><strong>Bot:</strong> Hello, welcome to FLIPS! We are here to assist you with flood information ` +
                                `and prediction. Our services include real-time flood predictions, river water level monitoring, ` +
                                `and data-driven insights. How can I assist you today?<br>` +
                                `If you need help with user accounts and password resets, please let me know.<br>` +
                                `If you would like to speak with an agent, type 'agent' and I will create a support ticket for you.</p>`;
        chatOutput.scrollTop = chatOutput.scrollHeight;
    } else {
        bot.style.display = 'none';
    }
}document.addEventListener("DOMContentLoaded", function() {
    const supportBotBody = document.getElementById('supportBotBody');
    supportBotBody.innerHTML = `
        <form id="chatForm" class="d-flex mb-3">
            <input type="text" id="chatInput" placeholder="Type a message" class="form-control mr-2" required>
            <button type="submit" class="btn btn-primary">Send</button>
        </form>
        <div id="chatOutput" class="border p-3" style="height: 300px; overflow-y: auto; background: #f9f9f9;"></div>
        <div id="ticketList" class="border p-3 mt-3" style="height: 300px; overflow-y: auto; background: #f9f9f9;"></div>
    `;

    const chatForm = document.getElementById('chatForm');
    chatForm.onsubmit = async function(event) {
        event.preventDefault();
        const message = document.getElementById('chatInput').value;
        const chatOutput = document.getElementById('chatOutput');
        const csrfToken = getCookie('csrftoken');

        try {
            const response = await fetch('http://127.0.0.1:8000/support/chatbot/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error: ${response.status} - ${response.statusText} \n${errorText}`);
            }

            const data = await response.json();

            chatOutput.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
            chatOutput.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;

            if (data.response.includes("Your request to talk to an agent has been received.")) {
                setTimeout(() => {
                    window.location.href = 'support/ticket.html';
                }, 3000); // Redirect to ticket page after 3 seconds
            }

            chatOutput.scrollTop = chatOutput.scrollHeight;
        } catch (error) {
            chatOutput.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
            chatOutput.scrollTop = chatOutput.scrollHeight;
            console.error('Error:', error);
        }

        document.getElementById('chatInput').value = ''; // Clear input after sending
    };

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === `${name}=`) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    async function fetchTickets() {
        const csrfToken = getCookie('csrftoken');
        const ticketList = document.getElementById('ticketList');

        try {
            const response = await fetch('http://127.0.0.1:8000/support/tickets/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error: ${response.status} - ${response.statusText} \n${errorText}`);
            }

            const tickets = await response.json();

            ticketList.innerHTML = '<h3>Your Tickets</h3>';
            tickets.forEach(ticket => {
                ticketList.innerHTML += `
                    <div class="ticket">
                        <p><strong>Subject:</strong> ${ticket.subject}</p>
                        <p><strong>Description:</strong> ${ticket.description}</p>
                        <p><strong>Created:</strong> ${ticket.created_at}</p>
                    </div>
                `;
            });

            ticketList.scrollTop = ticketList.scrollHeight;
        } catch (error) {
            ticketList.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
            ticketList.scrollTop = ticketList.scrollHeight;
            console.error('Error:', error);
        }
    }

    fetchTickets(); // Fetch tickets on page load
});