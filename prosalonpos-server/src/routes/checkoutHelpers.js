/**
 * ProSalonPOS — Checkout Helpers
 * Extracted from checkout.js (Session V2) to stay under 800-line cap.
 * Shared by checkout routes: formatTicket, dayBounds, timezone helpers.
 */
import { isSQLite } from '../config/database.js';

function toDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'object') return JSON.stringify(val);
  return val;
}
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

/**
 * Get US Eastern timezone offset in minutes (300 = EST, 240 = EDT).
 * Uses Intl to determine if DST is active for a given date.
 */
function getEasternOffset(date) {
  var str = date.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
  if (str.indexOf('EDT') >= 0) return 240;
  return 300;
}

/**
 * Get start-of-day and end-of-day boundaries for a date string (YYYY-MM-DD).
 * If no date provided, uses today in US Eastern time.
 * Railway runs in UTC — must convert to Eastern for Florida salons.
 */
function dayBounds(dateStr) {
  if (dateStr) {
    var parts = dateStr.split('-');
    var y = parseInt(parts[0]);
    var m = parseInt(parts[1]) - 1;
    var day = parseInt(parts[2]);
    var probe = new Date(Date.UTC(y, m, day, 12, 0, 0));
    var etOffset = getEasternOffset(probe);
    var start = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
    start.setUTCMinutes(start.getUTCMinutes() + etOffset);
    var end = new Date(Date.UTC(y, m, day, 23, 59, 59, 999));
    end.setUTCMinutes(end.getUTCMinutes() + etOffset);
    return { start: start, end: end };
  } else {
    var now = new Date();
    var etOffset = getEasternOffset(now);
    var etNow = new Date(now.getTime() - etOffset * 60000);
    var yy = etNow.getUTCFullYear();
    var mm = etNow.getUTCMonth();
    var dd = etNow.getUTCDate();
    var start = new Date(Date.UTC(yy, mm, dd, 0, 0, 0, 0));
    start.setUTCMinutes(start.getUTCMinutes() + etOffset);
    var end = new Date(Date.UTC(yy, mm, dd, 23, 59, 59, 999));
    end.setUTCMinutes(end.getUTCMinutes() + etOffset);
    return { start: start, end: end };
  }
}

/**
 * Format a ticket from Prisma (with includes) into the shape the frontend expects.
 */
