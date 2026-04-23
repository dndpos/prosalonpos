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
// cc11.2: formatTicket shapes a raw Prisma ticket into the client-expected
// format (same mapping the /checkout/tickets/by-short-id route uses).
// We need it because the by-short-id appointment route now also returns
// the linked open ticket — and the client's handleScanReopen expects the
// shaped form, not the raw Prisma record.
import { formatTicket } from './checkoutHelpers.js';
// cc15: barcode audit log — slip_printed on create, scanned on by-short-id.
import { logSlipEvent, SLIP_EVENT_TYPES, reqContext, shortIdFromUuid } from '../utils/slipLog.js';

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

// PROTECTED C62: Convert UTC Date to timezone-naive salon-local string (no Z).
// "2026-04-15T13:00:00.000Z" (UTC) → "2026-04-15T09:00:00" (Eastern, no Z).
// Frontend new Date("...no Z...") parses as browser-local → always shows 9 AM.
function toSalonLocal(d) {
  if (!d) return d;
  var fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var p = {}; fmt.formatToParts(d).forEach(function(x) { p[x.type] = x.value; });
  var hh = p.hour === '24' ? '00' : p.hour;
  return p.year + '-' + p.month + '-' + p.day + 'T' + hh + ':' + p.minute + ':' + p.second;
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
      obj.starts_at = toSalonLocal(sl.starts_at); // C62: timezone-naive for frontend
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

// ── GET /by-short-id/:shortId — Barcode scan lookup (cc11, linkedTicket added cc11.2) ──
// The check-in slip barcode encodes the last 8 hex chars of the appointment
// UUID (stripped of dashes, uppercase). Same pattern as the ticket receipt's
// `GET /checkout/tickets/by-short-id/:shortId` (P059 / cc5). Lowercases the
// shortId because stored UUIDs are lowercase (`@default(uuid())`).
//
// cc11.2: Also looks up any currently-open ticket linked to this appointment
// and returns it as `linkedTicket`. Reason — after check-in, the tech works,
// cashier may open checkout and make adjustments (add retail, change prices,
// add tips) and put the ticket on hold. The slip's barcode still points at
// the appointment, but the LIVE data is on the held ticket. Client prefers
// `linkedTicket` over `appointment` so scanning the original slip brings up
// the adjusted ticket, not stale appointment data.
router.get('/by-short-id/:shortId', async function(req, res, next) {
  try {
    var shortId = (req.params.shortId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(shortId)) {
      return res.status(400).json({ error: 'shortId must be 8 hex chars' });
    }
    var appt = await prisma.appointment.findFirst({
      where: { salon_id: req.salon_id, id: { endsWith: shortId } },
      include: { service_lines: { orderBy: { position: 'asc' } } },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    // cc11.2 + cc15.4: check for a currently-open (held) ticket tied to
    // this appointment. Ticket.status values: open | paid | voided |
    // refunded | merged. Only `open` means "held, ready to resume at
    // checkout." The others are terminal and shouldn't override the
    // appointment's live service lines.
    //
    // cc15.4: match on EITHER the scalar `appointment_id` (direct, for
    // single-ticket holds + first-source-of-merge) OR the JSON array
    // `source_appointment_ids` (populated by merge routes with every
    // source's appointment_id). This replaces the cc15.3 chain walk for
    // any ticket merged under cc15.4+. The chain walk remains below as
    // a safety net for historical merges that predate this column.
    var linkedTicket = await prisma.ticket.findFirst({
      where: {
        salon_id: req.salon_id,
        status: 'open',
        OR: [
          { appointment_id: appt.id },
          { source_appointment_ids: { array_contains: appt.id } },
        ],
      },
      include: { items: true, payments: true },
      orderBy: { created_at: 'desc' },
    });
    // cc15.3: when the direct lookup finds no open ticket, the ticket
    // for this appointment may have been MERGED into another. Andy's
    // rule: from slip-print to final payment, the original slip must
    // always resolve to whatever ticket is currently "live" — single,
    // merged into another, or merged-into-another-merged. Walk the
    // `merged_into` chain until we find an open ticket (return it) or
    // hit a terminal state (paid/voided/refunded → return null, same as
    // today — slip no longer resolves because payment is done).
    //
    // Safety cap at 10 hops so a corrupt self-referential chain can't
    // spin forever. Realistic chains are 1-2 hops.
    if (!linkedTicket) {
      var mergedSource = await prisma.ticket.findFirst({
        where: { salon_id: req.salon_id, appointment_id: appt.id, status: 'merged' },
        orderBy: { created_at: 'desc' },
      });
      if (mergedSource && mergedSource.merged_into) {
        var cursorId = mergedSource.merged_into;
        var hops = 0;
        while (cursorId && hops < 10) {
          var next = await prisma.ticket.findFirst({
            where: { id: cursorId, salon_id: req.salon_id },
          });
          if (!next) break;
          if (next.status === 'merged' && next.merged_into) {
            cursorId = next.merged_into;
            hops = hops + 1;
            continue;
          }
          if (next.status === 'open') {
            // Re-fetch with items + payments for formatTicket.
            linkedTicket = await prisma.ticket.findFirst({
              where: { id: next.id, salon_id: req.salon_id },
              include: { items: true, payments: true },
            });
          }
          // Terminal status (paid/voided/refunded) → linkedTicket stays
          // null. Client falls back to appointment data. Matches cc11.2
          // "only open means held, ready to resume."
          break;
        }
      }
    }
    var pkgRedemptions = [];
    if (linkedTicket && (linkedTicket.pkg_redeemed_cents || 0) > 0) {
      pkgRedemptions = await prisma.packageRedemption.findMany({ where: { ticket_id: linkedTicket.id } });
    }
    // cc15: log the scan. Note that this fires on any slip scan, whether
    // from empty checkout (open-fresh) or active checkout (combine). The
    // payload includes the resolution — appointment only, direct held
    // ticket, or (cc15.3) walked merge chain — which is exactly what's
    // useful when debugging "the slip didn't pull up the right data."
    // cc15.3: if the returned ticket is NOT directly linked to this
    // appointment (i.e., we walked the merge chain to find it), tag the
    // event as resolved='merge_chain' so the History viewer shows the
    // slip was followed through a merge to land on the absorber.
    var _resolvedVia = linkedTicket ? (linkedTicket.appointment_id === appt.id ? 'linkedTicket' : 'merge_chain') : 'appointment';
    logSlipEvent({
      ...reqContext(req),
      eventType:     SLIP_EVENT_TYPES.SCANNED,
      shortId:       shortId,
      appointmentId: appt.id,
      ticketId:      linkedTicket ? linkedTicket.id : null,
      payload: {
        resolved: _resolvedVia,
        ticket_status: linkedTicket ? linkedTicket.status : null,
        absorber_ticket_number: _resolvedVia === 'merge_chain' ? (linkedTicket && linkedTicket.ticket_number) : undefined,
      },
    });
    res.json({
      appointment: appt,
      linkedTicket: linkedTicket ? formatTicket(linkedTicket, pkgRedemptions) : null,
    });
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
    // cc15: slip_printed — the appointment exists, so the check-in slip
    // is now printable and the barcode is live. Any future ticket write
    // under this appointment lands in this barcode's log.
    logSlipEvent({
      ...reqContext(req),
      eventType:     SLIP_EVENT_TYPES.SLIP_PRINTED,
      appointmentId: appt.id,
      payload: {
        client_name: appt.client_name || 'Walk-in',
        walk_in: !!appt.walk_in,
        service_lines: (appt.service_lines || []).map(function(sl) {
          return { name: sl.service_name, price: sl.price_cents || 0, tech_id: sl.staff_id };
        }),
      },
    });
    res.status(201).json({ appointment: appt });
  } catch (err) { next(err); }
});

// ── POST /:id/assign-walkin — Add service_lines to a walk-in appointment when a tech is assigned (cc11.3) ──
// Walk-in appointments are created at check-in time with `walk_in:true, status:'checked_in'`
// and NO service_lines (tech isn't picked yet — client is on the waitlist). When the
// salon owner pulls them off the waitlist and assigns a tech, the front-end calls
// this route to (a) create the service_lines under the existing appointment and
// (b) flip the appointment status to 'in_progress'. Using the SAME appointment id
// keeps the check-in slip's barcode valid throughout the visit — scans resolve to
// this appointment (or its linkedTicket, via cc11.2) regardless of timing.
router.post('/:id/assign-walkin', async function(req, res, next) {
  try {
    var existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { service_lines: true },
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });
    if (!existing.walk_in) return res.status(400).json({ error: 'Not a walk-in appointment' });
    var data = req.body || {};
    var lines = data.service_lines || [];
    if (lines.length === 0) return res.status(400).json({ error: 'At least one service_line is required' });
    // Remove any pre-existing service_lines under this appointment first (defensive —
    // expected to be empty for walk-ins but an idempotent re-call shouldn't duplicate).
    if (existing.service_lines && existing.service_lines.length > 0) {
      await prisma.serviceLine.deleteMany({ where: { appointment_id: req.params.id } });
    }
    // Create the new service_lines tied to the existing appointment.
    await prisma.serviceLine.createMany({
      data: lines.map(function(sl, i) {
        return {
          appointment_id: req.params.id,
          service_catalog_id: sl.service_catalog_id || null,
          staff_id: sl.staff_id,
          starts_at: new Date(sl.starts_at),
          duration_minutes: sl.duration_minutes || 30,
          calendar_color: sl.calendar_color || '#3B82F6',
          status: 'in_progress',
          client_name: sl.client_name || existing.client_name || null,
          service_name: sl.service_name,
          price_cents: sl.price_cents || 0,
          position: i,
        };
      }),
    });
    // Flip appointment status + bump version.
    var appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'in_progress', version: { increment: 1 } },
      include: { service_lines: { orderBy: { position: 'asc' } } },
    });
    // Broadcast so other stations pick up the new service_lines.
    var assignStaffIds = (appt.service_lines || []).map(function(sl) { return sl.staff_id; }).filter(Boolean);
    emit(req, 'appointment:updated', {
      staff_ids: assignStaffIds,
      client_name: appt.client_name || 'Walk-in',
      status: 'in_progress',
    });
    res.json({ appointment: appt });
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
