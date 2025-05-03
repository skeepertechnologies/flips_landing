import os
import time
import subprocess
import socket

def is_process_running(command):
    try:
        output = subprocess.check_output(f'pgrep -f "{command}"', shell=True)
        return bool(output.strip())
    except subprocess.CalledProcessError:
        return False

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('0.0.0.0', port)) == 0

def start_django_server():
    os.chdir('/var/www/html/floodsys/auth')
    # Activate the virtual environment and start the Django server
    subprocess.Popen(['/home/skeeperloyaltie/.venv/bin/python', 'manage.py', 'runserver', '0.0.0.0:8000'])

if __name__ == "__main__":
    command = '/home/skeeperloyaltie/.venv/bin/python manage.py runserver 0.0.0.0:8000'
    port = 8000
    while True:
        if is_process_running(command):
            print(f"The process '{command}' is already running.")
        elif is_port_in_use(port):
            print(f"Port {port} is already in use. Cannot start the Django server.")
        else:
            print("Django server not running. Starting it...")
            start_django_server()

        time.sleep(10)  # Check every 10 seconds
