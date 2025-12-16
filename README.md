# SillyTPLink - TP-Link Smart Home Control for SillyTavern

Control your TP-Link Kasa smart home devices directly from SillyTavern using the local protocol - no cloud required.

![SillyTPLink Interface](images/screenshot.png)

## Requirements

- **SillyTavern**
- **[SillyTavern-PyRunner](https://github.com/mechamarmot/SillyTavern-PyRunner)** - Extension that enables Python script execution
- **Python 3.7+**
- **TP-Link Kasa Devices** - See compatible devices below

## Installation

**Recommended: Use SillyTavern's Built-in Extension Manager**

1. Open SillyTavern's Extension Manager (puzzle piece icon)
2. Paste this URL: `https://github.com/mechamarmot/SillyTavern-TPLink`
3. Click "Install"
4. Install PyRunner the same way using: `https://github.com/mechamarmot/SillyTavern-PyRunner`
5. Enable both extensions in the extensions panel
6. Restart SillyTavern

**Alternative: Manual Installation**

1. Install PyRunner extension
2. Clone this repo to `SillyTavern/public/scripts/extensions/third-party/SillyTavern-TPLink`
3. Enable both extensions
4. Restart SillyTavern

## Quick Start

1. Click **Auto-Discover** or **Network Scan** to find devices
2. Or manually add devices by IP address
3. Test control using the ON/OFF toggle buttons
4. Use slash commands or macros in chat to control devices

## Usage

### Slash Commands

```
/tplink-on Lamp
/tplink-off Lamp
/tplink-toggle Lamp
/tplink-cycle Lamp 5
/tplink-status
```

**Scene control example:**
```
/tplink-on Living_Room_Light | /tplink-on Table_Lamp | /echo Scene activated
```

### Message Macros

**Available macros:**
- `{{tplink-on:DeviceName}}` - Turn device on
- `{{tplink-off:DeviceName}}` - Turn device off
- `{{tplink-cycle:DeviceName:seconds}}` - Turn on, wait, turn off

**Example:**
```
Turn on the lights {{tplink-on:Living_Room_Light}} please!
```

**Result:** You see `[Living Room Light ON]` in the chat, device turns on, and the AI only sees your message text without the macro or replacement.

**Cycle example:**
```
Activating the lamp {{tplink-cycle:Desk_Lamp:5}} for 5 seconds
```

**Result:** Device turns on, countdown timer shows `[Desk Lamp CYCLED 5s]`, then automatically turns off after 5 seconds.

### Status Display

A semi-transparent status box appears below the top menu showing:
- Recently controlled devices with current state (ON/OFF)
- Live countdown timers for cycling devices
- Independent timers for multiple devices simultaneously
- Toggle visibility in extension settings

## Device Management

### Adding Devices

- **Auto-Discover**: Broadcasts to find Kasa devices
- **Network Scan**: Port-based scanning of your subnet
- **Manual Entry**: Add by IP address

### Device Names

**Naming rules:**
- Single word only (no spaces)
- Alphanumeric and underscores only (`A-Z`, `a-z`, `0-9`, `_`)
- No special characters or hyphens
- Must be unique (case-insensitive)

**Auto-sanitization:** When adding devices, spaces become underscores and special characters are removed.
- `Living Room Lamp!` → `Living_Room_Lamp`
- `My Device #1` → `My_Device_1`

**Aliases:** The extension tracks both your custom alias (used in commands) and the device's original TP-Link name (synced via refresh button). Commands always work via IP address regardless of name changes.

## Compatible Devices

TP-Link **Kasa** devices with local control protocol support:

**Smart Plugs**: HS100, HS103, HS105, HS110, KP100, KP115, KP125, EP10, EP25
**Smart Switches**: HS200, HS210, HS220, KS200, KS220, KS230
**Smart Bulbs**: LB100-230 series, KL50, KL60, KL110-135 series
**Light Strips**: KL400, KL420, KL430
**Power Strips**: HS300, KP200, KP303, KP400

**Note**: Tapo and other TP-Link brands use different protocols and are not supported.

## Troubleshooting

**PyRunner not available**: Install PyRunner extension and restart SillyTavern
**Device not found**: Check IP address, ensure same network, allow port 9999 in firewall
**Discovery fails**: Use Network Scan or Manual Entry instead
**Commands not working**: Wait 10 seconds after page load, then reload if needed

## Technical Details

- Uses reverse-engineered TP-Link Smart Home Protocol (port 9999)
- XOR autokey encryption for device communication
- No cloud connection required
- No authentication needed for local control
- Based on [softScheck/tplink-smartplug](https://github.com/softScheck/tplink-smartplug)

## Credits

- **Author**: mechamarmot
- **Built with**: React 18, Webpack 5, Python

## License

Apache 2.0 License

---

**Made for the SillyTavern community**
