/**
 * ProSalonPOS — Hardware Fingerprint
 * 
 * Generates a unique Machine Code from the PC's hardware:
 *   - Motherboard serial number
 *   - Primary hard drive serial number
 *   - First non-internal MAC address
 * 
 * These three values are hashed together to create a stable fingerprint
 * that survives OS reinstalls but changes if major hardware is swapped.
 * 
 * Used by the licensing system to lock a license to a specific computer.
 * 
 * Windows-only (uses wmic commands). Returns a fallback on non-Windows
 * for development/testing purposes.
 */
import { execSync } from 'child_process';
import { createHash } from 'crypto';

/**
 * Run a Windows command and return trimmed output.
 * Returns empty string on failure.
 */
function runCommand(cmd) {
  try {
    var result = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
    // wmic output has header line + data line — grab last non-empty line
    var lines = result.trim().split('\n').filter(function(l) { return l.trim().length > 0; });
    if (lines.length >= 2) {
      return lines[lines.length - 1].trim();
    }
    return lines[0] ? lines[0].trim() : '';
  } catch (err) {
    return '';
  }
}

/**
 * Get motherboard serial number via wmic.
 */
function getMotherboardSerial() {
  if (process.platform !== 'win32') return 'DEV-MOBO-001';
  return runCommand('wmic baseboard get serialnumber') || 'UNKNOWN-MOBO';
}

/**
 * Get primary hard drive serial number via wmic.
 */
function getDiskSerial() {
  if (process.platform !== 'win32') return 'DEV-DISK-001';
  return runCommand('wmic diskdrive get serialnumber') || 'UNKNOWN-DISK';
}

/**
 * Get first non-internal MAC address via wmic.
 */
function getMacAddress() {
  if (process.platform !== 'win32') return 'DE:AD:BE:EF:00:01';
  try {
    var result = execSync('wmic nic where "NetEnabled=true" get MACAddress', {
      encoding: 'utf8',
      timeout: 5000
    });
    var lines = result.trim().split('\n').filter(function(l) {
      var trimmed = l.trim();
      return trimmed.length > 0 && trimmed !== 'MACAddress' && trimmed.indexOf(':') !== -1;
    });
    return lines[0] ? lines[0].trim() : 'UNKNOWN-MAC';
  } catch (err) {
    return 'UNKNOWN-MAC';
  }
}

/**
 * Generate the raw hardware fingerprint object.
 * Useful for debugging — shows what values were collected.
 */
function getRawFingerprint() {
  return {
    motherboard: getMotherboardSerial(),
    disk: getDiskSerial(),
    mac: getMacAddress(),
    platform: process.platform
  };
}

/**
 * Generate the Machine Code — a short, readable hash of the hardware fingerprint.
 * Format: PSP-XXXX-XXXX-XXXX (12 hex chars in 3 groups)
 * 
 * This is what the customer reads to the provider over the phone.
 */
function getMachineCode() {
  var raw = getRawFingerprint();
  var combined = raw.motherboard + '|' + raw.disk + '|' + raw.mac;

  // SHA-256 hash, take first 12 hex chars, format as PSP-XXXX-XXXX-XXXX
  var hash = createHash('sha256').update(combined).digest('hex').toUpperCase();
  var code = hash.substring(0, 12);

  return 'PSP-' + code.substring(0, 4) + '-' + code.substring(4, 8) + '-' + code.substring(8, 12);
}

/**
 * Generate the full fingerprint hash (used internally for license file storage).
 * This is the full SHA-256 — not shown to the customer.
 */
function getFingerprintHash() {
  var raw = getRawFingerprint();
  var combined = raw.motherboard + '|' + raw.disk + '|' + raw.mac;
  return createHash('sha256').update(combined).digest('hex');
}

export { getRawFingerprint, getMachineCode, getFingerprintHash };
export default getMachineCode;
