import React from 'react';
import DeviceCard from './DeviceCard';

function DeviceList({ devices, onRemove, onToggle, onRefresh, onUpdateDescription, onRename, disabled }) {
    if (devices.length === 0) {
        return null;
    }

    return (
        <div className="tplink-device-list">
            <h4>Configured Devices ({devices.length})</h4>
            <div className="device-grid">
                {devices.map(device => (
                    <DeviceCard
                        key={device.id}
                        device={device}
                        onToggle={onToggle}
                        onRefresh={onRefresh}
                        onRemove={onRemove}
                        onUpdateDescription={onUpdateDescription}
                        onRename={onRename}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}

export default DeviceList;
