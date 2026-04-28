/**
 * ProSalonPOS — Staff Routes
 * All endpoints require JWT authentication.
 * salon_id comes from the JWT token — never from the request.
 */
import { Router, raw } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { hashPin, comparePin, comparePinAsync, hashPinAsync, pinSha256 } from '../config/auth.js';
import { emit } from '../utils/emit.js';
// PROTECTED C64: master code from env var via provider.js
import { PROVIDER_MASTER_CODE } from './provider.js';

// cc4.5: sharp is used to re-encode + downscale uploaded avatars to a fixed
// 512×512 JPEG. Importing lazily so the server still boots if sharp is absent.
var _sharpModule = null;
async function getSharp() {
  if (_sharpModule) return _sharpModule;
  try { _sharpModule = (await import('sharp')).default; return _sharpModule; }
  catch (e) { console.warn('[Staff/photo] sharp not available:', e.message); return null; }
}

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

// cc4.5: Never leak photo_blob out of a JSON response. Bytes column would
// otherwise balloon the /staff payload by hundreds of KB per tech and defeat
// the whole point of serving photos via the dedicated cached endpoint.
function stripHeavyFields(s) {
  delete s.photo_blob;
  delete s.photo_mime;
  delete s.pin_hash;
  return s;
}

// cc5.8: Authoritatively wipe pay fields that don't match the active pay_type
// so the three tabs (commission / hourly / salary) can never coexist in the
// DB. Mutates `data` in place. Called by POST (create) and PUT (update) so
// both the "new staff" and "edit staff" paths produce the same clean shape.
// `commission_bonus_enabled` is the legit sub-option inside hourly/salary —
// when that flag is true, commission_pct is preserved. When it's false,
// commission_pct is wiped along with the other cross-tab fields.
function enforcePayTypeExclusivity(data) {
  if (!data || typeof data.pay_type !== 'string') return;
  var t = data.pay_type;
  if (t === 'commission') {
    data.hourly_rate_cents = null;
    data.salary_amount_cents = null;
    data.salary_period = null;
    data.commission_bonus_enabled = false;
  } else if (t === 'hourly') {
    data.salary_amount_cents = null;
    data.salary_period = null;
    data.daily_guarantee_cents = 0;
    if (!data.commission_bonus_enabled) {
      data.commission_pct = 0;
    }
  } else if (t === 'salary') {
    data.hourly_rate_cents = null;
    data.daily_guarantee_cents = 0;
    if (!data.commission_bonus_enabled) {
      data.commission_pct = 0;
    }
  }
}

