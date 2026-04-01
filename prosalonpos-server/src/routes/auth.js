/**
 * ProSalonPOS — Auth Routes
 * GET  /api/v1/auth/salon/:code — verify salon code exists (public, for station setup)
 * POST /api/v1/auth/login — salon_id + PIN → JWT token
 * POST /api/v1/auth/verify-pin — verify a staff PIN (for RBAC popups)
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { createToken, comparePin, hashPin } from '../config/auth.js';

function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
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

// ── Login: salon_id + PIN → JWT ──
// Check order: 1) Staff PINs  2) Owner PIN (salon record)  3) Provider master code (90706)
router.post('/login', async function(req, res, next) {
  try {
    var { salon_id, pin } = req.body;
    console.log('[Auth] Login attempt — salon_id:', salon_id);

    if (!salon_id || !pin) {
      return res.status(400).json({ error: 'salon_id and pin are required' });
    }

    // 1. Check staff PINs
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    console.log('[Auth] Found', staff.length, 'active staff for salon', salon_id);

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash && comparePin(pin, staff[i].pin_hash)) {
        matched = staff[i];
        break;
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
    if (salon && salon.owner_pin_hash && comparePin(pin, salon.owner_pin_hash)) {
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

    // 1. Staff PINs
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash && comparePin(pin, staff[i].pin_hash)) {
        matched = staff[i];
        break;
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
    if (salon && salon.owner_pin_hash && comparePin(pin, salon.owner_pin_hash)) {
      return res.json({
        staff: { id: 'owner', display_name: 'Owner', role: 'owner', rbac_role: 'owner', permissions: null, permission_overrides: null }
      });
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
// No old password required — user is already authenticated as owner to reach settings
router.put('/owner-pin', async function(req, res, next) {
  try {
    var { new_pin } = req.body;
    if (!new_pin || String(new_pin).length < 2) {
      return res.status(400).json({ error: 'PIN must be at least 2 digits' });
    }

    // Get salon_id from JWT (set by authenticate middleware or from body)
    var salon_id = (req.auth && req.auth.salon_id) || req.body.salon_id;
    if (!salon_id) {
      return res.status(400).json({ error: 'salon_id is required' });
    }

    var newHash = hashPin(String(new_pin));
    await prisma.salon.update({
      where: { id: salon_id },
      data: { owner_pin_hash: newHash }
    });

    console.log('[Auth] Owner PIN updated for salon', salon_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
