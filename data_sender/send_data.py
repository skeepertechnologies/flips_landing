import requests
import json
import time
import random
from datetime import datetime
import pytz

# The endpoint URLs
# Using the service name 'django' to route through Docker's internal network
sensor_data_url = "https://django:8000/monitor/sensor-data/"
rigs_url = "https://django:8000/monitor/get-rigs/"

# The header, including an authorization token
headers = {
    "Content-Type": "application/json",
    "Authorization": "Token 5ac50a6f97d8d21c5d01f7ef4fcd6481ca0f36ef",
}

def fetch_rigs():
    """Fetches rig data from the server."""
    while True:
        try:
            response = requests.get(rigs_url, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Failed to fetch rigs: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching rigs: {e}")

        print("Retrying in 60 seconds...")
        time.sleep(6)

def generate_real_time_data(sensor_id, rig):
    """
    Generates real-time data using the current timestamp.
    This ensures the data reflects the exact moment it's created.
    """
    nairobi_tz = pytz.timezone('Africa/Nairobi')
    timestamp = datetime.now(nairobi_tz).isoformat()  # Current timestamp in ISO format

    return {
        "sensorID": sensor_id,
        "waterLevel": round(random.uniform(5.0, 10.0), 2),
        "temperature": round(random.uniform(20.0, 30.0), 2),
        "humidity": round(random.uniform(50.0, 70.0), 2),
        "timestamp": timestamp,
        "latitude": rig["latitude"],  # Add latitude
        "longitude": rig["longitude"]  # Add longitude
    }

def send_data():
    """
    Continuously fetch rig data, generate real-time sensor data,
    and send it to the server.
    """
    while True:
        rigs = fetch_rigs()
        if not rigs:
            print("No rigs available to send data.")
            continue

        selected_rig = random.choice(rigs)
        sensor_id = selected_rig.get("sensor_id")

        if not sensor_id:
            print(f"Skipping rig with invalid or missing sensor_id: {selected_rig}")
            continue

        # Generate real-time data
        data = generate_real_time_data(sensor_id, selected_rig)

        try:
            response = requests.post(sensor_data_url, headers=headers, data=json.dumps(data))
            if response.status_code in (200, 201):
                print(
                    f"Data sent successfully for sensor {sensor_id} (rig {selected_rig.get('rig_id')})"
                )
                print(response.json())
            else:
                print(
                    f"Failed to send data for sensor {sensor_id} (rig {selected_rig.get('rig_id')}): {response.status_code}"
                )
                try:
                    print(response.json())
                except json.JSONDecodeError:
                    print(response.text)
        except requests.exceptions.RequestException as e:
            print(
                f"Error sending request for sensor {sensor_id} (rig {selected_rig.get('rig_id')}): {e}"
            )

        # Send data every 3 seconds to simulate real-time updates
        time.sleep(3)

if __name__ == "__main__":
    send_data()
