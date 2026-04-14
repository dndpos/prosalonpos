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
import { sendPushToStaffList } from '../utils/pushService.js';
import { triggerBookingConfirm, triggerCancelConfirm, triggerNoShow, triggerWaitlist } from '../utils/autoMessaging.js';

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

    var createStaffIds = (appt.service_lines || []).map(function(sl) { return sl.staff_id; }).filter(Boolean);
    emit(req, 'appointment:created', {
      staff_ids: createStaffIds,
      client_name: appt.client_name || 'Walk-in',
      status: appt.status || 'pending',
      requested: appt.requested || false,
    });
    // Push notification to involved techs
    sendPushToStaffList(req.salon_id, createStaffIds, {
      title: 'New Appointment',
      body: (appt.client_name || 'Walk-in') + ' booked',
      tag: 'appt-created-' + appt.id,
    }).catch(function() {});
    // Automated SMS: booking confirmation (non-blocking)
    triggerBookingConfirm(req.salon_id, appt, appt.service_lines).catch(function() {});
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

      // When marked no_show, append a note to the client's record
      if (data.status === 'no_show' && (existing.client_id || appt.client_id)) {
        try {
          var _clientId = appt.client_id || existing.client_id;
          var _client = await prisma.client.findUnique({ where: { id: _clientId }, select: { notes: true } });
          // Build note with date and services
          var svcNames = (appt.service_lines || []).map(function(sl) { return sl.service_name || 'Service'; }).join(', ');
          var dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric', year: 'numeric' });
          var noShowNote = 'No-show on ' + dateStr + (svcNames ? ' - ' + svcNames : '');
          var existingNotes = (_client && _client.notes) ? _client.notes.trim() : '';
          var updatedNotes = existingNotes ? existingNotes + '\n' + noShowNote : noShowNote;
          await prisma.client.update({ where: { id: _clientId }, data: { notes: updatedNotes } });
        } catch (noteErr) {
          console.error('[No-show note] Failed to append client note:', noteErr.message);
        }
      }
    }

    // Include status + staff IDs so stations can update tech turn rotation
    var emitData = {
      staff_ids: (appt.service_lines || []).map(function(sl) { return sl.staff_id; }).filter(Boolean),
      client_name: appt.client_name || 'Walk-in',
      requested: appt.requested || false,
      old_status: existing.status || null,
    };
    // De-duplicate staff IDs
    emitData.staff_ids = emitData.staff_ids.filter(function(id, idx, arr) { return arr.indexOf(id) === idx; });
    if (data.status) {
      emitData.status = data.status;
      console.log('[Appointments] Status changed to ' + data.status + ', staff_ids:', emitData.staff_ids);
    }
    emit(req, 'appointment:updated', emitData);
    // Push notification for meaningful status changes
    if (data.status) {
      var pushStatuses = { checked_in: ' checked in', in_progress: ' — started', completed: ' — completed', no_show: ' — no show', cancelled: ' — cancelled' };
      if (pushStatuses[data.status]) {
        sendPushToStaffList(req.salon_id, emitData.staff_ids, {
          title: 'Appointment Update',
          body: (appt.client_name || 'Walk-in') + pushStatuses[data.status],
          tag: 'appt-' + appt.id + '-' + data.status,
        }).catch(function() {});
      }
      // Automated SMS: no-show notification (non-blocking)
      if (data.status === 'no_show') {
        triggerNoShow(req.salon_id, appt).catch(function() {});
      }
      // Automated SMS: waitlist → pending transition (non-blocking)
      if (data.status === 'pending' && existing.status === 'waitlisted') {
        triggerWaitlist(req.salon_id, appt).catch(function() {});
      }
    }
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

    // Cascade status to parent appointment (e.g. Start Working via service line fallback)
    if (data.status && existing.appointment_id) {
      await prisma.appointment.update({
        where: { id: existing.appointment_id },
        data: { status: data.status, version: { increment: 1 } },
      });
    }

    // Build emit data with old + new staff for tech phone notifications
    var oldStaffId = existing.staff_id;
    var newStaffId = sl.staff_id;
    var staffChanged = data.staff_id !== undefined && oldStaffId !== newStaffId;

    // Get client name from parent appointment
    var parentAppt = await prisma.appointment.findFirst({
      where: { id: existing.appointment_id },
      select: { client_name: true, requested: true }
    });
    var clientName = (parentAppt && parentAppt.client_name) || 'Walk-in';

    // Collect all staff_ids that need to know about this update
    var notifyStaffIds = [newStaffId];
    if (staffChanged && oldStaffId) notifyStaffIds.push(oldStaffId);
    notifyStaffIds = notifyStaffIds.filter(function(id, idx, arr) { return id && arr.indexOf(id) === idx; });

    var emitData = {
      staff_ids: notifyStaffIds,
      client_name: clientName,
      requested: (parentAppt && parentAppt.requested) || false,
    };
    if (staffChanged) emitData.reassigned = true;
    if (data.status) emitData.status = data.status;

    emit(req, 'appointment:updated', emitData);

    // Push notification for reassignment
    if (staffChanged) {
      sendPushToStaffList(req.salon_id, [newStaffId], {
        title: 'Appointment Assigned',
        body: clientName + ' moved to you',
        tag: 'reassign-' + existing.appointment_id,
      }).catch(function(){});
      sendPushToStaffList(req.salon_id, [oldStaffId], {
        title: 'Appointment Moved',
        body: clientName + ' reassigned to another tech',
        tag: 'reassign-' + existing.appointment_id,
      }).catch(function(){});
    }

    res.json({ serviceLine: sl });
  } catch (err) { next(err); }
});

