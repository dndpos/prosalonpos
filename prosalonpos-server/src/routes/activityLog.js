/**
 * activityLog.js — cc25 — Persistent appointment activity log.
 *
 * Replaces the cc14-era client-only useState array that lived in browser
 * memory and vanished on page refresh. Every appointment-level action
 * (book / move / tech_change / status_change / add_time / check_in /
 * break / etc.) is POSTed here and persisted to the ActivityLog table.
 *
 * Endpoints:
 *   POST /activity-log              — create one entry
 *   GET  /activity-log?from=&to=&q= — fetch entries (default = today only)
 *
 * Retention: 60 days. Pruning runs nightly via server.js setInterval.
 *
 * Search: `q` matches client_name OR client_phone (case-insensitive
 * partial). Phone matches strip non-digits before comparing so
 * "(305) 555-1234" finds "3055551234".
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

// Helper — normalize a date string (YYYY-MM-DD) to a Date at start/end
// of day in UTC. We don't worry about Eastern-time bounds here because
// the popup is a per-day visual filter, not a financial period bound.
function dayStart(ymd) {
  if (!ymd) return null;
  return new Date(ymd + 'T00:00:00.000Z');
}
function dayEnd(ymd) {
  if (!ymd) return null;
  return new Date(ymd + 'T23:59:59.999Z');
}

// Strip everything except digits — used to compare phones loosely.
function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '');
}

// ── POST /activity-log — write one entry ─────────────────────────────
// If client_phone isn't provided but appointment_id is, we look it up
// once via the appointment's client. Keeps the station call lean and
// makes phone search work without changing the calendar handlers'
// existing log payloads.
router.post('/', async function(req, res, next) {
  try {
    var b = req.body || {};
    if (!b.action || !b.description) {
      return res.status(400).json({ error: 'action and description are required' });
    }

    var phone = b.client_phone ? String(b.client_phone).slice(0, 40) : null;
    var name  = b.client_name  ? String(b.client_name).slice(0, 200) : null;

    if (!phone && b.appointment_id) {
      try {
        var appt = await prisma.appointment.findFirst({
          where: { id: b.appointment_id, salon_id: req.salon_id },
          select: { client_phone: true, client_name: true, client_id: true },
        });
        if (appt) {
          if (!phone) phone = appt.client_phone || null;
          if (!name)  name  = appt.client_name  || null;
          // Last resort — pull from Client table by id.
          if (!phone && appt.client_id) {
            var client = await prisma.client.findFirst({
              where: { id: appt.client_id, salon_id: req.salon_id },
              select: { phone: true },
            });
            if (client && client.phone) phone = client.phone;
          }
        }
      } catch (lookupErr) {
        // Non-fatal — log without phone if appointment can't be read.
        console.warn('[activityLog] phone lookup failed:', lookupErr.message);
      }
    }

    var entry = await prisma.activityLog.create({
      data: {
        salon_id:       req.salon_id,
        action:         String(b.action).slice(0, 64),
        description:    String(b.description).slice(0, 500),
        client_name:    name,
        client_phone:   phone,
        tech_name:      b.tech_name ? String(b.tech_name).slice(0, 100) : null,
        tech_id:        b.tech_id || null,
        service_name:   b.service_name ? String(b.service_name).slice(0, 200) : null,
        appointment_id: b.appointment_id || null,
        requested:      !!b.requested,
        changed_tech:   !!b.changed_tech,
        payload:        b.payload || null,
      },
    });
    res.json({ entry: entry });
  } catch (err) { next(err); }
});

// ── GET /activity-log?from=YYYY-MM-DD&to=YYYY-MM-DD&q=... ────────────
// Default (no params): today only, no search.
router.get('/', async function(req, res, next) {
  try {
    var from = req.query.from || null;
    var to   = req.query.to   || null;
    var q    = (req.query.q || '').toString().trim();

    // Default to today (UTC day) when no range specified.
    if (!from && !to) {
      var now = new Date();
      var ymd = now.getUTCFullYear() + '-' +
        String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(now.getUTCDate()).padStart(2, '0');
      from = ymd;
      to   = ymd;
    } else {
      if (!from) from = to;
      if (!to)   to   = from;
    }

    var where = {
      salon_id: req.salon_id,
      created_at: { gte: dayStart(from), lte: dayEnd(to) },
    };

    if (q) {
      // Build OR clauses for name OR phone. Phone matches use the
      // digits-only form on both sides so "(305) 555-1234" matches
      // "3055551234" stored in DB.
      var qDigits = digitsOnly(q);
      var ors = [
        { client_name: { contains: q, mode: 'insensitive' } },
      ];
      if (qDigits.length >= 3) {
        ors.push({ client_phone: { contains: qDigits } });
        // Also match against the raw search string so users typing
        // "555-1234" still hit a stored "555-1234".
        ors.push({ client_phone: { contains: q, mode: 'insensitive' } });
      } else {
        ors.push({ client_phone: { contains: q, mode: 'insensitive' } });
      }
      where.OR = ors;
    }

    var entries = await prisma.activityLog.findMany({
      where: where,
      orderBy: { created_at: 'desc' },
      take: 1000,    // safety cap; salons rarely cross 500/day
    });
    res.json({
      entries: entries,
      from: from,
      to: to,
      q: q || null,
      count: entries.length,
    });
  } catch (err) { next(err); }
});

// ── Prune helper, exported for server.js's nightly cleanup. ──────────
// Deletes entries older than `days` days (default 60). Returns the count
// removed so server.js can log it.
export async function pruneActivityLog(days) {
  var keepDays = Number.isFinite(days) && days > 0 ? days : 60;
  var cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
  var result = await prisma.activityLog.deleteMany({
    where: { created_at: { lt: cutoff } },
  });
  return result.count;
}

export default router;
