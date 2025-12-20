/**
 * SlashCommands.js - Registers slash commands for TP-Link device control
 *
 * Registers the following commands:
 * - /tplink-on <device-name> - Turn device on
 * - /tplink-off <device-name> - Turn device off
 * - /tplink-toggle <device-name> - Toggle device state
 * - /tplink-cycle <device-name> <seconds> - Cycle device on for duration
 * - /tplink-stop <device-name> - Stop current cycle and clear queue
 * - /tplink-status - List all devices and their states
 */

// Cycle queue management - keyed by device IP
const cycleQueues = new Map(); // IP -> { running: boolean, queue: [], currentTimeout: null, controlDevice: null }

/**
 * Wait for SillyTavern slash command system to be available
 * @returns {Promise<object|null>}
 */
async function waitForSillyTavern() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 30 seconds total

        const checkInterval = setInterval(() => {
            attempts++;

            // Check for slash command system on SillyTavern context
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const context = SillyTavern.getContext();
                if (context && context.SlashCommand && context.SlashCommandParser) {
                    console.log(`[SillyTPLink] Slash command system found after ${attempts} attempts`);
                    clearInterval(checkInterval);
                    resolve(context);
                    return;
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('[SillyTPLink] Timeout waiting for slash command system after 30 seconds');
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
 * Get or create a cycle queue for a device
 * @param {string} ip - Device IP address
 * @returns {object} Queue state object
 */
function getCycleQueue(ip) {
    if (!cycleQueues.has(ip)) {
        cycleQueues.set(ip, {
            running: false,
            queue: [],
            currentTimeout: null,
            controlDevice: null
        });
    }
    return cycleQueues.get(ip);
}

/**
 * Emit queue update event for status display
 * @param {string} ip - Device IP address
 * @param {number} queueLength - Number of items in queue
 */
function emitQueueUpdate(ip, queueLength) {
    window.dispatchEvent(new CustomEvent('tplink:device:queueUpdate', {
        detail: { ip, queueLength }
    }));
}

/**
 * Process the next cycle in the queue
 * @param {string} ip - Device IP address
 * @param {object} device - Device object
 */
async function processNextCycle(ip, device) {
    const queueState = getCycleQueue(ip);

    if (queueState.queue.length === 0) {
        // No more cycles - turn off and mark as not running
        queueState.running = false;
        await queueState.controlDevice(ip, 'off');
        emitQueueUpdate(ip, 0);
        return;
    }

    // Get next cycle duration
    const duration = queueState.queue.shift();
    queueState.running = true;

    console.log(`[SillyTPLink] Processing cycle for "${device.name}": ${duration}s (${queueState.queue.length} remaining in queue)`);

    // Emit cycle event for status display
    window.dispatchEvent(new CustomEvent('tplink:device:cycle', {
        detail: {
            deviceName: device.name,
            deviceDescription: device.description,
            ip: ip,
            duration: duration,
            queueLength: queueState.queue.length
        }
    }));

    // Schedule next cycle or turn off
    queueState.currentTimeout = setTimeout(async () => {
        queueState.currentTimeout = null;
        await processNextCycle(ip, device);
    }, duration * 1000);
}

/**
 * Stop all cycles for a device and clear the queue
 * @param {string} ip - Device IP address
 * @param {Function} controlDevice - Device control function
 */
async function stopCycleQueue(ip, controlDevice) {
    const queueState = getCycleQueue(ip);

    // Clear the timeout
    if (queueState.currentTimeout) {
        clearTimeout(queueState.currentTimeout);
        queueState.currentTimeout = null;
    }

    // Clear the queue
    queueState.queue = [];
    queueState.running = false;

    // Turn off the device
    await controlDevice(ip, 'off');

    // Emit stop event for status display
    window.dispatchEvent(new CustomEvent('tplink:device:cycleStopped', {
        detail: { ip }
    }));

    emitQueueUpdate(ip, 0);
}

/**
 * Register TP-Link slash commands with SillyTavern
 * @param {Function} getDevices - Function that returns array of device objects
 * @param {Function} controlDevice - Function that controls a device: (ip, action) => Promise<boolean>
 */
export async function registerTPLinkCommands(getDevices, controlDevice) {
    console.log('[SillyTPLink] Registering slash commands...');

    // Wait for SillyTavern slash command system to be available
    const context = await waitForSillyTavern();

    if (!context) {
        console.error('[SillyTPLink] Slash command system not available, cannot register commands');
        return;
    }

    // Access slash command system from context
    const { SlashCommand, SlashCommandParser, SlashCommandArgument, ARGUMENT_TYPE } = context;

    console.log('[SillyTPLink] SlashCommand APIs:', {
        hasSlashCommand: !!SlashCommand,
        hasParser: !!SlashCommandParser,
        hasArgument: !!SlashCommandArgument,
        hasArgumentType: !!ARGUMENT_TYPE
    });

    try {
        // Command: /tplink-on <device-name>
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-on',
        callback: async (args, value) => {
            console.log('[SillyTPLink] /tplink-on called with:', { args, value });
            try {
                const deviceName = (value || args.toString()).trim();

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
            SlashCommandArgument.fromProps({
                description: 'device name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            })
        ]
    }));
    console.log('[SillyTPLink] Registered /tplink-on');

    // Command: /tplink-off <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-off',
        callback: async (args, value) => {
            console.log('[SillyTPLink] /tplink-off called with:', { args, value });
            try {
                const deviceName = (value || args.toString()).trim();

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
            SlashCommandArgument.fromProps({
                description: 'device name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            })
        ]
    }));
    console.log('[SillyTPLink] Registered /tplink-off');

    // Command: /tplink-toggle <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-toggle',
        callback: async (args, value) => {
            console.log('[SillyTPLink] /tplink-toggle called with:', { args, value });
            try {
                const deviceName = (value || args.toString()).trim();

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
            SlashCommandArgument.fromProps({
                description: 'device name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            })
        ]
    }));
    console.log('[SillyTPLink] Registered /tplink-toggle');

    // Command: /tplink-cycle <device-name> <seconds>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-cycle',
        callback: async (args, value) => {
            console.log('[SillyTPLink] /tplink-cycle called with:', { args, value });
            try {
                // Parse arguments: device name and duration
                const parts = (value || '').trim().split(/\s+/);

                if (parts.length < 2) {
                    return 'Error: Please specify device name and duration. Usage: /tplink-cycle <device-name> <seconds>';
                }

                const duration = parseInt(parts.pop()); // Last argument is duration
                const deviceName = parts.join(' '); // Rest is device name

                if (!deviceName) {
                    return 'Error: Please specify a device name. Usage: /tplink-cycle <device-name> <seconds>';
                }

                if (isNaN(duration) || duration <= 0) {
                    return 'Error: Duration must be a positive number. Usage: /tplink-cycle <device-name> <seconds>';
                }

                const devices = getDevices();
                if (!devices || devices.length === 0) {
                    return 'Error: No devices configured';
                }

                const device = findDevice(devices, deviceName);
                if (!device) {
                    return `Error: Device "${deviceName}" not found. Use /tplink-status to list devices.`;
                }

                // Get the queue state for this device
                const queueState = getCycleQueue(device.ip);
                queueState.controlDevice = controlDevice;

                // Check if a cycle is already running
                if (queueState.running) {
                    // Add to queue
                    queueState.queue.push(duration);
                    const queueLength = queueState.queue.length;

                    console.log(`[SillyTPLink] Queued cycle for "${device.name}": ${duration}s (${queueLength} in queue)`);

                    // Emit queue update event
                    emitQueueUpdate(device.ip, queueLength);

                    return `✓ Queued cycle for "${device.name}" (${duration}s) - ${queueLength} in queue`;
                }

                // No cycle running - start immediately
                queueState.running = true;

                // Turn on the device
                const onSuccess = await controlDevice(device.ip, 'on');
                if (!onSuccess) {
                    queueState.running = false;
                    return `Error: Failed to turn on "${device.name}"`;
                }

                // Emit cycle event for status display
                window.dispatchEvent(new CustomEvent('tplink:device:cycle', {
                    detail: {
                        deviceName: device.name,
                        deviceDescription: device.description,
                        ip: device.ip,
                        duration: duration,
                        queueLength: 0
                    }
                }));

                // Schedule next cycle or turn off
                queueState.currentTimeout = setTimeout(async () => {
                    queueState.currentTimeout = null;
                    await processNextCycle(device.ip, device);
                }, duration * 1000);

                return `✓ Cycling "${device.name}" for ${duration} seconds`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-cycle error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'Cycle a TP-Link device (turn on, wait, turn off). Queues additional cycles if one is running. Usage: /tplink-cycle <device-name> <seconds>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'device name and duration',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            })
        ]
    }));
    console.log('[SillyTPLink] Registered /tplink-cycle');

    // Command: /tplink-stop <device-name>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-stop',
        callback: async (args, value) => {
            console.log('[SillyTPLink] /tplink-stop called with:', { args, value });
            try {
                const deviceName = (value || args.toString()).trim();

                if (!deviceName) {
                    return 'Error: Please specify a device name. Usage: /tplink-stop <device-name>';
                }

                const devices = getDevices();
                if (!devices || devices.length === 0) {
                    return 'Error: No devices configured';
                }

                const device = findDevice(devices, deviceName);
                if (!device) {
                    return `Error: Device "${deviceName}" not found. Use /tplink-status to list devices.`;
                }

                const queueState = getCycleQueue(device.ip);
                const wasRunning = queueState.running;
                const queuedCount = queueState.queue.length;

                // Stop the cycle and clear queue
                await stopCycleQueue(device.ip, controlDevice);

                if (!wasRunning && queuedCount === 0) {
                    return `No active cycle for "${device.name}"`;
                }

                const clearedMsg = queuedCount > 0 ? ` (cleared ${queuedCount} queued)` : '';
                return `✓ Stopped cycle for "${device.name}"${clearedMsg}`;
            } catch (error) {
                console.error('[SillyTPLink] /tplink-stop error:', error);
                return `Error: ${error.message}`;
            }
        },
        helpString: 'Stop the current cycle and clear the queue for a TP-Link device. Usage: /tplink-stop <device-name>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'device name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            })
        ]
    }));
    console.log('[SillyTPLink] Registered /tplink-stop');

    // Command: /tplink-status
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tplink-status',
        callback: async (args) => {
            console.log('[SillyTPLink] /tplink-status called');
            try {
                const devices = getDevices();
                console.log('[SillyTPLink] Got devices:', devices);

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
    console.log('[SillyTPLink] Registered /tplink-status');

    console.log('[SillyTPLink] All slash commands registered successfully');
    } catch (error) {
        console.error('[SillyTPLink] Error registering slash commands:', error);
        console.error('[SillyTPLink] Stack trace:', error.stack);
    }
}
