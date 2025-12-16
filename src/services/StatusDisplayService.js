/**
 * StatusDisplayService.js
 * Manages a global status display for TPLink devices
 * Shows multiple devices stacked vertically with independent states and timers
 */

class StatusDisplayService {
    constructor() {
        this.container = null;
        this.deviceMap = new Map(); // Key: IP address, Value: device state object
        this.eventHandlers = {};
        this.enabled = true; // Enabled by default
    }

    /**
     * Initialize the service - create DOM, attach listeners
     */
    init() {
        console.log('[SillyTPLink StatusDisplay] Initializing...');

        // Create container element
        this.container = document.createElement('div');
        this.container.id = 'tplink-status-container';
        this.container.className = 'tplink-status-hidden'; // Start hidden

        // Inject into body
        document.body.appendChild(this.container);

        // Attach event listeners
        this.attachEventListeners();

        console.log('[SillyTPLink StatusDisplay] Initialized successfully');
    }

    /**
     * Attach event listeners for device control events
     */
    attachEventListeners() {
        this.eventHandlers.on = (e) => {
            const { ip, deviceDescription, deviceName } = e.detail;
            console.log(`[SillyTPLink StatusDisplay] ✅ Received ON event:`, {
                ip,
                deviceName,
                deviceDescription,
                currentDevicesInMap: Array.from(this.deviceMap.keys())
            });
            this.addOrUpdateDevice(ip, deviceDescription, 'on', null);
        };

        this.eventHandlers.off = (e) => {
            const { ip, deviceDescription, deviceName } = e.detail;
            console.log(`[SillyTPLink StatusDisplay] ⭕ Received OFF event:`, {
                ip,
                deviceName,
                deviceDescription,
                currentDevicesInMap: Array.from(this.deviceMap.keys())
            });
            this.addOrUpdateDevice(ip, deviceDescription, 'off', null);
        };

        this.eventHandlers.cycle = (e) => {
            const { ip, deviceDescription, deviceName, duration } = e.detail;
            console.log(`[SillyTPLink StatusDisplay] 🔄 Received CYCLE event:`, {
                ip,
                deviceName,
                deviceDescription,
                duration,
                currentDevicesInMap: Array.from(this.deviceMap.keys())
            });
            this.addOrUpdateDevice(ip, deviceDescription, 'cycle', duration);
            this.startDeviceCountdown(ip, duration);
        };

        this.eventHandlers.toggle = (e) => {
            const { enabled } = e.detail;
            console.log(`[SillyTPLink StatusDisplay] Status box toggle: ${enabled}`);
            this.setEnabled(enabled);
        };

        window.addEventListener('tplink:device:on', this.eventHandlers.on);
        window.addEventListener('tplink:device:off', this.eventHandlers.off);
        window.addEventListener('tplink:device:cycle', this.eventHandlers.cycle);
        window.addEventListener('tplink:statusbox:toggle', this.eventHandlers.toggle);

        console.log('[SillyTPLink StatusDisplay] Event listeners attached for: on, off, cycle, toggle');
    }

    /**
     * Add a new device or update existing device state
     * @param {string} ip - Device IP address
     * @param {string} deviceDescription - Device description to display
     * @param {string} status - 'on' | 'off' | 'cycle'
     * @param {number|null} duration - Duration for cycle in seconds
     */
    addOrUpdateDevice(ip, deviceDescription, status, duration) {
        // Check if device already exists
        const existingDevice = this.deviceMap.get(ip);

        if (existingDevice) {
            console.log(`[SillyTPLink StatusDisplay] 🔄 Updating existing device:`, {
                ip,
                oldStatus: existingDevice.status,
                newStatus: status,
                oldDescription: existingDevice.description,
                newDescription: deviceDescription
            });

            // Clear existing timer if any
            this.clearDeviceTimer(ip);

            // Update device state
            existingDevice.description = deviceDescription;
            existingDevice.status = status;
            existingDevice.countdown = duration;
        } else {
            console.log(`[SillyTPLink StatusDisplay] ➕ Creating new device:`, {
                ip,
                description: deviceDescription,
                status,
                duration
            });

            // Create new device state
            this.deviceMap.set(ip, {
                ip: ip,
                description: deviceDescription,
                status: status,
                countdown: duration,
                timerInterval: null
            });
        }

        console.log(`[SillyTPLink StatusDisplay] Device map now has ${this.deviceMap.size} device(s):`, Array.from(this.deviceMap.keys()));

        // Re-render the device row
        this.renderDevice(ip);

        // Show container if hidden
        this.showContainer();
    }

    /**
     * Remove a device from the map and DOM
     * @param {string} ip - Device IP address
     */
    removeDevice(ip) {
        console.log(`[SillyTPLink StatusDisplay] Removing device ${ip}`);

        // Clear device timer
        this.clearDeviceTimer(ip);

        // Remove from map
        this.deviceMap.delete(ip);

        // Remove DOM element
        const row = this.container.querySelector(`.tplink-device-row[data-ip="${ip}"]`);
        if (row) {
            row.remove();
        }

        // Hide container if no devices left
        if (this.deviceMap.size === 0) {
            this.hideContainer();
        }
    }

