/**
 * ProSalonPOS — Reminder Scheduler
 * Session C51 | Runs on a setInterval timer (every 5 minutes).
 * Checks all salons for upcoming appointments and sends reminders
 * at the owner-configured times (e.g. 48hr, 24hr, 2hr before).
 *
 * Decision #183: Multiple reminder times per salon.
 * Decision #184: Only Pending/Confirmed appointments get reminders.
 *
 * To avoid duplicate reminders, each send is logged in MessageLogEntry.
 * Before sending, we check if a reminder of the same type was already
 * sent for that appointment+client within the same reminder window.
 */

import prisma from '../config/database.js';
import { sendSms } from './smsService.js';

var INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
var schedulerTimer = null;

// ════════════════════════════════════════════
// HELPER: Get salon settings JSON
// ════════════════════════════════════════════

async function getSalonSettings(salonId) {
  try {
    var row = await prisma.salonSettings.findUnique({ where: { salon_id: salonId } });
    if (!row || !row.settings) return {};
    return typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  } catch (err) {
    return {};
  }
}

// ════════════════════════════════════════════
// HELPER: Resolve template body
// ════════════════════════════════════════════

function resolveBody(templateBody, vars) {
  if (!templateBody) return '';
  var result = templateBody;
  var keys = Object.keys(vars || {});
  for (var i = 0; i < keys.length; i++) {
    var token = '{' + keys[i] + '}';
    result = result.split(token).join(vars[keys[i]] || '');
  }
  return result;
}

// ════════════════════════════════════════════
// CHECK & SEND REMINDERS FOR ONE SALON
// ════════════════════════════════════════════

