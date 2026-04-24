/**
 * ProSalonPOS — Salon Terminals (cc19)
 *
 * CRUD for the SalonTerminal table. One row per physical PAX terminal a
 * salon owns (one per station). Fiserv merges all batches into a single
 * ACH deposit regardless of how many terminals report in.
 *
 *   GET    /salon-terminals           → list all active+inactive terminals for the salon
 *   POST   /salon-terminals           → create a new terminal row
 *   PATCH  /salon-terminals/:id       → update fields (name, pax_ip, station binding, active)
 *   DELETE /salon-terminals/:id       → soft-delete by flipping active=false (hard-delete via ?hard=1)
 *   POST   /salon-terminals/:id/register-station  → link this row to a helper's stationKey
 *
 * Auth: expects the standard /api/v1 authenticate middleware (req.salon_id set).
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

function cleanPort(v, fallback) {
  var n = parseInt(v, 10);
  if (!isFinite(n) || n <= 0 || n > 65535) return fallback;
  return n;
}

function ipLooksValid(ip) {
  if (typeof ip !== 'string') return false;
  var s = ip.trim();
  if (!s) return false;
  // Accept IPv4, hostnames, and 127.0.0.1. Server keeps validation loose —
  // the station UI has stricter checks before it submits.
  return /^[A-Za-z0-9._-]+$/.test(s);
}

// ── GET / — list terminals for the current salon ──
router.get('/', async function(req, res, next) {
  try {
    var terminals = await prisma.salonTerminal.findMany({
      where: { salon_id: req.salon_id },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    res.json({ terminals: terminals });
  } catch (err) { next(err); }
});

// ── POST / — create a new terminal ──
router.post('/', async function(req, res, next) {
  try {
    var data = req.body || {};
    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!ipLooksValid(data.pax_ip)) {
      return res.status(400).json({ error: 'pax_ip is required and must be a hostname or IP' });
    }
    var created = await prisma.salonTerminal.create({
      data: {
        salon_id:    req.salon_id,
        name:        String(data.name).trim(),
        station_key: data.station_key || null,
        station_id:  data.station_id || null,
        helper_host: data.helper_host || '127.0.0.1',
        helper_port: cleanPort(data.helper_port, 10009),
        pax_ip:      String(data.pax_ip).trim(),
        pax_port:    cleanPort(data.pax_port, 10009),
        cc_device_id: data.cc_device_id || null,
        active:      data.active !== false,
      },
    });
    res.status(201).json({ terminal: created });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: 'station_key is already bound to another terminal' });
    }
    next(err);
  }
});

// ── PATCH /:id — update ──
router.patch('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.salonTerminal.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Terminal not found' });
    var data = req.body || {};
    var patch = {};
    if (data.name != null) patch.name = String(data.name).trim();
    if (data.station_key !== undefined) patch.station_key = data.station_key || null;
    if (data.station_id !== undefined) patch.station_id = data.station_id || null;
    if (data.helper_host != null) patch.helper_host = data.helper_host;
    if (data.helper_port != null) patch.helper_port = cleanPort(data.helper_port, existing.helper_port);
    if (data.pax_ip != null) {
      if (!ipLooksValid(data.pax_ip)) return res.status(400).json({ error: 'pax_ip must be a hostname or IP' });
      patch.pax_ip = String(data.pax_ip).trim();
    }
    if (data.pax_port != null) patch.pax_port = cleanPort(data.pax_port, existing.pax_port);
    if (data.cc_device_id !== undefined) patch.cc_device_id = data.cc_device_id || null;
    if (data.active != null) patch.active = !!data.active;
    var updated = await prisma.salonTerminal.update({
      where: { id: existing.id },
      data: patch,
    });
    res.json({ terminal: updated });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: 'station_key is already bound to another terminal' });
    }
    next(err);
  }
});

// ── DELETE /:id — soft delete (active=false) unless ?hard=1 ──
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.salonTerminal.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Terminal not found' });
    if (String(req.query.hard || '') === '1') {
      await prisma.salonTerminal.delete({ where: { id: existing.id } });
      return res.json({ success: true, hard: true });
    }
    var updated = await prisma.salonTerminal.update({
      where: { id: existing.id },
      data: { active: false },
    });
    res.json({ success: true, terminal: updated });
  } catch (err) { next(err); }
});

// ── POST /:id/register-station — link a helper's stationKey to this row ──
// Called by the "Register this station" button in the Terminals panel. The
// station reads its local helper-config.json, posts the stationKey, and the
// server binds it to the selected SalonTerminal row.
router.post('/:id/register-station', async function(req, res, next) {
  try {
    var existing = await prisma.salonTerminal.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Terminal not found' });
    var key = req.body && req.body.station_key;
    if (!key || typeof key !== 'string' || key.length < 8) {
      return res.status(400).json({ error: 'station_key is required (UUID from helper-config.json)' });
    }
    // Unbind the key from any other terminal first (owner may re-register).
    await prisma.salonTerminal.updateMany({
      where: { salon_id: req.salon_id, station_key: key, NOT: { id: existing.id } },
      data: { station_key: null },
    });
    var updated = await prisma.salonTerminal.update({
      where: { id: existing.id },
      data: { station_key: key, station_id: req.body.station_id || existing.station_id },
    });
    res.json({ terminal: updated });
  } catch (err) { next(err); }
});

export default router;
