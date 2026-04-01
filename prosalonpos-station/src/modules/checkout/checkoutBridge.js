/**
 * Pro Salon POS — Checkout Bridge (Store → Component Data Layer)
 * Session 88: Renamed from checkoutMockData.js — this is NOT mock data.
 * All exports read from live Zustand stores via Proxy objects.
 * Downstream checkout components import from here and get real data.
 */

import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useClientStore } from '../../lib/stores/clientStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useInventoryStore } from '../../lib/stores/inventoryStore';
import { phoneToDigits } from '../../lib/formatUtils';

// ─── Lazy getters (called when data is accessed, not at import time) ───
function _getSettings() { return useSettingsStore.getState().settings || {}; }
function _getStaff() { return useStaffStore.getState().staff || []; }
function _getClients() { return useClientStore.getState().clients || []; }
function _getServices() { return useServiceStore.getState().services || []; }
function _getCategories() { return useServiceStore.getState().categories || []; }

// ─── CHECKOUT_SETTINGS ───
// Getter object that reads from settingsStore each time a property is accessed.
// Downstream components use: const settings = CHECKOUT_SETTINGS; settings.tax_rate_percentage
var _settingsDefaults = {
  tax_rate_percentage: 7.5,
  price_adjust_permission: 'all_staff',
  discount_types_enabled: ['pct_total', 'flat_total', 'pct_line_item'],
  discount_default_type: 'flat_total',
  discount_presets_pct: [10, 15, 20, 25],
  discount_presets_flat_cents: [500, 1000, 1500, 2000],
  discount_permission: 'all_staff',
  discount_max_pct: null,
  discount_max_flat_cents: null,
  tip_presets: [18, 20, 25],
  tip_distribution_mode: 'proportional',
  tip_entry_location: 'station',
  tip_edit_permission: 'no_pin',
  receipt_options: ['email', 'text', 'print'],
  receipt_email_enabled: true,
  receipt_text_enabled: true,
  receipt_print_enabled: true,
  store_auto_print_receipt: true,
  auto_print_open_ticket: true,
  void_refund_permission: 'manager_owner',
  void_reason_presets: ['Wrong client', 'Duplicate ticket', 'Rang up incorrectly', 'Other'],
  numpad_mode: 'cash_register',
  cash_rounding: true,
  receipt_show_tip_line: true,
  receipt_footer_text: 'Thank you for visiting!\nSee you next time! 💇',
  receipt_show_signature: true,
};

// Build a getter-backed object so every property read hits the live store
export var CHECKOUT_SETTINGS = new Proxy(_settingsDefaults, {
  get: function(defaults, key) {
    var s = _getSettings();
    // tip_presets in settings store is a comma-separated string; checkout expects array
    if (key === 'tip_presets') {
      if (s.tip_presets_array) return s.tip_presets_array;
      if (typeof s.tip_presets === 'string') {
        return s.tip_presets.split(',').map(Number);
      }
      return defaults.tip_presets;
    }
    // Use store value if it exists, otherwise fall back to defaults
    return s[key] !== undefined ? s[key] : defaults[key];
  }
});

// ─── SALON_INFO ───
// Reads salon name/address/phone from settingsStore
var _salonInfoDefaults = {
  name: "Bella's Salon",
  address_line1: '123 Main St, Suite 4',
  address_line2: 'Palm Beach Gardens, FL 33410',
  phone: '(561) 555-0100',
  logo_url: null,
};

export var SALON_INFO = new Proxy(_salonInfoDefaults, {
  get: function(defaults, key) {
    var s = _getSettings();
    if (key === 'name') return s.salon_name || defaults.name;
    if (key === 'address_line1') return s.salon_address_line1 || defaults.address_line1;
    if (key === 'address_line2') return s.salon_address_line2 || defaults.address_line2;
    if (key === 'phone') return s.salon_phone || defaults.phone;
    if (key === 'logo_url') return s.salon_logo_url || defaults.logo_url;
    return defaults[key];
  }
});

// ─── CHECKOUT_STAFF ───
// Reads from staffStore. Components access it as: CHECKOUT_STAFF.find(s => s.id === techId)
function _buildCheckoutStaff() {
  return _getStaff().filter(function(s) { return s.active && s.status !== 'deleted'; });
}

export var CHECKOUT_STAFF = new Proxy([], {
  get: function(target, key) {
    var live = _buildCheckoutStaff();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'some') return function(fn) { return live.some(fn); };
    if (key === 'every') return function(fn) { return live.every(fn); };
    if (key === 'reduce') return function(fn, init) { return live.reduce(fn, init); };
    if (key === 'indexOf') return function(item) { return live.indexOf(item); };
    if (key === 'includes') return function(item) { return live.includes(item); };
    if (key === 'slice') return function(a, b) { return live.slice(a, b); };
    if (key === 'concat') return function(arr) { return live.concat(arr); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

// ─── Mock retail products → now from inventoryStore ───
// Build retail items from inventory products, mapping category_id → category name
function _getInventoryProducts() { return useInventoryStore.getState().products || []; }
function _getInventoryCategories() { return useInventoryStore.getState().categories || []; }

function _buildRetailItems() {
  var products = _getInventoryProducts();
  var cats = _getInventoryCategories();
  return products.filter(function(p) { return p.active; }).map(function(p) {
    var cat = cats.find(function(c) { return c.id === p.category_id; });
    return { id: p.id, name: p.name, price_cents: p.price_cents, cat: cat ? cat.name : 'Other', barcode: p.sku || '' };
  });
}

function _buildRetailCategories() {
  var cats = _getInventoryCategories();
  var activeCats = cats.filter(function(c) { return c.active; });
  // Only return category names that have at least one active product
  var products = _getInventoryProducts();
  return activeCats.filter(function(c) {
    return products.some(function(p) { return p.active && p.category_id === c.id; });
  }).map(function(c) { return c.name; });
}

export var RETAIL_CATEGORIES = new Proxy([], {
  get: function(target, key) {
    var live = _buildRetailCategories();
    if (key === 'length') return live.length;
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

export var MOCK_RETAIL = new Proxy([], {
  get: function(target, key) {
    var live = _buildRetailItems();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'some') return function(fn) { return live.some(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

// ─── Service catalog — from serviceStore ───
function _buildServiceCatalog() {
  return _getServices().map(function(s) {
    return { id: s.id, name: s.name, color: s.calendar_color, dur: s.default_duration_minutes, price_cents: s.price_cents, cat: (s.category_ids || [])[0] };
  });
}

export var SERVICE_CATEGORIES = new Proxy([], {
  get: function(target, key) {
    var live = _getCategories();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

export var SERVICE_CATALOG = new Proxy([], {
  get: function(target, key) {
    var live = _buildServiceCatalog();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

// ─── CHECKOUT_CLIENTS — from clientStore ───
function _buildCheckoutClients() {
  return _getClients().map(function(c) {
    return Object.assign({}, c, { phone: phoneToDigits(c.phone || '') });
  });
}

export var CHECKOUT_CLIENTS = new Proxy([], {
  get: function(target, key) {
    var live = _buildCheckoutClients();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'some') return function(fn) { return live.some(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});
