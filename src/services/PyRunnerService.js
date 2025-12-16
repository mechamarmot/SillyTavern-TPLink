/**
 * PyRunner Service - Interface for executing Python commands
 * This service requires the PyRunner extension to be installed and enabled
 */

class PyRunnerService {
    /**
     * Execute a Python script via PyRunner
     * @param {string} script - Python script path relative to extension
     * @param {Array} args - Command line arguments
     * @returns {Promise<Object>} - Parsed JSON response from Python
     */
    static async executePython(script, args = []) {
        console.log('[PyRunnerService] Executing Python script:', script, 'with args:', args);

        try {
            // Construct the Python code that will execute our script
            const extensionPath = 'public/scripts/extensions/third-party/SillyTavern-TPLink';
            const scriptPath = `${extensionPath}/python/${script}`;

            // Build Python code that sets sys.argv and executes the script
            const argsJson = JSON.stringify([scriptPath, ...args]);
            const pythonCode = `
import sys
import os

# Set up sys.argv for the script
sys.argv = ${argsJson}

# Change to the extension directory
os.chdir('${extensionPath}')

# Add the python directory to sys.path so imports work
python_dir = os.path.join(os.getcwd(), 'python')
if python_dir not in sys.path:
    sys.path.insert(0, python_dir)

# Execute the script
with open('python/${script}', 'r') as f:
    exec(f.read())
`;

            console.log('[PyRunnerService] Python code to execute:', pythonCode);

            // Call PyRunner API endpoint
            console.log('[PyRunnerService] Calling /api/plugins/pyrunner/execute');
            const response = await fetch('/api/plugins/pyrunner/execute', {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    code: pythonCode,
                    timeout: 30000,
                    venv: 'tplink'
                })
            });

            console.log('[PyRunnerService] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[PyRunnerService] API error:', response.status, errorText);
                throw new Error(`PyRunner API error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[PyRunnerService] Response:', result);

            // Check if there was an error in execution
            if (result.error) {
                console.error('[PyRunnerService] Execution error:', result.error);
                return { error: result.error };
            }

            // Parse the output as JSON
            try {
                const output = result.output || '';
                console.log('[PyRunnerService] Python output (first 500 chars):', output.substring(0, 500));

                // Extract JSON from output (usually the last line)
                // Some scripts output progress messages before the JSON
                const lines = output.trim().split('\n');
                let jsonStr = lines[lines.length - 1]; // Try last line first

                // If last line doesn't start with { or [, try to find JSON in output
                if (!jsonStr.trim().startsWith('{') && !jsonStr.trim().startsWith('[')) {
                    // Look for JSON in the output by finding lines that start with { or [
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('{') || line.startsWith('[')) {
                            jsonStr = line;
                            break;
                        }
                    }
                }

                console.log('[PyRunnerService] Attempting to parse JSON from:', jsonStr.substring(0, 200));
                const parsed = JSON.parse(jsonStr);
                console.log('[PyRunnerService] Parsed result:', parsed);
                return parsed;
            } catch (e) {
                console.error('[PyRunnerService] Failed to parse output:', e, 'Raw output:', result.output);
                return { error: 'Failed to parse Python response', raw: result };
            }
        } catch (error) {
            console.error('[PyRunnerService] Exception:', error);
            return { error: error.message || 'Unknown error executing Python' };
        }
    }

    /**
     * Get request headers with CSRF token
     * @returns {Object} Headers object
     */
    static getHeaders() {
        // Use SillyTavern's built-in method to get headers with CSRF token
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;

        if (context && typeof context.getRequestHeaders === 'function') {
            return {
                ...context.getRequestHeaders(),
                'Content-Type': 'application/json',
            };
        }

        // Fallback if SillyTavern context not available
        return {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Ensure the tplink venv exists
     * @returns {Promise<boolean>} - True if venv exists or was created
     */
    static async ensureVenv() {
        console.log('[PyRunnerService] Checking for tplink venv...');

        try {
            // Check if venv exists
            const checkResponse = await fetch('/api/plugins/pyrunner/venvs');
            if (checkResponse.ok) {
                const { venvs } = await checkResponse.json();
                console.log('[PyRunnerService] Existing venvs:', venvs);

                if (venvs.includes('tplink')) {
                    console.log('[PyRunnerService] tplink venv already exists');
                    return true;
                }
            }

            // Create the venv
            console.log('[PyRunnerService] Creating tplink venv...');
            const createResponse = await fetch('/api/plugins/pyrunner/venvs', {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ name: 'tplink' })
            });

            if (createResponse.ok) {
                console.log('[PyRunnerService] tplink venv created successfully');
                return true;
            } else {
                const error = await createResponse.json();
                console.error('[PyRunnerService] Failed to create venv:', error);
                return false;
            }
        } catch (error) {
            console.error('[PyRunnerService] Error ensuring venv:', error);
            return false;
        }
    }

    /**
     * Discover Kasa devices on the network
     * @param {number} timeout - Discovery timeout in seconds (default: 10)
     * @returns {Promise<Object>} - { devices: [ip1, ip2, ...] }
     */
    static async discoverDevices(timeout = 10) {
        return await this.executePython('kasa_api.py', ['discover', timeout]);
    }

    /**
     * Get device information
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Device info response
     */
    static async getDeviceInfo(ip) {
        return await this.executePython('kasa_api.py', ['info', ip]);
    }

    /**
     * Get device state (on/off)
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - { state: 'on'|'off', relay_state: 0|1 }
     */
    static async getDeviceState(ip) {
        return await this.executePython('kasa_api.py', ['state', ip]);
    }

    /**
     * Turn device on
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Result and updated state
     */
    static async turnOn(ip) {
        return await this.executePython('kasa_api.py', ['on', ip]);
    }

    /**
     * Turn device off
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Result and updated state
     */
    static async turnOff(ip) {
        return await this.executePython('kasa_api.py', ['off', ip]);
    }

    /**
     * Toggle device state
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Result and updated state
     */
    static async toggleDevice(ip) {
        return await this.executePython('kasa_api.py', ['toggle', ip]);
    }

    /**
     * Get energy meter data (HS110/KP115 only)
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Energy meter data
     */
    static async getEmeterData(ip) {
        return await this.executePython('kasa_api.py', ['emeter', ip]);
    }

    /**
     * Set LED state
     * @param {string} ip - Device IP address
     * @param {boolean} state - LED state (true = on, false = off)
     * @returns {Promise<Object>} - Result
     */
    static async setLED(ip, state) {
        return await this.executePython('kasa_api.py', ['led', ip, state ? 'on' : 'off']);
    }

    /**
     * Reboot device
     * @param {string} ip - Device IP address
     * @param {number} delay - Delay in seconds before reboot (default: 1)
     * @returns {Promise<Object>} - Result
     */
    static async rebootDevice(ip, delay = 1) {
        return await this.executePython('kasa_api.py', ['reboot', ip, delay]);
    }

    /**
     * Test discovery with detailed logging
     * @returns {Promise<Object>} - Test results with debug output
     */
    static async testDiscovery() {
        return await this.executePython('test_discovery.py', []);
    }

    /**
     * Test direct TCP connection to a device
     * @param {string} ip - Device IP address
     * @returns {Promise<Object>} - Test results
     */
    static async testConnection(ip) {
        return await this.executePython('test_connection.py', [ip]);
    }

    /**
     * Scan network for Kasa devices with port 9999 open
     * @returns {Promise<Object>} - Scan results
     */
    static async scanNetwork() {
        return await this.executePython('scan_network.py', []);
    }
}

export default PyRunnerService;