async function processRemindersForSalon(salonId) {
  var settings = await getSalonSettings(salonId);
  if (!settings.msg_reminder_enabled) return;

  var reminderHours = settings.msg_reminder_times_hours;
  if (!reminderHours || !Array.isArray(reminderHours) || reminderHours.length === 0) return;

  var channel = settings.msg_reminder_channel || 'sms';

  // Get active reminder template
  var tpl = await prisma.messageTemplate.findFirst({
    where: { salon_id: salonId, type: 'reminder', active: true },
    orderBy: { created_at: 'asc' },
  });
  if (!tpl) return;

  var now = Date.now();

  // For each reminder window, find appointments that need a reminder NOW
  // Window: the reminder should fire when appointment is between (hours - 0.1) and (hours + 0.1) hours away
  // With 5-minute interval, use a 6-minute window to avoid misses
  var windowMs = 6 * 60 * 1000; // 6 minutes

  for (var h = 0; h < reminderHours.length; h++) {
    var hoursBeforeAppt = reminderHours[h];
    var targetMs = hoursBeforeAppt * 60 * 60 * 1000;

    // Appointments starting between (now + targetMs - windowMs) and (now + targetMs + windowMs)
    var windowStart = new Date(now + targetMs - windowMs);
    var windowEnd = new Date(now + targetMs + windowMs);

    // Find appointments with service lines in this window
    var serviceLines = await prisma.serviceLine.findMany({
      where: {
        starts_at: { gte: windowStart, lte: windowEnd },
        status: { in: ['pending', 'confirmed'] },
        appointment: { salon_id: salonId, status: { in: ['pending', 'confirmed'] } },
      },
      include: {
        // PROTECTED cc13.3: include `requested` so the technician-resolution
        // rule below can gate name-vs-"our team" correctly.
        appointment: { select: { id: true, client_id: true, client_name: true, status: true, requested: true } },
      },
      distinct: ['appointment_id'],
    });

    if (serviceLines.length === 0) continue;

    // Group by appointment
    var apptMap = {};
    for (var s = 0; s < serviceLines.length; s++) {
      var sl = serviceLines[s];
      var apptId = sl.appointment_id;
      if (!apptMap[apptId]) {
        apptMap[apptId] = {
          appointment: sl.appointment,
          lines: [],
        };
      }
      apptMap[apptId].lines.push(sl);
    }

    var apptIds = Object.keys(apptMap);

    for (var a = 0; a < apptIds.length; a++) {
      var entry = apptMap[apptIds[a]];
      var appt = entry.appointment;
      var lines = entry.lines;

      if (!appt.client_id) continue; // walk-in, no contact info

      // Check if we already sent a reminder for this appointment+hour combo
      var existingReminder = await prisma.messageLogEntry.findFirst({
        where: {
          salon_id: salonId,
          client_id: appt.client_id,
          type: 'reminder',
          // Check within a 15-minute window around the target send time
          sent_at: { gte: new Date(now - 15 * 60 * 1000) },
          body: { contains: lines[0].service_name || '' },
        },
      });

      if (existingReminder) continue; // already sent

      // Get client contact
      var client = await prisma.client.findUnique({
        where: { id: appt.client_id },
        select: { id: true, first_name: true, last_name: true, phone: true, email: true },
      });
      if (!client) continue;

      var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();
      var firstLine = lines[0];
      var startDate = new Date(firstLine.starts_at);
      var svcNames = lines.map(function(l) { return l.service_name || ''; }).filter(Boolean).join(', ');

      // PROTECTED cc13.3: same tech-resolution rule as triggerBookingConfirm/
      // CancelConfirm. Pre-cc13.3 this was `firstLine.staff_name || ''` which
      // always resolved to empty because ServiceLine has no staff_name column.
      // Andy's rule: show tech name only for requested appointments; else
      // fill with 'our team'. The appointment.requested field was included in
      // the serviceLines findMany above specifically for this check.
      var techDisplay = 'our team';
      if (appt.requested === true) {
        if (firstLine.staff_id) {
          try {
            var staffRow = await prisma.staff.findUnique({
              where: { id: firstLine.staff_id },
              select: { display_name: true },
            });
            if (staffRow && staffRow.display_name) techDisplay = staffRow.display_name;
          } catch (e) { /* keep default */ }
        } else if (firstLine.staff_name) {
          techDisplay = firstLine.staff_name;
        }
      }

      var vars = {
        client_name: clientName,
        salon_name: settings.salon_name || '',
        date: startDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }),
        time: startDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
        service: svcNames,
        technician: techDisplay,
      };

      var body = resolveBody(tpl.body, vars);

      // Send via configured channels
      var channels = channel === 'both' ? ['sms', 'email'] : [channel];

      for (var c = 0; c < channels.length; c++) {
        var ch = channels[c];
        var to = ch === 'email' ? client.email : client.phone;
        if (!to) continue;

        var status = 'logged';
        if (ch === 'sms') {
          var result = await sendSms(to, body);
          status = result.success ? (result.dev ? 'logged' : 'sent') : 'failed';
        }

        await prisma.messageLogEntry.create({
          data: {
            salon_id: salonId,
            client_id: client.id,
            type: 'reminder',
            channel: ch,
            to: to,
            body: body,
            status: status,
          },
        });
      }

      console.log('[reminderScheduler] Sent', hoursBeforeAppt + 'hr reminder for', clientName);
    }
  }
}

// ════════════════════════════════════════════
// MAIN LOOP: Process all salons
// ════════════════════════════════════════════

async function runReminderCheck() {
  try {
    // Get all salon IDs that have reminder enabled
    var allSettings = await prisma.salonSettings.findMany({
      select: { salon_id: true, settings: true },
    });

    for (var i = 0; i < allSettings.length; i++) {
      var row = allSettings[i];
      var s = typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings || {});
      if (s.msg_reminder_enabled) {
        await processRemindersForSalon(row.salon_id);
      }
    }
  } catch (err) {
    console.error('[reminderScheduler] Error:', err.message);
  }
}

// ════════════════════════════════════════════
// START / STOP
// ════════════════════════════════════════════

export function startReminderScheduler() {
  if (schedulerTimer) return;
  console.log('[reminderScheduler] Started — checking every 5 minutes');
  // Run once on startup after a short delay
  setTimeout(function() {
    runReminderCheck();
  }, 30 * 1000); // 30 second delay on startup
  // Then every 5 minutes
  schedulerTimer = setInterval(runReminderCheck, INTERVAL_MS);
}

export function stopReminderScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[reminderScheduler] Stopped');
  }
}
