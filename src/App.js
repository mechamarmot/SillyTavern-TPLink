/* global SillyTavern */
import React, { useState, useEffect, useRef } from 'react';
import DeviceList from './components/DeviceList';
import AddDevice from './components/AddDevice';
import PyRunnerService from './services/PyRunnerService';
import './styles.css';

function App() {
    const [devices, setDevices] = useState([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [error, setError] = useState(null);
    const [pyRunnerAvailable, setPyRunnerAvailable] = useState(false);
    const [showStatusBox, setShowStatusBox] = useState(true);

    // Load saved devices from extension settings
    useEffect(() => {
        loadDevices();
        checkPyRunnerAvailability();
        loadSettings();
    }, []);

    // Reload devices when component becomes visible or settings change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('[SillyTPLink] Page visible, reloading devices...');
                loadDevices();
            }
        };

        const handleFocus = () => {
            console.log('[SillyTPLink] Window focused, reloading devices...');
            loadDevices();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const checkPyRunnerAvailability = async () => {
        console.log('[SillyTPLink] Checking PyRunner availability...');

        // Check if PyRunner is available
        try {
            console.log('[SillyTPLink] Checking PyRunner status...');
            const response = await fetch('/api/plugins/pyrunner/status');

            console.log('[SillyTPLink] Response status:', response.status, response.statusText);

            if (!response.ok) {
                console.error('[SillyTPLink] PyRunner not responding:', response.status);
                setPyRunnerAvailable(false);
                setError('PyRunner plugin is not installed or enabled. Please install PyRunner.');
                return;
            }

            const result = await response.json();
            console.log('[SillyTPLink] PyRunner status:', result);

            if (result.status === 'ok') {
                console.log('[SillyTPLink] PyRunner is available! Creating tplink venv...');

                // Ensure the tplink venv exists
                const venvCreated = await PyRunnerService.ensureVenv();

                if (venvCreated) {
                    console.log('[SillyTPLink] tplink venv ready!');
                    setPyRunnerAvailable(true);
                    setError(null);
                } else {
                    console.error('[SillyTPLink] Failed to create tplink venv');
                    setPyRunnerAvailable(false);
                    setError('Failed to create Python virtual environment for SillyTPLink.');
                }
            } else {
                console.error('[SillyTPLink] PyRunner returned unexpected status');
                setPyRunnerAvailable(false);
                setError('PyRunner is not responding correctly.');
            }
        } catch (err) {
            console.error('[SillyTPLink] Error checking PyRunner:', err);
            setPyRunnerAvailable(false);
            setError('PyRunner plugin is not available. Please install and enable PyRunner.');
        }
    };

    const loadDevices = () => {
        console.log('[SillyTPLink] Loading devices from settings...');
        const context = SillyTavern.getContext();
        const extensionSettings = context.extensionSettings || {};
        const tplinkSettings = extensionSettings.tplink || { devices: [] };
        console.log('[SillyTPLink] Loaded devices:', tplinkSettings.devices);
        setDevices(tplinkSettings.devices || []);
    };

    const saveDevices = (newDevices) => {
        console.log('[SillyTPLink] Saving devices:', newDevices);
        const context = SillyTavern.getContext();
        context.extensionSettings = context.extensionSettings || {};
        context.extensionSettings.tplink = context.extensionSettings.tplink || {};
        context.extensionSettings.tplink.devices = newDevices;
        console.log('[SillyTPLink] Settings to save:', context.extensionSettings.tplink);
        context.saveSettingsDebounced();
        setDevices(newDevices);
        console.log('[SillyTPLink] Devices saved and state updated');
    };

    const loadSettings = () => {
        console.log('[SillyTPLink] Loading settings...');
        const context = SillyTavern.getContext();
        const extensionSettings = context.extensionSettings || {};
        const tplinkSettings = extensionSettings.tplink || {};
        const showStatus = tplinkSettings.showStatusBox !== undefined ? tplinkSettings.showStatusBox : true;
        console.log('[SillyTPLink] Show status box:', showStatus);
        setShowStatusBox(showStatus);
    };

    const handleStatusBoxToggle = (event) => {
        const newValue = event.target.checked;
        console.log('[SillyTPLink] Status box toggle:', newValue);
        setShowStatusBox(newValue);

        // Save to settings
        const context = SillyTavern.getContext();
        context.extensionSettings = context.extensionSettings || {};
        context.extensionSettings.tplink = context.extensionSettings.tplink || {};
        context.extensionSettings.tplink.showStatusBox = newValue;
        context.saveSettingsDebounced();

        // Emit event for StatusDisplayService
        window.dispatchEvent(new CustomEvent('tplink:statusbox:toggle', {
            detail: { enabled: newValue }
        }));
    };

    const sanitizeDeviceName = (name) => {
        // Replace spaces with underscores
        let sanitized = name.replace(/\s+/g, '_');
        // Remove all non-alphanumeric characters except underscores
        sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');
        // Ensure it's not empty
        if (!sanitized) {
            sanitized = 'Device_' + Date.now();
        }
        return sanitized;
    };

    const validateDeviceName = (name) => {
        // Must be alphanumeric + underscores only, no spaces or special chars
        const validPattern = /^[a-zA-Z0-9_]+$/;
        return validPattern.test(name);
    };

    const addDevice = async (ip, name) => {
        try {
            // Get device info first
            const info = await PyRunnerService.getDeviceInfo(ip);

            if (info.error) {
                setError(`Failed to connect to device: ${info.error}`);
                return false;
            }

            const sysInfo = info.system?.get_sysinfo || {};
            const originalName = sysInfo.alias || sysInfo.dev_name || ip;

            // Sanitize the device name (replace spaces with underscores, remove special chars)
            const rawName = name || originalName;
            const deviceName = sanitizeDeviceName(rawName);

            console.log(`[SillyTPLink] Sanitized device name: "${rawName}" -> "${deviceName}"`);

            const newDevice = {
                id: Date.now(),
                ip,
                name: deviceName, // User-editable alias
                originalName: originalName, // Actual TP-Link device name
                model: sysInfo.model || 'Unknown',
                state: sysInfo.relay_state === 1 ? 'on' : 'off',
                hasEmeter: sysInfo.feature?.includes('ENE') || false,
                description: 'Generic Device'
            };

            // Use functional state update to avoid closure issues
            let deviceAdded = false;
            setDevices(prevDevices => {
                // Check for duplicate IP using current state
                const existingDeviceByIp = prevDevices.find(d => d.ip === ip);
                if (existingDeviceByIp) {
                    setError(`Device with IP ${ip} already exists (${existingDeviceByIp.name}). Cannot add duplicate IP addresses.`);
                    return prevDevices; // Return unchanged
                }

                // Check for duplicate name
                const existingDeviceByName = prevDevices.find(d => d.name.toLowerCase() === deviceName.toLowerCase());
                if (existingDeviceByName) {
                    setError(`Device with name "${deviceName}" already exists. Please choose a different name.`);
                    return prevDevices; // Return unchanged
                }

                const updatedDevices = [...prevDevices, newDevice];

                // Save to settings
                const context = SillyTavern.getContext();
                context.extensionSettings = context.extensionSettings || {};
                context.extensionSettings.tplink = context.extensionSettings.tplink || {};
                context.extensionSettings.tplink.devices = updatedDevices;
                context.saveSettingsDebounced();

                deviceAdded = true;
                return updatedDevices;
            });

            if (deviceAdded) {
                setError(null);
                return true;
            }
            return false;
        } catch (err) {
            setError(`Error adding device: ${err.message}`);
            return false;
        }
    };

    const removeDevice = (deviceId) => {
        setDevices(prevDevices => {
            const updatedDevices = prevDevices.filter(d => d.id !== deviceId);

            // Save to settings
            const context = SillyTavern.getContext();
            context.extensionSettings = context.extensionSettings || {};
            context.extensionSettings.tplink = context.extensionSettings.tplink || {};
            context.extensionSettings.tplink.devices = updatedDevices;
            context.saveSettingsDebounced();

            return updatedDevices;
        });
    };

    const updateDeviceDescription = (deviceId, newDescription) => {
        setDevices(prevDevices => {
            const updatedDevices = prevDevices.map(d =>
                d.id === deviceId ? { ...d, description: newDescription } : d
            );

            // Save to settings
            const context = SillyTavern.getContext();
            context.extensionSettings = context.extensionSettings || {};
            context.extensionSettings.tplink = context.extensionSettings.tplink || {};
            context.extensionSettings.tplink.devices = updatedDevices;
            context.saveSettingsDebounced();

            return updatedDevices;
        });
    };

    const updateDeviceName = (deviceId, newName) => {
        // Validate name format
        if (!validateDeviceName(newName)) {
            setError(`Invalid device name "${newName}". Names must contain only letters, numbers, and underscores (no spaces or special characters).`);
            return false;
        }

        let nameUpdated = false;
        setDevices(prevDevices => {
            // Check for duplicate name (excluding the device being renamed)
            const existingDevice = prevDevices.find(d =>
                d.id !== deviceId && d.name.toLowerCase() === newName.toLowerCase()
            );

            if (existingDevice) {
                setError(`Device with name "${newName}" already exists. Please choose a different name.`);
                return prevDevices; // Return unchanged
            }

            const updatedDevices = prevDevices.map(d =>
                d.id === deviceId ? { ...d, name: newName } : d
            );

            // Save to settings
            const context = SillyTavern.getContext();
            context.extensionSettings = context.extensionSettings || {};
            context.extensionSettings.tplink = context.extensionSettings.tplink || {};
            context.extensionSettings.tplink.devices = updatedDevices;
            context.saveSettingsDebounced();

            nameUpdated = true;
            return updatedDevices;
        });

        if (nameUpdated) {
            setError(null);
        }
        return nameUpdated;
    };

    const discoverDevices = async () => {
        if (!pyRunnerAvailable) {
            setError('PyRunner is not available');
            return;
        }

        setIsDiscovering(true);
        setError(null);

        try {
            const result = await PyRunnerService.discoverDevices();

            if (result.error) {
                setError(`Discovery failed: ${result.error}`);
                setIsDiscovering(false);
                return;
            }

            const discoveredIps = result.devices || [];

            if (discoveredIps.length === 0) {
                setError('No devices found on network');
                setIsDiscovering(false);
                return;
            }

            // Add discovered devices that aren't already in the list
            const existingIps = devices.map(d => d.ip);
            const newIps = discoveredIps.filter(ip => !existingIps.includes(ip));

            for (const ip of newIps) {
                await addDevice(ip);
            }

            setError(null);
        } catch (err) {
            setError(`Discovery error: ${err.message}`);
        }

        setIsDiscovering(false);
    };

    const scanNetwork = async () => {
        if (!pyRunnerAvailable) {
            setError('PyRunner is not available');
            return;
        }

        setError(null);

        try {
            console.log('[SillyTPLink] Scanning network for Kasa devices...');
            const result = await PyRunnerService.scanNetwork();

            console.log('[SillyTPLink] Network scan result:', result);

            if (result.error) {
                setError(`Network scan failed: ${result.error}`);
                alert(`Scan failed\n\nError: ${result.error}`);
            } else {
                const kasaDevices = result.kasa_devices || [];
                const otherDevices = result.other_devices || [];

                let message = `Scan complete!\n\n`;
                if (kasaDevices.length > 0) {
                    message += `Found ${kasaDevices.length} Kasa device(s):\n${kasaDevices.join('\n')}\n\n`;
                    message += `You can now manually add these devices by IP.`;
                    setError(`Found ${kasaDevices.length} Kasa device(s) - check alert for IPs`);
                } else if (otherDevices.length > 0) {
                    message += `Found ${otherDevices.length} device(s) with port 9999 open, but they're not responding as Kasa devices.\n\n`;
                    message += `IPs: ${otherDevices.join(', ')}`;
                    setError('Found devices with port 9999 open, but not Kasa devices');
                } else {
                    message += `No devices found with port 9999 open on your network.\n\n`;
                    message += `Your Kasa devices may have firmware that disabled the local API.`;
                    setError('No devices found with port 9999 open');
                }

                alert(message);
            }
        } catch (err) {
            console.error('[SillyTPLink] Network scan error:', err);
            setError(`Scan error: ${err.message}`);
        }
    };

    const updateDeviceState = async (deviceId, newState) => {
        try {
            // First, find the device to get its IP and info
            let deviceIp = null;
            let deviceInfo = null;
            setDevices(prevDevices => {
                const device = prevDevices.find(d => d.id === deviceId);
                if (device) {
                    deviceIp = device.ip;
                    deviceInfo = device;
                }
                return prevDevices; // No change yet
            });

            if (!deviceIp) return;

            // Call PyRunner with the device IP
            const result = newState === 'on'
                ? await PyRunnerService.turnOn(deviceIp)
                : await PyRunnerService.turnOff(deviceIp);

            if (result.error) {
                setError(`Failed to control device: ${result.error}`);
                return;
            }

            // Update device state
            setDevices(prevDevices => {
                const updatedDevices = prevDevices.map(d =>
                    d.id === deviceId ? { ...d, state: newState } : d
                );

                // Save to settings
                const context = SillyTavern.getContext();
                context.extensionSettings = context.extensionSettings || {};
                context.extensionSettings.tplink = context.extensionSettings.tplink || {};
                context.extensionSettings.tplink.devices = updatedDevices;
                context.saveSettingsDebounced();

                return updatedDevices;
            });

            // Emit event for status display (using captured device info)
            if (deviceInfo) {
                console.log(`[SillyTPLink] Emitting ${newState} event for UI button: ${deviceInfo.name} (${deviceInfo.description}) at ${deviceInfo.ip}`);
                window.dispatchEvent(new CustomEvent(`tplink:device:${newState}`, {
                    detail: {
                        deviceName: deviceInfo.name,
                        deviceDescription: deviceInfo.description,
                        ip: deviceInfo.ip
                    }
                }));
            }

            setError(null);
        } catch (err) {
            setError(`Error controlling device: ${err.message}`);
        }
    };

    const refreshDeviceState = async (deviceId) => {
        try {
            // First, find the device to get its IP
            let deviceIp = null;
            setDevices(prevDevices => {
                const device = prevDevices.find(d => d.id === deviceId);
                if (device) {
                    deviceIp = device.ip;
                }
                return prevDevices; // No change yet
            });

            if (!deviceIp) return;

            // Get device info from PyRunner
            const info = await PyRunnerService.getDeviceInfo(deviceIp);

            if (info.error) {
                setError(`Failed to get device info: ${info.error}`);
                return;
            }

            const sysInfo = info.system?.get_sysinfo || {};
            const originalName = sysInfo.alias || sysInfo.dev_name || deviceIp;
            const newState = sysInfo.relay_state === 1 ? 'on' : 'off';

            // Update device state and sync original name
            setDevices(prevDevices => {
                const updatedDevices = prevDevices.map(d =>
                    d.id === deviceId ? {
                        ...d,
                        state: newState,
                        originalName: originalName, // Sync the actual device name
                        model: sysInfo.model || d.model
                    } : d
                );

                // Save to settings
                const context = SillyTavern.getContext();
                context.extensionSettings = context.extensionSettings || {};
                context.extensionSettings.tplink = context.extensionSettings.tplink || {};
                context.extensionSettings.tplink.devices = updatedDevices;
                context.saveSettingsDebounced();

                return updatedDevices;
            });

            setError(null);
        } catch (err) {
            setError(`Error getting device state: ${err.message}`);
        }
    };

    // Export device access helpers for macro and slash command hooks
    // Use useRef to avoid recreating functions on every render
    const devicesRef = useRef(devices);

    useEffect(() => {
        devicesRef.current = devices;
    }, [devices]);

    useEffect(() => {
        window.tplinkExtension = {
            // Get all devices - always returns current state via ref
            getDevices: () => devicesRef.current,

            // Control a device by IP address
            controlDevice: async (ip, action) => {
                try {
                    console.log(`[SillyTPLink] 🎮 controlDevice called:`, { ip, action });

                    // Find device FIRST using ref (always current state)
                    const currentDevices = devicesRef.current;
                    console.log(`[SillyTPLink] 🔍 Looking for device with IP ${ip} in:`, currentDevices.map(d => ({ name: d.name, ip: d.ip })));

                    const deviceInfo = currentDevices.find(d => d.ip === ip);

                    if (deviceInfo) {
                        console.log(`[SillyTPLink] ✅ Found device:`, {
                            name: deviceInfo.name,
                            description: deviceInfo.description,
                            ip: deviceInfo.ip
                        });
                    } else {
                        console.error(`[SillyTPLink] ❌ Device with IP ${ip} NOT FOUND in state!`);
                        return false;
                    }

                    // Call appropriate PyRunner service method
                    const result = action === 'on'
                        ? await PyRunnerService.turnOn(ip)
                        : await PyRunnerService.turnOff(ip);

                    if (result.error) {
                        console.error(`[SillyTPLink] ❌ Control failed:`, result.error);
                        return false;
                    }

                    console.log(`[SillyTPLink] ✅ PyRunner ${action} succeeded for ${ip}`);

                    // Update local device state
                    setDevices(prevDevices => {
                        const updatedDevices = prevDevices.map(d =>
                            d.ip === ip ? { ...d, state: action } : d
                        );

                        // Save to settings
                        const context = SillyTavern.getContext();
                        context.extensionSettings = context.extensionSettings || {};
                        context.extensionSettings.tplink = context.extensionSettings.tplink || {};
                        context.extensionSettings.tplink.devices = updatedDevices;
                        context.saveSettingsDebounced();

                        return updatedDevices;
                    });

                    // Emit custom event for status display
                    const eventData = {
                        deviceName: deviceInfo.name,
                        deviceDescription: deviceInfo.description,
                        ip: deviceInfo.ip
                    };
                    console.log(`[SillyTPLink] 📡 Emitting tplink:device:${action} event:`, eventData);
                    window.dispatchEvent(new CustomEvent(`tplink:device:${action}`, {
                        detail: eventData
                    }));
                    console.log(`[SillyTPLink] 📡 Event emitted successfully`);

                    console.log(`[SillyTPLink] ✅ Device ${ip} turned ${action} - operation complete`);
                    return true;
                } catch (err) {
                    console.error(`[SillyTPLink] ❌ Error controlling device:`, err);
                    return false;
                }
            },

            // Update device description
            updateDescription: (deviceId, description) => {
                updateDeviceDescription(deviceId, description);
            },

            // Update device name
            updateName: (deviceId, name) => {
                updateDeviceName(deviceId, name);
            }
        };

        console.log('[SillyTPLink] Device access helpers exported to window.tplinkExtension');
    }, []); // Empty dependency array - functions created once, access devices via ref

    return (
        <div className="tplink-extension">
            <div className="tplink-header">
                <h3>SillyTPLink - TP-Link Smart Home Control</h3>
            </div>

            <div className="tplink-settings-row">
                <label className="tplink-checkbox-label">
                    <input
                        type="checkbox"
                        checked={showStatusBox}
                        onChange={handleStatusBoxToggle}
                        className="tplink-checkbox"
                    />
                    <span>Display Device Status Box</span>
                </label>
            </div>

            {error && (
                <div className="tplink-error">
                    {error}
                    <button onClick={() => setError(null)} className="error-close">×</button>
                </div>
            )}

            {!pyRunnerAvailable && (
                <div className="tplink-warning">
                    PyRunner extension is required for SillyTPLink to work.
                    Please install and enable the PyRunner extension.
                </div>
            )}

            <AddDevice
                onAddDevice={addDevice}
                onDiscover={discoverDevices}
                onScanNetwork={scanNetwork}
                isDiscovering={isDiscovering}
                disabled={!pyRunnerAvailable}
            />

            <DeviceList
                devices={devices}
                onRemove={removeDevice}
                onToggle={updateDeviceState}
                onRefresh={refreshDeviceState}
                onUpdateDescription={updateDeviceDescription}
                onRename={updateDeviceName}
                disabled={!pyRunnerAvailable}
            />

            {devices.length === 0 && (
                <div className="tplink-empty">
                    <p>No devices configured.</p>
                    <p>Add a device manually or use discovery to find devices on your network.</p>
                </div>
            )}
        </div>
    );
}

export default App;
