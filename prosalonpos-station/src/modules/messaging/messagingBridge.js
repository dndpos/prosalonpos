/**
 * Pro Salon POS — Messaging Bridge (Store → Component)
 * Session 50: Wired to messagingStore via Proxy pattern.
 * API mode → reads from store. Mock mode → returns static defaults below.
 * All export names preserved — downstream components need zero changes.
 */

import { MESSAGE_TYPES } from '../../lib/messagingService';
import { useMessagingStore } from '../../lib/stores/messagingStore';

// Lazy getter
function _getStore() { return useMessagingStore.getState(); }

// ─── Helper: array Proxy that checks store source ───
function _makeArrayProxy(defaults, storeGetter) {
  return new Proxy(defaults, {
    get: function(target, key) {
      var st = _getStore();
      var live = (st.source !== 'pending') ? storeGetter(st) : target;
      if (key === 'length') return live.length;
      if (key === 'find') return function(fn) { return live.find(fn); };
      if (key === 'filter') return function(fn) { return live.filter(fn); };
      if (key === 'map') return function(fn) { return live.map(fn); };
      if (key === 'forEach') return function(fn) { return live.forEach(fn); };
      if (key === 'some') return function(fn) { return live.some(fn); };
      if (key === 'every') return function(fn) { return live.every(fn); };
      if (key === 'reduce') return function(fn, init) { return live.reduce(fn, init); };
      if (key === 'slice') return function(a, b) { return live.slice(a, b); };
      if (key === 'concat') return function(arr) { return live.concat(arr); };
      if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
      var idx = Number(key);
      if (!isNaN(idx)) return live[idx];
      return live[key];
    }
  });
}

// ════════════════════════════════════════════
// MESSAGE TYPE COLORS (for UI dots/badges) — static, no Proxy needed
// ════════════════════════════════════════════
export var MSG_TYPE_COLORS = {
  [MESSAGE_TYPES.BOOKING_CONFIRM]: '#38BDF8',
  [MESSAGE_TYPES.REMINDER]:        '#7DD3FC',
  [MESSAGE_TYPES.CANCEL_CONFIRM]:  '#D97706',
  [MESSAGE_TYPES.NOSHOW]:          '#DC2626',
  [MESSAGE_TYPES.RECEIPT]:         '#059669',
  [MESSAGE_TYPES.WAITLIST]:        '#94A3B8',
  [MESSAGE_TYPES.PROMOTIONAL]:     '#A78BFA',
};

export var STATUS_COLORS = {
  delivered: '#059669',
  sent:      '#38BDF8',
  failed:    '#DC2626',
  bounced:   '#D97706',
  blocked:   '#64748B',
  queued:    '#94A3B8',
};

// ════════════════════════════════════════════
// MOCK TEMPLATES — static defaults, Proxy reads from store in API mode
// ════════════════════════════════════════════
var _defaultTemplates = [
  { id: 'tpl-01', type: MESSAGE_TYPES.BOOKING_CONFIRM, name: 'Default confirmation', active: true,
    content: 'Hi {client_name}, your appointment at {salon_name} is booked for {date} at {time} with {technician}. See you then!' },
  { id: 'tpl-02', type: MESSAGE_TYPES.BOOKING_CONFIRM, name: 'Short confirmation', active: false,
    content: '{client_name} — confirmed: {service} on {date} at {time}. {salon_name}' },
  { id: 'tpl-03', type: MESSAGE_TYPES.REMINDER, name: '24hr reminder', active: true,
    content: 'Reminder: {client_name}, you have an appointment tomorrow at {time} with {technician} at {salon_name}. Reply Y to confirm.' },
  { id: 'tpl-04', type: MESSAGE_TYPES.REMINDER, name: '2hr reminder', active: true,
    content: 'Hi {client_name}, just a reminder — your appointment is in 2 hours at {time}. See you soon at {salon_name}!' },
  { id: 'tpl-05', type: MESSAGE_TYPES.CANCEL_CONFIRM, name: 'Default cancellation', active: true,
    content: 'Hi {client_name}, your appointment on {date} at {time} at {salon_name} has been cancelled. Call us to rebook!' },
  { id: 'tpl-06', type: MESSAGE_TYPES.NOSHOW, name: 'Default no-show', active: true,
    content: 'Hi {client_name}, we missed you today at {salon_name}. Please call us to reschedule your {service} appointment.' },
  { id: 'tpl-07', type: MESSAGE_TYPES.RECEIPT, name: 'Default receipt', active: true,
    content: 'Thank you {client_name}! Your receipt from {salon_name}: {service} — Total: {total}. See you next time!' },
  { id: 'tpl-08', type: MESSAGE_TYPES.WAITLIST, name: 'Slot available', active: true,
    content: 'Great news {client_name}! A slot has opened up at {salon_name} on {date} at {time}. Book now before it fills up!' },
  { id: 'tpl-09', type: MESSAGE_TYPES.PROMOTIONAL, name: 'Birthday promo', active: true,
    content: 'Happy birthday {client_name}! 🎉 Enjoy 10% off your next visit at {salon_name}. Book today!' },
  { id: 'tpl-10', type: MESSAGE_TYPES.PROMOTIONAL, name: 'We miss you', active: true,
    content: "Hi {client_name}, it's been a while! We miss you at {salon_name}. Book your next appointment today." },
  { id: 'tpl-11', type: MESSAGE_TYPES.PROMOTIONAL, name: 'Seasonal special', active: false,
    content: 'Spring is here {client_name}! Treat yourself at {salon_name}. 20% off all color services this month.' },
];

