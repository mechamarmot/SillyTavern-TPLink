"""
Test discovery script with detailed logging
"""
import socket
import time
import json
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

print("Starting TP-Link device discovery test...")
print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")

# Get local network info
def get_local_interfaces():
    """Get all local network interfaces"""
    interfaces = []
    hostname = socket.gethostname()

    try:
        addrs = socket.getaddrinfo(hostname, None)
        for addr in addrs:
            ip = addr[4][0]
            if ':' not in ip and ip != '127.0.0.1':
                interfaces.append(ip)
    except:
        pass

    # Try socket connection trick
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        if local_ip not in interfaces:
            interfaces.append(local_ip)
    except:
        pass

    return interfaces

def is_vpn_ip(ip):
    """Check if IP is likely a VPN (Tailscale uses 100.64.0.0/10)"""
    parts = [int(x) for x in ip.split('.')]
    return parts[0] == 100 and 64 <= parts[1] <= 127

try:
    hostname = socket.gethostname()
    interfaces = get_local_interfaces()

    print(f"Local hostname: {hostname}")
    print(f"Detected interfaces: {', '.join(interfaces)}")

    # Find non-VPN interface
    local_ip = None
    for ip in interfaces:
        if not is_vpn_ip(ip):
            local_ip = ip
            print(f"Using non-VPN interface: {local_ip}")
            break

    if not local_ip:
        local_ip = interfaces[0] if interfaces else "unknown"
        print(f"No non-VPN interface found, using: {local_ip}")

except Exception as e:
    print(f"Could not get local IP: {e}")
    local_ip = "unknown"

# Discovery command
command = '{"system":{"get_sysinfo":{}}}'
print(f"\nCommand to send: {command}")
encrypted = encrypt(command)
print(f"Encrypted length: {len(encrypted)} bytes")
print(f"Encrypted (hex): {encrypted.hex()}")

discovered = set()

try:
    # Create UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    # Try binding to port 9999 to match device expectations
    try:
        sock.bind(('', 9999))
        bound_port = 9999
        print(f"\nBound to port: {bound_port} (same as devices)")
    except Exception as e:
        print(f"\nCouldn't bind to port 9999 ({e}), using random port")
        sock.bind(('', 0))
        bound_port = sock.getsockname()[1]
        print(f"Bound to port: {bound_port}")

    sock.settimeout(1.0)

    # Calculate broadcast address based on local IP
    broadcast_addresses = ['255.255.255.255']  # Global broadcast always first

    if local_ip and local_ip != "unknown":
        try:
            parts = local_ip.split('.')
            # Add specific broadcasts for the detected network
            broadcast_24 = f"{parts[0]}.{parts[1]}.{parts[2]}.255"
            broadcast_16 = f"{parts[0]}.{parts[1]}.255.255"

            if not is_vpn_ip(local_ip):
                broadcast_addresses.insert(0, broadcast_24)  # Most specific first
                broadcast_addresses.insert(1, broadcast_16)
                print(f"Added network-specific broadcasts: {broadcast_24}, {broadcast_16}")
            else:
                print(f"Skipping VPN network broadcasts")

            # Also try common subnets
            if parts[0] in ['192', '10', '172']:
                broadcast_addresses.extend([
                    '192.168.1.255',    # Common router default
                    '192.168.0.255',    # Another common default
                    '10.0.0.255',       # 10.0.0.x subnet
                ])
        except:
            pass

    print(f"\nBroadcast targets:")
    for addr in broadcast_addresses:
        print(f"  - {addr}")

    print(f"\nSending 5 broadcast packets to each target...")
    # Send broadcasts
    sent_count = 0
    failed_count = 0
    for i in range(5):
        for broadcast_addr in broadcast_addresses:
            try:
                sock.sendto(encrypted, (broadcast_addr, 9999))
                sent_count += 1
            except Exception as e:
                failed_count += 1
                if i == 0:  # Only print errors on first iteration
                    print(f"  ERROR: Broadcast to {broadcast_addr} failed - {e}")
        time.sleep(0.2)

    print(f"  Sent: {sent_count} broadcasts, Failed: {failed_count}")

    print(f"\nListening for responses (10 second timeout)...")
    # Listen for responses
    start_time = time.time()
    response_count = 0
    timeout = 10

    while time.time() - start_time < timeout:
        try:
            data, addr = sock.recvfrom(4096)
            response_count += 1
            print(f"\n  Response {response_count} from {addr[0]}:{addr[1]}")
            print(f"    Raw data length: {len(data)} bytes")
            print(f"    Raw data (first 50 bytes hex): {data[:50].hex()}")

            # Try to decrypt
            try:
                decrypted = decrypt(data[4:])
                print(f"    Decrypted: {decrypted[:200]}")

                # Check if this is an echo (same as our command) or a real response
                if len(data) <= 50:
                    print(f"    NOTE: Short response ({len(data)} bytes) - likely an ECHO, not a real device")
                else:
                    print(f"    This looks like a REAL device response!")
                    discovered.add(addr[0])

            except Exception as e:
                print(f"    ERROR decrypting: {e}")

        except socket.timeout:
            elapsed = time.time() - start_time
            if int(elapsed) != int(elapsed - 1.0):  # Print every second
                print(f"  {int(elapsed)}s elapsed...")
            continue
        except Exception as e:
            print(f"  ERROR receiving: {e}")
            break

    sock.close()
    print(f"\nDiscovery complete.")
    print(f"Total responses received: {response_count}")
    print(f"Unique device IPs: {list(discovered)}")

except Exception as e:
    print(f"\nFATAL ERROR: {e}")
    import traceback
    traceback.print_exc()

# Output result as JSON for PyRunner
result = {"devices": list(discovered), "debug": f"Received {response_count} responses"}
print(f"\n{json.dumps(result)}")
