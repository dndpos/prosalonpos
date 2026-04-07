/**
 * Pro Salon POS — Messaging Service
 * Centralized message dispatch engine per Engineering Standards §27.
 * No component sends messages directly — all outbound goes through this service.
 *
 * Session 8 Decisions: #179–#192
 * 7 message types, 2 channels (SMS/email), template variable substitution,
 * opt-out enforcement, reminder scheduling, blast filter evaluation.
 *
 * Phase 1: Mock dispatch (logs to messageLog array). Phase 2: real provider wiring.
 */

// ════════════════════════════════════════════
// MESSAGE TYPE DEFINITIONS
// ════════════════════════════════════════════

export const MESSAGE_TYPES = {
  BOOKING_CONFIRM:  'booking_confirm',
  REMINDER:         'reminder',
  CANCEL_CONFIRM:   'cancel_confirm',
  NOSHOW:           'noshow',
  RECEIPT:          'receipt',
  WAITLIST:         'waitlist',
  PROMOTIONAL:      'promotional',
};

export const MESSAGE_TYPE_META = {
  [MESSAGE_TYPES.BOOKING_CONFIRM]: { label: 'Booking confirmation', category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.REMINDER]:        { label: 'Appointment reminder',  category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.CANCEL_CONFIRM]:  { label: 'Cancellation confirmation', category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.NOSHOW]:          { label: 'No-show notification', category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.RECEIPT]:         { label: 'Receipt delivery',     category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.WAITLIST]:        { label: 'Waitlist notification', category: 'Transactional', optOutable: false },
  [MESSAGE_TYPES.PROMOTIONAL]:     { label: 'Promotional',          category: 'Promotional',   optOutable: true },
};

export const CHANNELS = { SMS: 'sms', EMAIL: 'email', BOTH: 'both' };

// ════════════════════════════════════════════
// TEMPLATE PLACEHOLDER DEFINITIONS
// ════════════════════════════════════════════

export const PLACEHOLDERS = [
  { key: '{client_name}',   label: 'Client name',   example: 'Sarah Mitchell' },
  { key: '{date}',          label: 'Date',           example: 'Mar 25, 2026' },
  { key: '{time}',          label: 'Time',           example: '2:00 PM' },
  { key: '{service}',       label: 'Service',        example: "Women's Haircut" },
  { key: '{technician}',    label: 'Technician',     example: 'Maria' },
  { key: '{salon_name}',    label: 'Salon name',     example: 'Luxe Hair Studio' },
  { key: '{total}',         label: 'Total',          example: '$55.00' },
  { key: '{deposit_amount}',label: 'Deposit amount', example: '$25.00' },
];

// ════════════════════════════════════════════
// TEMPLATE VARIABLE SUBSTITUTION
// ════════════════════════════════════════════

/**
 * Replace placeholders in a template string with actual values.
 * @param {string} template - Template with {placeholder} tokens
 * @param {object} vars - Key/value pairs e.g. { client_name: 'Sarah', date: 'Mar 25' }
 * @returns {string} Resolved message content
 */
export function resolveTemplate(template, vars) {
  if (!template) return '';
  var result = template;
  Object.keys(vars || {}).forEach(function(key) {
    var token = '{' + key + '}';
    result = result.split(token).join(vars[key] || '');
  });
  return result;
}

/**
 * Preview a template with example values.
 */
export function previewTemplate(template) {
  var exampleVars = {};
  PLACEHOLDERS.forEach(function(p) {
    var key = p.key.replace(/[{}]/g, '');
    exampleVars[key] = p.example;
  });
  return resolveTemplate(template, exampleVars);
}

// ════════════════════════════════════════════
// OPT-OUT ENFORCEMENT (Decision #184)
// ════════════════════════════════════════════

/**
 * Check whether a message can be sent to a client.
 * Transactional = always sent. Promotional = blocked if promo_opt_out is true.
 * @param {string} messageType - One of MESSAGE_TYPES values
 * @param {object} client - Client record with promo_opt_out field
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canSendToClient(messageType, client) {
  if (!client) return { allowed: false, reason: 'No client record' };
  var meta = MESSAGE_TYPE_META[messageType];
  if (!meta) return { allowed: false, reason: 'Unknown message type' };
  if (meta.optOutable && client.promo_opt_out) {
    return { allowed: false, reason: 'Client opted out of promotional messages' };
  }
  return { allowed: true, reason: null };
}

// ════════════════════════════════════════════
// CHANNEL ROUTING (Decision #181)
// ════════════════════════════════════════════

/**
 * Determine which channels to send on for a message type.
 * @param {string} messageType
 * @param {object} settings - Salon settings with msg_*_channel keys
 * @returns {string[]} Array of channels to send on: ['sms'], ['email'], or ['sms','email']
 */
