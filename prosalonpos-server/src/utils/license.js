/**
 * ProSalonPOS — License Validation
 * 
 * Handles all licensing logic for the self-hosted .exe installer:
 * 
 *   1. Check license file on startup → allow or block the app
 *   2. Activate a license key (online or phone-based)
 *   3. Generate activation codes (provider-side, for phone activation)
 *   4. Validate activation codes (customer-side, for phone activation)
 * 
 * License file location: {app root}/license.json (encrypted)
 * 
 * License file contents (after decryption):
 *   {
 *     license_key: "PSP-2026-A7B3-X9K2",
 *     salon_name: "Andy's Salon",
 *     machine_code: "PSP-1A2B-3C4D-5E6F",
 *     fingerprint_hash: "abc123...",
 *     activated_at: "2026-03-31T...",
 *     activation_number: 1      // 1st, 2nd, or 3rd activation
 *   }
 * 
 * The license file is encrypted with AES-256-CBC using a key derived
 * from a hardcoded secret + the machine's fingerprint hash. This means
 * copying the license file to another computer won't work — it can only
 * be decrypted on the original hardware.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getFingerprintHash, getMachineCode } from './fingerprint.js';

var __dirname = dirname(fileURLToPath(import.meta.url));

// In production, store license.json in ProgramData (writable, survives reinstall)
// In dev, store it in the server root
var _isProduction = process.env.NODE_ENV === 'production';
var LICENSE_FILE = _isProduction
  ? join('C:', 'ProgramData', 'ProSalonPOS', 'license.json')
  : join(__dirname, '..', '..', 'license.json');

// Encryption secret — combined with hardware fingerprint for per-machine key
var APP_SECRET = 'ProSalonPOS-License-2026-Secure';

// ════════════════════════════════════════════
// ENCRYPTION HELPERS
// ════════════════════════════════════════════

/**
 * Derive an AES-256 key from the app secret + machine fingerprint.
 * This ties the encryption to the specific hardware.
 */
function deriveKey(fingerprintHash) {
  var combined = APP_SECRET + ':' + fingerprintHash;
  return createHash('sha256').update(combined).digest();
}

/**
 * Encrypt a JSON object into a storable string.
 */
function encryptLicense(data, fingerprintHash) {
  var key = deriveKey(fingerprintHash);
  var iv = randomBytes(16);
  var cipher = createCipheriv('aes-256-cbc', key, iv);
  var plaintext = JSON.stringify(data);
  var encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex')
  });
}

/**
 * Decrypt a stored license string back into a JSON object.
 * Returns null if decryption fails (wrong hardware or tampered file).
 */
function decryptLicense(stored, fingerprintHash) {
  try {
    var parsed = JSON.parse(stored);
    var key = deriveKey(fingerprintHash);
    var iv = Buffer.from(parsed.iv, 'hex');
    var encrypted = Buffer.from(parsed.data, 'hex');
    var decipher = createDecipheriv('aes-256-cbc', key, iv);
    var decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    return null;
  }
}

// ════════════════════════════════════════════
// LICENSE FILE OPERATIONS
// ════════════════════════════════════════════

/**
 * Check if a valid license file exists and matches this hardware.
 * Returns the license data if valid, null if not.
 */
function checkLicense() {
  if (!existsSync(LICENSE_FILE)) {
    return null;
  }

  try {
    var stored = readFileSync(LICENSE_FILE, 'utf8');
    var fingerprint = getFingerprintHash();
    var license = decryptLicense(stored, fingerprint);

    if (!license) {
      console.log('[License] File exists but cannot be decrypted — hardware mismatch or corrupted');
      return null;
    }

    // Verify the fingerprint hash matches this machine
    if (license.fingerprint_hash !== fingerprint) {
      console.log('[License] Fingerprint mismatch — license was activated on different hardware');
      return null;
    }

    console.log('[License] Valid — ' + license.salon_name + ' (key: ' + license.license_key + ')');
    return license;
  } catch (err) {
    console.log('[License] Error reading license file:', err.message);
    return null;
  }
}

/**
 * Save an activated license to the encrypted file.
 */
function saveLicense(licenseData) {
  var fingerprint = getFingerprintHash();
  var data = {
    license_key: licenseData.license_key,
    salon_name: licenseData.salon_name,
    machine_code: getMachineCode(),
    fingerprint_hash: fingerprint,
    activated_at: new Date().toISOString(),
    activation_number: licenseData.activation_number || 1
  };

  var encrypted = encryptLicense(data, fingerprint);
  writeFileSync(LICENSE_FILE, encrypted, 'utf8');
  console.log('[License] Saved — ' + data.salon_name);
  return data;
}

// ════════════════════════════════════════════
// ACTIVATION CODE GENERATION (Provider-side)
// ════════════════════════════════════════════

/**
 * Generate an Activation Code from a Machine Code + License Key.
 * This runs on the PROVIDER's computer (Andy's desktop tool).
 * 
 * The activation code is mathematically tied to the machine code —
 * it will only work on the computer that generated that machine code.
 * 
 * Format: ACT-XXXX-XXXX-XXXX
 */
function generateActivationCode(machineCode, licenseKey) {
  var combined = machineCode + ':' + licenseKey + ':' + APP_SECRET;
  var hash = createHash('sha256').update(combined).digest('hex').toUpperCase();
  var code = hash.substring(0, 12);
  return 'ACT-' + code.substring(0, 4) + '-' + code.substring(4, 8) + '-' + code.substring(8, 12);
}

/**
 * Validate an Activation Code against this machine's Machine Code + License Key.
 * This runs on the CUSTOMER's computer during phone activation.
 * 
 * Returns true if the activation code is valid for this hardware + license key.
 */
function validateActivationCode(activationCode, licenseKey) {
  var machineCode = getMachineCode();
  var expected = generateActivationCode(machineCode, licenseKey);
  return activationCode === expected;
}

// ════════════════════════════════════════════
// STARTUP CHECK
// ════════════════════════════════════════════

/**
 * Run the license check on server startup.
 * Returns an object with the status and license data.
 * 
 * Statuses:
 *   'valid'       — license is good, app can run
 *   'not_found'   — no license file, show activation screen
 *   'invalid'     — license file exists but is bad (wrong hardware, corrupted)
 *   'dev_mode'    — not in production mode, skip license check
 */
function startupLicenseCheck() {
  // Skip license check in dev mode (when using PostgreSQL)
  var dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.startsWith('file:')) {
    return { status: 'dev_mode', license: null };
  }

  var license = checkLicense();
  if (license) {
    return { status: 'valid', license: license };
  }

  if (existsSync(LICENSE_FILE)) {
    return { status: 'invalid', license: null };
  }

  return { status: 'not_found', license: null };
}

export {
  checkLicense,
  saveLicense,
  generateActivationCode,
  validateActivationCode,
  startupLicenseCheck,
  getMachineCode
};

export default startupLicenseCheck;
