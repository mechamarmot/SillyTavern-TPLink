import React, { useState } from 'react';

function AddDevice({ onAddDevice, onDiscover, onTestDiscover, onTestConnection, onScanNetwork, isDiscovering, disabled }) {
    const [ip, setIp] = useState('');
    const [name, setName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!ip.trim()) {
            return;
        }

        setIsAdding(true);
        const success = await onAddDevice(ip.trim(), name.trim());

        if (success) {
            setIp('');
            setName('');
        }

        setIsAdding(false);
    };

    const handleTestDiscover = async () => {
        setIsTesting(true);
        await onTestDiscover();
        setIsTesting(false);
    };

    const handleTestConnection = async () => {
        if (!ip.trim()) {
            alert('Please enter an IP address first');
            return;
        }
        setIsTestingConnection(true);
        await onTestConnection(ip.trim());
        setIsTestingConnection(false);
    };

    const handleScanNetwork = async () => {
        setIsScanning(true);
        await onScanNetwork();
        setIsScanning(false);
    };

    return (
        <div className="tplink-add-device">
            <h4>Add Device</h4>

            <form onSubmit={handleSubmit} className="add-device-form">
                <div className="form-row">
                    <input
                        type="text"
                        placeholder="Device IP (e.g., 192.168.1.100)"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        disabled={disabled || isAdding}
                        className="input-ip"
                    />
                    <input
                        type="text"
                        placeholder="Name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={disabled || isAdding}
                        className="input-name"
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={disabled || isAdding || !ip.trim()}
                        className="btn-add"
                    >
                        {isAdding ? 'Adding...' : 'Add Device'}
                    </button>

                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={disabled || isTestingConnection || !ip.trim()}
                        className="btn-test-connection"
                    >
                        {isTestingConnection ? 'Testing...' : 'Test IP Connection'}
                    </button>

                    <button
                        type="button"
                        onClick={onDiscover}
                        disabled={disabled || isDiscovering || isTesting}
                        className="btn-discover"
                    >
                        {isDiscovering ? 'Discovering...' : 'Auto-Discover'}
                    </button>

                    <button
                        type="button"
                        onClick={handleTestDiscover}
                        disabled={disabled || isDiscovering || isTesting}
                        className="btn-test"
                    >
                        {isTesting ? 'Testing...' : 'Test Discovery (Debug)'}
                    </button>

                    <button
                        type="button"
                        onClick={handleScanNetwork}
                        disabled={disabled || isScanning}
                        className="btn-scan"
                    >
                        {isScanning ? 'Scanning...' : 'Scan Network (Port 9999)'}
                    </button>
                </div>
            </form>

            <div className="add-device-help">
                <p>Enter the IP address of your TP-Link Kasa device, or use Auto-Discover to find devices on your network.</p>
                <p>If Auto-Discover doesn't work, use "Scan Network" to find devices with port 9999 open.</p>
            </div>
        </div>
    );
}

export default AddDevice;
