/**
 * ProSalonPOS — Provider Admin Routes (auth only)
 * ISO-level management: provider login, forgot-pin, reset-pin.
 * Salon CRUD, notes, audit, lockout endpoints are in providerSalons.js.
 *
 * C64: Provider login requires email + PIN (two factors).
 * C64: DB-level account lockout after 5 failed attempts.
 * C64: PIN reset flow with 6-digit code (logged + emailable later).
 * C64: Provider master code from PROVIDER_MASTER_CODE env var.
 * C66: Split — salon routes extracted to providerSalons.js.
 */
import { Router } from 'express';
import { createHash, randomInt } from 'crypto';
import prisma, { isSQLite } from '../config/database.js';
import { createToken, hashPin, comparePin } from '../config/auth.js';
import providerAuth from '../middleware/providerAuth.js';
import providerSalonRoutes from './providerSalons.js';

// ── Provider master code — env var or default ──
// PROTECTED C64: master code from env var, never hardcoded in production
var PROVIDER_MASTER_CODE = process.env.PROVIDER_MASTER_CODE || '90706';

var PROVIDER_MAX_ATTEMPTS = 5;
var RESET_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// Hash a reset code with SHA-256
function hashResetCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

var router = Router();

// ════════════════════════════════════════════
// AUTH (public — no middleware)
// ════════════════════════════════════════════

// Per-IP rate limiting
var _providerIpAttempts = {};
var PROVIDER_IP_MAX = 10;
var PROVIDER_IP_WINDOW_MS = 15 * 60 * 1000;

function checkProviderIpLimit(ip) {
  var entry = _providerIpAttempts[ip];
  if (!entry) return true;
  if (Date.now() - entry.lastAttempt > PROVIDER_IP_WINDOW_MS) {
    delete _providerIpAttempts[ip];
    return true;
  }
  return entry.count < PROVIDER_IP_MAX;
}

function recordProviderIpFail(ip) {
  if (!_providerIpAttempts[ip]) _providerIpAttempts[ip] = { count: 0, lastAttempt: 0 };
  _providerIpAttempts[ip].count++;
  _providerIpAttempts[ip].lastAttempt = Date.now();
}

function clearProviderIpFails(ip) {
  delete _providerIpAttempts[ip];
}

// ── POST /auth/login — Provider login (email + PIN) ──
router.post('/auth/login', async function(req, res, next) {
  try {
    var ip = req.ip || req.connection.remoteAddress || 'unknown';
    var { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }

    // Per-IP rate limit
    if (!checkProviderIpLimit(ip)) {
      return res.status(429).json({ error: 'Too many login attempts from this IP. Try again in 15 minutes.' });
    }

    var normalEmail = email.trim().toLowerCase();

    // Look up provider owner by email
    var owner = await prisma.providerOwner.findUnique({
      where: { email: normalEmail }
    });

    if (!owner) {
      recordProviderIpFail(ip);
      return res.status(401).json({ error: 'Invalid email or PIN' });
    }

    // Check DB-level lockout
    if (owner.failed_attempts >= PROVIDER_MAX_ATTEMPTS) {
      return res.status(403).json({
        error: 'Account locked due to too many failed attempts. Use "Forgot PIN" to reset.',
        code: 'PROVIDER_LOCKED',
      });
    }

    // Compare PIN
    var pinMatch = comparePin(pin, owner.pin_hash);

    if (!pinMatch) {
      // Increment DB-level failed_attempts
      await prisma.providerOwner.update({
        where: { id: owner.id },
        data: { failed_attempts: { increment: 1 } }
      });
      recordProviderIpFail(ip);

      var remaining = PROVIDER_MAX_ATTEMPTS - (owner.failed_attempts + 1);
      if (remaining <= 0) {
        return res.status(403).json({
          error: 'Account locked due to too many failed attempts. Use "Forgot PIN" to reset.',
          code: 'PROVIDER_LOCKED',
        });
      }

      return res.status(401).json({
        error: 'Invalid email or PIN. ' + remaining + ' attempt' + (remaining > 1 ? 's' : '') + ' remaining.',
      });
    }

    // Success — clear failed attempts
    await prisma.providerOwner.update({
      where: { id: owner.id },
      data: { failed_attempts: 0 }
    });
    clearProviderIpFails(ip);

    var token = createToken({
      provider_id: owner.id,
      role: 'provider_owner'
    });

    res.json({
      token: token,
      provider: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: 'provider_owner',
      }
    });
  } catch (err) { next(err); }
});

// ── POST /auth/forgot-pin — Request a PIN reset code ──
router.post('/auth/forgot-pin', async function(req, res, next) {
  try {
    var { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    var normalEmail = email.trim().toLowerCase();
    var owner = await prisma.providerOwner.findUnique({ where: { email: normalEmail } });

    if (!owner) {
      // Don't reveal whether email exists
      return res.json({ message: 'If an account with that email exists, a reset code has been generated.' });
    }

    // Generate 6-digit code
    var code = String(randomInt(100000, 999999));
    var hashed = hashResetCode(code);

    await prisma.providerOwner.update({
      where: { id: owner.id },
      data: {
        reset_code_hash: hashed,
        reset_code_expires: new Date(Date.now() + RESET_CODE_EXPIRY_MS),
      }
    });

    // Log the code (in production, this would be emailed)
    console.log('[Provider] PIN reset code for', normalEmail, ':', code, '(expires in 15 min)');

    res.json({ message: 'If an account with that email exists, a reset code has been generated.' });
  } catch (err) { next(err); }
});

// ── POST /auth/reset-pin — Verify code and set new PIN ──
router.post('/auth/reset-pin', async function(req, res, next) {
  try {
    var { email, code, new_pin } = req.body;
    if (!email || !code || !new_pin) {
      return res.status(400).json({ error: 'Email, code, and new_pin are required' });
    }

    var normalEmail = email.trim().toLowerCase();
    var owner = await prisma.providerOwner.findUnique({ where: { email: normalEmail } });
    if (!owner) return res.status(401).json({ error: 'Invalid email or code' });

    // Verify code
    var hashedInput = hashResetCode(code);
    if (hashedInput !== owner.reset_code_hash) {
      return res.status(401).json({ error: 'Invalid or expired reset code' });
    }

    // Check expiry
    if (!owner.reset_code_expires || new Date() > new Date(owner.reset_code_expires)) {
      return res.status(401).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    // Set new PIN + clear failed attempts + clear code
    var newHash = hashPin(new_pin);
    await prisma.providerOwner.update({
      where: { id: owner.id },
      data: {
        pin_hash: newHash,
        failed_attempts: 0,
        reset_code_hash: null,
        reset_code_expires: null,
      }
    });

    console.log('[Provider] PIN reset successful for', normalEmail);
    res.json({ message: 'PIN has been reset successfully. You can now log in with your new PIN.' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// All routes below require provider auth
// ════════════════════════════════════════════
router.use(providerAuth);

// Mount salon sub-routes (salons, notes, audit, lockout, tech sessions)
router.use(providerSalonRoutes);

export { PROVIDER_MASTER_CODE };
export default router;