// ── GET / — List all staff for this salon ──
router.get('/', async function(req, res, next) {
  try {
    var staff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id },
      include: { service_staff: true },
      orderBy: { position: 'asc' }
    });

    // Strip pin_hash + photo_blob, add assigned_service_ids from junction table
    var safe = staff.map(function(s) {
      var copy = Object.assign({}, s);
      stripHeavyFields(copy);
      // Show plain PIN for non-owners only
      if (copy.role !== 'owner' && copy.pin_plain) {
        copy.pin_display = copy.pin_plain;
      }
      delete copy.pin_plain;
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

    stripHeavyFields(s);
    if (s.role !== 'owner' && s.pin_plain) {
      s.pin_display = s.pin_plain;
    }
    delete s.pin_plain;
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
    enforcePayTypeExclusivity(data); // cc5.8 — see helper above

    // Owner role staff uses salon owner PIN — no separate PIN needed
    if (data.role === 'owner') {
      var salon = await prisma.salon.findUnique({
        where: { id: req.salon_id },
        select: { owner_pin_hash: true, owner_pin_sha256: true }
      });
      if (!salon || !salon.owner_pin_hash) {
        return res.status(400).json({ error: 'Owner PIN not set in Salon Information. Set it first.' });
      }

      // Check only one owner staff record at a time
      var existingOwner = await prisma.staff.findFirst({
        where: { salon_id: req.salon_id, role: 'owner', active: true }
      });
      if (existingOwner) {
        return res.status(409).json({ error: 'An active Owner staff member already exists: ' + existingOwner.display_name });
      }

      var s = await prisma.staff.create({
        data: {
          salon_id: req.salon_id,
          display_name: data.display_name,
          legal_name: data.legal_name || null,
          photo_url: data.photo_url || null,
          role: 'owner',
          rbac_role: 'owner',
          pin_hash: salon.owner_pin_hash,
          pin_sha256: salon.owner_pin_sha256,
          badge_id: data.badge_id || null,
          active: data.active !== false,
          tech_turn_eligible: data.tech_turn_eligible !== false,
          show_on_calendar: data.show_on_calendar !== false,
          show_on_online_booking: data.show_on_online_booking !== false,
          pay_type: data.pay_type || 'commission',
          commission_pct: data.commission_pct || 0,
          daily_guarantee_cents: data.daily_guarantee_cents || 0,
          hourly_rate_cents: data.hourly_rate_cents || null,
          salary_amount_cents: data.salary_amount_cents || null,
          salary_period: data.salary_period || null,
          commission_bonus_enabled: data.commission_bonus_enabled || false,
          payout_check_pct: data.payout_check_pct != null ? data.payout_check_pct : 100,
          payout_bonus_pct: data.payout_bonus_pct || 0,
          category_commission_rates: toDb(data.category_commission_rates || {}),
          retail_commission_pct: data.retail_commission_pct || 0,
          permission_overrides: toDb(data.permission_overrides || {}),
          permissions: toDb(data.permissions || {}),
          schedule: toDb(data.schedule || null),
          position: data.position || 0,
          status: 'active',
        },
        include: { service_staff: true }
      });

      var copy = Object.assign({}, s);
      delete copy.pin_hash;
      JSON_FIELDS.forEach(function(f) { if (copy[f] !== undefined) copy[f] = fromDb(copy[f]); });
      copy.assigned_service_ids = [];
      delete copy.service_staff;
      emit(req, 'staff:updated');
      return res.status(201).json({ staff: copy });
    }

    var newPin = data.pin || '0000';

    // ── Run duplicate check + bcrypt hash in PARALLEL ──
    var newPinSha = pinSha256(newPin);
    var newPinPlain = newPin; // Store plain PIN for display in edit screen
    var [existingStaff, salon, pinHashResult] = await Promise.all([
      prisma.staff.findMany({ where: { salon_id: req.salon_id, active: true, role: { not: 'owner' } }, select: { pin_sha256: true, display_name: true } }),
      prisma.salon.findUnique({ where: { id: req.salon_id }, select: { owner_pin_sha256: true } }),
      hashPinAsync(newPin)
    ]);

    // Check duplicates
    var dupStaff = existingStaff.find(function(s) { return s.pin_sha256 === newPinSha; });
    if (dupStaff) {
      return res.status(409).json({ error: 'PIN already in use by ' + dupStaff.display_name });
    }
    if (salon && salon.owner_pin_sha256 && salon.owner_pin_sha256 === newPinSha) {
      return res.status(409).json({ error: 'PIN already in use by Owner' });
    }

    var s = await prisma.staff.create({
      data: {
        salon_id: req.salon_id,
        display_name: data.display_name,
        legal_name: data.legal_name || null,
        photo_url: data.photo_url || null,
        role: data.role || 'technician',
        rbac_role: data.rbac_role || 'tech',
        pin_hash: pinHashResult,
        pin_sha256: newPinSha,
        pin_plain: newPinPlain,
        badge_id: data.badge_id || null,
        active: data.active !== false,
        tech_turn_eligible: data.tech_turn_eligible !== false,
        show_on_calendar: data.show_on_calendar !== false,
        show_on_online_booking: data.show_on_online_booking !== false,
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
        retail_commission_pct: data.retail_commission_pct || 0,
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
    if (s.role !== 'owner' && s.pin_plain) {
      s.pin_display = s.pin_plain;
    }
    delete s.pin_plain;
    s.assigned_service_ids = assignedIds;
    emit(req, 'staff:created');
    res.status(201).json({ staff: s });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update staff member ──
router.put('/:id', async function(req, res, next) {
  try {
    var data = req.body;
    enforcePayTypeExclusivity(data); // cc5.8 — see helper above
    var updateData = {};

    // Only include fields that were sent
    var fields = ['display_name', 'legal_name', 'photo_url', 'role', 'rbac_role',
      'badge_id', 'active', 'status', 'tech_turn_eligible', 'show_on_calendar', 'show_on_online_booking', 'pay_type',
      'commission_pct', 'daily_guarantee_cents', 'hourly_rate_cents',
      'commission_bonus_enabled', 'salary_amount_cents', 'salary_period',
      'payout_check_pct', 'payout_bonus_pct', 'category_commission_rates',
      'retail_commission_pct',  // 2026-04-26: per-staff product commission %
      'permission_overrides', 'permissions', 'schedule', 'position'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) {
        updateData[f] = JSON_FIELDS.indexOf(f) >= 0 ? toDb(data[f]) : data[f];
      }
    });

    // Handle PIN change separately (needs hashing + duplicate check)
    // Owner role staff always uses salon owner PIN — never a separate PIN
    if (data.pin) {
      // Need existing record to check role
      var existing = await prisma.staff.findFirst({
        where: { id: req.params.id, salon_id: req.salon_id },
        select: { role: true }
      });
      if (!existing) return res.status(404).json({ error: 'Staff not found' });

      var effectiveRole = data.role || existing.role;
      if (effectiveRole === 'owner') {
        var salonForOwner = await prisma.salon.findUnique({
          where: { id: req.salon_id },
          select: { owner_pin_hash: true, owner_pin_sha256: true }
        });
        if (salonForOwner && salonForOwner.owner_pin_hash) {
          updateData.pin_hash = salonForOwner.owner_pin_hash;
          updateData.pin_sha256 = salonForOwner.owner_pin_sha256;
        }
      } else {
        var newPinSha = pinSha256(data.pin);
        var [otherStaff, salon2, pinHashResult] = await Promise.all([
          prisma.staff.findMany({ where: { salon_id: req.salon_id, active: true, id: { not: req.params.id }, role: { not: 'owner' } }, select: { pin_sha256: true, display_name: true } }),
          prisma.salon.findUnique({ where: { id: req.salon_id }, select: { owner_pin_sha256: true } }),
          hashPinAsync(data.pin)
        ]);
        var dupStaff = otherStaff.find(function(s) { return s.pin_sha256 === newPinSha; });
        if (dupStaff) {
          return res.status(409).json({ error: 'PIN already in use by ' + dupStaff.display_name });
        }
        if (salon2 && salon2.owner_pin_sha256 && salon2.owner_pin_sha256 === newPinSha) {
          return res.status(409).json({ error: 'PIN already in use by Owner' });
        }
        updateData.pin_hash = pinHashResult;
        updateData.pin_sha256 = newPinSha;
        updateData.pin_plain = data.pin;
      }
    }

    updateData.version = { increment: 1 };

    // Use a transaction to batch update + service assignment into one DB round trip
    var s = await prisma.$transaction(async function(tx) {
      var updated = await tx.staff.update({
        where: { id: req.params.id },
        data: updateData,
        include: { service_staff: true }
      });

      // Only replace service assignments if provided AND changed
      if (data.assigned_service_ids !== undefined) {
        var oldIds = (updated.service_staff || []).map(function(ss) { return ss.service_catalog_id; }).sort();
        var newIds = (data.assigned_service_ids || []).slice().sort();
        var changed = oldIds.length !== newIds.length || oldIds.some(function(id, i) { return id !== newIds[i]; });

        if (changed) {
          await tx.serviceStaffAssignment.deleteMany({ where: { staff_id: req.params.id } });
          if (newIds.length > 0) {
            await tx.serviceStaffAssignment.createMany({
              data: newIds.map(function(svcId) {
                return { service_catalog_id: svcId, staff_id: req.params.id };
              })
            });
          }
        }
        updated.assigned_service_ids = data.assigned_service_ids || [];
      } else {
        updated.assigned_service_ids = (updated.service_staff || []).map(function(ss) {
          return ss.service_catalog_id;
        });
      }

      return updated;
    }, { timeout: 20000 });

    delete s.pin_hash;
    delete s.service_staff;
    if (s.role !== 'owner' && s.pin_plain) {
      s.pin_display = s.pin_plain;
    }
    delete s.pin_plain;
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
// Fast path: SHA-256 lookup table (instant). Fallback: sequential bcrypt (slow but catches edge cases).
router.post('/verify-any-pin', async function(req, res, next) {
  try {
    var pin = req.body.pin;
    var inputHash = pinSha256(pin);

    // 1. Build SHA-256 lookup table from all active staff
    var allStaff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id, active: true }
    });

    // Fast SHA-256 match
    var sha256Match = null;
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].pin_sha256 && allStaff[i].pin_sha256 === inputHash) {
        sha256Match = allStaff[i];
        break;
      }
    }

    if (sha256Match) {
      return res.json({
        valid: true,
        staff: {
          id: sha256Match.id,
          display_name: sha256Match.display_name,
          role: sha256Match.role,
          rbac_role: sha256Match.rbac_role,
          permissions: sha256Match.permissions,
          permission_overrides: sha256Match.permission_overrides,
        }
      });
    }

    // 2. Check owner PIN — SHA-256 fast path first
    var salon = await prisma.salon.findUnique({ where: { id: req.salon_id } });
    if (salon && salon.owner_pin_sha256 && salon.owner_pin_sha256 === inputHash) {
      return res.json({
        valid: true,
        staff: {
          id: 'owner',
          display_name: 'Owner',
          role: 'owner',
          rbac_role: 'owner',
          permissions: null,
          permission_overrides: null,
        }
      });
    }

    // 3. Owner bcrypt fallback (covers cases where sha256 not yet backfilled)
    if (salon && salon.owner_pin_hash) {
      var ownerMatch = await comparePinAsync(pin, salon.owner_pin_hash);
      if (ownerMatch) {
        // Backfill sha256 for next time
        if (!salon.owner_pin_sha256) {
          prisma.salon.update({ where: { id: req.salon_id }, data: { owner_pin_sha256: inputHash } }).catch(function() {});
        }
        return res.json({
          valid: true,
          staff: {
            id: 'owner',
            display_name: 'Owner',
            role: 'owner',
            rbac_role: 'owner',
            permissions: null,
            permission_overrides: null,
          }
        });
      }
    }

    // 4. Provider master code
    if (pin === PROVIDER_MASTER_CODE) {
      return res.json({
        valid: true,
        staff: {
          id: 'provider',
          display_name: 'Provider',
          role: 'owner',
          rbac_role: 'owner',
          permissions: null,
          permission_overrides: null,
        }
      });
    }

    // 5. Slow bcrypt fallback for staff (covers missing pin_sha256)
    for (var j = 0; j < allStaff.length; j++) {
      if (allStaff[j].pin_hash && !allStaff[j].pin_sha256) {
        var isMatch = await comparePinAsync(pin, allStaff[j].pin_hash);
        if (isMatch) {
          // Backfill sha256 for next time
          prisma.staff.update({ where: { id: allStaff[j].id }, data: { pin_sha256: inputHash } }).catch(function() {});
          return res.json({
            valid: true,
            staff: {
              id: allStaff[j].id,
              display_name: allStaff[j].display_name,
              role: allStaff[j].role,
              rbac_role: allStaff[j].rbac_role,
              permissions: allStaff[j].permissions,
              permission_overrides: allStaff[j].permission_overrides,
            }
          });
        }
      }
    }

    return res.json({ valid: false });
  } catch (err) { next(err); }
});

