/**
 * Pro Salon POS — Membership Bridge (Store → Component)
 * Session 50: Wired to membershipStore via Proxy pattern.
 * API mode → reads from store. Mock mode → returns static defaults below.
 * All export names preserved — downstream components need zero changes.
 */

import { useMembershipStore } from '../../lib/stores/membershipStore';

// Lazy getter
function _getStore() { return useMembershipStore.getState(); }

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
// MOCK MEMBERSHIP PLANS (Decision #231, #232, #233)
// ════════════════════════════════════════════
var _defaultPlans = [
  {
    id: 'mp-01', location_id: 'loc-01', name: 'Silver Membership',
    description: '10% off all services + $25 monthly credit. Perfect for regular clients.',
    billing_cycle_days: 30, price_cents: 4900, payment_method: 'in_person',
    min_commitment_cycles: 3, notice_period_days: null,
    missed_payment_action: 'pause', missed_payment_threshold: null,
    credit_rollover: false, perk_apply_mode: 'auto', freeze_allowed: true,
    active: true, position: 1,
  },
  {
    id: 'mp-02', location_id: 'loc-01', name: 'Gold Membership',
    description: '15% off all services + 1 free blowout per month + $50 credit.',
    billing_cycle_days: 30, price_cents: 8900, payment_method: 'in_person',
    min_commitment_cycles: 6, notice_period_days: 30,
    missed_payment_action: 'grace_period', missed_payment_threshold: 15,
    credit_rollover: true, perk_apply_mode: 'auto', freeze_allowed: true,
    active: true, position: 2,
  },
  {
    id: 'mp-03', location_id: 'loc-01', name: 'VIP Annual',
    description: '20% off everything + 2 free haircuts per month + $100 credit. Best value.',
    billing_cycle_days: 365, price_cents: 89900, payment_method: 'upfront',
    min_commitment_cycles: null, notice_period_days: null,
    missed_payment_action: 'cancel', missed_payment_threshold: 1,
    credit_rollover: true, perk_apply_mode: 'auto', freeze_allowed: true,
    active: true, position: 3,
  },
  {
    id: 'mp-04', location_id: 'loc-01', name: 'Nails Only',
    description: '20% off all nail services. No credits or free services.',
    billing_cycle_days: 30, price_cents: 2900, payment_method: 'in_person',
    min_commitment_cycles: null, notice_period_days: null,
    missed_payment_action: 'cancel', missed_payment_threshold: 2,
    credit_rollover: false, perk_apply_mode: 'auto', freeze_allowed: false,
    active: false, position: 4,
  },
];

export var MOCK_MEMBERSHIP_PLANS = _makeArrayProxy(_defaultPlans, function(st) { return st.plans; });

// ════════════════════════════════════════════
// MOCK PERKS (Decision #232)
// ════════════════════════════════════════════
var _defaultPerks = [
  { id: 'pk-01', plan_id: 'mp-01', type: 'percentage_discount', discount_percentage: 10, service_catalog_id: null, category_id: null, credit_amount_cents: null, quantity_per_cycle: null },
  { id: 'pk-02', plan_id: 'mp-01', type: 'service_credit', discount_percentage: null, service_catalog_id: null, category_id: null, credit_amount_cents: 2500, quantity_per_cycle: null },
  { id: 'pk-03', plan_id: 'mp-02', type: 'percentage_discount', discount_percentage: 15, service_catalog_id: null, category_id: null, credit_amount_cents: null, quantity_per_cycle: null },
  { id: 'pk-04', plan_id: 'mp-02', type: 'free_service', discount_percentage: null, service_catalog_id: 'svc-02', category_id: null, credit_amount_cents: null, quantity_per_cycle: 1 },
  { id: 'pk-05', plan_id: 'mp-02', type: 'service_credit', discount_percentage: null, service_catalog_id: null, category_id: null, credit_amount_cents: 5000, quantity_per_cycle: null },
  { id: 'pk-06', plan_id: 'mp-03', type: 'percentage_discount', discount_percentage: 20, service_catalog_id: null, category_id: null, credit_amount_cents: null, quantity_per_cycle: null },
  { id: 'pk-07', plan_id: 'mp-03', type: 'free_service', discount_percentage: null, service_catalog_id: 'svc-01', category_id: null, credit_amount_cents: null, quantity_per_cycle: 2 },
  { id: 'pk-08', plan_id: 'mp-03', type: 'service_credit', discount_percentage: null, service_catalog_id: null, category_id: null, credit_amount_cents: 10000, quantity_per_cycle: null },
  { id: 'pk-09', plan_id: 'mp-04', type: 'percentage_discount', discount_percentage: 20, service_catalog_id: null, category_id: 'cat-02', credit_amount_cents: null, quantity_per_cycle: null },
];

export var MOCK_MEMBERSHIP_PERKS = _makeArrayProxy(_defaultPerks, function(st) { return st.perks || []; });