    /**
     * Start countdown timer for a cycling device
     * @param {string} ip - Device IP address
     * @param {number} duration - Duration in seconds
     */
    startDeviceCountdown(ip, duration) {
        const device = this.deviceMap.get(ip);
        if (!device) return;

        // Clear existing timer if any
        this.clearDeviceTimer(ip);

        let remaining = duration;
        device.countdown = remaining;

        // Update display immediately
        this.updateDeviceDisplay(ip);

        // Start interval
        device.timerInterval = setInterval(() => {
            remaining--;
            device.countdown = remaining;

            if (remaining <= 0) {
                // Countdown complete - transition to OFF
                console.log(`[SillyTPLink StatusDisplay] Cycle complete for ${device.description}`);
                this.clearDeviceTimer(ip);
                device.status = 'off';
                device.countdown = null;
            }

            // Update display
            this.updateDeviceDisplay(ip);
        }, 1000);
    }

    /**
     * Clear countdown timer for a device
     * @param {string} ip - Device IP address
     */
    clearDeviceTimer(ip) {
        const device = this.deviceMap.get(ip);
        if (device && device.timerInterval) {
            clearInterval(device.timerInterval);
            device.timerInterval = null;
        }
    }

    /**
     * Render or update a device row in the DOM
     * @param {string} ip - Device IP address
     */
    renderDevice(ip) {
        const device = this.deviceMap.get(ip);
        if (!device) return;

        // Check if row already exists
        let row = this.container.querySelector(`.tplink-device-row[data-ip="${ip}"]`);

        if (!row) {
            // Create new row
            row = document.createElement('div');
            row.className = 'tplink-device-row';
            row.setAttribute('data-ip', ip);

            // Create dot
            const dot = document.createElement('span');
            dot.className = 'tplink-status-dot';
            row.appendChild(dot);

            // Create text
            const text = document.createElement('span');
            text.className = 'tplink-status-text';
            row.appendChild(text);

            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'tplink-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                if (device.status === 'off') {
                    this.removeDevice(ip);
                }
            });
            row.appendChild(removeBtn);

            // Add to container
            this.container.appendChild(row);
        }

        // Update display
        this.updateDeviceDisplay(ip);
    }

    /**
     * Update the display for a device row
     * @param {string} ip - Device IP address
     */
    updateDeviceDisplay(ip) {
        const device = this.deviceMap.get(ip);
        if (!device) return;

        const row = this.container.querySelector(`.tplink-device-row[data-ip="${ip}"]`);
        if (!row) return;

        const dot = row.querySelector('.tplink-status-dot');
        const text = row.querySelector('.tplink-status-text');
        const removeBtn = row.querySelector('.tplink-remove-btn');

        // Update dot status class
        dot.className = 'tplink-status-dot';
        dot.classList.add(`status-${device.status}`);

        // Update text
        if (device.status === 'cycle' && device.countdown !== null) {
            text.textContent = `${device.description} ${device.countdown}s`;
        } else {
            text.textContent = `${device.description} ${device.status.toUpperCase()}`;
        }

        // Update remove button state (only enabled when OFF)
        removeBtn.disabled = device.status !== 'off';
    }

    /**
     * Enable or disable the status display
     * @param {boolean} enabled - Whether to enable the display
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            // If we have devices, show the container
            if (this.deviceMap.size > 0) {
                this.showContainer();
            }
        } else {
            // Hide the container
            this.hideContainer();
        }
    }

    /**
     * Show the container
     */
    showContainer() {
        if (this.container && this.enabled && this.deviceMap.size > 0) {
            this.container.className = 'tplink-status-visible';
        }
    }

    /**
     * Hide the container
     */
    hideContainer() {
        if (this.container) {
            this.container.className = 'tplink-status-hidden';
        }
    }

    /**
     * Cleanup - remove DOM, clear timers, remove listeners
     */
    destroy() {
        console.log('[SillyTPLink StatusDisplay] Destroying...');

        // Clear all device timers
        for (const [ip, device] of this.deviceMap) {
            if (device.timerInterval) {
                clearInterval(device.timerInterval);
            }
        }

        // Clear device map
        this.deviceMap.clear();

        // Remove event listeners
        if (this.eventHandlers.on) {
            window.removeEventListener('tplink:device:on', this.eventHandlers.on);
        }
        if (this.eventHandlers.off) {
            window.removeEventListener('tplink:device:off', this.eventHandlers.off);
        }
        if (this.eventHandlers.cycle) {
            window.removeEventListener('tplink:device:cycle', this.eventHandlers.cycle);
        }
        if (this.eventHandlers.toggle) {
            window.removeEventListener('tplink:statusbox:toggle', this.eventHandlers.toggle);
        }

        // Remove DOM element
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;

        console.log('[SillyTPLink StatusDisplay] Destroyed');
    }
}

// Export singleton instance
const statusDisplayService = new StatusDisplayService();
export default statusDisplayService;
