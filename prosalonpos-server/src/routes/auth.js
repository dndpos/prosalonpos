/**
 * ProSalonPOS — Auth Routes
 * GET  /api/v1/auth/salon/:code — verify salon code exists (public, for station setup)
 * POST /api/v1/auth/login — salon_id + PIN → JWT token
 * POST /api/v1/auth/verify-pin — verify a staff PIN (for RBAC popups)
 */
import { Router } from 'express';
import { createHash } from 'crypto';
import prisma, { isSQLite } from '../config/database.js';
import { createToken, verifyToken, comparePin, hashPin, comparePinAsync, hashPinAsync, pinSha256 } from '../config/auth.js';

function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

// Check if a bcrypt hash uses old (slow) salt rounds and needs rehash
function needsRehash(hash) {
  // bcrypt hash format: $2a$XX$ or $2b$XX$ where XX = rounds
  var match = hash && hash.match(/^\$2[ab]\$(\d+)\$/);
  if (!match) return false;
  var rounds = parseInt(match[1], 10);
  return rounds > 6; // rehash anything above our target of 6
}

var router = Router();

// ── GET /salon/:code — Look up salon by code (one-time station setup) ──
// Public endpoint — returns salon name and id if code is valid
router.get('/salon/:code', async function(req, res, next) {
  try {
    var code = (req.params.code || '').toUpperCase();
    if (!code) return res.status(400).json({ error: 'Salon code is required' });

    var salon = await prisma.salon.findUnique({
      where: { salon_code: code }
    });

    if (!salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    res.json({
      salon: {
        id: salon.id,
        name: salon.name,
        salon_code: salon.salon_code,
        status: salon.status,
      }
    });
  } catch (err) { next(err); }
});

// ── GET /pin-table/:salon_id — PIN lookup table for instant local verification ──
// Public endpoint — station calls this once on boot to enable instant PIN checking.
// Returns a map of SHA-256(pin) → staff info. The station hashes typed PINs locally
// and looks them up in this map — zero network delay, exact match required.
router.get('/pin-table/:salon_id', async function(req, res, next) {
  try {
    var salon_id = req.params.salon_id;
    if (!salon_id) return res.status(400).json({ error: 'salon_id is required' });

    var table = {};

    // 1. Staff PINs
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_sha256) {
        table[staff[i].pin_sha256] = {
          id: staff[i].id,
          display_name: staff[i].display_name,
          role: staff[i].role,
          rbac_role: staff[i].rbac_role,
          permissions: fromDb(staff[i].permissions),
          permission_overrides: fromDb(staff[i].permission_overrides)
        };
      }
    }

    // 2. Owner PIN
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    if (salon && salon.owner_pin_sha256) {
      table[salon.owner_pin_sha256] = {
        id: 'owner',
        display_name: 'Owner',
        role: 'owner',
        rbac_role: 'owner'
      };
    }

    // 3. Provider master code
    table[pinSha256('90706')] = {
      id: 'provider',
      display_name: 'Provider',
      role: 'owner',
      rbac_role: 'owner'
    };

    res.json({ pinTable: table });
  } catch (err) { next(err); }
});

// ── Login: salon_id + PIN → JWT ──
// Check order: 1) Staff PINs  2) Owner PIN (salon record)  3) Provider master code (90706)
router.post('/login', async function(req, res, next) {
  try {
    var { salon_id, pin } = req.body;
    console.log('[Auth] Login attempt — salon_id:', salon_id);

    if (!salon_id || !pin) {
      return res.status(400).json({ error: 'salon_id and pin are required' });
    }

    // 1. Check staff PINs (async — non-blocking)
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    console.log('[Auth] Found', staff.length, 'active staff for salon', salon_id);

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash) {
        var isMatch = await comparePinAsync(pin, staff[i].pin_hash);
        if (isMatch) {
          matched = staff[i];
          // Rehash if using old slow rounds (fire and forget)
          if (needsRehash(staff[i].pin_hash)) {
            hashPinAsync(pin).then(function(newHash) {
              prisma.staff.update({ where: { id: matched.id }, data: { pin_hash: newHash } }).catch(function() {});
            });
          }
          break;
        }
      }
    }

    if (matched) {
      var token = createToken({
        salon_id: matched.salon_id,
        staff_id: matched.id,
        role: matched.rbac_role
      });
      return res.json({
        token: token,
        staff: {
          id: matched.id,
          display_name: matched.display_name,
          role: matched.role,
          rbac_role: matched.rbac_role
        }
      });
    }

    // 2. Check owner PIN on Salon record
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    console.log('[Auth] Salon found:', !!salon, '| Has owner_pin_hash:', !!(salon && salon.owner_pin_hash));
    if (salon && salon.owner_pin_hash) {
      var ownerMatch = await comparePinAsync(pin, salon.owner_pin_hash);
      console.log('[Auth] Owner PIN compare result:', ownerMatch);
      if (ownerMatch) {
        // Rehash if using old slow rounds (fire and forget)
        if (needsRehash(salon.owner_pin_hash)) {
          hashPinAsync(pin).then(function(newHash) {
            prisma.salon.update({ where: { id: salon.id }, data: { owner_pin_hash: newHash } }).catch(function() {});
          });
        }
        var ownerToken = createToken({
          salon_id: salon_id,
          staff_id: 'owner',
          role: 'owner'
        });
        return res.json({
          token: ownerToken,
          staff: {
            id: 'owner',
            display_name: 'Owner',
            role: 'owner',
            rbac_role: 'owner'
          }
        });
      }
    }

    // 3. Provider master code (works on every system)
    if (pin === '90706') {
      var masterToken = createToken({
        salon_id: salon_id,
        staff_id: 'provider',
        role: 'owner'
      });
      return res.json({
        token: masterToken,
        staff: {
          id: 'provider',
          display_name: 'Provider',
          role: 'owner',
          rbac_role: 'owner'
        }
      });
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) { next(err); }
});

