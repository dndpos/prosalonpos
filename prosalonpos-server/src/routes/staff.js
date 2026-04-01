/**
 * ProSalonPOS — Staff Routes
 * All endpoints require JWT authentication.
 * salon_id comes from the JWT token — never from the request.
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { hashPin, comparePin } from '../config/auth.js';
import { emit } from '../utils/emit.js';

// SQLite stores JSON fields as strings — stringify objects before writing
var JSON_FIELDS = ['category_commission_rates', 'permission_overrides', 'permissions', 'schedule'];
function toDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'object') return JSON.stringify(val);
  return val;
}
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

var router = Router();

// ── GET / — List all staff for this salon ──
router.get('/', async function(req, res, next) {
  try {
    var staff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id },
      include: { service_staff: true },
      orderBy: { position: 'asc' }
    });

    // Strip pin_hash, add assigned_service_ids from junction table
    var safe = staff.map(function(s) {
      var copy = Object.assign({}, s);
      delete copy.pin_hash;
      // Parse JSON fields from SQLite string storage
      JSON_FIELDS.forEach(function(f) { if (copy[f] !== undefined) copy[f] = fromDb(copy[f]); });
      copy.assigned_service_ids = (s.service_staff || []).map(function(ss) {
        return ss.service_catalog_id;
      });
      delete copy.service_staff;
      return copy;
    });

    res.json({ staff: safe });
  } catch (err) { next(err); }
});

// ── GET /:id — Single staff member ──
router.get('/:id', async function(req, res, next) {
  try {
    var s = await prisma.staff.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { service_staff: true }
    });
    if (!s) return res.status(404).json({ error: 'Staff not found' });

    delete s.pin_hash;
    JSON_FIELDS.forEach(function(f) { if (s[f] !== undefined) s[f] = fromDb(s[f]); });
    s.assigned_service_ids = (s.service_staff || []).map(function(ss) {
      return ss.service_catalog_id;
    });
    delete s.service_staff;
    res.json({ staff: s });
  } catch (err) { next(err); }
});

// ── POST / — Create new staff member ──
router.post('/', async function(req, res, next) {
  try {
    var data = req.body;
    var s = await prisma.staff.create({
      data: {
        salon_id: req.salon_id,
        display_name: data.display_name,
        legal_name: data.legal_name || null,
        photo_url: data.photo_url || null,
        role: data.role || 'technician',
        rbac_role: data.rbac_role || 'tech',
        pin_hash: hashPin(data.pin || '0000'),
        badge_id: data.badge_id || null,
        active: data.active !== false,
        tech_turn_eligible: data.tech_turn_eligible !== false,
        pay_type: data.pay_type || 'commission',
        commission_pct: data.commission_pct || 0,
        daily_guarantee_cents: data.daily_guarantee_cents || 0,
        hourly_rate_cents: data.hourly_rate_cents || null,
        commission_bonus_enabled: data.commission_bonus_enabled || false,
        salary_amount_cents: data.salary_amount_cents || null,
        salary_period: data.salary_period || null,
        payout_check_pct: data.payout_check_pct || 100,
        payout_bonus_pct: data.payout_bonus_pct || 0,
        category_commission_rates: toDb(data.category_commission_rates),
        permission_overrides: toDb(data.permission_overrides),
        permissions: toDb(data.permissions),
        schedule: toDb(data.schedule),
        position: data.position || 0,
      }
    });

    // Create service assignments if provided
    var assignedIds = data.assigned_service_ids || [];
    if (assignedIds.length > 0) {
      await prisma.serviceStaffAssignment.createMany({
        data: assignedIds.map(function(svcId) {
          return { service_catalog_id: svcId, staff_id: s.id };
        })
      });
    }

    delete s.pin_hash;
    s.assigned_service_ids = assignedIds;
    emit(req, 'staff:created');
    res.status(201).json({ staff: s });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update staff member ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.staff.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Staff not found' });

    var data = req.body;
    var updateData = {};

    // Only include fields that were sent
    var fields = ['display_name', 'legal_name', 'photo_url', 'role', 'rbac_role',
      'badge_id', 'active', 'status', 'tech_turn_eligible', 'pay_type',
      'commission_pct', 'daily_guarantee_cents', 'hourly_rate_cents',
      'commission_bonus_enabled', 'salary_amount_cents', 'salary_period',
      'payout_check_pct', 'payout_bonus_pct', 'category_commission_rates',
      'permission_overrides', 'permissions', 'schedule', 'position'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) {
        updateData[f] = JSON_FIELDS.indexOf(f) >= 0 ? toDb(data[f]) : data[f];
      }
    });

    // Handle PIN change separately (needs hashing)
    if (data.pin) {
      updateData.pin_hash = hashPin(data.pin);
    }

    updateData.version = { increment: 1 };

    var s = await prisma.staff.update({
      where: { id: req.params.id },
      data: updateData,
      include: { service_staff: true }
    });

    // Handle assigned_service_ids if provided (replace all assignments)
    if (data.assigned_service_ids !== undefined) {
      // Delete existing assignments
      await prisma.serviceStaffAssignment.deleteMany({
        where: { staff_id: req.params.id }
      });
      // Create new assignments
      var assignedIds = data.assigned_service_ids || [];
      if (assignedIds.length > 0) {
        await prisma.serviceStaffAssignment.createMany({
          data: assignedIds.map(function(svcId) {
            return { service_catalog_id: svcId, staff_id: req.params.id };
          })
        });
      }
      s.assigned_service_ids = assignedIds;
    } else {
      s.assigned_service_ids = (s.service_staff || []).map(function(ss) {
        return ss.service_catalog_id;
      });
    }

    delete s.pin_hash;
    delete s.service_staff;
    JSON_FIELDS.forEach(function(f) { if (s[f] !== undefined) s[f] = fromDb(s[f]); });
    emit(req, 'staff:updated');
    res.json({ staff: s });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Soft delete (deactivate) ──
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.staff.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Staff not found' });

    var s = await prisma.staff.update({
      where: { id: req.params.id },
      data: { active: false, status: 'deactivated', version: { increment: 1 } }
    });

    delete s.pin_hash;
    emit(req, 'staff:deleted');
    res.json({ staff: s });
  } catch (err) { next(err); }
});

// ── POST /verify-any-pin — Verify any staff PIN (RBAC checkout login) ──
// Must be before /:id routes so Express doesn't treat 'verify-any-pin' as an id
router.post('/verify-any-pin', async function(req, res, next) {
  try {
    var allStaff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id, active: true }
    });

    var pin = req.body.pin;
    var match = null;
    for (var i = 0; i < allStaff.length; i++) {
      if (comparePin(pin, allStaff[i].pin_hash)) {
        match = allStaff[i];
        break;
      }
    }

    if (!match) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      staff: {
        id: match.id,
        display_name: match.display_name,
        role: match.role,
        rbac_role: match.rbac_role,
        permissions: match.permissions,
        permission_overrides: match.permission_overrides,
      }
    });
  } catch (err) { next(err); }
});

// ── POST /:id/verify-pin — Verify a specific staff member's PIN ──
router.post('/:id/verify-pin', async function(req, res, next) {
  try {
    var s = await prisma.staff.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!s) return res.status(404).json({ error: 'Staff not found' });

    if (!comparePin(req.body.pin, s.pin_hash)) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    res.json({
      valid: true,
      staff: {
        id: s.id,
        display_name: s.display_name,
        role: s.role,
        rbac_role: s.rbac_role,
        permissions: s.permissions,
        permission_overrides: s.permission_overrides
      }
    });
  } catch (err) { next(err); }
});

export default router;