export function getChannels(messageType, settings) {
  var channelKey = 'msg_' + messageType + '_channel';
  var channel = (settings || {})[channelKey] || 'sms';
  if (channel === 'both') return ['sms', 'email'];
  return [channel];
}

/**
 * Check if a message type is enabled in salon settings.
 */
export function isMessageTypeEnabled(messageType, settings) {
  var enabledKey = 'msg_' + messageType + '_enabled';
  return !!(settings || {})[enabledKey];
}

// ════════════════════════════════════════════
// REMINDER SCHEDULING (Decision #183)
// ════════════════════════════════════════════

/**
 * Calculate reminder send times for an appointment.
 * Skips reminders where the booking was created after the reminder window.
 * Only sends for Pending or Confirmed appointments.
 * @param {object} appointment - { starts_at, booked_at, status }
 * @param {object} settings - { msg_reminder_times_hours: [48, 24, 2] }
 * @returns {Date[]} Array of send times (sorted earliest first)
 */
export function getReminderTimes(appointment, settings) {
  if (!appointment || !appointment.starts_at) return [];
  var validStatuses = ['pending', 'confirmed'];
  if (validStatuses.indexOf(appointment.status) === -1) return [];

  var startTime = new Date(appointment.starts_at).getTime();
  var bookedAt = new Date(appointment.booked_at || appointment.starts_at).getTime();
  var hours = (settings || {}).msg_reminder_times_hours || [24];

  var times = [];
  hours.forEach(function(h) {
    var sendAt = startTime - (h * 60 * 60 * 1000);
    // Skip if appointment was booked after this reminder window
    if (sendAt > bookedAt && sendAt > Date.now()) {
      times.push(new Date(sendAt));
    }
  });
  return times.sort(function(a, b) { return a.getTime() - b.getTime(); });
}

// ════════════════════════════════════════════
// BLAST FILTER EVALUATION (Decision #189)
// ════════════════════════════════════════════

/**
 * Six blast filters, combinable with AND logic.
 * Returns clients matching ALL active filters.
 * @param {object[]} clients - Array of client records
 * @param {object} filters - Active filter criteria
 * @returns {object[]} Filtered client array
 */
export function evaluateBlastFilters(clients, filters) {
  if (!filters || !clients) return clients || [];

  var result = clients.slice();

  // Filter 1: last visit date — exclude clients who visited within N days
  if (filters.lastVisitDaysAgo != null && filters.lastVisitDaysAgo > 0) {
    var cutoff = Date.now() - (filters.lastVisitDaysAgo * 24 * 60 * 60 * 1000);
    result = result.filter(function(c) {
      if (!c.last_visit_at) return true; // never visited = include
      return new Date(c.last_visit_at).getTime() < cutoff;
    });
  }

  // Filter 2: service type — clients who have had a specific service
  if (filters.serviceId) {
    result = result.filter(function(c) {
      return (c.service_history || []).indexOf(filters.serviceId) !== -1;
    });
  }

  // Filter 3: birthday month
  if (filters.birthdayMonth != null && filters.birthdayMonth >= 1 && filters.birthdayMonth <= 12) {
    result = result.filter(function(c) {
      if (!c.birthday) return false;
      var bMonth = new Date(c.birthday).getMonth() + 1;
      return bMonth === filters.birthdayMonth;
    });
  }

  // Filter 4: membership status (grayed out until Module 9)
  if (filters.membershipStatus) {
    result = result.filter(function(c) {
      return (c.membership_status || 'none') === filters.membershipStatus;
    });
  }

  // Filter 5: loyalty tier (grayed out until Module 8)
  if (filters.loyaltyTier) {
    result = result.filter(function(c) {
      return (c.loyalty_tier || 'none') === filters.loyaltyTier;
    });
  }

  // Exclude opted-out clients (Decision #184)
  result = result.filter(function(c) { return !c.promo_opt_out; });

  return result;
}

