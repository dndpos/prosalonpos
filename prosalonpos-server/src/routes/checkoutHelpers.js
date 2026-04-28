/**
 * ProSalonPOS — Checkout Helpers
 * Extracted from checkout.js (Session V2) to stay under 800-line cap.
 * Shared by checkout routes: formatTicket, dayBounds, timezone helpers.
 *
 * v2.0.6: dayBounds is now tz-aware. ALL callers must pass salon_id.
 * Throws if salon_id missing — keeps cc26-style silent ET fallbacks out.
 */
import { isSQLite } from '../config/database.js';
import { dayBoundsTz, getSalonTz } from '../utils/salonTz.js';

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
 * v2.0.6: getEasternOffset replaced by salonTz.getTzOffsetMs (tz-aware).
 * Kept here as a thin shim ONLY for legacy code that hasn't been ported.
 * Returns offset in minutes for the salon's tz (300 EST, 240 EDT, 420 PDT, etc.).
 * THROWS if salon_id missing — caller must pass it.
 */
function getEasternOffset(date, salon_id) {
  if (!salon_id) throw new Error('getEasternOffset: salon_id required (v2.0.6 tz-aware)');
  var tz = getSalonTz(salon_id);
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  var parts = {};
  fmt.formatToParts(date).forEach(function(p) { parts[p.type] = p.value; });
  var hour = parts.hour === '24' ? '00' : parts.hour;
  var asUtc = Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    parseInt(hour), parseInt(parts.minute), parseInt(parts.second)
  );
  // Offset in minutes from UTC, positive for west (US tz)
  return -((asUtc - date.getTime()) / 60000);
}

/**
 * v2.0.6: dayBounds(dateStr, salon_id) — tz-aware, REQUIRES salon_id.
 * Throws if salon_id is missing (intentionally loud — prevents cc26-style
 * silent fallback bugs). dateStr optional; defaults to today in salon's tz.
 */
function dayBounds(dateStr, salon_id) {
  if (!salon_id) throw new Error('dayBounds: salon_id required (v2.0.6 tz-aware)');
  return dayBoundsTz(dateStr, salon_id);
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

  // cc6: per-item package-redemption amount. Greedy-match redemption records
  // to items by service_id so the receipt can render "Pkg Redeemed -$X" as a
  // sub-line under the specific service it covered (not as a totals-block line).
  // Covered cents = item.price_cents - upgrade_difference_cents (full service
  // price when no upgrade; base-service price when customer upgraded).
  var _pkgByService = {};
  (pkgRedemptions || []).forEach(function(r) {
    var k = r.service_redeemed_id || '';
    if (!k) return;
    if (!_pkgByService[k]) _pkgByService[k] = [];
    _pkgByService[k].push(r);
  });

  return {
    id: t.id,
    ticket_number: t.ticket_number,
    ticketNumber: t.ticket_number,
    appointment_id: t.appointment_id,
    // cc15.4: full list of source appointment_ids on merge absorbers.
    // Client-side openTickets.find checks this in addition to
    // appointment_id so every source slip maps back to the absorber.
    source_appointment_ids: t.source_appointment_ids || null,
    sourceAppointmentIds: t.source_appointment_ids || null,
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
    dual_pricing_cents: t.dual_pricing_cents,
    dualPricingCents: t.dual_pricing_cents || 0,
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
    edited_by_id: t.edited_by_id || null,
    edited_by_name: t.edited_by_name || null,
    editedById: t.edited_by_id || null,
    editedByName: t.edited_by_name || null,
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
      // cc6: attach per-item package-redeem cents (see _pkgByService above).
      var pkgRedeemCents = 0;
      var sid = item.service_id;
      if (sid && _pkgByService[sid] && _pkgByService[sid].length > 0) {
        var red = _pkgByService[sid].shift();
        var upgrade = red && red.upgrade_difference_cents ? red.upgrade_difference_cents : 0;
        pkgRedeemCents = Math.max(0, (item.price_cents || 0) - upgrade);
      }
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
        pkg_redeem_cents: pkgRedeemCents,
        pkgRedeemCents: pkgRedeemCents,
      };
    }),
    payments: (t.payments || []).map(function(p) {
      return {
        id: p.id,
        ticket_id: p.ticket_id,
        method: p.method,
        sub_method: p.sub_method || null,
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
