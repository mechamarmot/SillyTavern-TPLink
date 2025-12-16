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

    // Check if message is still streaming (has streaming class or is-typing)
    if (mesElement.classList.contains('streaming') || 
        mesElement.classList.contains('is-typing') ||
        mesElement.querySelector('.mes_text.streaming')) {
        console.log('[SillyTPLink] Message still streaming, skipping...');
        return;
    }

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

                console.log(`[SillyTPLink] CYCLE ACTION - Device: "${device.name}" (${device.ip}) for ${duration}s`);
                console.log(`[SillyTPLink] Calling controlDevice(${device.ip}, 'on')...`);

                // Turn on
                const onSuccess = await controlDevice(device.ip, 'on');
                console.log(`[SillyTPLink] Turn ON result: ${onSuccess}`);

                if (!onSuccess) {
                    console.error(`[SillyTPLink] FAILED to turn on device for cycle`);
                    continue;
                }

                // Emit cycle event for status display
                window.dispatchEvent(new CustomEvent('tplink:device:cycle', {
                    detail: {
                        deviceName: device.name,
                        deviceDescription: device.description,
                        ip: device.ip,
                        duration: duration
                    }
                }));

                console.log(`[SillyTPLink] Device turned ON successfully, will turn OFF in ${duration}s`);

                // Wait for specified duration then turn off
                setTimeout(async () => {
                    console.log(`[SillyTPLink] Turning off device "${device.name}" after ${duration} seconds`);
                    await controlDevice(device.ip, 'off');
                    // Note: controlDevice in App.js will emit the 'off' event, no need to duplicate
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

                // Note: controlDevice in App.js will emit the on/off event, no need to duplicate

                replacement = `[${device.description} ${m.action.toUpperCase()}]`;
            }
            
            console.log(`[SillyTPLink] Macro: "${m.full}" -> Visual: "${replacement}"`);

            // Update chat data and DOM separately
            if (context.chat && mesId !== null) {
                const msgIndex = parseInt(mesId);
                if (context.chat[msgIndex]) {
                    const originalMes = context.chat[msgIndex].mes;
                    
                    // Context: Strip macro entirely (AI never sees it or replacement)
                    const contextMes = originalMes.replace(m.full, '').replace(/\s+/g, ' ').trim();
                    
                    // Visual: Replace macro with visual feedback (user sees it)
                    const visualMes = originalMes.replace(m.full, replacement);
                    
                    if (contextMes !== originalMes || visualMes !== originalMes) {
                        // Update context WITHOUT the macro or replacement
                        context.chat[msgIndex].mes = contextMes;
                        const messageType = context.chat[msgIndex].is_user ? 'User' : 'AI';
                        console.log(`[SillyTPLink] ${messageType} context: "${contextMes}"`);
                        
                        // Update DOM WITH visual replacement
                        const mesTextEl = mesElement.querySelector('.mes_text');
                        if (mesTextEl) {
                            mesTextEl.innerHTML = visualMes;
                            console.log(`[SillyTPLink] Visual shown: "${visualMes}"`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[SillyTPLink] Error processing macro ${m.full}:`, error);
        }
    }
}


// Track macro-only messages that should not trigger generation
const macroOnlyMessages = new Set();

/**
 * Intercept generation to suppress AI response for macro-only messages
 */
function interceptUserInput(context) {
    console.log('[SillyTPLink] Setting up quiet action interceptor...');

    // Listen for MESSAGE_SENDING to mark macro-only messages
    if (context.eventSource && context.eventTypes?.MESSAGE_SENDING) {
        context.eventSource.on(context.eventTypes.MESSAGE_SENDING, (data) => {
            const messageText = data?.text || data?.message || '';

            // Check if message contains ONLY macros
            const macroPattern = /\{\{tplink-(on|off|cycle):[^:}]+(?::\d+)?\}\}/gi;
            const macros = messageText.match(macroPattern) || [];
            const textWithoutMacros = messageText.replace(macroPattern, '').trim();

            if (macros.length > 0 && textWithoutMacros === '') {
                console.log('[SillyTPLink] Macro-only message detected - marking for no generation');
                // Store the next message index that will be macro-only
                const nextIndex = context.chat ? context.chat.length : 0;
                macroOnlyMessages.add(nextIndex);
                console.log(`[SillyTPLink] Marked message index ${nextIndex} as macro-only`);
            }
        });
    }

    // Listen for USER_MESSAGE_RENDERED to check if we should suppress generation
    if (context.eventSource && context.eventTypes?.USER_MESSAGE_RENDERED) {
        context.eventSource.on(context.eventTypes.USER_MESSAGE_RENDERED, (messageId) => {
            // Check if this message was marked as macro-only
            if (macroOnlyMessages.has(messageId)) {
                console.log(`[SillyTPLink] Message ${messageId} is macro-only - will suppress generation`);

                // Use setTimeout to let the message process, then check if we should cancel generation
                setTimeout(() => {
                    // Get the processed message from chat
                    if (context.chat && context.chat[messageId]) {
                        const processedMes = context.chat[messageId].mes || '';

                        // If the message is now empty (macros were stripped), prevent generation
                        if (processedMes.trim() === '') {
                            console.log('[SillyTPLink] Message is empty after macro processing - canceling generation');

                            // Try to stop generation if it hasn't started yet
                            if (typeof context.stopGeneration === 'function') {
                                context.stopGeneration();
                            }

                            // Alternative: Set the abort flag if it exists
                            if (context.abortController) {
                                context.abortController.abort();
                            }

                            // Clean up the tracking set
                            macroOnlyMessages.delete(messageId);
                        }
                    }
                }, 1500); // Wait for macro processing to complete
            }
        });
    }

    // Hook into GENERATION_STARTED to prevent it for macro-only messages
    if (context.eventSource && context.eventTypes?.GENERATION_STARTED) {
        context.eventSource.on(context.eventTypes.GENERATION_STARTED, () => {
            // Check if the last user message was macro-only
            if (context.chat && context.chat.length > 0) {
                const lastMessage = context.chat[context.chat.length - 1];
                if (lastMessage.is_user && lastMessage.mes.trim() === '' && macroOnlyMessages.size > 0) {
                    console.log('[SillyTPLink] Canceling generation for macro-only message');

                    // Stop generation
                    if (typeof context.stopGeneration === 'function') {
                        context.stopGeneration();
                    }

                    // Clear tracking
                    macroOnlyMessages.clear();
                }
            }
        });
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
            
            // Retry multiple times to handle streaming
            const tryProcess = async (attempt = 1, maxAttempts = 3) => {
                const mesElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
                if (!mesElement) return;
                
                // Check if still streaming
                const isStreaming = mesElement.classList.contains('streaming') || 
                                   mesElement.classList.contains('is-typing') ||
                                   mesElement.querySelector('.mes_text.streaming');
                
                if (isStreaming && attempt < maxAttempts) {
                    console.log(`[SillyTPLink] Message ${messageId} still streaming, retry ${attempt}/${maxAttempts}`);
                    setTimeout(() => tryProcess(attempt + 1, maxAttempts), 2000);
                } else {
                    console.log(`[SillyTPLink] Processing message ${messageId} (attempt ${attempt})`);
                    await processMessageElement(mesElement, getDevices, controlDevice);
                }
            };
            
            setTimeout(() => tryProcess(), 1000);
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
            }, 500);
        });
    }

    // Set up quiet action interceptor to suppress AI response for macro-only messages
    interceptUserInput(context);

    console.log('[SillyTPLink] Message hooks registered successfully');
}
