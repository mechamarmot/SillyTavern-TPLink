/* global SillyTavern */
import React, { useState, useEffect } from 'react';
import DeviceList from './components/DeviceList';
import AddDevice from './components/AddDevice';
import PyRunnerService from './services/PyRunnerService';
import './styles.css';

function App() {
    const [devices, setDevices] = useState([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [error, setError] = useState(null);
    const [pyRunnerAvailable, setPyRunnerAvailable] = useState(false);

    // Load saved devices from extension settings
    useEffect(() => {
        loadDevices();
        checkPyRunnerAvailability();
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
        const context = SillyTavern.getContext();
        const extensionSettings = context.extensionSettings || {};
        const tplinkSettings = extensionSettings.tplink || { devices: [] };
        setDevices(tplinkSettings.devices || []);
    };

    const saveDevices = (newDevices) => {
        const context = SillyTavern.getContext();
        context.extensionSettings = context.extensionSettings || {};
        context.extensionSettings.tplink = { devices: newDevices };
        context.saveSettingsDebounced();
        setDevices(newDevices);
    };

    const addDevice = async (ip, name) => {
        try {
            // Get device info
            const info = await PyRunnerService.getDeviceInfo(ip);

            if (info.error) {
                setError(`Failed to connect to device: ${info.error}`);
                return false;
            }

            const sysInfo = info.system?.get_sysinfo || {};
            const originalName = sysInfo.alias || sysInfo.dev_name || ip;
            const deviceName = name || originalName;

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

            const updatedDevices = [...devices, newDevice];
            saveDevices(updatedDevices);
            setError(null);
            return true;
        } catch (err) {
            setError(`Error adding device: ${err.message}`);
            return false;
        }
    };

    const removeDevice = (deviceId) => {
        const updatedDevices = devices.filter(d => d.id !== deviceId);
        saveDevices(updatedDevices);
    };

    const updateDeviceDescription = (deviceId, newDescription) => {
        const updatedDevices = devices.map(d =>
            d.id === deviceId ? { ...d, description: newDescription } : d
        );
        saveDevices(updatedDevices);
    };

    const updateDeviceName = (deviceId, newName) => {
        const updatedDevices = devices.map(d =>
            d.id === deviceId ? { ...d, name: newName } : d
        );
        saveDevices(updatedDevices);
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

    const testDiscovery = async () => {
        if (!pyRunnerAvailable) {
            setError('PyRunner is not available');
            return;
        }

        setError(null);

        try {
            console.log('[SillyTPLink] Running test discovery...');
            const result = await PyRunnerService.testDiscovery();

            console.log('[SillyTPLink] Test discovery result:', result);

            if (result.error) {
                setError(`Test failed: ${result.error}`);
            } else {
                const msg = `Test complete! Found ${result.devices?.length || 0} devices. Check browser console for detailed logs.`;
                setError(msg);
                alert(msg + '\n\nCheck the browser console (F12) for detailed output.');
            }
        } catch (err) {
            console.error('[SillyTPLink] Test discovery error:', err);
            setError(`Test error: ${err.message}`);
        }
    };

    const testConnection = async (ip) => {
        if (!pyRunnerAvailable) {
            setError('PyRunner is not available');
            return;
        }

        setError(null);

        try {
            console.log('[SillyTPLink] Testing direct connection to:', ip);
            const result = await PyRunnerService.testConnection(ip);

            console.log('[SillyTPLink] Connection test result:', result);

            if (result.error) {
                setError(`Connection test failed: ${result.error}`);
                alert(`Failed to connect to ${ip}\n\nError: ${result.error}\n\nCheck console for details.`);
            } else if (result.success) {
                const deviceInfo = result.response?.system?.get_sysinfo;
                const deviceName = deviceInfo?.alias || deviceInfo?.dev_name || 'Unknown';
                const model = deviceInfo?.model || 'Unknown';
                const msg = `SUCCESS! Connected to ${deviceName} (${model}) at ${ip}`;
                setError(msg);
                alert(`${msg}\n\nThe device is responding correctly! You can now add it.`);
            } else {
                setError('Connection test returned unexpected result');
            }
        } catch (err) {
            console.error('[SillyTPLink] Connection test error:', err);
            setError(`Test error: ${err.message}`);
        }
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
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        try {
            const result = newState === 'on'
                ? await PyRunnerService.turnOn(device.ip)
                : await PyRunnerService.turnOff(device.ip);

            if (result.error) {
                setError(`Failed to control device: ${result.error}`);
                return;
            }

            // Update device state
            const updatedDevices = devices.map(d =>
                d.id === deviceId ? { ...d, state: newState } : d
            );
            saveDevices(updatedDevices);
            setError(null);
        } catch (err) {
            setError(`Error controlling device: ${err.message}`);
        }
    };

    const refreshDeviceState = async (deviceId) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        try {
            const info = await PyRunnerService.getDeviceInfo(device.ip);

            if (info.error) {
                setError(`Failed to get device info: ${info.error}`);
                return;
            }

            const sysInfo = info.system?.get_sysinfo || {};
            const originalName = sysInfo.alias || sysInfo.dev_name || device.ip;
            const newState = sysInfo.relay_state === 1 ? 'on' : 'off';

            // Update device state and sync original name
            const updatedDevices = devices.map(d =>
                d.id === deviceId ? {
                    ...d,
                    state: newState,
                    originalName: originalName, // Sync the actual device name
                    model: sysInfo.model || d.model
                } : d
            );
            saveDevices(updatedDevices);
            setError(null);
        } catch (err) {
            setError(`Error getting device state: ${err.message}`);
        }
    };

    // Export device access helpers for macro and slash command hooks
    useEffect(() => {
        window.tplinkExtension = {
            // Get all devices
            getDevices: () => devices,

            // Control a device by IP address
            controlDevice: async (ip, action) => {
                try {
                    console.log(`[SillyTPLink] controlDevice: ${ip} -> ${action}`);

                    // Call appropriate PyRunner service method
                    const result = action === 'on'
                        ? await PyRunnerService.turnOn(ip)
                        : await PyRunnerService.turnOff(ip);

                    if (result.error) {
                        console.error(`[SillyTPLink] Control failed: ${result.error}`);
                        return false;
                    }

                    // Update local device state
                    const updatedDevices = devices.map(d =>
                        d.ip === ip ? { ...d, state: action } : d
                    );
                    saveDevices(updatedDevices);

                    console.log(`[SillyTPLink] Device ${ip} turned ${action}`);
                    return true;
                } catch (err) {
                    console.error(`[SillyTPLink] Error controlling device:`, err);
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
    }, [devices]);

    return (
        <div className="tplink-extension">
            <div className="tplink-header">
                <h3>SillyTPLink - TP-Link Smart Home Control</h3>
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
                onTestDiscover={testDiscovery}
                onTestConnection={testConnection}
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