// ── PUT /:id/service-lines — Replace service lines on appointment (tech phone edit) ──
router.put('/:id/service-lines', async function(req, res, next) {
  try {
    var existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { service_lines: { orderBy: { position: 'asc' } } }
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    var newLines = req.body.service_lines || [];
    if (newLines.length === 0) return res.status(400).json({ error: 'At least one service is required' });

    // Use the first existing service line's starts_at as the base time
    var baseStart = (existing.service_lines && existing.service_lines[0])
      ? existing.service_lines[0].starts_at
      : new Date();

    // Delete old service lines and create new ones
    await prisma.serviceLine.deleteMany({ where: { appointment_id: req.params.id } });

    var runningStart = new Date(baseStart);
    var creates = newLines.map(function(sl, i) {
      var dur = sl.duration_minutes || 30;
      var lineStart = new Date(runningStart);
      runningStart = new Date(runningStart.getTime() + dur * 60000);
      return {
        appointment_id: req.params.id,
        service_catalog_id: sl.service_id || null,
        staff_id: sl.tech_id || req.staff_id,
        starts_at: lineStart,
        duration_minutes: dur,
        calendar_color: sl.color || '#3B82F6',
        status: existing.status || 'pending',
        client_name: existing.client_name || null,
        service_name: sl.name || 'Service',
        price_cents: sl.price_cents || 0,
        position: i,
      };
    });

    await prisma.serviceLine.createMany({ data: creates });
    await prisma.appointment.update({
      where: { id: req.params.id },
      data: { version: { increment: 1 } }
    });

    var appt = await prisma.appointment.findFirst({
      where: { id: req.params.id },
      include: { service_lines: { orderBy: { position: 'asc' } } }
    });

    emit(req, 'appointment:updated');
    res.json({ appointment: appt });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Soft cancel (never hard delete) ──
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { service_lines: { select: { staff_id: true, service_name: true, starts_at: true, staff_name: true } } }
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

    var delStaffIds = (existing.service_lines || []).map(function(sl) { return sl.staff_id; }).filter(Boolean);
    var delStaffUnique = delStaffIds.filter(function(id, idx, arr) { return arr.indexOf(id) === idx; });
    emit(req, 'appointment:deleted', {
      staff_ids: delStaffUnique,
      client_name: existing.client_name || 'Walk-in',
      requested: existing.requested || false,
    });
    sendPushToStaffList(req.salon_id, delStaffUnique, {
      title: 'Appointment Cancelled',
      body: (existing.client_name || 'Walk-in') + ' — cancelled',
      tag: 'appt-del-' + existing.id,
    }).catch(function() {});
    // Automated SMS: cancellation confirmation (non-blocking)
    triggerCancelConfirm(req.salon_id, existing).catch(function() {});
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