// ── Verify PIN (for RBAC popups) ──
// Same 3-level check: staff → owner → master code
router.post('/verify-pin', async function(req, res, next) {
  try {
    var { salon_id, pin } = req.body;
    if (!salon_id || !pin) {
      return res.status(400).json({ error: 'salon_id and pin are required' });
    }

    // 1. Staff PINs (async)
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash) {
        var isMatch = await comparePinAsync(pin, staff[i].pin_hash);
        if (isMatch) {
          matched = staff[i];
          if (needsRehash(staff[i].pin_hash)) {
            hashPinAsync(pin).then(function(newHash) {
              prisma.staff.update({ where: { id: matched.id }, data: { pin_hash: newHash } }).catch(function() {});
            });
          }
          break;
        }
      }
    }

    if (matched) {
      return res.json({
        staff: {
          id: matched.id,
          display_name: matched.display_name,
          role: matched.role,
          rbac_role: matched.rbac_role,
          permissions: fromDb(matched.permissions),
          permission_overrides: fromDb(matched.permission_overrides)
        }
      });
    }

    // 2. Owner PIN
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    if (salon && salon.owner_pin_hash) {
      var ownerMatch = await comparePinAsync(pin, salon.owner_pin_hash);
      if (ownerMatch) {
        if (needsRehash(salon.owner_pin_hash)) {
          hashPinAsync(pin).then(function(newHash) {
            prisma.salon.update({ where: { id: salon.id }, data: { owner_pin_hash: newHash } }).catch(function() {});
          });
        }
        return res.json({
          staff: { id: 'owner', display_name: 'Owner', role: 'owner', rbac_role: 'owner', permissions: null, permission_overrides: null }
        });
      }
    }

    // 3. Master code
    if (pin === '90706') {
      return res.json({
        staff: { id: 'provider', display_name: 'Provider', role: 'owner', rbac_role: 'owner', permissions: null, permission_overrides: null }
      });
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) { next(err); }
});

// ── Change Owner PIN ──
// Requires JWT — inline auth check since this router is public
router.put('/owner-pin', async function(req, res, next) {
  try {
    console.log('[Auth] PUT /owner-pin called');
    var { new_pin, salon_id } = req.body;

    // Try JWT first, fall back to salon_id from body
    var resolvedSalonId = null;
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        var decoded = verifyToken(authHeader.slice(7));
        resolvedSalonId = decoded.salon_id;
      } catch (e) {
        // Token expired — fall through to salon_id from body
      }
    }
    if (!resolvedSalonId && salon_id) {
      resolvedSalonId = salon_id;
    }
    if (!resolvedSalonId) {
      return res.status(401).json({ error: 'salon_id required' });
    }

    if (!new_pin || String(new_pin).length < 2) {
      return res.status(400).json({ error: 'PIN must be at least 2 digits' });
    }

    var newHash = hashPin(String(new_pin));
    var newSha = pinSha256(String(new_pin));
    await prisma.salon.update({
      where: { id: resolvedSalonId },
      data: { owner_pin_hash: newHash, owner_pin_sha256: newSha }
    });

    // Sync to any staff record with role 'owner' (they share the salon owner PIN)
    await prisma.staff.updateMany({
      where: { salon_id: resolvedSalonId, role: 'owner' },
      data: { pin_hash: newHash, pin_sha256: newSha }
    });

    console.log('[Auth] Owner PIN updated for salon', resolvedSalonId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
