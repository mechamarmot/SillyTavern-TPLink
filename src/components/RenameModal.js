import React, { useState } from 'react';

function RenameModal({ currentName, onSave, onClose }) {
    const [name, setName] = useState(currentName);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Rename Device</h3>
                <div className="modal-device-name">Current: {currentName}</div>
                <input
                    type="text"
                    className="modal-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter new device name"
                    autoFocus
                />
                <div className="modal-actions">
                    <button className="btn-modal-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn-modal-save" onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RenameModal;