// ════════════════════════════════════════════
// TWO-WAY CONFIRMATION (Decisions #185–#186)
// ════════════════════════════════════════════

const POSITIVE_REPLIES = ['y', 'yes', 'confirm', 'ok', 'yep', 'yeah', 'sure'];
const NEGATIVE_REPLIES = ['n', 'no', 'cancel', 'nope'];

/**
 * Process a client SMS reply for two-way confirmation.
 * @param {string} replyText - Raw SMS text from client
 * @returns {{ type: 'positive'|'negative'|'unknown', normalized: string }}
 */
export function processConfirmationReply(replyText) {
  var normalized = (replyText || '').trim().toLowerCase();
  if (POSITIVE_REPLIES.indexOf(normalized) !== -1) {
    return { type: 'positive', normalized: normalized };
  }
  if (NEGATIVE_REPLIES.indexOf(normalized) !== -1) {
    return { type: 'negative', normalized: normalized };
  }
  return { type: 'unknown', normalized: normalized };
}

// ════════════════════════════════════════════
// MOCK DISPATCH (Phase 1 — replaced in Phase 2)
// ════════════════════════════════════════════

/**
 * Mock-send a message. In Phase 1, this just creates a log entry.
 * In Phase 2, this calls the SMS/email provider API.
 * @param {object} params
 * @param {string} params.type - MESSAGE_TYPES value
 * @param {string} params.channel - 'sms' or 'email'
 * @param {object} params.client - { first_name, last_name, phone, email }
 * @param {string} params.content - Resolved message content
 * @param {object} params.settings - Salon settings
 * @returns {object} Log entry
 */
export function dispatchMessage(params) {
  var type = params.type;
  var channel = params.channel;
  var client = params.client || {};
  var content = params.content || '';

  // Opt-out check
  var check = canSendToClient(type, client);
  if (!check.allowed) {
    return {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      type: type,
      channel: channel,
      recipient: (client.first_name || '') + ' ' + (client.last_name || ''),
      recipientContact: channel === 'sms' ? (client.phone || '') : (client.email || ''),
      content: content,
      status: 'blocked',
      statusReason: check.reason,
      sent_at: new Date().toISOString(),
    };
  }

  // Phase 1: mock success (90% delivered, 8% sent, 2% failed)
  var rand = Math.random();
  var status = rand < 0.02 ? 'failed' : rand < 0.10 ? 'sent' : 'delivered';

  return {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    type: type,
    channel: channel,
    recipient: (client.first_name || '') + ' ' + (client.last_name || ''),
    recipientContact: channel === 'sms' ? (client.phone || '') : (client.email || ''),
    content: content,
    status: status,
    statusReason: null,
    sent_at: new Date().toISOString(),
  };
}

/**
 * Send a message using template + variables. Handles channel routing and opt-out.
 * Returns array of log entries (one per channel).
 */
export function sendMessage(type, template, vars, client, settings) {
  if (!isMessageTypeEnabled(type, settings)) return [];

  var content = resolveTemplate(template, vars);
  var channels = getChannels(type, settings);
  var logs = [];

  channels.forEach(function(ch) {
    logs.push(dispatchMessage({ type: type, channel: ch, client: client, content: content, settings: settings }));
  });

  return logs;
}

/**
 * Send a promotional blast to a filtered list of clients.
 * Returns { blastRecord, messageLogs[] }
 */
export function sendBlast(name, template, clients, settings) {
  var logs = [];
  var channels = getChannels(MESSAGE_TYPES.PROMOTIONAL, settings);

  clients.forEach(function(client) {
    var vars = { client_name: (client.first_name || '') + ' ' + (client.last_name || ''), salon_name: (settings || {}).salon_name || '' };
    var content = resolveTemplate(template, vars);
    channels.forEach(function(ch) {
      logs.push(dispatchMessage({ type: MESSAGE_TYPES.PROMOTIONAL, channel: ch, client: client, content: content, settings: settings }));
    });
  });

  var delivered = logs.filter(function(l) { return l.status === 'delivered'; }).length;
  var failed = logs.filter(function(l) { return l.status === 'failed'; }).length;

  var blastRecord = {
    id: 'blast-' + Date.now(),
    name: name,
    template: template,
    recipients: clients.length,
    delivered: delivered,
    failed: failed,
    sent_at: new Date().toISOString(),
    logs: logs,
  };

  return { blastRecord: blastRecord, messageLogs: logs };
}
