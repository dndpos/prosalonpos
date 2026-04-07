/**
 * ProSalonPOS — Time Clock Routes
 * Clock punches for hourly staff.
 * All endpoints require JWT authentication.
 *
 * Frontend state shape: { id, staff_id, type:'in'|'out', timestamp }
 * App.jsx manages clockPunches in useState — this API provides persistence.
 *
 * Endpoints:
 *   GET  /punches                → { punches: [...] }
 *   POST /punch                  → { punch: {...} }
 *   POST /punches/manual         → { punch: {...} }
 *   DELETE /punches/:id          → { success: true }
 *   GET  /status/:staffId        → { clocked_in: bool, last_punch: {...} }
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

/**
 * Format a punch for the frontend.
 * Frontend expects: { id, staff_id, type, timestamp (ms), manual }
 */
function formatPunch(p) {
  return {
    id: p.id,
    staff_id: p.staff_id,
    type: p.type,
    timestamp: p.timestamp.getTime(),
    manual: p.manual,
    created_at: p.created_at.toISOString(),
  };
}

// ── GET /punches — List punches for a date range ──
// Query params: ?date=YYYY-MM-DD (default: today)
//               ?staff_id=xxx (optional, filter by staff)
//               ?start=ISO&end=ISO (optional, range query)
router.get('/punches', async function(req, res, next) {
  try {
    var where = {};

    // Filter by staff that belongs to this salon
    // ClockPunch doesn't have salon_id — we join through staff
    var staffWhere = { salon_id: req.salon_id };
    if (req.query.staff_id) {
      staffWhere.id = req.query.staff_id;
    }
    var salonStaff = await prisma.staff.findMany({
      where: staffWhere,
      select: { id: true }
    });
    var staffIds = salonStaff.map(function(s) { return s.id; });

    if (staffIds.length === 0) {
      return res.json({ punches: [] });
    }

    where.staff_id = { in: staffIds };

    // Date filtering
    if (req.query.start && req.query.end) {
      where.timestamp = {
        gte: new Date(req.query.start),
        lte: new Date(req.query.end),
      };
    } else {
      // Default to today
      var dateStr = req.query.date || new Date().toISOString().split('T')[0];
      var dayStart = new Date(dateStr + 'T00:00:00.000Z');
      var dayEnd = new Date(dateStr + 'T23:59:59.999Z');
      where.timestamp = { gte: dayStart, lte: dayEnd };
    }

    var punches = await prisma.clockPunch.findMany({
      where: where,
      orderBy: { timestamp: 'asc' }
    });

    res.json({ punches: punches.map(formatPunch) });
  } catch (err) { next(err); }
});

// ── POST /punch — Clock in or out ──
// Body: { staff_id, type: 'in'|'out' }
router.post('/punch', async function(req, res, next) {
  try {
    var d = req.body;

    // Verify staff belongs to this salon
    var staff = await prisma.staff.findFirst({
      where: { id: d.staff_id, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (d.type !== 'in' && d.type !== 'out') {
      return res.status(400).json({ error: 'Type must be "in" or "out"' });
    }

    var punch = await prisma.clockPunch.create({
      data: {
        staff_id: d.staff_id,
        type: d.type,
        timestamp: new Date(),
        manual: false,
      }
    });

    emit(req, 'timeclock:punch');
    res.status(201).json({ punch: formatPunch(punch) });
  } catch (err) { next(err); }
});

// ── POST /punches/manual — Add a manual punch (owner/manager) ──
// Body: { staff_id, type: 'in'|'out', timestamp: ISO string or ms }
router.post('/punches/manual', async function(req, res, next) {
  try {
    var d = req.body;

    var staff = await prisma.staff.findFirst({
      where: { id: d.staff_id, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (d.type !== 'in' && d.type !== 'out') {
      return res.status(400).json({ error: 'Type must be "in" or "out"' });
    }

    var ts = typeof d.timestamp === 'number' ? new Date(d.timestamp) : new Date(d.timestamp);

    var punch = await prisma.clockPunch.create({
      data: {
        staff_id: d.staff_id,
        type: d.type,
        timestamp: ts,
        manual: true,
      }
    });

    emit(req, 'timeclock:punch');
    res.status(201).json({ punch: formatPunch(punch) });
  } catch (err) { next(err); }
});

// ── DELETE /punches/:id — Delete a punch (owner/manager) ──
router.delete('/punches/:id', async function(req, res, next) {
  try {
    // Verify punch belongs to a staff in this salon
    var punch = await prisma.clockPunch.findFirst({
      where: { id: req.params.id },
      include: { staff: { select: { salon_id: true } } }
    });
    if (!punch || punch.staff.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Punch not found' });
    }

    await prisma.clockPunch.delete({ where: { id: req.params.id } });
    emit(req, 'timeclock:punch');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /status/:staffId — Check if a staff member is currently clocked in ──
router.get('/status/:staffId', async function(req, res, next) {
  try {
    var staff = await prisma.staff.findFirst({
      where: { id: req.params.staffId, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Get the most recent punch for this staff today
    var today = new Date().toISOString().split('T')[0];
    var dayStart = new Date(today + 'T00:00:00.000Z');

    var lastPunch = await prisma.clockPunch.findFirst({
      where: {
        staff_id: req.params.staffId,
        timestamp: { gte: dayStart }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json({
      clocked_in: lastPunch ? lastPunch.type === 'in' : false,
      last_punch: lastPunch ? formatPunch(lastPunch) : null,
    });
  } catch (err) { next(err); }
});

export default router;
