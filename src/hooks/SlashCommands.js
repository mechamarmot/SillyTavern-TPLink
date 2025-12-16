/**
 * SlashCommands.js - Registers slash commands for TP-Link device control
 *
 * Registers the following commands:
 * - /tplink-on <device-name> - Turn device on
 * - /tplink-off <device-name> - Turn device off
 * - /tplink-toggle <device-name> - Toggle device state
 * - /tplink-status - List all devices and their states
 */

/**
 * Wait for SillyTavern context to be available
 * @returns {Promise<object|null>}
 */
async function waitForSillyTavern() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 30 seconds total

        const checkInterval = setInterval(() => {
            attempts++;

            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const context = SillyTavern.getContext();
                if (context && context.SlashCommand && context.SlashCommandParser) {
                    console.log(`[SillyTPLink] SillyTavern context found after ${attempts} attempts`);
                    clearInterval(checkInterval);
                    resolve(context);
                    return;
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('[SillyTPLink] Timeout waiting for SillyTavern context after 30 seconds');
                resolve(null);
            }
        }, 300);
    });
}

/**
 * Find a device by name (case-insensitive)
 * @param {Array} devices - Array of device objects
 * @param {string} name - Device name to search for
 * @returns {object|null}
 */
function findDevice(devices, name) {
    const nameLower = name.toLowerCase().trim();
    return devices.find(d => d.name.toLowerCase() === nameLower) || null;
}

/**
 * Register TP-Link slash commands with SillyTavern
 * @param {Function} getDevices - Function that returns array of device objects
 * @param {Function} controlDevice - Function that controls a device: (ip, action) => Promise<boolean>
 */
export async function registerTPLinkCommands(getDevices, controlDevice) {
    console.log('[SillyTPLink] Registering slash commands...');

    // Wait for SillyTavern to be available
    const context = await waitForSillyTavern();

    if (!context) {
        console.error('[SillyTPLink] SillyTavern context not available, cannot register commands');
        return;
    }

    const { SlashCommand, SlashCommandParser } = context;

    // Command: /tplink-on <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-on',
        callback: async (args) => {
            try {
                const deviceName = args.toString().trim();

                if (!deviceName) {
                    return 'Error: Please specify a device name. Usage: /tplink-on <device-name>';
                }

                const devices = getDevices();
                if (!devices || devices.length === 0) {
                    return 'Error: No devices configured';
                }

                const device = findDevice(devices, deviceName);
                if (!device) {
                    return `Error: Device "${deviceName}" not found. Use /tplink-status to list devices.`;
                }

                const success = await controlDevice(device.ip, 'on');
                if (!success) {
                    return `Error: Failed to turn on "${device.name}"`;
                }

                return `✓ Turned on "${device.name}"`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-on error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'Turn on a TP-Link device. Usage: /tplink-on <device-name>',
        unnamedArgumentList: [
            SlashCommand.argument('device name', [SlashCommand.ARGUMENT_TYPE.STRING], true)
        ]
    }));

    // Command: /tplink-off <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-off',
        callback: async (args) => {
            try {
                const deviceName = args.toString().trim();

                if (!deviceName) {
                    return 'Error: Please specify a device name. Usage: /tplink-off <device-name>';
                }

                const devices = getDevices();
                if (!devices || devices.length === 0) {
                    return 'Error: No devices configured';
                }

                const device = findDevice(devices, deviceName);
                if (!device) {
                    return `Error: Device "${deviceName}" not found. Use /tplink-status to list devices.`;
                }

                const success = await controlDevice(device.ip, 'off');
                if (!success) {
                    return `Error: Failed to turn off "${device.name}"`;
                }

                return `✓ Turned off "${device.name}"`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-off error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'Turn off a TP-Link device. Usage: /tplink-off <device-name>',
        unnamedArgumentList: [
            SlashCommand.argument('device name', [SlashCommand.ARGUMENT_TYPE.STRING], true)
        ]
    }));

    // Command: /tplink-toggle <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-toggle',
        callback: async (args) => {
            try {
                const deviceName = args.toString().trim();

                if (!deviceName) {
                    return 'Error: Please specify a device name. Usage: /tplink-toggle <device-name>';
                }

                const devices = getDevices();
                if (!devices || devices.length === 0) {
                    return 'Error: No devices configured';
                }

                const device = findDevice(devices, deviceName);
                if (!device) {
                    return `Error: Device "${deviceName}" not found. Use /tplink-status to list devices.`;
                }

                // Toggle based on current state
                const newAction = device.state === 'on' ? 'off' : 'on';
                const success = await controlDevice(device.ip, newAction);
                if (!success) {
                    return `Error: Failed to toggle "${device.name}"`;
                }

                return `✓ Toggled "${device.name}" to ${newAction.toUpperCase()}`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-toggle error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'Toggle a TP-Link device on/off. Usage: /tplink-toggle <device-name>',
        unnamedArgumentList: [
            SlashCommand.argument('device name', [SlashCommand.ARGUMENT_TYPE.STRING], true)
        ]
    }));

    // Command: /tplink-status
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-status',
        callback: async () => {
            try {
                const devices = getDevices();

                if (!devices || devices.length === 0) {
                    return 'No TP-Link devices configured.';
                }

                // Build status list
                const statusLines = devices.map(d => {
                    const state = d.state === 'on' ? '● ON' : '○ OFF';
                    return `${state} | ${d.name} (${d.model}) - ${d.ip}`;
                });

                return `TP-Link Devices (${devices.length}):\n${statusLines.join('\n')}`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-status error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'List all TP-Link devices and their current states',
        unnamedArgumentList: []
    }));

    console.log('[SillyTPLink] Slash commands registered successfully');
}
