/**
 * Pro Salon POS — Loyalty Bridge (Store → Component)
 * Session 50: Wired to loyaltyStore via Proxy pattern.
 * API mode → reads from store. Mock mode → returns static defaults below.
 * All export names preserved — downstream components need zero changes.
 */

import { useLoyaltyStore } from '../../lib/stores/loyaltyStore';

// Lazy getter
function _getStore() { return useLoyaltyStore.getState(); }

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
// MOCK LOYALTY PROGRAM (Decision #222)
// Object Proxy — reads program from store in API mode
// ════════════════════════════════════════════
var _defaultProgram = {
  id: 'lp-01', location_id: 'loc-01', program_type: 'tiered',
  earn_per_dollar: 1, earn_per_visit: 10, expiration_months: null,
  redemption_mode: 'manual', tier_reset: 'permanent',
  show_on_receipt: true, active: true,
};

export var MOCK_LOYALTY_PROGRAM = new Proxy(_defaultProgram, {
  get: function(defaults, key) {
    var st = _getStore();
    if (st.source !== 'pending' && st.program) {
      return st.program[key] !== undefined ? st.program[key] : defaults[key];
    }
    return defaults[key];
  }
});

// ════════════════════════════════════════════
// MOCK TIERS (Decision #222, #223, #224)
// ════════════════════════════════════════════
var _defaultTiers = [
  { id: 'lt-01', program_id: 'lp-01', name: 'Silver',   threshold_points: 0,    earn_multiplier: 1.0, position: 1 },
  { id: 'lt-02', program_id: 'lp-01', name: 'Gold',     threshold_points: 500,  earn_multiplier: 1.5, position: 2 },
  { id: 'lt-03', program_id: 'lp-01', name: 'Platinum', threshold_points: 1500, earn_multiplier: 2.0, position: 3 },
];

export var MOCK_LOYALTY_TIERS = _makeArrayProxy(_defaultTiers, function(st) { return st.tiers; });

// ════════════════════════════════════════════
// MOCK REWARDS (Decision #221)
// ════════════════════════════════════════════
var _defaultRewards = [
  { id: 'lr-01', program_id: 'lp-01', name: '$10 off', type: 'dollar_discount', point_cost: 100, discount_cents: 1000, service_catalog_ids: [], service_catalog_id: null, tier_id: null, active: true },
  { id: 'lr-02', program_id: 'lp-01', name: '$25 off', type: 'dollar_discount', point_cost: 250, discount_cents: 2500, service_catalog_ids: [], service_catalog_id: null, tier_id: null, active: true },
  { id: 'lr-03', program_id: 'lp-01', name: 'Free Basic Service', type: 'free_service', point_cost: 200, discount_cents: null, service_catalog_ids: ['svc-01', 'svc-02', 'svc-09', 'svc-14'], service_catalog_id: 'svc-01', tier_id: null, active: true },
  { id: 'lr-04', program_id: 'lp-01', name: 'Free Nail Service (Gold+)', type: 'free_service', point_cost: 150, discount_cents: null, service_catalog_ids: ['svc-09', 'svc-10', 'svc-11'], service_catalog_id: 'svc-09', tier_id: 'lt-02', active: true },
  { id: 'lr-05', program_id: 'lp-01', name: '$50 off (Platinum)', type: 'dollar_discount', point_cost: 400, discount_cents: 5000, service_catalog_ids: [], service_catalog_id: null, tier_id: 'lt-03', active: true },
];

export var MOCK_LOYALTY_REWARDS = _makeArrayProxy(_defaultRewards, function(st) { return st.rewards; });

// ════════════════════════════════════════════
// MOCK CLIENT LOYALTY DATA (Decision #230) — static for now
// ════════════════════════════════════════════
export var MOCK_CLIENT_LOYALTY = [
  { client_id: 'cli-01', name: 'Sarah Mitchell',  points_balance: 285, lifetime_points: 1620, tier_id: 'lt-03', tier_name: 'Platinum' },
  { client_id: 'cli-03', name: 'Lisa Thompson',   points_balance: 140, lifetime_points: 580,  tier_id: 'lt-02', tier_name: 'Gold' },
  { client_id: 'cli-04', name: 'Amy Kim',         points_balance: 75,  lifetime_points: 320,  tier_id: 'lt-01', tier_name: 'Silver' },
  { client_id: 'cli-05', name: 'Rachel Parker',   points_balance: 520, lifetime_points: 890,  tier_id: 'lt-02', tier_name: 'Gold' },
  { client_id: 'cli-07', name: 'Dan Brooks',      points_balance: 30,  lifetime_points: 180,  tier_id: 'lt-01', tier_name: 'Silver' },
  { client_id: 'cli-08', name: 'Nina Lee',        points_balance: 410, lifetime_points: 1510, tier_id: 'lt-03', tier_name: 'Platinum' },
  { client_id: 'cli-12', name: 'Emma Davis',      points_balance: 95,  lifetime_points: 445,  tier_id: 'lt-01', tier_name: 'Silver' },
];

// ════════════════════════════════════════════
// MOCK LOYALTY TRANSACTIONS (Decision #228) — static for now
// ════════════════════════════════════════════
export var MOCK_LOYALTY_TRANSACTIONS = [
  { id: 'ltx-01', client_id: 'cli-01', type: 'earn',    points: 65,   balance_after: 285, created_at: '2026-03-22T15:00:00Z', note: "Women's Haircut + Blowout" },
  { id: 'ltx-02', client_id: 'cli-01', type: 'redeem',  points: -100, balance_after: 220, created_at: '2026-03-18T11:30:00Z', note: '$10 off — redeemed', reward_name: '$10 off' },
  { id: 'ltx-03', client_id: 'cli-01', type: 'earn',    points: 155,  balance_after: 320, created_at: '2026-03-10T14:00:00Z', note: 'Highlights' },
  { id: 'ltx-04', client_id: 'cli-03', type: 'earn',    points: 45,   balance_after: 140, created_at: '2026-03-21T16:30:00Z', note: 'Blowout' },
  { id: 'ltx-05', client_id: 'cli-03', type: 'earn',    points: 55,   balance_after: 95,  created_at: '2026-03-14T10:00:00Z', note: "Women's Haircut" },
  { id: 'ltx-06', client_id: 'cli-05', type: 'redeem',  points: -250, balance_after: 520, created_at: '2026-03-19T13:00:00Z', note: '$25 off — redeemed', reward_name: '$25 off' },
  { id: 'ltx-07', client_id: 'cli-05', type: 'earn',    points: 90,   balance_after: 770, created_at: '2026-03-15T11:00:00Z', note: 'Facial' },
  { id: 'ltx-08', client_id: 'cli-08', type: 'earn',    points: 210,  balance_after: 410, created_at: '2026-03-20T14:30:00Z', note: 'Balayage' },
  { id: 'ltx-09', client_id: 'cli-08', type: 'redeem',  points: -200, balance_after: 200, created_at: '2026-03-12T10:00:00Z', note: 'Free blowout — redeemed', reward_name: 'Free blowout' },
  { id: 'ltx-10', client_id: 'cli-12', type: 'earn',    points: 45,   balance_after: 95,  created_at: '2026-03-23T09:30:00Z', note: "Men's Haircut" },
];

// Tier colors for UI badges — static
export var TIER_COLORS = {
  'lt-01': { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' },
  'lt-02': { bg: 'rgba(234,179,8,0.15)',   text: '#EAB308' },
  'lt-03': { bg: 'rgba(168,85,247,0.15)',  text: '#A855F7' },
};
