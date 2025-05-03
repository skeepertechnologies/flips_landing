import socket

def scan_ports(ip, start_port, end_port):
    open_ports = []
    for port in range(start_port, end_port + 1):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((ip, port))
        if result == 0:
            open_ports.append(port)
        sock.close()
    return open_ports

ip = input("Enter the IP address to scan: ")
start_port = int(input("Enter the starting port: "))
end_port = int(input("Enter the ending port: "))

print(f"Scanning ports {start_port} to {end_port} on {ip}")
open_ports = scan_ports(ip, start_port, end_port)

if open_ports:
    print("Open ports:", open_ports)
else:
    print("No open ports found in the specified range.")