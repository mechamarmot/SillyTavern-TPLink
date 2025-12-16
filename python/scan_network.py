"""
Scan network for devices with port 9999 open (Kasa devices)
"""
import socket
import json
import concurrent.futures
from struct import pack

def encrypt(string):
    """Encrypt using TP-Link protocol"""
    key = 171
    result = pack(">I", len(string))
    for char in string:
        a = key ^ ord(char)
        key = a
        result += bytes([a])
    return result

def check_port(ip, port=9999, timeout=1):
    """Check if port is open and try to get device info"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))

        if result == 0:
            # Port is open, try to get device info
            command = '{"system":{"get_sysinfo":{}}}'
            encrypted = encrypt(command)

            try:
                sock.send(encrypted)
                data = sock.recv(4096)
                sock.close()

                if len(data) > 4:
                    # Got a response
                    return {"ip": ip, "port": port, "open": True, "responding": True, "data_length": len(data)}
                else:
                    return {"ip": ip, "port": port, "open": True, "responding": False}
            except:
                sock.close()
                return {"ip": ip, "port": port, "open": True, "responding": False}
        else:
            sock.close()
            return None
    except:
        return None

def scan_subnet(subnet="192.168.1", start=1, end=255, port=9999, timeout=1):
    """Scan a subnet for open ports"""
    print(f"Scanning {subnet}.{start}-{end} for port {port}...")
    print(f"This may take a minute...")
    print()

    found = []

    # Use thread pool for faster scanning
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = []
        for i in range(start, end + 1):
            ip = f"{subnet}.{i}"
            futures.append(executor.submit(check_port, ip, port, timeout))

        completed = 0
        for future in concurrent.futures.as_completed(futures):
            completed += 1
            if completed % 50 == 0:
                print(f"  Progress: {completed}/{end - start + 1} IPs checked...")

            result = future.result()
            if result:
                found.append(result)
                print(f"\n  FOUND: {result['ip']}:{result['port']}")
                if result['responding']:
                    print(f"    Status: Port OPEN and RESPONDING to Kasa protocol!")
                    print(f"    Response size: {result['data_length']} bytes")
                else:
                    print(f"    Status: Port OPEN but NOT responding to Kasa protocol")
                print()

    return found

# Get network info
try:
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print(f"Local hostname: {hostname}")
    print(f"Local IP: {local_ip}")
    print()

    # Determine subnet from local IP
    if local_ip.startswith("192.168."):
        parts = local_ip.split(".")
        subnet = f"{parts[0]}.{parts[1]}.{parts[2]}"
    else:
        subnet = "192.168.1"  # Default
        print(f"WARNING: Your IP ({local_ip}) is not on 192.168.x.x network")
        print(f"Using default subnet: {subnet}.x")
        print()
except:
    subnet = "192.168.1"
    print("Could not detect local IP, using default: 192.168.1.x")
    print()

# Scan the network
found_devices = scan_subnet(subnet, start=1, end=255, port=9999, timeout=0.5)

print("\n" + "="*60)
print("SCAN COMPLETE")
print("="*60)

if found_devices:
    print(f"\nFound {len(found_devices)} device(s) with port 9999 open:")
    print()

    kasa_devices = []
    other_devices = []

    for device in found_devices:
        if device['responding']:
            kasa_devices.append(device['ip'])
            print(f"  {device['ip']} - KASA DEVICE (responding to protocol)")
        else:
            other_devices.append(device['ip'])
            print(f"  {device['ip']} - Port open but not responding as Kasa device")

    result = {
        "found": len(found_devices),
        "kasa_devices": kasa_devices,
        "other_devices": other_devices,
        "all_devices": found_devices
    }
else:
    print("\nNo devices found with port 9999 open on this network.")
    result = {
        "found": 0,
        "kasa_devices": [],
        "other_devices": [],
        "all_devices": []
    }

print()
print(json.dumps(result))
