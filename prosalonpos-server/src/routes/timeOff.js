/**
 * timeOff.js — Time Off / Blocked Time routes
 * CRUD for staff time-off requests (one-time and recurring).
 * Used by tech phone app and station calendar.
 */
import { Router } from 'express';
import prisma from '../config/database.js';
var router = Router();

// GET /api/v1/time-off?staff_id=xxx — list all time-off for a staff member
router.get('/', async function(req, res) {
  try {
    var salon_id = req.salon_id;
    var staff_id = req.query.staff_id;
    if (!staff_id) return res.status(400).json({ error: 'staff_id required' });

    var blocks = await prisma.blockedTime.findMany({
      where: { salon_id: salon_id, staff_id: staff_id, block_type: 'blocked' },
      orderBy: { created_at: 'desc' },
    });
    res.json({ blocks: blocks });
  } catch (err) {
    console.error('[TimeOff] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch time-off' });
  }
});

// GET /api/v1/time-off/date?date=YYYY-MM-DD — get all blocked times for a date (all staff)
router.get('/date', async function(req, res) {
  try {
    var salon_id = req.salon_id;
    var dateStr = req.query.date;
    if (!dateStr) return res.status(400).json({ error: 'date required' });

    var queryDate = new Date(dateStr + 'T00:00:00Z');
    var dayOfWeek = queryDate.getUTCDay(); // 0=Sun
    var dayOfMonth = queryDate.getUTCDate();

    // Fetch all blocked times for this salon
    var allBlocks = await prisma.blockedTime.findMany({
      where: { salon_id: salon_id, block_type: 'blocked' },
    });

    // Filter to blocks that apply to this date
    var applicable = allBlocks.filter(function(b) {
      // Check date range bounds — only if date_from/date_to are set
      if (b.date_from && queryDate < new Date(b.date_from)) return false;
      // For recurring blocks, skip date_to check if not set or same as date_from
      if (b.date_to && b.repeat_type === 'none') {
        var endDate = new Date(b.date_to);
        endDate.setUTCHours(23, 59, 59, 999);
        if (queryDate > endDate) return false;
      }
      if (b.date_to && b.repeat_type !== 'none') {
        // Only enforce date_to if it's different from date_from (user set an end date)
        var dfStr = b.date_from ? b.date_from.toISOString().slice(0, 10) : null;
        var dtStr = b.date_to.toISOString().slice(0, 10);
        if (dfStr && dtStr !== dfStr) {
          var endDate2 = new Date(b.date_to);
          endDate2.setUTCHours(23, 59, 59, 999);
          if (queryDate > endDate2) return false;
        }
      }

      if (b.repeat_type === 'none') {
        // One-time: check if date falls within date_from to date_to
        var blockDate = new Date(b.starts_at);
        var bDateStr = blockDate.toISOString().slice(0, 10);
        if (b.date_to) {
          // Multi-day one-time
          return dateStr >= (b.date_from ? b.date_from.toISOString().slice(0, 10) : bDateStr)
            && dateStr <= b.date_to.toISOString().slice(0, 10);
        }
        return bDateStr === dateStr;
      }

      if (b.repeat_type === 'daily') return true;

      if (b.repeat_type === 'weekly') {
        var days = (b.repeat_days || '').split(',').map(Number);
        return days.includes(dayOfWeek);
      }

      if (b.repeat_type === 'biweekly') {
        var days2 = (b.repeat_days || '').split(',').map(Number);
        if (!days2.includes(dayOfWeek)) return false;
        // Check if this is the right week
        if (b.repeat_start_week) {
          var startWeek = new Date(b.repeat_start_week);
          var diffMs = queryDate.getTime() - startWeek.getTime();
          var diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
          return diffWeeks % 2 === 0;
        }
        return true;
      }

      if (b.repeat_type === 'monthly') {
        return b.repeat_day_of_month === dayOfMonth;
      }

      return false;
    });

    res.json({ blocks: applicable });
  } catch (err) {
    console.error('[TimeOff] GET /date error:', err.message);
    res.status(500).json({ error: 'Failed to fetch time-off for date' });
  }
});

// POST /api/v1/time-off — create a new time-off block
router.post('/', async function(req, res) {
  try {
    var salon_id = req.salon_id;
    var b = req.body;
    if (!b.staff_id || b.start_min == null || b.end_min == null) {
      return res.status(400).json({ error: 'staff_id, start_min, end_min required' });
    }

    var dur = b.end_min - b.start_min;
    if (dur <= 0) return res.status(400).json({ error: 'end_min must be after start_min' });

    // Build starts_at from date_from + start_min
    var dateFrom = b.date_from ? new Date(b.date_from + 'T00:00:00Z') : new Date();
    var startsAt = new Date(dateFrom);
    startsAt.setUTCHours(0, 0, 0, 0);
    startsAt.setUTCMinutes(b.start_min);

    var block = await prisma.blockedTime.create({
      data: {
        salon_id: salon_id,
        staff_id: b.staff_id,
        starts_at: startsAt,
        dur: dur,
        start_min: b.start_min,
        end_min: b.end_min,
        block_type: 'blocked',
        reason: b.reason || null,
        date_from: b.date_from ? new Date(b.date_from + 'T00:00:00Z') : startsAt,
        date_to: b.date_to ? new Date(b.date_to + 'T00:00:00Z') : (b.repeat_type && b.repeat_type !== 'none' ? null : (b.date_from ? new Date(b.date_from + 'T00:00:00Z') : startsAt)),
        repeat_type: b.repeat_type || 'none',
        repeat_days: b.repeat_days || null,
        repeat_day_of_month: b.repeat_day_of_month || null,
        repeat_start_week: b.repeat_start_week ? new Date(b.repeat_start_week + 'T00:00:00Z') : null,
      },
    });

    // Broadcast to stations
    var io = req.app.get('io');
    if (io) io.to('salon:' + salon_id).emit('timeoff:updated', { staff_id: b.staff_id });

    console.log('[TimeOff] Created block:', block.id, 'staff:', b.staff_id, 'repeat:', b.repeat_type || 'none');
    res.json({ block: block });
  } catch (err) {
    console.error('[TimeOff] POST error:', err.message);
    var userMsg = 'Failed to create time-off';
    if (err.message && err.message.indexOf('Unknown arg') >= 0) {
      userMsg = 'Database needs update — please redeploy or contact support';
    } else if (err.message) {
      userMsg = 'Failed to create time-off: ' + err.message.slice(0, 120);
    }
    res.status(500).json({ error: userMsg });
  }
});

// DELETE /api/v1/time-off/:id — delete a time-off block
router.delete('/:id', async function(req, res) {
  try {
    var salon_id = req.salon_id;
    var block = await prisma.blockedTime.findFirst({
      where: { id: req.params.id, salon_id: salon_id },
    });
    if (!block) return res.status(404).json({ error: 'Not found' });

    await prisma.blockedTime.delete({ where: { id: req.params.id } });

    var io = req.app.get('io');
    if (io) io.to('salon:' + salon_id).emit('timeoff:updated', { staff_id: block.staff_id });

    console.log('[TimeOff] Deleted block:', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[TimeOff] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete time-off' });
  }
});

export default router;
