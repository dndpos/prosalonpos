/**
 * ProSalonPOS — Appointments Routes
 * Two-level data model: Appointment (parent) → ServiceLine (child).
 * Calendar renders service lines, not appointments.
 * 
 * Key endpoints:
 *   GET /service-lines?start=YYYY-MM-DD  — flat list for calendar (matches mock shape)
 *   GET /?start=YYYY-MM-DD              — full appointments with nested service lines
 *   GET /client/:clientId               — client visit history
 *   POST /                              — create appointment + service lines in one transaction
 *   PUT /:id                            — update appointment (status cascades to service lines)
 *   PUT /service-line/:id               — update single service line (drag on calendar)
 *   DELETE /:id                         — soft cancel
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── Helper: get start/end of day for date filtering (Eastern time) ──
function getEasternOffset(date) {
  var str = date.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
  if (str.indexOf('EDT') >= 0) return 240;
  return 300;
}

function dayBounds(dateStr) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]) - 1;
  var day = parseInt(parts[2]);
  var probe = new Date(Date.UTC(y, m, day, 12, 0, 0));
  var etOffset = getEasternOffset(probe);
  var start = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  start.setUTCMinutes(start.getUTCMinutes() + etOffset);
  var end = new Date(Date.UTC(y, m, day, 23, 59, 59, 999));
  end.setUTCMinutes(end.getUTCMinutes() + etOffset);
  return { start: start, end: end };
}

function todayStr() {
  var now = new Date();
  var etOffset = getEasternOffset(now);
  var etNow = new Date(now.getTime() - etOffset * 60000);
  return etNow.getUTCFullYear() + '-' + String(etNow.getUTCMonth() + 1).padStart(2, '0') + '-' + String(etNow.getUTCDate()).padStart(2, '0');
}

// ── GET /service-lines?start=YYYY-MM-DD — Flat list for calendar rendering ──
// Returns data shaped exactly like MOCK_SERVICE_LINES for drop-in compatibility
router.get('/service-lines', async function(req, res, next) {
  try {
    var dateStr = req.query.start;
    if (!dateStr) {
      dateStr = todayStr();
    }

    var bounds = dayBounds(dateStr);

    var lines = await prisma.serviceLine.findMany({
      where: {
        appointment: { salon_id: req.salon_id },
        starts_at: { gte: bounds.start, lte: bounds.end },
        status: { not: 'cancelled' }
      },
      include: {
        appointment: {
          select: { booking_group_id: true, client_id: true, requested: true, source: true }
        }
      },
      orderBy: { starts_at: 'asc' }
    });

    // Flatten parent appointment fields onto each service line for calendar compatibility
    var flat = lines.map(function(sl) {
      var obj = Object.assign({}, sl);
      if (sl.appointment) {
        obj.bookingId = sl.appointment.booking_group_id || null;
        obj.client_id = sl.appointment.client_id || null;
        obj.requested = sl.appointment.requested || false;
        obj.source = sl.appointment.source || null;
      }
      delete obj.appointment;
      return obj;
    });

    res.json({ serviceLines: flat });
  } catch (err) { next(err); }
});

// ── GET / — Full appointments with nested service lines ──
router.get('/', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id };

    if (req.query.start) {
      var bounds = dayBounds(req.query.start);
      where.service_lines = { some: { starts_at: { gte: bounds.start, lte: bounds.end } } };
    }

    if (req.query.status) {
      where.status = req.query.status;
    }

    var appts = await prisma.appointment.findMany({
      where: where,
      include: { service_lines: { orderBy: { position: 'asc' } } },
      orderBy: { created_at: 'desc' },
      take: 200
    });

    res.json({ appointments: appts });
  } catch (err) { next(err); }
});

// ── GET /client/:clientId — Client visit history ──
router.get('/client/:clientId', async function(req, res, next) {
  try {
    var appts = await prisma.appointment.findMany({
      where: { salon_id: req.salon_id, client_id: req.params.clientId },
      include: { service_lines: true },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    res.json({ appointments: appts });
  } catch (err) { next(err); }
});

// ── POST / — Create appointment + service lines in one transaction ──
router.post('/', async function(req, res, next) {
  try {
    var data = req.body;

    var appt = await prisma.appointment.create({
      data: {
        salon_id: req.salon_id,
        client_id: data.client_id || null,
        client_name: data.client_name || null,
        status: data.status || 'pending',
        source: data.source || 'staff',
        booking_group_id: data.booking_group_id || null,
        requested: data.requested || false,
        deposit_cents: data.deposit_cents || 0,
        deposit_status: data.deposit_status || 'none',
        walk_in: data.walk_in || false,
        notes: data.notes || null,
        service_lines: {
          create: (data.service_lines || []).map(function(sl, i) {
            return {
              service_catalog_id: sl.service_catalog_id || null,
              staff_id: sl.staff_id,
              starts_at: new Date(sl.starts_at),
              duration_minutes: sl.duration_minutes,
              calendar_color: sl.calendar_color || '#3B82F6',
              status: sl.status || data.status || 'pending',
              client_name: sl.client_name || data.client_name || null,
              service_name: sl.service_name,
              price_cents: sl.price_cents || 0,
              position: i,
            };
          })
        }
      },
      include: { service_lines: true }
    });

    emit(req, 'appointment:created');
    res.status(201).json({ appointment: appt });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update appointment (status cascades to all service lines) ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    var data = req.body;
    var updateData = {};
    var fields = ['client_id', 'client_name', 'status', 'source', 'requested',
      'deposit_cents', 'deposit_status', 'walk_in', 'checked_in_at', 'notes'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });

    if (data.checked_in_at === 'now') {
      updateData.checked_in_at = new Date();
    }

    updateData.version = { increment: 1 };

    var appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: updateData,
      include: { service_lines: true }
    });

    // Cascade status to all service lines
    if (data.status) {
      await prisma.serviceLine.updateMany({
        where: { appointment_id: req.params.id },
        data: { status: data.status }
      });
    }

    emit(req, 'appointment:updated');
    res.json({ appointment: appt });
  } catch (err) { next(err); }
});

// ── PUT /service-line/:id — Update single service line (drag on calendar) ──
router.put('/service-line/:id', async function(req, res, next) {
  try {
    // Verify service line belongs to this salon via its appointment
    var existing = await prisma.serviceLine.findFirst({
      where: { id: req.params.id },
      include: { appointment: { select: { salon_id: true } } }
    });
    if (!existing || existing.appointment.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Service line not found' });
    }

    var data = req.body;
    var updateData = {};
    var fields = ['staff_id', 'starts_at', 'duration_minutes', 'calendar_color',
      'status', 'client_name', 'service_name', 'price_cents', 'payment_method'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) {
        updateData[f] = f === 'starts_at' ? new Date(data[f]) : data[f];
      }
    });

    updateData.version = { increment: 1 };

    var sl = await prisma.serviceLine.update({
      where: { id: req.params.id },
      data: updateData
    });

    emit(req, 'appointment:updated');
    res.json({ serviceLine: sl });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Soft cancel (never hard delete) ──
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    var appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'cancelled', version: { increment: 1 } }
    });

    // Cascade cancel to all service lines
    await prisma.serviceLine.updateMany({
      where: { appointment_id: req.params.id },
      data: { status: 'cancelled' }
    });

    emit(req, 'appointment:deleted');
    res.json({ appointment: appt });
  } catch (err) { next(err); }
});

// ── DELETE /bulk/all — Hard delete ALL appointments for this salon (owner only) ──
router.delete('/bulk/all', async function(req, res, next) {
  try {
    if (req.staff_role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can bulk delete appointments' });
    }
    var appts = await prisma.appointment.findMany({
      where: { salon_id: req.salon_id },
      select: { id: true },
    });
    var apptIds = appts.map(function(a) { return a.id; });
    if (apptIds.length === 0) return res.json({ success: true, deleted: 0 });
    await prisma.serviceLine.deleteMany({ where: { appointment_id: { in: apptIds } } });
    var result = await prisma.appointment.deleteMany({ where: { salon_id: req.salon_id } });
    console.log('[Appointments] Bulk deleted', result.count, 'appointments for salon', req.salon_id);
    emit(req, 'appointment:deleted');
    res.json({ success: true, deleted: result.count });
  } catch (err) { next(err); }
});

export default router;
