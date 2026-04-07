/**
 * Pro Salon POS — Service Package Bridge (Store → Component)
 * Session 50: Wired to packageStore via Proxy pattern.
 * API mode → reads from store. Mock mode → returns static defaults below.
 * All export names preserved — downstream components need zero changes.
 */

import { usePackageStore } from '../../lib/stores/packageStore';

// Lazy getter
function _getStore() { return usePackageStore.getState(); }

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
// MOCK SERVICE PACKAGES (templates owner creates)
// ════════════════════════════════════════════
var _defaultPackages = [
  {
    id: 'pkg-01', location_id: 'loc-01', name: 'Nail Lovers Bundle',
    description: '10 nail services at a great price — mix manicures and pedicures.',
    price_cents: 35000, expiration_enabled: true, expiration_days: 365,
    transferable: false, refundable: true, active: true, created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'pkg-02', location_id: 'loc-01', name: 'Spa Essentials',
    description: '5 facials + 5 waxing sessions — your monthly self-care sorted.',
    price_cents: 45000, expiration_enabled: true, expiration_days: 180,
    transferable: true, refundable: false, active: true, created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'pkg-03', location_id: 'loc-01', name: "Men's Grooming Pack",
    description: "10 men's haircuts + 5 beard trims — look sharp all year.",
    price_cents: 40000, expiration_enabled: false, expiration_days: null,
    transferable: false, refundable: true, active: true, created_at: '2026-02-20T10:00:00Z',
  },
];

export var MOCK_SERVICE_PACKAGES = _makeArrayProxy(_defaultPackages, function(st) { return st.packages; });

// ════════════════════════════════════════════
// MOCK SERVICE PACKAGE ITEMS (services + qty in each template)
// ════════════════════════════════════════════
var _defaultPackageItems = [
  { id: 'pki-01', package_id: 'pkg-01', service_id: 'svc-09', service_name: 'Manicure',       quantity: 5 },
  { id: 'pki-02', package_id: 'pkg-01', service_id: 'svc-10', service_name: 'Pedicure',       quantity: 5 },
  { id: 'pki-03', package_id: 'pkg-02', service_id: 'svc-12', service_name: 'Facial',         quantity: 5 },
  { id: 'pki-04', package_id: 'pkg-02', service_id: 'svc-13', service_name: 'Waxing',         quantity: 5 },
  { id: 'pki-05', package_id: 'pkg-03', service_id: 'svc-14', service_name: "Men's Haircut",  quantity: 10 },
  { id: 'pki-06', package_id: 'pkg-03', service_id: 'svc-15', service_name: 'Beard Trim',     quantity: 5 },
];

export var MOCK_SERVICE_PACKAGE_ITEMS = _makeArrayProxy(_defaultPackageItems, function(st) { return st.packageItems; });

// ════════════════════════════════════════════
// MOCK CLIENT PACKAGES (purchased by clients) — static for now
// ════════════════════════════════════════════
var _defaultClientPackages = [
  {
    id: 'cpkg-01', client_id: 'cli-01', client_name: 'Sarah Mitchell',
    package_id: 'pkg-01', package_name: 'Nail Lovers Bundle',
    price_paid_cents: 35000, purchased_at: '2026-02-10T14:30:00Z',
    expires_at: '2027-02-10T14:30:00Z', transferable: false, refundable: true,
    status: 'active', sold_by_staff_id: 'staff-06', sold_by_staff_name: 'Sarah',
  },
  {
    id: 'cpkg-02', client_id: 'cli-07', client_name: 'Dan Brooks',
    package_id: 'pkg-03', package_name: "Men's Grooming Pack",
    price_paid_cents: 40000, purchased_at: '2026-03-01T11:00:00Z',
    expires_at: null, transferable: false, refundable: true,
    status: 'active', sold_by_staff_id: 'staff-01', sold_by_staff_name: 'Maria',
  },
];

export var MOCK_CLIENT_PACKAGES = _makeArrayProxy(_defaultClientPackages, function(st) { return st.clientPackages; });

// ════════════════════════════════════════════
// MOCK CLIENT PACKAGE ITEMS (remaining counts per service)
// ════════════════════════════════════════════
var _defaultClientPackageItems = [
  { id: 'cpi-01', client_package_id: 'cpkg-01', service_id: 'svc-09', service_name: 'Manicure', total_quantity: 5, remaining: 3 },
  { id: 'cpi-02', client_package_id: 'cpkg-01', service_id: 'svc-10', service_name: 'Pedicure', total_quantity: 5, remaining: 4 },
  { id: 'cpi-03', client_package_id: 'cpkg-02', service_id: 'svc-14', service_name: "Men's Haircut", total_quantity: 10, remaining: 8 },
  { id: 'cpi-04', client_package_id: 'cpkg-02', service_id: 'svc-15', service_name: 'Beard Trim',    total_quantity: 5,  remaining: 4 },
];

export var MOCK_CLIENT_PACKAGE_ITEMS = _makeArrayProxy(_defaultClientPackageItems, function(st) { return st.clientPackageItems; });

