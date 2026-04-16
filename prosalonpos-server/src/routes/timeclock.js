/**
 * ProSalonPOS — Time Clock Routes
 * Clock punches for hourly staff.
 * All endpoints require JWT authentication.
 *
 * Frontend state shape: { id, staff_id, type:'in'|'out', timestamp }
 *
 * Endpoints:
 *   GET    /punches                → { punches: [...] }
 *   POST   /punch                  → { punch: {...} }
 *   POST   /punches/manual         → { punch: {...} }
 *   PUT    /punches/:id            → { punch: {...} }
 *   DELETE /punches/:id            → { success: true }
 *   GET    /status/:staffId        → { clocked_in: bool, last_punch: {...} }
 *   GET    /audit-log              → { logs: [...] }
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
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

/** Write an audit log entry */
async function writeAuditLog(data) {
  try {
    await prisma.punchAuditLog.create({
      data: {
        id: randomUUID(),
        punch_id: data.punch_id || null,
        staff_id: data.staff_id,
        action: data.action,
        old_value: data.old_value ? JSON.stringify(data.old_value) : null,
        new_value: data.new_value ? JSON.stringify(data.new_value) : null,
        changed_by: data.changed_by || null,
        changed_by_name: data.changed_by_name || null,
      }
    });
  } catch (err) {
    console.error('[timeclock] Audit log write failed:', err.message);
  }
}

// ── GET /punches — List punches for a date range ──
// Query params: ?date=YYYY-MM-DD (default: today)
//               ?staff_id=xxx (optional, filter by staff)
//               ?start=ISO&end=ISO (optional, range query)
router.get('/punches', async function(req, res, next) {
  try {
    var where = {};

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

    await writeAuditLog({
      punch_id: punch.id,
      staff_id: d.staff_id,
      action: 'created',
      new_value: { type: punch.type, timestamp: punch.timestamp.toISOString() },
      changed_by: req.staff_id || null,
      changed_by_name: d.changed_by_name || 'System',
    });

    emit(req, 'timeclock:punch');
    res.status(201).json({ punch: formatPunch(punch) });
  } catch (err) { next(err); }
});

// ── POST /punches/manual — Add a manual punch (owner/manager) ──
// Body: { staff_id, type: 'in'|'out', timestamp: ISO string or ms, changed_by_name }
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

    await writeAuditLog({
      punch_id: punch.id,
      staff_id: d.staff_id,
      action: 'created',
      new_value: { type: punch.type, timestamp: ts.toISOString(), manual: true },
      changed_by: req.staff_id || null,
      changed_by_name: d.changed_by_name || 'Manager',
    });

    emit(req, 'timeclock:punch');
    res.status(201).json({ punch: formatPunch(punch) });
  } catch (err) { next(err); }
});

// ── PUT /punches/:id — Edit a punch timestamp or type ──
// Body: { timestamp?, type?, changed_by_name? }
router.put('/punches/:id', async function(req, res, next) {
  try {
    var d = req.body;

    // Verify punch belongs to a staff in this salon
    var existing = await prisma.clockPunch.findFirst({
      where: { id: req.params.id },
      include: { staff: { select: { salon_id: true, id: true } } }
    });
    if (!existing || existing.staff.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Punch not found' });
    }

    if (d.type && d.type !== 'in' && d.type !== 'out') {
      return res.status(400).json({ error: 'Type must be "in" or "out"' });
    }

    var oldValue = { type: existing.type, timestamp: existing.timestamp.toISOString() };

    var updateData = {};
    if (d.timestamp) {
      updateData.timestamp = typeof d.timestamp === 'number' ? new Date(d.timestamp) : new Date(d.timestamp);
    }
    if (d.type) {
      updateData.type = d.type;
    }

    var updated = await prisma.clockPunch.update({
      where: { id: req.params.id },
      data: updateData,
    });

    var newValue = { type: updated.type, timestamp: updated.timestamp.toISOString() };

    await writeAuditLog({
      punch_id: updated.id,
      staff_id: existing.staff_id,
      action: 'edited',
      old_value: oldValue,
      new_value: newValue,
      changed_by: req.staff_id || null,
      changed_by_name: d.changed_by_name || 'Manager',
    });

    emit(req, 'timeclock:punch');
    res.json({ punch: formatPunch(updated) });
  } catch (err) { next(err); }
});

