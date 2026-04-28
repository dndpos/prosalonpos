/**
 * ProSalonPOS — Stations Routes (v2.2.0)
 *
 * Salon-scoped CRUD for the persistent Station table. Stations are
 * upserted by the socket join-salon handler; this route lets the salon
 * owner manage labels, designate the main station, and remove orphans.
 *
 * Mounted under /api/v1/stations — salon-scoped JWT required (authenticate
 * middleware sets req.salon_id).
 *
 * Phase 1 of multi-station main-station designation. Does NOT change batch
 * close (each terminal closes its own batch — Fiserv is per-terminal/MID).
 * Used for: ★ MAIN badge, terminal-sharing default, reports default scope.
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

// v2.3.5: stations not seen in 7+ days are flagged "stale" so the UI can
// dim them and offer bulk cleanup. Plan-limit enforcement is independent
// (it counts ActiveSession rows, not Station rows), so stale records don't
// burn slots — they're just visual clutter.
var STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function format(s) {
  if (!s) return null;
  var lastSeenMs = s.last_seen ? new Date(s.last_seen).getTime() : null;
  var isStale = !lastSeenMs || (Date.now() - lastSeenMs) > STALE_AFTER_MS;
  return {
    id: s.id,
    label: s.label,
    is_main: !!s.is_main,
    last_seen: s.last_seen,
    lan_ip: s.lan_ip || null, // v2.2.6: surfaced for V2.3 offline routing + diagnostic
    created_at: s.created_at,
    is_stale: isStale, // v2.3.5
  };
}

// ── GET /stations — list all stations for this salon ──
router.get('/', async function(req, res, next) {
  try {
    var stations = await prisma.station.findMany({
      where: { salon_id: req.salon_id },
      orderBy: [{ is_main: 'desc' }, { created_at: 'asc' }],
    });
    res.json({ stations: stations.map(format) });
  } catch (err) { next(err); }
});

// ── PUT /stations/:id — rename label ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.station.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Station not found' });

    var newLabel = (req.body.label || '').trim();
    if (!newLabel) return res.status(400).json({ error: 'Label is required' });

    // Reject duplicate labels in the same salon
    var dup = await prisma.station.findFirst({
      where: { salon_id: req.salon_id, label: newLabel, id: { not: existing.id } },
      select: { id: true },
    });
    if (dup) return res.status(409).json({ error: 'Another station already uses that label' });

    var updated = await prisma.station.update({
      where: { id: existing.id },
      data: { label: newLabel },
    });
    res.json({ station: format(updated) });
  } catch (err) { next(err); }
});

// ── PUT /stations/:id/main — promote to main (atomically un-mains the rest) ──
router.put('/:id/main', async function(req, res, next) {
  try {
    var existing = await prisma.station.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Station not found' });

    await prisma.$transaction([
      prisma.station.updateMany({
        where: { salon_id: req.salon_id, is_main: true, id: { not: existing.id } },
        data: { is_main: false },
      }),
      prisma.station.update({
        where: { id: existing.id },
        data: { is_main: true },
      }),
    ]);

    var updated = await prisma.station.findUnique({ where: { id: existing.id } });
    res.json({ station: format(updated) });
  } catch (err) { next(err); }
});

// ── PUT /stations/clear-main — un-main any current main station ──
// v2.2.1: lets the owner reset the main designation entirely (no main = no default).
router.put('/clear-main', async function(req, res, next) {
  try {
    await prisma.station.updateMany({
      where: { salon_id: req.salon_id, is_main: true },
      data: { is_main: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── DELETE /stations/bulk-stale — bulk-delete stations not seen in 30+ days ──
// v2.3.5: cleanup helper. Owner-only (matches the existing /:id delete behavior).
// Default cutoff 30 days. Never deletes the current main, and never deletes
// stations actively connected (ActiveSession exists). Returns the deleted ids.
router.delete('/bulk-stale', async function(req, res, next) {
  try {
    if (req.staff_role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can bulk delete stations' });
    }
    var cutoffMs = 30 * 24 * 60 * 60 * 1000;
    var bodyDays = req.body && typeof req.body.days === 'number' ? req.body.days : null;
    if (bodyDays && bodyDays >= 1 && bodyDays <= 365) {
      cutoffMs = bodyDays * 24 * 60 * 60 * 1000;
    }
    var cutoff = new Date(Date.now() - cutoffMs);

    // Find candidates: salon-scoped, not main, last_seen null OR < cutoff.
    var candidates = await prisma.station.findMany({
      where: {
        salon_id: req.salon_id,
        is_main: false,
        OR: [{ last_seen: null }, { last_seen: { lt: cutoff } }],
      },
      select: { id: true, label: true, last_seen: true },
    });
    if (candidates.length === 0) {
      return res.json({ success: true, deleted: 0, ids: [] });
    }

    // Drop any candidate that has a live ActiveSession (defensive — if a
    // station re-connected between our findMany and now, don't delete).
    var liveSocketIds = await prisma.activeSession.findMany({
      where: { salon_id: req.salon_id },
      select: { station_label: true },
    });
    var liveLabels = new Set(liveSocketIds.map(function(s) { return s.station_label; }).filter(Boolean));
    var safe = candidates.filter(function(c) { return !liveLabels.has(c.label); });
    var safeIds = safe.map(function(s) { return s.id; });
    if (safeIds.length === 0) {
      return res.json({ success: true, deleted: 0, ids: [] });
    }

    var result = await prisma.station.deleteMany({
      where: { id: { in: safeIds } },
    });
    res.json({ success: true, deleted: result.count, ids: safeIds });
  } catch (err) { next(err); }
});

// ── DELETE /stations/:id — remove a station record ──
// If the deleted one was main, auto-promote the oldest remaining station.
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.station.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Station not found' });

    await prisma.station.delete({ where: { id: existing.id } });

    if (existing.is_main) {
      var oldest = await prisma.station.findFirst({
        where: { salon_id: req.salon_id },
        orderBy: { created_at: 'asc' },
      });
      if (oldest) {
        await prisma.station.update({ where: { id: oldest.id }, data: { is_main: true } });
      }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
