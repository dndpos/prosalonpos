/**
 * ProSalonPOS — Automated Messaging Utility
 * Session C51 | Handles trigger-based SMS/email for:
 *   - Booking confirmation (on appointment create)
 *   - Cancellation confirmation (on appointment cancel)
 *   - No-show notification (on status → no_show)
 *   - Receipt delivery (on ticket close, if client chose text/email)
 *   - Waitlist notification (on waitlist → pending transition)
 *
 * Each function checks salon settings to see if the message type is enabled,
 * resolves the template, sends via smsService, and logs to MessageLogEntry.
 *
 * Reminder scheduling is handled separately by reminderScheduler.js.
 */

import prisma from '../config/database.js';
import { sendSms } from './smsService.js';

// ════════════════════════════════════════════
// HELPER: Get salon settings JSON
// ════════════════════════════════════════════

async function getSalonSettings(salonId) {
  try {
    var row = await prisma.salonSettings.findUnique({ where: { salon_id: salonId } });
    if (!row || !row.settings) return {};
    return typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  } catch (err) {
    console.warn('[autoMessaging] Failed to load settings for salon', salonId, err.message);
    return {};
  }
}

// ════════════════════════════════════════════
// HELPER: Get active template for a message type
// ════════════════════════════════════════════

async function getActiveTemplate(salonId, type) {
  try {
    var tpl = await prisma.messageTemplate.findFirst({
      where: { salon_id: salonId, type: type, active: true },
      orderBy: { created_at: 'asc' },
    });
    return tpl;
  } catch (err) {
    console.warn('[autoMessaging] Failed to load template for', type, err.message);
    return null;
  }
}

// ════════════════════════════════════════════
// HELPER: Resolve template placeholders
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
// HELPER: Get client contact info
// ════════════════════════════════════════════

async function getClientContact(clientId) {
  if (!clientId) return null;
  try {
    var client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, first_name: true, last_name: true, phone: true, email: true, promo_opt_out: true },
    });
    return client;
  } catch (err) {
    return null;
  }
}

// ════════════════════════════════════════════
// HELPER: Send + log a single message
// ════════════════════════════════════════════

async function sendAndLog(salonId, clientId, type, channel, to, body) {
  var status = 'logged';

  if (channel === 'sms' && to) {
    var result = await sendSms(to, body);
    status = result.success ? (result.dev ? 'logged' : 'sent') : 'failed';
  }
  // Email channel: Phase 2 — log only for now
  if (channel === 'email') {
    console.log('[autoMessaging] EMAIL (Phase 2) — would send to', to, ':', body.substring(0, 60));
    status = 'logged';
  }

  try {
    await prisma.messageLogEntry.create({
      data: {
        salon_id: salonId,
        client_id: clientId || null,
        type: type,
        channel: channel,
        to: to || '',
        body: body,
        status: status,
      },
    });
  } catch (logErr) {
    console.error('[autoMessaging] Failed to log message:', logErr.message);
  }

  return status;
}

// ════════════════════════════════════════════
// HELPER: Dispatch to configured channels
// ════════════════════════════════════════════

async function dispatchToChannels(salonId, clientId, type, channelSetting, client, body) {
  var channels = channelSetting === 'both' ? ['sms', 'email'] : [channelSetting || 'sms'];
  var results = [];

  for (var i = 0; i < channels.length; i++) {
    var ch = channels[i];
    var to = ch === 'email' ? (client && client.email) : (client && client.phone);
    if (!to) {
      console.log('[autoMessaging] No', ch, 'contact for client', clientId || '(none)');
      continue;
    }
    var status = await sendAndLog(salonId, clientId, type, ch, to, body);
    results.push({ channel: ch, status: status });
  }

  return results;
}

// ════════════════════════════════════════════
// TRIGGER: Booking Confirmation
// ════════════════════════════════════════════

export async function triggerBookingConfirm(salonId, appointment, serviceLines) {
  try {
    var settings = await getSalonSettings(salonId);
    if (!settings.msg_booking_confirm_enabled) return;

    var clientId = appointment.client_id;
    if (!clientId) return; // walk-ins with no client record — skip

    var client = await getClientContact(clientId);
    if (!client) return;

    var tpl = await getActiveTemplate(salonId, 'booking_confirm');
    if (!tpl) {
      console.log('[autoMessaging] No active booking_confirm template for salon', salonId);
      return;
    }

    var firstLine = (serviceLines || [])[0] || {};
    var startDate = firstLine.starts_at ? new Date(firstLine.starts_at) : new Date();
    var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();
    var svcNames = (serviceLines || []).map(function(sl) { return sl.service_name || ''; }).filter(Boolean).join(', ');

    var vars = {
      client_name: clientName,
      salon_name: settings.salon_name || '',
      date: startDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }),
      time: startDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
      service: svcNames,
      technician: firstLine.staff_name || appointment.client_name || '',
    };

    var body = resolveBody(tpl.body, vars);
    var channel = settings.msg_booking_confirm_channel || 'sms';

    await dispatchToChannels(salonId, clientId, 'booking_confirm', channel, client, body);
    console.log('[autoMessaging] Booking confirm sent for', clientName);
  } catch (err) {
    console.error('[autoMessaging] triggerBookingConfirm error:', err.message);
  }
}