function formatTicket(t, pkgRedemptions) {
  var closedAtTs = null;
  if (t.status === 'paid' || t.status === 'refunded') {
    closedAtTs = t.updated_at ? t.updated_at.getTime() : Date.now();
  } else if (t.status === 'voided') {
    closedAtTs = t.void_at ? t.void_at.getTime() : (t.updated_at ? t.updated_at.getTime() : Date.now());
  }

  var isCashOrZelle = t.payment_method === 'cash' || t.payment_method === 'zelle';
  var tipAutoRemoved = isCashOrZelle && (t.tip_cents || 0) === 0 && t.status === 'paid';

  var refundHistory = fromDb(t.refund_history) || [];
  var refunds = [];
  if (refundHistory.length > 0) {
    refundHistory.forEach(function(rh) {
      refunds.push({
        refundTotal_cents: rh.amount_cents || 0,
        items: (rh.items || []).map(function(ri) { return { itemId: ri.itemId, name: ri.name, refundAmount_cents: ri.refundAmount_cents || ri.amount_cents || 0, isPkgRedeemed: ri.isPkgRedeemed || false }; }),
        refundTax_cents: rh.tax_cents || 0,
        refundTip: (rh.tip_cents || 0) > 0,
        tipRefunded_cents: rh.tip_cents || 0,
        reasonPreset: rh.reason || '',
        reasonText: '',
        processedBy: rh.by || 'Manager',
        processedAt: rh.at ? new Date(rh.at).getTime() : null,
        refundMethod: rh.method || 'credit',
        pkgCreditsRestored: rh.pkgCreditsRestored || false,
      });
    });
  } else if (t.refund_at || t.status === 'refunded') {
    // Legacy fallback for tickets refunded before refund_history was added
    refunds.push({
      refundTotal_cents: t.refund_cents || 0,
      items: [],
      refundTax_cents: 0,
      refundTip: false,
      tipRefunded_cents: 0,
      reasonPreset: t.refund_reason || '',
      reasonText: '',
      processedBy: t.refund_by || 'Manager',
      processedAt: t.refund_at ? t.refund_at.getTime() : null,
      refundMethod: (t.pkg_redeemed_cents || 0) > 0 && (t.refund_cents || 0) === 0 ? 'Package' : (t.payment_method || 'credit'),
      pkgCreditsRestored: (t.pkg_redeemed_cents || 0) > 0 && (t.refund_cents || 0) === 0,
    });
  }

  // Build set of all refunded item IDs for frontend use
  var refundedItemIds = {};
  refunds.forEach(function(r) { (r.items || []).forEach(function(ri) { refundedItemIds[ri.itemId] = true; }); });

  return {
    id: t.id,
    ticket_number: t.ticket_number,
    ticketNumber: t.ticket_number,
    appointment_id: t.appointment_id,
    client_id: t.client_id,
    client_name: t.client_name,
    clientName: t.client_name,
    status: t.status,
    merged_into: t.merged_into || null,
    mergedInto: t.merged_into || null,
    display_number: t.display_number || null,
    displayNumber: t.display_number || null,
    subtotal_cents: t.subtotal_cents,
    subtotalCents: t.subtotal_cents || 0,
    tax_cents: t.tax_cents,
    taxCents: t.tax_cents || 0,
    discount_cents: t.discount_cents,
    discountCents: t.discount_cents || 0,
    tip_cents: t.tip_cents,
    tipCents: t.tip_cents || 0,
    surcharge_cents: t.surcharge_cents,
    surchargeCents: t.surcharge_cents || 0,
    deposit_cents: t.deposit_cents,
    depositCents: t.deposit_cents || 0,
    pkg_redeemed_cents: t.pkg_redeemed_cents,
    pkgRedeemCents: t.pkg_redeemed_cents || 0,
    total_cents: t.total_cents,
    totalCents: t.total_cents || 0,
    payment_method: t.payment_method,
    paymentMethod: t.payment_method,
    cashier_id: t.cashier_id,
    cashier_name: t.cashier_name,
    cashierName: t.cashier_name,
    created_by_id: t.created_by_id || null,
    created_by_name: t.created_by_name || null,
    createdById: t.created_by_id || null,
    createdByName: t.created_by_name || null,
    tip_distributions: fromDb(t.tip_distributions),
    tipDistributions: fromDb(t.tip_distributions) || [],
    tipDistributed: !!(t.tip_distributions && (fromDb(t.tip_distributions) || []).length > 0),
    tipAutoRemoved: tipAutoRemoved,
    void_reason: t.void_reason,
    voidReason: t.void_reason,
    void_by: t.void_by,
    voided: t.status === 'voided',
    voidedBy: t.void_by || null,
    voidedAt: t.void_at ? t.void_at.getTime() : null,
    void_at: t.void_at,
    voidAt: t.void_at ? t.void_at.getTime() : null,
    refund_cents: t.refund_cents,
    refundCents: t.refund_cents || 0,
    refund_reason: t.refund_reason,
    refund_by: t.refund_by,
    refund_at: t.refund_at,
    refunds: refunds,
    refundedItemIds: refundedItemIds,
    created_at: t.created_at,
    createdAt: t.created_at ? t.created_at.getTime() : Date.now(),
    closedAt: closedAtTs,
    updated_at: t.updated_at,
    version: t.version,
    items: (t.items || []).map(function(item) {
      return {
        id: item.id,
        type: item.type,
        name: item.name,
        price_cents: item.price_cents,
        original_price_cents: item.original_price_cents,
        tech_id: item.tech_id,
        techId: item.tech_id,
        tech_name: item.tech_name,
        tech: item.tech_name,
        service_id: item.service_id,
        product_id: item.product_id,
        client_id: item.client_id,
        color: item.color,
      };
    }),
    payments: (t.payments || []).map(function(p) {
      return {
        id: p.id,
        ticket_id: p.ticket_id,
        method: p.method,
        amount_cents: p.amount_cents,
        gc_id: p.gc_id,
        gc_code: p.gc_code,
        created_at: p.created_at,
      };
    }),
    pkgRedemptions: (pkgRedemptions || []).map(function(r) {
      return {
        id: r.id,
        client_package_item_id: r.client_package_item_id,
        service_redeemed_name: r.service_redeemed_name,
        service_redeemed_id: r.service_redeemed_id,
        redeemed_at: r.redeemed_at,
      };
    }),
  };
}

export { toDb, fromDb, dayBounds, getEasternOffset, formatTicket };
