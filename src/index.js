import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerTPLinkMacros } from './hooks/MessageHooks';
import { registerTPLinkCommands } from './hooks/SlashCommands';

// Create the extension settings panel
function createSettingsPanel() {
    console.log('[SillyTPLink] Initializing extension...');

    // Create the inline settings HTML
    const settingsHTML = `
        <div id="tplink_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>SillyTPLink</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" id="tplink_container"></div>
            </div>
        </div>
    `;

    // Add to extensions settings panel
    const extensionsSettings = document.getElementById('extensions_settings');
    if (extensionsSettings) {
        console.log('[SillyTPLink] Found extensions_settings container');
        const settingsElement = document.createElement('div');
        settingsElement.innerHTML = settingsHTML;
        extensionsSettings.appendChild(settingsElement.firstElementChild);

        // Mount React app in the container
        const container = document.getElementById('tplink_container');
        if (container) {
            console.log('[SillyTPLink] Mounting React app...');
            const root = ReactDOM.createRoot(container);
            root.render(
                <React.StrictMode>
                    <App />
                </React.StrictMode>
            );
            console.log('[SillyTPLink] Extension initialized successfully');

            // Initialize hooks after a delay to ensure SillyTavern and tplinkExtension are ready
            setTimeout(() => {
                console.log('[SillyTPLink] Initializing hooks...');

                // Keep trying until tplinkExtension is available
                const initHooks = () => {
                    if (window.tplinkExtension) {
                        const { getDevices, controlDevice } = window.tplinkExtension;

                        // Register hooks (they will wait internally for SillyTavern systems)
                        registerTPLinkMacros(getDevices, controlDevice);
                        registerTPLinkCommands(getDevices, controlDevice);

                        console.log('[SillyTPLink] Hooks initialization started');
                    } else {
                        console.warn('[SillyTPLink] tplinkExtension not ready, retrying in 1 second...');
                        setTimeout(initHooks, 1000);
                    }
                };

                initHooks();
            }, 2000);
        } else {
            console.error('[SillyTPLink] Could not find tplink_container');
        }
    } else {
        console.error('[SillyTPLink] Could not find extensions_settings');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSettingsPanel);
} else {
    createSettingsPanel();
}