// ── DELETE /punches/:id — Delete a punch (owner/manager) ──
// Body (optional): { changed_by_name }
router.delete('/punches/:id', async function(req, res, next) {
  try {
    var punch = await prisma.clockPunch.findFirst({
      where: { id: req.params.id },
      include: { staff: { select: { salon_id: true } } }
    });
    if (!punch || punch.staff.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Punch not found' });
    }

    var oldValue = { type: punch.type, timestamp: punch.timestamp.toISOString(), manual: punch.manual };

    await writeAuditLog({
      punch_id: punch.id,
      staff_id: punch.staff_id,
      action: 'deleted',
      old_value: oldValue,
      changed_by: req.staff_id || null,
      changed_by_name: req.body && req.body.changed_by_name ? req.body.changed_by_name : 'Manager',
    });

    await prisma.clockPunch.delete({ where: { id: req.params.id } });
    emit(req, 'timeclock:punch');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /punches/bulk-delete — Delete all punches for a staff member in a date range ──
// Body: { staff_id, start: ISO, end: ISO, changed_by_name? }
router.post('/punches/bulk-delete', async function(req, res, next) {
  try {
    var d = req.body;
    if (!d.staff_id) return res.status(400).json({ error: 'staff_id required' });

    var staff = await prisma.staff.findFirst({
      where: { id: d.staff_id, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    var where = { staff_id: d.staff_id };
    if (d.start && d.end) {
      where.timestamp = { gte: new Date(d.start), lte: new Date(d.end) };
    }

    // Get punches before deleting for audit log
    var punches = await prisma.clockPunch.findMany({ where: where });

    if (punches.length === 0) {
      return res.json({ success: true, deleted: 0 });
    }

    // Write one audit log entry for the bulk delete
    await writeAuditLog({
      punch_id: null,
      staff_id: d.staff_id,
      action: 'deleted',
      old_value: { bulk: true, count: punches.length, range: { start: d.start, end: d.end } },
      changed_by: req.staff_id || null,
      changed_by_name: d.changed_by_name || 'Manager',
    });

    await prisma.clockPunch.deleteMany({ where: where });
    emit(req, 'timeclock:punch');
    res.json({ success: true, deleted: punches.length });
  } catch (err) { next(err); }
});

// ── GET /status/:staffId — Check if a staff member is currently clocked in ──
router.get('/status/:staffId', async function(req, res, next) {
  try {
    var staff = await prisma.staff.findFirst({
      where: { id: req.params.staffId, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

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

// ── GET /audit-log — Get punch audit log entries ──
// Query params: ?staff_id=xxx (optional), ?start=ISO&end=ISO (optional), ?limit=50
router.get('/audit-log', async function(req, res, next) {
  try {
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
      return res.json({ logs: [] });
    }

    var where = { staff_id: { in: staffIds } };

    if (req.query.start && req.query.end) {
      where.created_at = {
        gte: new Date(req.query.start),
        lte: new Date(req.query.end),
      };
    }

    var limit = parseInt(req.query.limit, 10) || 50;

    var logs = await prisma.punchAuditLog.findMany({
      where: where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    res.json({
      logs: logs.map(function(l) {
        return {
          id: l.id,
          punch_id: l.punch_id,
          staff_id: l.staff_id,
          action: l.action,
          old_value: l.old_value ? JSON.parse(l.old_value) : null,
          new_value: l.new_value ? JSON.parse(l.new_value) : null,
          changed_by: l.changed_by,
          changed_by_name: l.changed_by_name,
          created_at: l.created_at.toISOString(),
        };
      }),
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// STAFF PRESENCE — lightweight sign-in for turn system
// Non-hourly staff use this instead of clock punches.
// ═══════════════════════════════════════════════

/** GET /presence — Load today's presence records for this salon */
router.get('/presence', async function(req, res, next) {
  try {
    var records = await prisma.staffPresence.findMany({
      where: { salon_id: req.salon_id },
    });
    res.json({
      presence: records.map(function(r) {
        return {
          id: r.id,
          staff_id: r.staff_id,
          salon_id: r.salon_id,
          status: r.status,
          timestamp: r.timestamp.getTime(),
        };
      }),
    });
  } catch (err) { next(err); }
});

/** POST /presence — Set presence for a staff member (sign in / sign out) */
// Body: { staff_id, status: 'in'|'out' }
router.post('/presence', async function(req, res, next) {
  try {
    var d = req.body;

    var staff = await prisma.staff.findFirst({
      where: { id: d.staff_id, salon_id: req.salon_id }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (d.status !== 'in' && d.status !== 'out') {
      return res.status(400).json({ error: 'Status must be "in" or "out"' });
    }

    // Upsert — one record per staff per salon
    var record = await prisma.staffPresence.upsert({
      where: {
        staff_id_salon_id: { staff_id: d.staff_id, salon_id: req.salon_id },
      },
      update: {
        status: d.status,
        timestamp: new Date(),
      },
      create: {
        staff_id: d.staff_id,
        salon_id: req.salon_id,
        status: d.status,
        timestamp: new Date(),
      },
    });

    emit(req, 'timeclock:presence');
    res.status(200).json({
      presence: {
        id: record.id,
        staff_id: record.staff_id,
        salon_id: record.salon_id,
        status: record.status,
        timestamp: record.timestamp.getTime(),
      },
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// MIDNIGHT AUTO-CLOCKOUT
// Called by server.js scheduler. For each salon, finds staff still clocked in
// (last punch = 'in') and creates an automatic 'out' punch at 11:59:59 PM.
// Also sets all StaffPresence records to 'out'.
// ═══════════════════════════════════════════════

async function midnightAutoClockout(io) {
  try {
    // Get all salons
    var salons = await prisma.salon.findMany({ select: { id: true } });

    for (var si = 0; si < salons.length; si++) {
      var salonId = salons[si].id;

      // Get all staff for this salon
      var staff = await prisma.staff.findMany({
        where: { salon_id: salonId },
        select: { id: true, display_name: true },
      });
      if (staff.length === 0) continue;

      var staffIds = staff.map(function(s) { return s.id; });
      var staffMap = {};
      staff.forEach(function(s) { staffMap[s.id] = s.display_name; });

      // Find last punch for each staff member today or earlier (any date — we want their current status)
      var clockedOutCount = 0;
      for (var i = 0; i < staffIds.length; i++) {
        var staffId = staffIds[i];
        var lastPunch = await prisma.clockPunch.findFirst({
          where: { staff_id: staffId },
          orderBy: { timestamp: 'desc' },
        });

        if (lastPunch && lastPunch.type === 'in') {
          // This person is still clocked in — auto clock them out at 11:59:59 PM Eastern
          // Railway runs UTC, so we need to compute 23:59:59 Eastern as a UTC Date
          var now = new Date();
          var etParts = {};
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour12: false,
          }).formatToParts(now).forEach(function(p) { etParts[p.type] = p.value; });
          // We're firing at 00:00 Eastern of the NEW day, so 11:59:59 PM is yesterday
          var yest = new Date(now.getTime() - 60000); // 1 minute ago = still yesterday in ET
          var yParts = {};
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour12: false,
          }).formatToParts(yest).forEach(function(p) { yParts[p.type] = p.value; });
          // Build 23:59:59 on yesterday's Eastern date, then convert to UTC
          var localStr = yParts.year + '-' + yParts.month + '-' + yParts.day + 'T23:59:59';
          // Determine EDT vs EST offset for that date
          var probe = new Date(localStr + 'Z');
          var tzStr = probe.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
          var offsetMin = tzStr.indexOf('EDT') >= 0 ? 240 : 300;
          var midnight = new Date(probe.getTime() + offsetMin * 60000);

          var punch = await prisma.clockPunch.create({
            data: {
              staff_id: staffId,
              type: 'out',
              timestamp: midnight,
              manual: true,
            }
          });

          await writeAuditLog({
            punch_id: punch.id,
            staff_id: staffId,
            action: 'created',
            new_value: { type: 'out', timestamp: midnight.toISOString(), manual: true, reason: 'midnight auto-clockout' },
            changed_by: null,
            changed_by_name: 'System (midnight auto-clockout)',
          });

          clockedOutCount++;
        }
      }

      // Set all presence records to 'out' for this salon
      await prisma.staffPresence.updateMany({
        where: { salon_id: salonId, status: 'in' },
        data: { status: 'out', timestamp: new Date() },
      });

      if (clockedOutCount > 0) {
        console.log('[Midnight] Auto-clocked out ' + clockedOutCount + ' staff for salon ' + salonId);
        // Notify connected stations
        if (io) {
          io.to('salon:' + salonId).emit('timeclock:punch');
          io.to('salon:' + salonId).emit('timeclock:presence');
        }
      }
    }
  } catch (err) {
    console.error('[Midnight] Auto-clockout failed:', err.message);
  }
}

export { midnightAutoClockout };
export default router;
