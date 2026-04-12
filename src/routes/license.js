/**
 * ProSalonPOS — License Routes
 * 
 * API endpoints for the License Activation Screen on the frontend.
 * These are PUBLIC routes (no JWT required) because the user hasn't
 * logged in yet — they're activating the software for the first time.
 * 
 * Endpoints:
 *   GET  /api/v1/license/status     — check current license status
 *   GET  /api/v1/license/machine    — get this PC's Machine Code
 *   POST /api/v1/license/activate   — activate with license key (online)
 *   POST /api/v1/license/activate-phone — activate with activation code (phone)
 */
import { Router } from 'express';
import {
  startupLicenseCheck,
  saveLicense,
  validateActivationCode
} from '../utils/license.js';
import { getMachineCode, getRawFingerprint } from '../utils/fingerprint.js';
import { bootstrapSalon } from '../utils/salonBootstrap.js';

var router = Router();

// ── Shared: run salon bootstrap after activation ──
async function runBootstrap(salonName, licenseKey, label) {
  console.log('[License:' + label + '] create_salon flag received, bootstrapping...');
  try {
    var result = await bootstrapSalon(salonName, licenseKey);
    if (result.created) {
      console.log('[License:' + label + '] Salon auto-created — code: ' + result.salon.salon_code);
    } else {
      console.log('[License:' + label + '] Salon already exists — code: ' + result.salon.salon_code);
    }
    return result;
  } catch (err) {
    console.error('[License:' + label + '] Salon bootstrap FAILED:', err.message);
    console.error(err.stack);
    return null;
  }
}

// ── GET /status — check current license status ──
router.get('/status', function(req, res) {
  var result = startupLicenseCheck();
  res.json({
    licenseStatus: {
      status: result.status,
      salon_name: result.license ? result.license.salon_name : null,
      license_key: result.license ? result.license.license_key : null,
      activated_at: result.license ? result.license.activated_at : null,
      machine_code: getMachineCode()
    }
  });
});

// ── GET /machine — get this PC's Machine Code ──
router.get('/machine', function(req, res) {
  res.json({
    machineInfo: {
      machine_code: getMachineCode(),
      platform: process.platform,
      raw: process.env.NODE_ENV === 'development' ? getRawFingerprint() : undefined
    }
  });
});

// ── POST /activate — online activation ──
router.post('/activate', async function(req, res) {
  var licenseKey = req.body.license_key;
  var salonName = req.body.salon_name;

  if (!licenseKey || !salonName) {
    return res.status(400).json({
      error: { message: 'License key and salon name are required' }
    });
  }

  var keyPattern = /^PSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!keyPattern.test(licenseKey)) {
    return res.status(400).json({
      error: { message: 'Invalid license key format. Expected: PSP-XXXX-XXXX-XXXX' }
    });
  }

  try {
    var license = saveLicense({
      license_key: licenseKey,
      salon_name: salonName,
      activation_number: 1
    });

    if (req.body.create_salon) {
      await runBootstrap(salonName, licenseKey, 'online');
    }

    res.json({
      activation: {
        success: true,
        salon_name: license.salon_name,
        license_key: license.license_key,
        machine_code: license.machine_code,
        activated_at: license.activated_at
      }
    });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Failed to save license: ' + err.message }
    });
  }
});

// ── POST /activate-phone — phone activation ──
router.post('/activate-phone', async function(req, res) {
  var licenseKey = req.body.license_key;
  var activationCode = req.body.activation_code;
  var salonName = req.body.salon_name;

  if (!licenseKey || !activationCode || !salonName) {
    return res.status(400).json({
      error: { message: 'License key, activation code, and salon name are required' }
    });
  }

  var isValid = validateActivationCode(activationCode, licenseKey);

  if (!isValid) {
    return res.status(403).json({
      error: { message: 'Invalid activation code. This code does not match this computer. Please contact your provider for the correct code.' }
    });
  }

  try {
    var license = saveLicense({
      license_key: licenseKey,
      salon_name: salonName,
      activation_number: 1
    });

    if (req.body.create_salon) {
      await runBootstrap(salonName, licenseKey, 'phone');
    }

    res.json({
      activation: {
        success: true,
        salon_name: license.salon_name,
        license_key: license.license_key,
        machine_code: license.machine_code,
        activated_at: license.activated_at
      }
    });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Failed to save license: ' + err.message }
    });
  }
});

export default router;