export var MOCK_TEMPLATES = _makeArrayProxy(_defaultTemplates, function(st) { return st.templates; });

// ════════════════════════════════════════════
// MOCK MESSAGE LOG
// ════════════════════════════════════════════
var _defaultLog = [
  { id: 'msg-01', type: MESSAGE_TYPES.REMINDER,        channel: 'sms',   recipient: 'Sarah Mitchell',  recipientContact: '(561) 555-0101', status: 'delivered', sent_at: '2026-03-24T10:00:00Z', content: 'Reminder: Sarah, you have an appointment tomorrow at 2:00 PM with Maria at Luxe Hair Studio. Reply Y to confirm.' },
  { id: 'msg-02', type: MESSAGE_TYPES.BOOKING_CONFIRM, channel: 'sms',   recipient: 'Emma Davis',      recipientContact: '(561) 555-0112', status: 'delivered', sent_at: '2026-03-24T09:45:00Z', content: 'Hi Emma, your appointment at Luxe Hair Studio is booked for Mar 25 at 11:00 AM with Ashley. See you then!' },
  { id: 'msg-03', type: MESSAGE_TYPES.RECEIPT,          channel: 'email', recipient: 'Lisa Thompson',   recipientContact: 'lisa.t@email.com', status: 'delivered', sent_at: '2026-03-23T16:30:00Z', content: "Thank you Lisa! Your receipt from Luxe Hair Studio: Women's Haircut — Total: $55.00. See you next time!" },
  { id: 'msg-04', type: MESSAGE_TYPES.PROMOTIONAL,      channel: 'sms',   recipient: 'Dan Brooks',      recipientContact: '(561) 555-0107', status: 'delivered', sent_at: '2026-03-23T12:00:00Z', content: "Hi Dan, it's been a while! We miss you at Luxe Hair Studio. Book your next appointment today." },
  { id: 'msg-05', type: MESSAGE_TYPES.REMINDER,        channel: 'sms',   recipient: 'Amy Kim',         recipientContact: '(561) 555-0104', status: 'failed',    sent_at: '2026-03-23T10:00:00Z', content: 'Reminder: Amy, you have an appointment tomorrow at 9:00 AM with Nicole at Luxe Hair Studio.' },
  { id: 'msg-06', type: MESSAGE_TYPES.BOOKING_CONFIRM, channel: 'email', recipient: 'Rachel Parker',   recipientContact: 'rachel.p@email.com', status: 'bounced', sent_at: '2026-03-22T15:15:00Z', content: 'Hi Rachel, your appointment at Luxe Hair Studio is booked for Mar 23 at 10:30 AM with David.' },
  { id: 'msg-07', type: MESSAGE_TYPES.CANCEL_CONFIRM,  channel: 'sms',   recipient: 'Kate Johnson',    recipientContact: '(561) 555-0108', status: 'delivered', sent_at: '2026-03-22T11:00:00Z', content: 'Hi Kate, your appointment on Mar 23 at 3:00 PM at Luxe Hair Studio has been cancelled. Call us to rebook!' },
  { id: 'msg-08', type: MESSAGE_TYPES.NOSHOW,          channel: 'sms',   recipient: 'Nina Lee',        recipientContact: '(561) 555-0109', status: 'delivered', sent_at: '2026-03-21T17:00:00Z', content: 'Hi Nina, we missed you today at Luxe Hair Studio. Please call us to reschedule your Balayage appointment.' },
  { id: 'msg-09', type: MESSAGE_TYPES.PROMOTIONAL,      channel: 'sms',   recipient: 'Blast: 45 clients', recipientContact: '—', status: 'delivered', sent_at: '2026-03-18T11:00:00Z', content: 'Spring special! 20% off all color services this month at Luxe Hair Studio!' },
  { id: 'msg-10', type: MESSAGE_TYPES.WAITLIST,         channel: 'sms',   recipient: 'Maria Vasquez',   recipientContact: '(561) 555-0106', status: 'delivered', sent_at: '2026-03-20T14:30:00Z', content: 'Great news Maria! A slot has opened up at Luxe Hair Studio on Mar 21 at 1:00 PM. Book now!' },
];

export var MOCK_MESSAGE_LOG = _makeArrayProxy(_defaultLog, function(st) { return st.messageLog; });

// ════════════════════════════════════════════
// MOCK BLAST HISTORY
// ════════════════════════════════════════════
var _defaultBlasts = [
  { id: 'blast-01', name: 'Spring color special', template: 'Spring special! 20% off all color services this month at Luxe Hair Studio!', recipients: 45, delivered: 43, failed: 2, sent_at: '2026-03-18T11:00:00Z' },
  { id: 'blast-02', name: 'February love promo', template: "Happy Valentine's Day! Treat yourself to a spa day. 15% off all services this week.", recipients: 120, delivered: 118, failed: 2, sent_at: '2026-02-14T10:00:00Z' },
];

export var MOCK_BLASTS = _makeArrayProxy(_defaultBlasts, function(st) { return st.blasts || []; });

// ════════════════════════════════════════════
// MONTH NAMES (for blast filter UI) — static
// ════════════════════════════════════════════
export var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
