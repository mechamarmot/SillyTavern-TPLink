/**
 * MessageHooks.js - Handles {{tplink-on:Device_Name}}, {{tplink-off:Device_Name}}, and {{tplink-cycle:Device_Name:seconds}} replacements
 *
 * Intercepts messages to find and replace device control macros:
 * {{tplink-on:Device_Name}} or {{tplink-off:Device Name}}
 *
 * The macros will:
 * 1. Actually control the device (turn it on or off)
 * 2. Replace themselves with status text: [Device Description ON], [Device Description OFF], or [Device Description CYCLED 5s]
 */

// Track processed messages to avoid reprocessing
const processedMessages = new WeakSet();

/**
 * Wait for SillyTavern context with eventSource to be available
 * @returns {Promise<object|null>}
 */
async function waitForContext() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 30 seconds total

        const checkInterval = setInterval(() => {
            attempts++;

            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const context = SillyTavern.getContext();
                if (context && context.eventSource && context.eventTypes) {
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
 * Process a message element for TPLink macros
 * @param {HTMLElement} mesElement - The message element
 * @param {Function} getDevices - Function that returns array of device objects
 * @param {Function} controlDevice - Function that controls a device
 */
async function processMessageElement(mesElement, getDevices, controlDevice) {
    // Skip if already processed
    if (processedMessages.has(mesElement)) return;

    // Find the text content
    let mesText = mesElement.querySelector('.mes_text .stle--content') || mesElement.querySelector('.mes_text');
    if (!mesText) return;

    const text = mesText.textContent || '';

    // Regex to match {{tplink-on:DeviceName}} or {{tplink-off:DeviceName}}
    const pattern = /\{\{tplink-(on|off|cycle):([^:}]+)(?::(\d+))?\}\}/gi;

    let match;
    const matches = [];
    while ((match = pattern.exec(text)) !== null) {
        matches.push({
            full: match[0],
            action: match[1].toLowerCase(),
            deviceName: match[2].trim(),
            duration: match[3] ? parseInt(match[3]) : null
        });
    }

    if (matches.length === 0) return;

    // Mark as processed BEFORE making changes
    processedMessages.add(mesElement);

    console.log(`[SillyTPLink] Found ${matches.length} TPLink macro(s) in message`);

    // Get message ID
    const mesId = mesElement.getAttribute('mesid');
    const context = SillyTavern.getContext();

    // Process each match
    for (const m of matches) {
        try {
            console.log(`[SillyTPLink] Processing macro: ${m.full} (action: ${m.action}, device: ${m.deviceName})`);

            // Get all devices
            const devices = getDevices();
            if (!devices || devices.length === 0) {
                console.warn('[SillyTPLink] No devices configured');
                continue;
            }

            // Find device by name (case-insensitive)
            const device = devices.find(d =>
                d.name.toLowerCase().trim() === m.deviceName.toLowerCase().trim()
            );

            if (!device) {
                console.error(`[SillyTPLink] Device "${m.deviceName}" not found`);
                continue;
            }

            let replacement;

            if (m.action === 'cycle') {
                // Cycle: turn on, wait, turn off
                const duration = m.duration || 5; // Default 5 seconds if not specified
                
                console.log(`[SillyTPLink] Cycling device "${device.name}" (${device.ip}) for ${duration} seconds`);
                
                // Turn on
                const onSuccess = await controlDevice(device.ip, 'on');
                if (!onSuccess) {
                    console.error(`[SillyTPLink] Failed to turn on device for cycle`);
                    continue;
                }
                
                // Wait for specified duration then turn off
                setTimeout(async () => {
                    console.log(`[SillyTPLink] Turning off device "${device.name}" after ${duration} seconds`);
                    await controlDevice(device.ip, 'off');
                }, duration * 1000);
                
                replacement = `[${device.description} CYCLED ${duration}s]`;
            } else {
                // Regular on/off control
                console.log(`[SillyTPLink] Controlling device "${device.name}" (${device.ip}) - turning ${m.action}`);
                
                const success = await controlDevice(device.ip, m.action);

                if (!success) {
                    console.error(`[SillyTPLink] Failed to control device`);
                    continue;
                }

                replacement = `[${device.description} ${m.action.toUpperCase()}]`;
            }
            
            console.log(`[SillyTPLink] Replacing "${m.full}" with "${replacement}"`);

            // Update the chat data
            if (context.chat && mesId !== null) {
                const msgIndex = parseInt(mesId);
                if (context.chat[msgIndex]) {
                    const originalMes = context.chat[msgIndex].mes;
                    const newMes = originalMes.replace(m.full, replacement);
                    if (newMes !== originalMes) {
                        context.chat[msgIndex].mes = newMes;

                        // Force re-render of this message
                        const mesTextEl = mesElement.querySelector('.mes_text');
                        if (mesTextEl) {
                            mesTextEl.innerHTML = newMes;
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[SillyTPLink] Error processing macro ${m.full}:`, error);
        }
    }
}

/**
 * Register message hooks to intercept and process TPLink macros
 * @param {Function} getDevices - Function that returns array of device objects
 * @param {Function} controlDevice - Function that controls a device: (ip, action) => Promise<boolean>
 */
export async function registerTPLinkMacros(getDevices, controlDevice) {
    console.log('[SillyTPLink] Registering message hooks for TPLink macros...');

    // Wait for context to be available
    const context = await waitForContext();

    if (!context) {
        console.error('[SillyTPLink] SillyTavern context not available, cannot register message hooks');
        return;
    }

    // Listen for user message events
    if (context.eventTypes.USER_MESSAGE_RENDERED) {
        context.eventSource.on(context.eventTypes.USER_MESSAGE_RENDERED, (messageId) => {
            console.log(`[SillyTPLink] USER_MESSAGE_RENDERED event for message ${messageId}`);
            // Use delay to let other extensions finish
            setTimeout(async () => {
                const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                if (mesElement) {
                    await processMessageElement(mesElement, getDevices, controlDevice);
                }
            }, 1000);
        });
    }

    // Listen for character message events
    if (context.eventTypes.CHARACTER_MESSAGE_RENDERED) {
        context.eventSource.on(context.eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            console.log(`[SillyTPLink] CHARACTER_MESSAGE_RENDERED event for message ${messageId}`);
            setTimeout(async () => {
                const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                if (mesElement) {
                    await processMessageElement(mesElement, getDevices, controlDevice);
                }
            }, 500);
        });
    }

    // Listen for generic message rendered events
    if (context.eventTypes.MESSAGE_RENDERED) {
        context.eventSource.on(context.eventTypes.MESSAGE_RENDERED, (messageId) => {
            console.log(`[SillyTPLink] MESSAGE_RENDERED event for message ${messageId}`);
            setTimeout(async () => {
                const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                if (mesElement) {
                    await processMessageElement(mesElement, getDevices, controlDevice);
                }
            }, 100);
        });
    }

    console.log('[SillyTPLink] Message hooks registered successfully');
}