// ════════════════════════════════════════════
// MOCK CLIENT MEMBERSHIPS (Decision #242)
// ════════════════════════════════════════════
var _defaultMembers = [
  { id: 'cm-01', client_id: 'cli-01', client_name: 'Sarah Mitchell',  plan_id: 'mp-02', plan_name: 'Gold Membership',   status: 'active',    signup_location_id: 'loc-01', started_at: '2025-11-15T10:00:00Z', next_billing_date: '2026-04-15', current_credit_cents: 3200, free_services_remaining: 1, cycles_completed: 4, freeze_until: null, cancelled_at: null },
  { id: 'cm-02', client_id: 'cli-03', client_name: 'Lisa Thompson',   plan_id: 'mp-01', plan_name: 'Silver Membership', status: 'active',    signup_location_id: 'loc-01', started_at: '2026-01-10T14:00:00Z', next_billing_date: '2026-04-10', current_credit_cents: 1800, free_services_remaining: 0, cycles_completed: 2, freeze_until: null, cancelled_at: null },
  { id: 'cm-03', client_id: 'cli-05', client_name: 'Rachel Parker',   plan_id: 'mp-02', plan_name: 'Gold Membership',   status: 'frozen',    signup_location_id: 'loc-01', started_at: '2025-09-01T09:00:00Z', next_billing_date: null,       current_credit_cents: 5000, free_services_remaining: 1, cycles_completed: 6, freeze_until: '2026-04-15', cancelled_at: null },
  { id: 'cm-04', client_id: 'cli-08', client_name: 'Nina Lee',        plan_id: 'mp-03', plan_name: 'VIP Annual',        status: 'active',    signup_location_id: 'loc-01', started_at: '2026-01-01T12:00:00Z', next_billing_date: '2027-01-01', current_credit_cents: 7500, free_services_remaining: 2, cycles_completed: 0, freeze_until: null, cancelled_at: null },
  { id: 'cm-05', client_id: 'cli-10', client_name: 'Tina Washington', plan_id: 'mp-01', plan_name: 'Silver Membership', status: 'paused',    signup_location_id: 'loc-01', started_at: '2025-12-01T10:00:00Z', next_billing_date: '2026-03-01', current_credit_cents: 0,    free_services_remaining: 0, cycles_completed: 2, freeze_until: null, cancelled_at: null },
  { id: 'cm-06', client_id: 'cli-12', client_name: 'Emma Davis',      plan_id: 'mp-04', plan_name: 'Nails Only',        status: 'cancelled', signup_location_id: 'loc-01', started_at: '2025-10-15T11:00:00Z', next_billing_date: null,       current_credit_cents: 0,    free_services_remaining: 0, cycles_completed: 4, freeze_until: null, cancelled_at: '2026-02-15T09:00:00Z' },
];

export var MOCK_CLIENT_MEMBERSHIPS = _makeArrayProxy(_defaultMembers, function(st) { return st.members; });

// ════════════════════════════════════════════
// MOCK BILLING TRANSACTIONS — static (not in store yet)
// ════════════════════════════════════════════
export var MOCK_BILLING_TRANSACTIONS = [
  { id: 'bt-01', membership_id: 'cm-01', type: 'payment',  amount_cents: 8900,  created_at: '2026-03-15T10:30:00Z', note: 'Monthly payment — Gold' },
  { id: 'bt-02', membership_id: 'cm-01', type: 'payment',  amount_cents: 8900,  created_at: '2026-02-15T11:00:00Z', note: 'Monthly payment — Gold' },
  { id: 'bt-03', membership_id: 'cm-01', type: 'credit',   amount_cents: 5000,  created_at: '2026-03-15T10:30:00Z', note: '$50 credit issued' },
  { id: 'bt-04', membership_id: 'cm-01', type: 'redeem',   amount_cents: -1800, created_at: '2026-03-20T14:00:00Z', note: 'Credit used at checkout' },
  { id: 'bt-05', membership_id: 'cm-02', type: 'payment',  amount_cents: 4900,  created_at: '2026-03-10T09:00:00Z', note: 'Monthly payment — Silver' },
  { id: 'bt-06', membership_id: 'cm-02', type: 'credit',   amount_cents: 2500,  created_at: '2026-03-10T09:00:00Z', note: '$25 credit issued' },
  { id: 'bt-07', membership_id: 'cm-03', type: 'freeze',   amount_cents: 0,     created_at: '2026-03-01T10:00:00Z', note: 'Frozen until Apr 15' },
  { id: 'bt-08', membership_id: 'cm-04', type: 'payment',  amount_cents: 89900, created_at: '2026-01-01T12:00:00Z', note: 'Annual payment — VIP' },
  { id: 'bt-09', membership_id: 'cm-04', type: 'credit',   amount_cents: 10000, created_at: '2026-03-01T00:00:00Z', note: '$100 credit issued (March)' },
  { id: 'bt-10', membership_id: 'cm-05', type: 'payment',  amount_cents: 4900,  created_at: '2026-02-01T10:00:00Z', note: 'Monthly payment — Silver' },
  { id: 'bt-11', membership_id: 'cm-05', type: 'missed',   amount_cents: 0,     created_at: '2026-03-01T00:00:00Z', note: 'Missed payment — membership paused' },
  { id: 'bt-12', membership_id: 'cm-06', type: 'cancel',   amount_cents: 0,     created_at: '2026-02-15T09:00:00Z', note: 'Membership cancelled by client' },
];

// ════════════════════════════════════════════
// STATUS COLORS — static
// ════════════════════════════════════════════
export var STATUS_COLORS = {
  active:    { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' },
  paused:    { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  frozen:    { bg: 'rgba(96,165,250,0.15)', text: '#7DD3FC' },
  cancelled: { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' },
};

// Billing cycle display helper
export function cycleName(days) {
  if (days === 30) return 'Monthly';
  if (days === 90) return 'Quarterly';
  if (days === 365) return 'Annual';
  return days + ' days';
}

// Transaction type colors
export var TXN_COLORS = {
  payment: '#22C55E',
  credit:  '#7DD3FC',
  redeem:  '#A855F7',
  freeze:  '#3B82F6',
  missed:  '#F59E0B',
  cancel:  '#EF4444',
};
