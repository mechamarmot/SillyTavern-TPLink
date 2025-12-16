import React, { useState } from 'react';
import DescriptionModal from './DescriptionModal';
import RenameModal from './RenameModal';

function DeviceCard({ device, onToggle, onRefresh, onRemove, onUpdateDescription, onRename, disabled }) {
    const [showMenu, setShowMenu] = useState(false);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);

    const handleToggle = () => {
        const newState = device.state === 'on' ? 'off' : 'on';
        onToggle(device.id, newState);
    };

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    };

    const handleEditDescription = () => {
        setShowMenu(false);
        setShowDescriptionModal(true);
    };

    const handleRename = () => {
        setShowMenu(false);
        setShowRenameModal(true);
    };

    const handleRemove = () => {
        setShowMenu(false);
        onRemove(device.id);
    };

    const handleSaveDescription = (newDescription) => {
        onUpdateDescription(device.id, newDescription);
        setShowDescriptionModal(false);
    };

    const handleSaveRename = (newName) => {
        onRename(device.id, newName);
        setShowRenameModal(false);
    };

    // Device name is used as-is in macros (spaces are fine)
    const deviceName = device.name;

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setShowMenu(false);
        if (showMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showMenu]);

    return (
        <>
            <div className="device-card">
                {/* Menu Button */}
                <button
                    className="device-menu-button"
                    onClick={handleMenuClick}
                    title="Device options"
                >
                    ⋮
                </button>

                {/* Context Menu */}
                {showMenu && (
                    <div className="device-context-menu">
                        <div className="context-menu-item" onClick={handleRename}>
                            Rename Device
                        </div>
                        <div className="context-menu-item" onClick={handleEditDescription}>
                            Edit Description
                        </div>
                        <div className="context-menu-item" onClick={handleRemove}>
                            Remove Device
                        </div>
                    </div>
                )}

                <div className="device-header">
                    <div className="device-info">
                        <div className="device-name">{device.name}</div>
                        {device.originalName && device.originalName !== device.name && (
                            <div className="device-original-name" title="Actual TP-Link device name">
                                Device: {device.originalName}
                            </div>
                        )}
                        <div className="device-description">"{device.description}"</div>
                        <div className="device-model">{device.model}</div>
                        <div className="device-ip">{device.ip}</div>
                    </div>
                    <div className={`device-status ${device.state}`}>
                        {device.state === 'on' ? '●' : '○'}
                    </div>
                </div>

                {/* Control Phrases */}
                <div className="device-control-phrases">
                    <div className="control-phrase">
                        ON PHRASE: <code>{`{{tplink-on:${deviceName}}}`}</code>
                    </div>
                    <div className="control-phrase">
                        OFF PHRASE: <code>{`{{tplink-off:${deviceName}}}`}</code>
                    </div>
                    <div className="control-phrase">
                        CYCLE PHRASE: <code>{`{{tplink-cycle:${deviceName}:#}}`}</code>
                    </div>
                </div>

                <div className="device-controls">
                    <button
                        onClick={handleToggle}
                        className={`btn-toggle ${device.state}`}
                        disabled={disabled}
                    >
                        {device.state === 'on' ? 'Turn Off' : 'Turn On'}
                    </button>

                    <button
                        onClick={() => onRefresh(device.id)}
                        className="btn-refresh"
                        disabled={disabled}
                        title="Refresh state"
                    >
                        ↻
                    </button>

                    <button
                        onClick={handleRemove}
                        className="btn-remove"
                        title="Remove device"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Description Modal */}
            {showDescriptionModal && (
                <DescriptionModal
                    currentDescription={device.description}
                    deviceName={device.name}
                    onSave={handleSaveDescription}
                    onClose={() => setShowDescriptionModal(false)}
                />
            )}

            {/* Rename Modal */}
            {showRenameModal && (
                <RenameModal
                    currentName={device.name}
                    onSave={handleSaveRename}
                    onClose={() => setShowRenameModal(false)}
                />
            )}
        </>
    );
}

export default DeviceCard;
