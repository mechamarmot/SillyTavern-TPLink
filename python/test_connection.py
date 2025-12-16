"""
Test direct TCP connection to a Kasa device
Usage: python test_connection.py <device_ip>
"""
import sys
import json
import socket
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

def decrypt(data):
    """Decrypt using TP-Link protocol"""
    key = 171
    result = ""
    for byte in data:
        a = key ^ byte
        key = byte
        result += chr(a)
    return result

if len(sys.argv) < 2:
    print("ERROR: No IP address provided")
    print(json.dumps({"error": "Usage: test_connection.py <device_ip>"}))
    sys.exit(1)

device_ip = sys.argv[1]

print(f"Testing direct TCP connection to {device_ip}:9999...")

# Command to get device info
command = '{"system":{"get_sysinfo":{}}}'
print(f"Command: {command}")

encrypted = encrypt(command)
print(f"Encrypted length: {len(encrypted)} bytes")
print(f"Encrypted (hex): {encrypted.hex()}")

try:
    # Create TCP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)

    print(f"\nConnecting to {device_ip}:9999...")
    sock.connect((device_ip, 9999))
    print("Connected!")

    print("Sending command...")
    sock.send(encrypted)
    print("Command sent!")

    print("Waiting for response...")
    data = sock.recv(4096)
    print(f"Received {len(data)} bytes")
    print(f"Raw response (hex): {data.hex()}")

    # Decrypt response (skip 4-byte header)
    decrypted = decrypt(data[4:])
    print(f"\nDecrypted response:\n{decrypted}")

    # Parse JSON
    response = json.loads(decrypted)
    print(f"\nParsed JSON:")
    print(json.dumps(response, indent=2))

    sock.close()

    result = {
        "success": True,
        "device_ip": device_ip,
        "response": response
    }

except socket.timeout:
    print("\nERROR: Connection timeout")
    result = {"error": "Connection timeout", "device_ip": device_ip}
except socket.error as e:
    print(f"\nERROR: Socket error - {e}")
    result = {"error": f"Socket error: {e}", "device_ip": device_ip}
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
    result = {"error": str(e), "device_ip": device_ip}

print(f"\n{json.dumps(result)}")
