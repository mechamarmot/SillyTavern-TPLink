"""
Get all network interfaces and find the local LAN (not VPN)
"""
import socket
import json

def get_local_interfaces():
    """Get all local network interfaces"""
    interfaces = []

    # Get hostname and all associated IPs
    hostname = socket.gethostname()

    # Try to get all IPs
    try:
        # This might return multiple IPs
        addrs = socket.getaddrinfo(hostname, None)
        for addr in addrs:
            ip = addr[4][0]
            # Filter out IPv6 and localhost
            if ':' not in ip and ip != '127.0.0.1':
                interfaces.append(ip)
    except:
        pass

    # Try alternative method using socket connection trick
    try:
        # Connect to external IP to find local interface
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        if local_ip not in interfaces:
            interfaces.append(local_ip)
    except:
        pass

    return interfaces

def categorize_ip(ip):
    """Categorize an IP address"""
    parts = [int(x) for x in ip.split('.')]

    if parts[0] == 10:
        return "private_10", "Private network (10.x.x.x)"
    elif parts[0] == 172 and 16 <= parts[1] <= 31:
        return "private_172", "Private network (172.16-31.x.x)"
    elif parts[0] == 192 and parts[1] == 168:
        return "private_192", "Private network (192.168.x.x)"
    elif parts[0] == 100 and 64 <= parts[1] <= 127:
        return "cgnat_vpn", "CGNAT/VPN (likely Tailscale/ZeroTier)"
    elif parts[0] == 169 and parts[1] == 254:
        return "link_local", "Link-local (169.254.x.x - no DHCP)"
    else:
        return "unknown", "Unknown/Public"

print("Detecting network interfaces...")
print()

interfaces = get_local_interfaces()

if not interfaces:
    print("ERROR: Could not detect any network interfaces!")
    print(json.dumps({"error": "No interfaces found"}))
else:
    print(f"Found {len(interfaces)} interface(s):")
    print()

    categorized = []
    for ip in interfaces:
        category, description = categorize_ip(ip)
        print(f"  {ip}")
        print(f"    Type: {description}")

        # Calculate broadcast address assuming /24
        parts = ip.split('.')
        broadcast = f"{parts[0]}.{parts[1]}.{parts[2]}.255"
        print(f"    Broadcast (/24): {broadcast}")

        # Calculate /16 broadcast
        broadcast_16 = f"{parts[0]}.{parts[1]}.255.255"
        print(f"    Broadcast (/16): {broadcast_16}")
        print()

        categorized.append({
            "ip": ip,
            "category": category,
            "description": description,
            "broadcast_24": broadcast,
            "broadcast_16": broadcast_16,
            "is_vpn": category == "cgnat_vpn"
        })

    # Find best interface (prefer non-VPN private networks)
    best = None
    for iface in categorized:
        if not iface['is_vpn'] and iface['category'].startswith('private'):
            best = iface
            break

    if not best:
        # Fallback to first interface
        best = categorized[0]

    print(f"RECOMMENDED interface for Kasa discovery:")
    print(f"  IP: {best['ip']}")
    print(f"  Reason: {best['description']}")
    print()

    result = {
        "interfaces": categorized,
        "recommended": best
    }

    print(json.dumps(result))
