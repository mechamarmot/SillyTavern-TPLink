# SillyTPLink - TP-Link Smart Home Control for SillyTavern

Control your TP-Link Kasa smart home devices directly from SillyTavern using the local protocol - no cloud required.

![SillyTPLink Interface](images/screenshot.png)

## Requirements

- **SillyTavern**
- **[SillyTavern-PyRunner](https://github.com/SillyTavern/Extension-PyRunner)** - Extension (required)
- **[SillyTavern-PyRunner-Plugin](https://github.com/SillyTavern/SillyTavern-PyRunner-Plugin)** - Server plugin (required)
- **Python 3.7+**
- **TP-Link Kasa Devices** (see compatible devices at bottom)

## Installation

1. Install PyRunner extension and PyRunner-Plugin server plugin
2. Clone this repo to `SillyTavern/public/scripts/extensions/third-party/SillyTavern-Kasa`
3. Enable both PyRunner and SillyTPLink in SillyTavern extensions panel
4. The SillyTPLink panel will appear in extensions settings

## Quick Start

1. Click **Auto-Discover** to find devices on your network
2. Or manually add by IP address
3. Use the toggle button to test control
4. Devices appear with control phrases you can use in chat

## Usage

### Slash Commands

```
/tplink-on Lamp
/tplink-off Lamp
/tplink-toggle Lamp
/tplink-status
```

### Message Macros

Embed control in messages:
```
Turn on the lights {{tplink-on:Living Room Light}} please!
```

Result:
```
Turn on the lights [Living Room Lamp ON] please!
```

### Advanced Examples

**Timed automation:**
```
/tplink-on Lamp | /delay 10000 | /tplink-off Lamp
```

**Scene control:**
```
/tplink-on Living Room Light | /tplink-on Table Lamp | /echo Scene activated
```

## Device Management

- **Auto-Discover**: Broadcasts to find Kasa devices on your network
- **Network Scan**: Port-based scanning for devices on your subnet
- **Manual Entry**: Add devices by IP address
- **Rename/Description**: Right-click menu on device cards
- **Remove**: Delete devices you no longer need

## Compatible Devices

TP-Link **Kasa** devices using the local control protocol:

**Smart Plugs**: HS100, HS103, HS105, HS110, KP100, KP115, KP125, EP10, EP25
**Smart Switches**: HS200, HS210, HS220, KS200, KS220, KS230
**Smart Bulbs**: LB100-230 series, KL50, KL60, KL110-135 series
**Light Strips**: KL400, KL420, KL430
**Power Strips**: HS300, KP200, KP303, KP400

**Note**: Tapo and other TP-Link brands use different protocols and are not supported.

## How It Works

- Uses the reverse-engineered TP-Link Smart Home Protocol (port 9999)
- XOR autokey encryption for device communication
- No cloud connection required
- No authentication needed for local control

Based on [softScheck/tplink-smartplug](https://github.com/softScheck/tplink-smartplug)

## Troubleshooting

**PyRunner not available**: Install PyRunner extension and PyRunner-Plugin server plugin
**Device not found**: Check IP address, ensure same network, allow port 9999 in firewall
**Discovery fails**: Use Network Scan or Manual Entry instead
**Commands not working**: Wait 10 seconds after page load, then reload if needed

## Credits

- Author: mechamarmot
- Protocol: [softScheck/tplink-smartplug](https://github.com/softScheck/tplink-smartplug)
- Built with: React 18, Webpack 5, Python

## License

Apache 2.0 License

---

**Made for the SillyTavern community**