// ════════════════════════════════════════════
// TRIGGER: Cancellation Confirmation
// ════════════════════════════════════════════

export async function triggerCancelConfirm(salonId, appointment) {
  try {
    var settings = await getSalonSettings(salonId);
    if (!settings.msg_cancel_enabled) return;

    var clientId = appointment.client_id;
    if (!clientId) return;

    var client = await getClientContact(clientId);
    if (!client) return;

    var tpl = await getActiveTemplate(salonId, 'cancel_confirm');
    if (!tpl) return;

    var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();
    var lines = appointment.service_lines || [];
    var firstLine = lines[0] || {};
    var startDate = firstLine.starts_at ? new Date(firstLine.starts_at) : new Date();

    var vars = {
      client_name: clientName,
      salon_name: settings.salon_name || '',
      date: startDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }),
      time: startDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
      service: (lines.map(function(sl) { return sl.service_name || ''; }).filter(Boolean).join(', ')),
      technician: firstLine.staff_name || '',
    };

    var body = resolveBody(tpl.body, vars);
    await dispatchToChannels(salonId, clientId, 'cancel_confirm', settings.msg_cancel_channel || 'sms', client, body);
    console.log('[autoMessaging] Cancel confirm sent for', clientName);
  } catch (err) {
    console.error('[autoMessaging] triggerCancelConfirm error:', err.message);
  }
}

// ════════════════════════════════════════════
// TRIGGER: No-Show Notification
// ════════════════════════════════════════════

export async function triggerNoShow(salonId, appointment) {
  try {
    var settings = await getSalonSettings(salonId);
    if (!settings.msg_noshow_enabled) return;

    var clientId = appointment.client_id;
    if (!clientId) return;

    var client = await getClientContact(clientId);
    if (!client) return;

    var tpl = await getActiveTemplate(salonId, 'noshow');
    if (!tpl) return;

    var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();
    var lines = appointment.service_lines || [];
    var svcNames = lines.map(function(sl) { return sl.service_name || ''; }).filter(Boolean).join(', ');

    var vars = {
      client_name: clientName,
      salon_name: settings.salon_name || '',
      service: svcNames,
    };

    var body = resolveBody(tpl.body, vars);
    await dispatchToChannels(salonId, clientId, 'noshow', settings.msg_noshow_channel || 'sms', client, body);
    console.log('[autoMessaging] No-show notification sent for', clientName);
  } catch (err) {
    console.error('[autoMessaging] triggerNoShow error:', err.message);
  }
}

// ════════════════════════════════════════════
// TRIGGER: Receipt Delivery
// Called from checkout close route when client chose text/email receipt.
// ════════════════════════════════════════════

export async function triggerReceipt(salonId, clientId, receiptData) {
  try {
    var settings = await getSalonSettings(salonId);
    if (!settings.msg_receipt_enabled) return;

    if (!clientId) return;

    var client = await getClientContact(clientId);
    if (!client) return;

    var tpl = await getActiveTemplate(salonId, 'receipt');
    if (!tpl) return;

    var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();

    var vars = {
      client_name: clientName,
      salon_name: settings.salon_name || '',
      service: receiptData.services || '',
      total: receiptData.total || '$0.00',
      technician: receiptData.technician || '',
      date: receiptData.date || new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
    };

    var body = resolveBody(tpl.body, vars);
    await dispatchToChannels(salonId, clientId, 'receipt', settings.msg_receipt_channel || 'sms', client, body);
    console.log('[autoMessaging] Receipt sent for', clientName);
  } catch (err) {
    console.error('[autoMessaging] triggerReceipt error:', err.message);
  }
}

// ════════════════════════════════════════════
// TRIGGER: Waitlist Notification
// Called when appointment status changes from waitlisted → pending.
// ════════════════════════════════════════════

export async function triggerWaitlist(salonId, appointment) {
  try {
    var settings = await getSalonSettings(salonId);
    if (!settings.msg_waitlist_enabled) return;

    var clientId = appointment.client_id;
    if (!clientId) return;

    var client = await getClientContact(clientId);
    if (!client) return;

    var tpl = await getActiveTemplate(salonId, 'waitlist');
    if (!tpl) return;

    var clientName = ((client.first_name || '') + ' ' + (client.last_name || '')).trim();
    var lines = appointment.service_lines || [];
    var firstLine = lines[0] || {};
    var startDate = firstLine.starts_at ? new Date(firstLine.starts_at) : new Date();

    var vars = {
      client_name: clientName,
      salon_name: settings.salon_name || '',
      date: startDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }),
      time: startDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
    };

    var body = resolveBody(tpl.body, vars);
    await dispatchToChannels(salonId, clientId, 'waitlist', settings.msg_waitlist_channel || 'sms', client, body);
    console.log('[autoMessaging] Waitlist notification sent for', clientName);
  } catch (err) {
    console.error('[autoMessaging] triggerWaitlist error:', err.message);
  }
}