// ── POST /:id/verify-pin — Verify a specific staff member's PIN ──
router.post('/:id/verify-pin', async function(req, res, next) {
  try {
    var s = await prisma.staff.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!s) return res.status(404).json({ error: 'Staff not found' });

    if (!(await comparePinAsync(req.body.pin, s.pin_hash))) {
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

// ═══════════════════════════════════════════════════════════════════════
// cc4.5: Avatar upload
// ═══════════════════════════════════════════════════════════════════════
// POST /api/v1/staff/:id/photo — tech uploads their own avatar.
//
// Design choices:
//   • Authenticated + self-only: JWT staff_id must match :id (owner/manager
//     bypass for salon admin use). Techs can never overwrite another tech's
//     photo.
//   • Re-encoded server-side with sharp → fixed 512×512 JPEG at q=80. Browser
//     will also shrink before upload, but the server re-encode guarantees
//     size + strips EXIF (no GPS from the phone photo leaks out).
//   • Stored as Bytes on the Staff row (single table, no volume/S3 setup).
//     photo_blob column is stripped from every non-photo response via
//     stripHeavyFields so list queries stay light.
//   • Old photo is NOT archived — the new blob simply overwrites the column.
//     photo_updated_at advances, photo_url gets a fresh ?v=<ts> so caches
//     invalidate naturally.
// ═══════════════════════════════════════════════════════════════════════
router.post('/:id/photo', raw({ type: 'image/*', limit: '2mb' }), async function(req, res, next) {
  try {
    var targetId = req.params.id;
    var callerId = req.staff_id;
    var callerRole = req.staff_role || '';
    var isSelf = targetId === callerId;
    var isAdmin = callerRole === 'owner' || callerRole === 'manager';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'You can only update your own photo' });
    }

    var target = await prisma.staff.findFirst({
      where: { id: targetId, salon_id: req.salon_id },
      select: { id: true }
    });
    if (!target) return res.status(404).json({ error: 'Staff not found' });

    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'No image data received' });
    }

    var sharp = await getSharp();
    if (!sharp) {
      return res.status(500).json({ error: 'Image processing unavailable' });
    }

    var processed;
    try {
      processed = await sharp(req.body)
        .rotate()                                          // honour EXIF orientation
        .resize(512, 512, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid image file' });
    }

    var now = new Date();
    var photoUrl = '/photos/staff/' + targetId + '?v=' + now.getTime();

    await prisma.staff.update({
      where: { id: targetId },
      data: {
        photo_blob: processed,
        photo_mime: 'image/jpeg',
        photo_updated_at: now,
        photo_url: photoUrl,
      }
    });

    emit(req, 'staff:photo_updated', { staff_id: targetId, photo_url: photoUrl });

    res.json({ photo_url: photoUrl, size_bytes: processed.length });
  } catch (err) { next(err); }
});

export default router;
