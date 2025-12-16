import React, { useState } from 'react';

function DescriptionModal({ currentDescription, deviceName, onSave, onClose }) {
    const [description, setDescription] = useState(currentDescription);

    const handleSave = () => {
        onSave(description.trim() || 'Generic Device');
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
                <h3>Edit Device Description</h3>
                <p className="modal-device-name">{deviceName}</p>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Generic Device"
                    className="modal-input"
                    autoFocus
                />
                <div className="modal-actions">
                    <button onClick={handleSave} className="btn-modal-save">
                        Save
                    </button>
                    <button onClick={onClose} className="btn-modal-cancel">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DescriptionModal;
