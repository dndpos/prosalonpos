/**
 * ProSalonPOS — Provider Salon Owner Routes (v2.1.3)
 *
 * Multi-owner portal management. CRUD for SalonOwnerAccount + SalonOwnerAccess.
 * Person-level owner accounts (separate from Salon.owner_pin_*, separate from
 * ProviderOwner). One person can own multiple salons; multiple people can own
 * the same salon (partner case).
 *
 * Mounted under /api/v1/provider — requires providerAuth middleware (added by
 * provider.js before mounting this sub-router).
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { hashPin } from '../config/auth.js';

var router = Router();

// ── Audit helper (mirrors providerSalons.js) ──
async function addAudit(req, action, detail, salonId) {
  var actorName = 'Unknown';
  try {
    var owner = await prisma.providerOwner.findUnique({ where: { id: req.provider_id } });
    if (owner) actorName = owner.name;
  } catch (e) { /* ignore */ }

  await prisma.providerAuditLog.create({
    data: {
      actor_id: req.provider_id,
      actor_name: actorName,
      action: action,
      detail: detail,
      salon_id: salonId || null,
    }
  });
}

// Strip pin_hash before returning. pin_plain is included so the provider can
// hand it back to the owner; this is a provider-only route.
function formatOwner(o) {
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    pin_plain: o.pin_plain,
    must_change_pin: o.must_change_pin,
    active: o.active,
    locked: o.locked,
    last_login_at: o.last_login_at,
    last_salon_id: o.last_salon_id,
    created_at: o.created_at,
    salons: (o.salon_access || []).map(function(sa) {
      return {
        access_id: sa.id,
        salon_id: sa.salon_id,
        salon_name: sa.salon ? sa.salon.name : null,
      };
    }),
  };
}

// ── GET /salon-owners — list all owner accounts ──
router.get('/salon-owners', async function(req, res, next) {
  try {
    var owners = await prisma.salonOwnerAccount.findMany({
      orderBy: { name: 'asc' },
      include: {
        salon_access: { include: { salon: { select: { id: true, name: true } } } },
      },
    });
    res.json({ owners: owners.map(formatOwner) });
  } catch (err) { next(err); }
});

// ── GET /salon-owners/:id ──
router.get('/salon-owners/:id', async function(req, res, next) {
  try {
    var owner = await prisma.salonOwnerAccount.findUnique({
      where: { id: req.params.id },
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    res.json({ owner: formatOwner(owner) });
  } catch (err) { next(err); }
});

// ── POST /salon-owners — create owner account ──
// Body: { name, email, pin, salon_ids: [..] }
router.post('/salon-owners', async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    var email = (req.body.email || '').trim().toLowerCase();
    var pin = String(req.body.pin || '').trim();
    var salonIds = Array.isArray(req.body.salon_ids) ? req.body.salon_ids : [];

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (!pin || pin.length < 4 || pin.length > 8) return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    if (!/^\d+$/.test(pin)) return res.status(400).json({ error: 'PIN must be digits only' });

    // Email must be unique
    var dup = await prisma.salonOwnerAccount.findUnique({ where: { email: email } });
    if (dup) return res.status(409).json({ error: 'An owner with that email already exists' });

    var pinHash = hashPin(pin);

    var created = await prisma.salonOwnerAccount.create({
      data: {
        name: name,
        email: email,
        pin_hash: pinHash,
        pin_plain: pin,
        must_change_pin: true,
        active: true,
        salon_access: {
          create: salonIds.map(function(sid) { return { salon_id: sid }; }),
        },
      },
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });

    await addAudit(req, 'salon_owner_created', 'Created owner ' + name + ' (' + email + '), salons: ' + salonIds.length, null);
    res.json({ owner: formatOwner(created) });
  } catch (err) { next(err); }
});