// ════════════════════════════════════════════
// MOCK PACKAGE REDEMPTIONS (log of each session used) — static
// ════════════════════════════════════════════
export var MOCK_PACKAGE_REDEMPTIONS = [
  { id: 'pr-01', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-01', ticket_id: 'tk-301',
    service_redeemed_id: 'svc-09', service_redeemed_name: 'Manicure',
    package_service_id: 'svc-09', package_service_name: 'Manicure',
    upgrade_difference_cents: 0, redeemed_at: '2026-02-20T15:00:00Z', staff_id: 'staff-04', staff_name: 'Nicole' },
  { id: 'pr-02', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-01', ticket_id: 'tk-312',
    service_redeemed_id: 'svc-09', service_redeemed_name: 'Manicure',
    package_service_id: 'svc-09', package_service_name: 'Manicure',
    upgrade_difference_cents: 0, redeemed_at: '2026-03-05T11:30:00Z', staff_id: 'staff-04', staff_name: 'Nicole' },
  { id: 'pr-03', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-02', ticket_id: 'tk-318',
    service_redeemed_id: 'svc-11', service_redeemed_name: 'Gel Manicure',
    package_service_id: 'svc-10', package_service_name: 'Pedicure',
    upgrade_difference_cents: 0, redeemed_at: '2026-03-12T14:00:00Z', staff_id: 'staff-04', staff_name: 'Nicole' },
  { id: 'pr-04', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-03', ticket_id: 'tk-305',
    service_redeemed_id: 'svc-14', service_redeemed_name: "Men's Haircut",
    package_service_id: 'svc-14', package_service_name: "Men's Haircut",
    upgrade_difference_cents: 0, redeemed_at: '2026-03-08T10:00:00Z', staff_id: 'staff-03', staff_name: 'James' },
  { id: 'pr-05', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-03', ticket_id: 'tk-320',
    service_redeemed_id: 'svc-14', service_redeemed_name: "Men's Haircut",
    package_service_id: 'svc-14', package_service_name: "Men's Haircut",
    upgrade_difference_cents: 0, redeemed_at: '2026-03-20T09:45:00Z', staff_id: 'staff-03', staff_name: 'James' },
  { id: 'pr-06', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-04', ticket_id: 'tk-305',
    service_redeemed_id: 'svc-15', service_redeemed_name: 'Beard Trim',
    package_service_id: 'svc-15', package_service_name: 'Beard Trim',
    upgrade_difference_cents: 0, redeemed_at: '2026-03-08T10:00:00Z', staff_id: 'staff-03', staff_name: 'James' },
];

// ════════════════════════════════════════════
// HELPER: Find active packages for a client
// ════════════════════════════════════════════
export function getClientPackages(clientId) {
  var all = MOCK_CLIENT_PACKAGES.filter(function(cp) {
    return cp.client_id === clientId && cp.status === 'active';
  });
  console.log('[PkgBridge] getClientPackages(' + clientId + ') — total MOCK_CLIENT_PACKAGES:', MOCK_CLIENT_PACKAGES.length, 'filtered:', all.length);
  if (all.length === 0 && MOCK_CLIENT_PACKAGES.length > 0) {
    console.log('[PkgBridge] All client_ids in store:', MOCK_CLIENT_PACKAGES.map(function(cp) { return cp.client_id; }));
  }
  return all;
}

// ════════════════════════════════════════════
// HELPER: Get remaining items for a client package
// ════════════════════════════════════════════
export function getClientPackageItems(clientPackageId) {
  return MOCK_CLIENT_PACKAGE_ITEMS.filter(function(cpi) {
    return cpi.client_package_id === clientPackageId && cpi.remaining > 0;
  });
}

// ════════════════════════════════════════════
// HELPER: Find matching package items for a service on the ticket
// Uses category match — any service in the same category qualifies.
// Returns array of { clientPackage, clientPackageItem, isExactMatch, catalogPriceDiff }
// ════════════════════════════════════════════
export function findRedeemablePackageItems(clientId, ticketServiceId, allServices, allCategories) {
  var clientPkgs = getClientPackages(clientId);
  console.log('[PkgBridge] clientPkgs for', clientId, ':', clientPkgs.length, clientPkgs.map(function(cp) { return { id: cp.id, client_id: cp.client_id, name: cp.package_name }; }));
  if (!clientPkgs.length) return [];

  var ticketService = allServices.find(function(s) { return s.id === ticketServiceId; });
  console.log('[PkgBridge] ticketService for svcId', ticketServiceId, ':', ticketService ? ticketService.name : 'NOT FOUND');
  if (!ticketService) return [];
  var ticketCategoryIds = ticketService.category_ids || [];

  var results = [];

  clientPkgs.forEach(function(cp) {
    var items = getClientPackageItems(cp.id);
    items.forEach(function(cpi) {
      if (cpi.service_id === ticketServiceId) {
        results.push({ clientPackage: cp, clientPackageItem: cpi, isExactMatch: true, upgradeDifferenceCents: 0 });
        return;
      }
      // Category-based upgrade matching disabled for now — exact service only
    });
  });

  results.sort(function(a, b) {
    if (a.isExactMatch && !b.isExactMatch) return -1;
    if (!a.isExactMatch && b.isExactMatch) return 1;
    return a.upgradeDifferenceCents - b.upgradeDifferenceCents;
  });

  return results;
}
