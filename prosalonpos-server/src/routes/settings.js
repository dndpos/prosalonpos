/**
 * ProSalonPOS — Salon Settings Routes
 * Settings stored as a single JSON object per salon.
 * GET returns the full object; PUT merges partial updates.
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { emit } from '../utils/emit.js';

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

// ── GET / — Get salon settings ──
router.get('/', async function(req, res, next) {
  try {
    var row = await prisma.salonSettings.findUnique({
      where: { salon_id: req.salon_id }
    });

    if (!row) {
      // Return empty settings — but still include owner_pin_sha256 for local PIN check
      var salon = await prisma.salon.findUnique({ where: { id: req.salon_id } });
      var base = {};
      if (salon && salon.owner_pin_sha256) base.owner_pin_sha256 = salon.owner_pin_sha256;
      if (salon && salon.owner_pin_plain) base.owner_pin_plain = salon.owner_pin_plain;
      if (salon && salon.salon_code) base.salon_code = salon.salon_code;
      return res.json({ settings: base });
    }

    var settings = fromDb(row.settings) || {};
    // Include owner_pin_sha256 for local PIN check at checkout
    var salon = await prisma.salon.findUnique({ where: { id: req.salon_id } });
    if (salon && salon.owner_pin_sha256) settings.owner_pin_sha256 = salon.owner_pin_sha256;
    if (salon && salon.owner_pin_plain) settings.owner_pin_plain = salon.owner_pin_plain;
    if (salon && salon.salon_code) settings.salon_code = salon.salon_code;
    res.json({ settings: settings });
  } catch (err) { next(err); }
});

// ── PUT / — Update salon settings (merge) ──
router.put('/', async function(req, res, next) {
  try {
    var updates = req.body;

    // Upsert: create if doesn't exist, merge if it does
    var existing = await prisma.salonSettings.findUnique({
      where: { salon_id: req.salon_id }
    });

    var merged;
    if (existing) {
      var current = fromDb(existing.settings) || {};
      merged = Object.assign({}, current, updates);
      await prisma.salonSettings.update({
        where: { salon_id: req.salon_id },
        data: { settings: toDb(merged), version: { increment: 1 } }
      });
    } else {
      merged = updates;
      await prisma.salonSettings.create({
        data: { salon_id: req.salon_id, settings: toDb(merged) }
      });
    }

    emit(req, 'settings:updated');
    res.json({ settings: merged });
  } catch (err) { next(err); }
});

export default router;