// ── PUT /salon-owners/:id — update name/email/active ──
// Body: { name?, email?, active? }
router.put('/salon-owners/:id', async function(req, res, next) {
  try {
    var existing = await prisma.salonOwnerAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Owner not found' });

    var data = {};
    if (typeof req.body.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body.email === 'string') {
      var newEmail = req.body.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) return res.status(400).json({ error: 'Invalid email format' });
      if (newEmail !== existing.email) {
        var dup = await prisma.salonOwnerAccount.findUnique({ where: { email: newEmail } });
        if (dup) return res.status(409).json({ error: 'Email already in use' });
      }
      data.email = newEmail;
    }
    if (typeof req.body.active === 'boolean') data.active = req.body.active;

    var updated = await prisma.salonOwnerAccount.update({
      where: { id: req.params.id },
      data: data,
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });

    await addAudit(req, 'salon_owner_updated', 'Updated owner ' + updated.name, null);
    res.json({ owner: formatOwner(updated) });
  } catch (err) { next(err); }
});

// ── PUT /salon-owners/:id/pin — provider-side PIN reset ──
// Body: { pin } — sets pin and forces change on next login
router.put('/salon-owners/:id/pin', async function(req, res, next) {
  try {
    var existing = await prisma.salonOwnerAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Owner not found' });

    var pin = String(req.body.pin || '').trim();
    if (!pin || pin.length < 4 || pin.length > 8) return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    if (!/^\d+$/.test(pin)) return res.status(400).json({ error: 'PIN must be digits only' });

    var updated = await prisma.salonOwnerAccount.update({
      where: { id: req.params.id },
      data: {
        pin_hash: hashPin(pin),
        pin_plain: pin,
        must_change_pin: true,
        failed_attempts: 0,
        locked: false,
        locked_at: null,
      },
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });

    await addAudit(req, 'salon_owner_pin_reset', 'Reset PIN for owner ' + updated.name, null);
    res.json({ owner: formatOwner(updated) });
  } catch (err) { next(err); }
});

// ── PUT /salon-owners/:id/salons — replace salon assignments ──
// Body: { salon_ids: [..] } — full replacement of access list
router.put('/salon-owners/:id/salons', async function(req, res, next) {
  try {
    var existing = await prisma.salonOwnerAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Owner not found' });

    var salonIds = Array.isArray(req.body.salon_ids) ? req.body.salon_ids : [];

    // Replace: delete all current access, add new
    await prisma.salonOwnerAccess.deleteMany({ where: { owner_id: req.params.id } });
    if (salonIds.length > 0) {
      await prisma.salonOwnerAccess.createMany({
        data: salonIds.map(function(sid) { return { owner_id: req.params.id, salon_id: sid }; }),
      });
    }

    var updated = await prisma.salonOwnerAccount.findUnique({
      where: { id: req.params.id },
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });

    await addAudit(req, 'salon_owner_access_updated', 'Set salon access for ' + updated.name + ' to ' + salonIds.length + ' salon(s)', null);
    res.json({ owner: formatOwner(updated) });
  } catch (err) { next(err); }
});

// ── PUT /salon-owners/:id/unlock — clear lockout ──
router.put('/salon-owners/:id/unlock', async function(req, res, next) {
  try {
    var existing = await prisma.salonOwnerAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Owner not found' });

    var updated = await prisma.salonOwnerAccount.update({
      where: { id: req.params.id },
      data: { failed_attempts: 0, locked: false, locked_at: null },
      include: { salon_access: { include: { salon: { select: { id: true, name: true } } } } },
    });

    await addAudit(req, 'salon_owner_unlocked', 'Unlocked owner ' + updated.name, null);
    res.json({ owner: formatOwner(updated) });
  } catch (err) { next(err); }
});

// ── DELETE /salon-owners/:id ──
router.delete('/salon-owners/:id', async function(req, res, next) {
  try {
    var existing = await prisma.salonOwnerAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Owner not found' });

    await prisma.salonOwnerAccount.delete({ where: { id: req.params.id } });
    await addAudit(req, 'salon_owner_deleted', 'Deleted owner ' + existing.name + ' (' + existing.email + ')', null);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
