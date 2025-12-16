/**
 * MessageHooks.js - Handles {{tplink-on:Device_Name}} and {{tplink-off:Device_Name}} replacements
 *
 * Intercepts messages to find and replace device control macros:
 * {{tplink-on:Device_Name}} or {{tplink-off:Device Name}}
 *
 * The macros will:
 * 1. Actually control the device (turn it on or off)
 * 2. Replace themselves with status text: [Device Description ON] or [Device Description OFF]
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
    const pattern = /\{\{tplink-(on|off):([^}]+)\}\}/gi;

    let match;
    const matches = [];
    while ((match = pattern.exec(text)) !== null) {
        matches.push({
            full: match[0],
            action: match[1].toLowerCase(),
            deviceName: match[2].trim()
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

            console.log(`[SillyTPLink] Controlling device "${device.name}" (${device.ip}) - turning ${m.action}`);

            // Control the device
            const success = await controlDevice(device.ip, m.action);

            if (!success) {
                console.error(`[SillyTPLink] Failed to control device`);
                continue;
            }

            // Create replacement text using device description
            const replacement = `[${device.description} ${m.action.toUpperCase()}]`;
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
