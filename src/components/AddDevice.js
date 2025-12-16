import React, { useState } from 'react';

function AddDevice({ onAddDevice, onDiscover, onScanNetwork, isDiscovering, disabled }) {
    const [ip, setIp] = useState('');
    const [name, setName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
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
                        onClick={onDiscover}
                        disabled={disabled || isDiscovering}
                        className="btn-discover"
                    >
                        {isDiscovering ? 'Discovering...' : 'Auto-Discover'}
                    </button>

                    <button
                        type="button"
                        onClick={handleScanNetwork}
                        disabled={disabled || isScanning}
                        className="btn-scan"
                    >
                        {isScanning ? 'Scanning...' : 'Network Scan'}
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
