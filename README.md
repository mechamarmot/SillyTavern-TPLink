# SillyTPLink - TP-Link Smart Home Control for SillyTavern

**Control your TP-Link Kasa smart home devices directly from SillyTavern**

This extension jailbreaks TP-Link Kasa devices using the reverse-engineered local protocol, bypassing cloud requirements and enabling direct local network control. Compatible with most Kasa devices up to the latest 2025 firmware versions. This extension uses the documented TP-Link Smart Home Protocol to communicate directly with your devices over your local network - no cloud connection required.

**⚠️ Compatibility Note**: This extension is designed specifically for **TP-Link Kasa** devices and has been tested extensively with the Kasa product line. Other TP-Link smart home brands (Tapo, etc.) use different protocols and are not supported.

![SillyTPLink Interface](images/screenshot.png)

## Requirements

### Essential Dependencies

- **SillyTavern** - The host application
- **[SillyTavern-PyRunner](https://github.com/SillyTavern/Extension-PyRunner)** ⚠️ **REQUIRED** - This extension depends on PyRunner for Python script execution
- **Python 3.7+** - Required for device communication protocol
- **TP-Link Kasa Devices** - See compatible devices list at bottom of this document

## Features

### Device Control
- **Manual Control**: Turn devices on/off with a single click from the UI
- **Slash Commands**: Control devices using `/tplink-on`, `/tplink-off`, `/tplink-toggle`, `/tplink-status`
- **Message Macros**: Embed device control in chat messages with `{{tplink-on:DeviceName}}` and `{{tplink-off:DeviceName}}`
- **Real-time Status**: Monitor device states with live updates
- **Custom Descriptions**: Label devices with descriptive names for better macro output

### Discovery & Management
- **Auto-Discovery**: Automatically find Kasa devices on your local network
- **Network Scanning**: Port-based scanning for devices on specific subnets
- **Manual Entry**: Add devices by IP address
- **Device Organization**: Manage multiple devices with custom descriptions

### Advanced Features
- **Local Network Control**: Direct communication with devices (no cloud required)
- **Scriptable Automation**: Chain commands together with PyRunner for complex automations

## Installation

### 1. Install PyRunner Extension (Required)

**PyRunner must be installed first**, as this extension depends on it:

```bash
cd c:\ST-dev\SillyTavern\public\scripts\extensions\third-party
git clone https://github.com/SillyTavern/Extension-PyRunner.git SillyTavern-PyRunner
```

Or download from: https://github.com/SillyTavern/Extension-PyRunner

### 2. Install SillyTPLink Extension

Clone or download this repository to your SillyTavern extensions directory:

```bash
cd c:\ST-dev\SillyTavern\public\scripts\extensions\third-party
git clone https://github.com/yourusername/SillyTavern-TPLink.git SillyTavern-TPLink
```

Or manually copy the folder to:
```
c:\ST-dev\SillyTavern\public\scripts\extensions\third-party\SillyTavern-TPLink\
```

### 3. Verify Python Installation

Ensure Python 3.7+ is installed and accessible:

```bash
python --version
```

### 4. Enable Extensions in SillyTavern

1. Start SillyTavern
2. Go to **Extensions** > **Extension Settings**
3. Enable **SillyTavern-PyRunner** (must be enabled first)
4. Enable **SillyTPLink - Smart Home Control**
5. The SillyTPLink panel will appear in the extensions settings

## Usage

### Adding Devices

**Option 1: Auto-Discovery (Recommended)**
1. Click the **Auto-Discover** button in the extension panel
2. The extension will broadcast to your local network to find Kasa devices
3. Found devices will be automatically added with their detected names and models

**Option 2: Network Scan**
1. Click **Scan Network (Port 9999)**
2. Scans your subnet for devices listening on the Kasa protocol port
3. Useful if broadcast discovery is blocked by your network

**Option 3: Manual Entry**
1. Enter the device's IP address (e.g., `192.168.1.100`)
2. Optionally provide a friendly name
3. Click **Add Device**
4. The extension will connect and retrieve device information

### Device Descriptions

Each device has a customizable description field:

1. Click the **⋮** menu button on any device card
2. Select **Edit Description**
3. Enter a descriptive name (e.g., "Living Room Lamp", "Bedroom Fan")
4. This description is used in macro replacement text

**Default**: New devices default to "Generic Device" until customized.

### Manual Device Control

Each device card provides direct control:

- **Toggle Button**: Turn device on/off
- **Refresh Button (↻)**: Update current device state
- **Remove Button (×)**: Delete device from list
- **Menu Button (⋮)**: Access device options (edit description, remove)

### Control Phrases

Each device card displays the control phrases you can use in messages:

```
ON PHRASE:  {{tplink-on:DeviceName}}
OFF PHRASE: {{tplink-off:DeviceName}}
```

### Slash Commands

Use slash commands in the chat input or in STScript:

#### Basic Commands

**Turn device on:**
```
/tplink-on DeviceName
```

**Turn device off:**
```
/tplink-off DeviceName
```

**Toggle device state:**
```
/tplink-toggle DeviceName
```

**List all devices:**
```
/tplink-status
```

#### Advanced Examples

**Create a timed automation:**

Turn on a device, wait 10 seconds, then turn it off:

```
/tplink-on Lamp | /pyrun import time; time.sleep(10) | /tplink-off Lamp
```

Turn on a device, wait 10 minutes, then turn it off:

```
/tplink-on Coffee Maker | /pyrun import time; time.sleep(600) | /tplink-off Coffee Maker
```

**Note**: Commands must be chained with `|` (pipe) for sequential execution. Commands on separate lines will run simultaneously, not sequentially.

**Use with Quick Replies:**

Create a Quick Reply button with:
```
/tplink-toggle Living Room Light | /echo Light toggled
```

**Scene Control:**

Turn on multiple devices:
```
/tplink-on Living Room Light | /tplink-on Table Lamp | /tplink-on LED Strip | /echo Scene activated
```

### Message Macros

Embed device control directly in chat messages. The macros will:
1. **Actually control the device** (turn it on or off)
2. **Replace themselves** with status text in the message

**Syntax:**
```
{{tplink-on:DeviceName}}   - Turn device on
{{tplink-off:DeviceName}}  - Turn device off
```

**Example in user message:**
```
Turn on the lights {{tplink-on:Living Room Light}} please!
```

**Result after processing:**
```
Turn on the lights [Living Room Lamp ON] please!
```

**Example in character card (Author's Note or System Prompt):**
```
When the user says goodnight, respond with a warm message and turn off the lights {{tplink-off:Bedroom Light}}.
```

**Note**: The replacement text uses the device's **description** field, not its name. This allows for more natural-sounding output.

### Device Information Display

Each device card shows:
- **Device Name**: As detected from the device or manually set
- **Device Description**: Custom label (displayed in quotes)
- **Model Number**: Hardware model (e.g., HS100, KP115)
- **IP Address**: Network address
- **Current State**: Visual indicator (● ON / ○ OFF)
- **Control Phrases**: Copy-paste ready macro syntax

## Architecture

### Frontend (React)
- Built with React 18 and Webpack
- Integrates with SillyTavern's extension system
- Uses SillyTavern's theme variables for consistent styling
- Inline drawer component in extensions settings panel

### Backend (Python)
- **tplink_protocol.py**: XOR autokey encryption/decryption for TP-Link protocol
- **kasa_controller.py**: High-level device control interface with KasaDevice class
- **kasa_api.py**: CLI wrapper for PyRunner integration
- **scan_network.py**: Network scanning utilities
- **test_connection.py**: Device connectivity testing

### Communication Flow
```
React UI → PyRunnerService → PyRunner Extension → Python Scripts → TP-Link Device (Port 9999)
```

### Message Hook System

The extension uses SillyTavern's event system to intercept and process messages:

1. **Event Listeners**: Hooks into `USER_MESSAGE_RENDERED`, `CHARACTER_MESSAGE_RENDERED`, and `MESSAGE_RENDERED` events
2. **DOM Processing**: Scans rendered messages for `{{tplink-on:Device}}` and `{{tplink-off:Device}}` patterns
3. **Device Control**: Executes actual device commands via PyRunner
4. **Text Replacement**: Updates both chat data and DOM with status text `[Description ACTION]`
5. **Deduplication**: Uses WeakSet to prevent reprocessing messages

This approach ensures macros work in both user and AI-generated messages.

## Supported Python Commands

The Python backend (`kasa_api.py`) supports these commands:

- `discover` - Find devices on network via broadcast
- `scan` - Scan network for devices on port 9999
- `info <ip>` - Get device information and system details
- `state <ip>` - Get current device state (on/off)
- `on <ip>` - Turn device on
- `off <ip>` - Turn device off
- `toggle <ip>` - Toggle device state
- `led <ip> <on|off>` - Control LED indicator
- `reboot <ip>` - Reboot device

## Protocol Details

SillyTPLink uses the **TP-Link Smart Home Protocol**:

- **Port**: TCP 9999
- **Encryption**: XOR autokey cipher (initial key: 171)
- **Format**: JSON commands/responses with 4-byte length header
- **Authentication**: None required for local control
- **Discovery**: UDP broadcast on port 9999

This protocol was reverse-engineered by the open-source community. Implementation based on [softScheck/tplink-smartplug](https://github.com/softScheck/tplink-smartplug).

### Example Protocol Exchange

**Command (plaintext JSON):**
```json
{"system":{"set_relay_state":{"state":1}}}
```

**Encrypted and sent to device on port 9999**

**Response (decrypted):**
```json
{"system":{"set_relay_state":{"err_code":0}}}
```

## Troubleshooting

### PyRunner Not Available

**Error**: "PyRunner extension is not available"

**Solution**:
1. Ensure PyRunner is installed in the extensions directory
2. Enable PyRunner in SillyTavern extensions panel
3. Restart SillyTavern if you just installed PyRunner
4. Check browser console for PyRunner initialization logs

### Device Not Found

**Error**: "Failed to connect to device" or "Device offline"

**Possible causes**:
1. Device is offline, unplugged, or rebooting
2. Incorrect IP address entered
3. Device is on a different network/VLAN
4. Firewall blocking TCP port 9999

**Solutions**:
- Verify device is powered on and WiFi LED is solid (not blinking)
- Check IP address in your router's DHCP client list or Kasa app
- Ensure device and computer are on the same network subnet
- Configure firewall to allow TCP/UDP port 9999
- Try pinging the device: `ping 192.168.1.xxx`

### Discovery Finds No Devices

**Possible causes**:
1. Devices are on a different subnet
2. Network doesn't allow broadcast/multicast packets (common in VLANs)
3. Firewall blocking UDP port 9999
4. Devices are in "cloud-only" mode (rare)

**Solutions**:
- Use "Scan Network" instead of "Auto-Discover"
- Add devices manually using IP address
- Check router/firewall settings for broadcast packet filtering
- Ensure you're on the same network as the devices

### Macros Not Working

**Possible causes**:
1. Extension hooks not registered (timing issue)
2. Device name mismatch (case-sensitive)
3. PyRunner not responding

**Solutions**:
- Reload SillyTavern (Ctrl+F5 for hard refresh)
- Verify device name matches exactly (check device card)
- Check browser console for `[SillyTPLink]` logs
- Test device control manually first (click toggle button)

### Python Script Errors

**Error**: Various Python-related errors in console

**Solutions**:
- Ensure Python 3.7+ is installed: `python --version`
- Verify Python is in system PATH
- Check PyRunner extension logs in browser console
- Try running Python scripts manually from `python/` directory

### Slash Commands Not Registered

**Error**: Commands like `/tplink-on` not recognized

**Solutions**:
- Wait 5-10 seconds after page load for initialization
- Check console for `[SillyTPLink] Slash commands registered successfully`
- Reload SillyTavern if commands don't appear
- Ensure SillyTavern version supports slash command API

## Security Notes

- **Local Network Only**: This extension communicates with devices on your local network by default
- **No Authentication**: TP-Link Kasa protocol does not require authentication for local control
- **Trusted Network**: Devices should be on a trusted network; anyone on the same network can control them
- **Network Segmentation**: Consider placing IoT devices on a separate VLAN for security
- **Firmware Updates**: Keep device firmware updated for security patches
- **Cloud Disabled**: You can disable cloud connectivity on devices and use purely local control

## Performance Notes

- **Device Response Time**: Commands typically complete in 100-500ms
- **Network Latency**: Response time depends on network conditions
- **Concurrent Operations**: Multiple devices can be controlled simultaneously
- **Message Processing**: Macro replacement happens after message rendering (500ms-1s delay)

## Credits

**Protocol & Research**:
- [softScheck/tplink-smartplug](https://github.com/softScheck/tplink-smartplug) - Reverse-engineered protocol documentation
- [python-kasa](https://github.com/python-kasa/python-kasa) - Python library for Kasa devices

**Authentication & Cloud API**:
- [IT Nerd Space](https://itnerd.space/2017/06/19/how-to-authenticate-to-tp-link-cloud-api/) - Cloud API authentication guide

**Development**:
- Author: mechamarmot
- Built with: React 18, Webpack 5, Python, SillyTavern Extension API
- Message processing pattern inspired by SillyTavern LocalImage extension

## License

Apache 2.0 License - Consistent with tplink-smartplug upstream project

See LICENSE file for full license text.

## Compatible Devices

This extension supports TP-Link **Kasa** devices using the local control protocol. Based on the [tplink-smartplug](https://github.com/softScheck/tplink-smartplug) library, compatible devices include:

**Smart Plugs**:
- HS100, HS103, HS105, HS107, HS110
- KP100, KP115, KP125, KP401
- EP10, EP25

**Smart Switches**:
- HS200, HS210, HS220
- KS200, KS220, KS230

**Smart Bulbs**:
- LB100, LB110, LB120, LB130, LB200, LB230
- KL50, KL60, KL110, KL120, KL125, KL130, KL135

**Smart Light Strips**:
- KL400, KL420, KL430

**Power Strips**:
- HS300, KP200, KP303, KP400

## Support

For issues, questions, or feature requests:
- Open an issue on the GitHub repository
- Check existing issues for solutions
- Include browser console logs and Python error messages when reporting bugs

## Changelog

### v1.0.0 (2025)
- Initial release
- Device discovery and manual entry
- Real-time device control
- Slash commands (`/tplink-on`, `/tplink-off`, `/tplink-toggle`, `/tplink-status`)
- Message macros (`{{tplink-on:Device}}`, `{{tplink-off:Device}}`)
- Custom device descriptions
- Network scanning capabilities
- Context menu for device management

---

**Made for the SillyTavern community**
