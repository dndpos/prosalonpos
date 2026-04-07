/**
 * useCheckoutCalc — Checkout calculation logic extracted from CheckoutScreen
 * Session V3 — TD-103 file size split
 * V3: Per-item-type tax (tax_on_services, tax_on_products, etc.)
 *
 * All totals, tax, discounts, remaining balance, tech groups.
 * Returns plain object (no hooks inside — just derived values).
 */

import { useMemo } from 'react';
import { roundToNickel } from './checkoutHelpers';
import { useInventoryStore } from '../../lib/stores/inventoryStore';

// Map item type → settings key for tax toggle
var TAX_TYPE_MAP = {
  service: 'tax_on_services',
  retail: 'tax_on_products',
  giftcard: 'tax_on_giftcards',
  package_sale: 'tax_on_packages',
  membership_sale: 'tax_on_memberships',
};

// Default tax rules — services/products/packages/memberships taxed, gift cards not
var TAX_TYPE_DEFAULTS = {
  tax_on_services: true,
  tax_on_products: true,
  tax_on_giftcards: false,
  tax_on_packages: true,
  tax_on_memberships: true,
};

function isItemTaxable(item, settings) {
  var settingsKey = TAX_TYPE_MAP[item.type];
  if (!settingsKey) return true; // unknown type → taxable by default
  var val = settings[settingsKey];
  if (val === undefined) val = TAX_TYPE_DEFAULTS[settingsKey];
  if (!val) return false; // type-level tax is OFF → not taxable

  // For retail items, check category-level override
  if (item.type === 'retail' && item.category_id) {
    var cats = useInventoryStore.getState().categories || [];
    var cat = cats.find(function(c) { return c.id === item.category_id; });
    if (cat && cat.taxable === false) return false;
  }

  return true;
}

export default function useCheckoutCalc(opts) {
  var items = opts.items;
  var serviceOverrides = opts.serviceOverrides;
  var itemDiscounts = opts.itemDiscounts;
  var discounts = opts.discounts;
  var depositCents = opts.depositCents;
  var tipAmount = opts.tipAmount;
  var payments = opts.payments;
  var settings = opts.settings;
  var isReopened = opts.isReopened;
  var alreadyPaidCents = opts.alreadyPaidCents;
  var outstandingCents = opts.outstandingCents;
  var packageRedemptions = opts.packageRedemptions || {};

  function getPrice(it) { return serviceOverrides[it.id] ?? it.price_cents; }

  function getItemDiscAmt(it) {
    var d = itemDiscounts[it.id]; if (!d) return 0;
    // Membership percentage discounts are total-level, not item-level — skip here
    if (d.membership && d.type === 'pct' && d.value < 100) return 0;
    var base = getPrice(it) * (it.qty || 1);
    return d.type === 'flat' ? Math.min(d.value, base) : Math.round(base * d.value / 100);
  }

  // Package redemption deduction per item
  function getPkgRedeemAmt(it) {
    var pkgR = packageRedemptions[it.id];
    return pkgR ? (pkgR.redeemCents || 0) : 0;
  }

  var canAdjust = settings.price_adjust_permission !== 'disabled';

  var serviceTotal = items.filter(function(i) { return i.type === 'service'; }).reduce(function(s, it) { return s + getPrice(it); }, 0);
  var retailTotal = items.filter(function(i) { return i.type === 'retail'; }).reduce(function(s, it) { return s + (getPrice(it) * (it.qty || 1)); }, 0);
  var gcTotal = items.filter(function(i) { return i.type === 'giftcard'; }).reduce(function(s, it) { return s + it.price_cents; }, 0);
  var pkgSaleTotal = items.filter(function(i) { return i.type === 'package_sale'; }).reduce(function(s, it) { return s + getPrice(it); }, 0);
  var memSaleTotal = items.filter(function(i) { return i.type === 'membership_sale'; }).reduce(function(s, it) { return s + getPrice(it); }, 0);
  var subtotalBefore = serviceTotal + retailTotal + gcTotal + pkgSaleTotal + memSaleTotal;

  var itemDiscTotal = items.reduce(function(s, it) { return s + getItemDiscAmt(it); }, 0);
  var pkgRedeemTotal = items.reduce(function(s, it) { return s + getPkgRedeemAmt(it); }, 0);

  var discountBase = subtotalBefore - pkgRedeemTotal;
  var discountTotal = 0;
  discounts.forEach(function(d) {
    if (d.type === 'pct_total') discountTotal += Math.round(discountBase * d.value / 100);
    else if (d.type === 'flat_total') discountTotal += d.value;
  });

  var allDiscounts = discountTotal + itemDiscTotal;

  // Per-item-type tax: only sum items whose type is taxable, minus their pkg redemptions
  var taxableItemTotal = items.reduce(function(s, it) {
    if (!isItemTaxable(it, settings)) return s;
    var price = (it.type === 'retail') ? (getPrice(it) * (it.qty || 1)) : getPrice(it);
    var disc = getItemDiscAmt(it);
    var pkgRedeem = getPkgRedeemAmt(it);
    return s + price - disc - pkgRedeem;
  }, 0);
  // Apply total-level discounts proportionally to taxable portion
  var netBeforeTax = subtotalBefore - itemDiscTotal - pkgRedeemTotal;
  var taxableRatio = netBeforeTax > 0 ? (taxableItemTotal / netBeforeTax) : 0;
  var taxableDiscountShare = Math.round(discountTotal * taxableRatio);
  var taxableAmount = Math.max(0, taxableItemTotal - taxableDiscountShare - (depositCents > 0 ? Math.round(depositCents * taxableRatio) : 0));
  var taxAmount = Math.round(taxableAmount * settings.tax_rate_percentage / 100);

  var totalBeforeTip = Math.max(0, subtotalBefore - allDiscounts - pkgRedeemTotal - depositCents + outstandingCents) + taxAmount;
  var grandTotal = totalBeforeTip + tipAmount;
  var paidTotal = payments.reduce(function(s, p) { return s + p.amount_cents; }, 0);

  var hasCashPayment = payments.some(function(p) { return p.method === 'cash'; });
  var effectiveTotal = hasCashPayment && settings.cash_rounding ? roundToNickel(grandTotal) : grandTotal;
  var reopenedBalanceDue = isReopened ? Math.max(0, effectiveTotal - alreadyPaidCents) : 0;
  var remaining = isReopened ? (reopenedBalanceDue - paidTotal) : (effectiveTotal - paidTotal);

  var hasItems = items.length > 0;
  var hasUnpricedOpen = items.some(function(it) { return it.open_price && getPrice(it) === 0 && !serviceOverrides[it.id]; });

  var techGroups = useMemo(function() {
    var groups = {};
    items.forEach(function(it) {
      var key = it.techId || '__none__';
      if (!groups[key]) groups[key] = { techId: it.techId, techName: it.tech, items: [] };
      groups[key].items.push(it);
    });
    return Object.values(groups);
  }, [items]);

  return {
    getPrice: getPrice,
    getItemDiscAmt: getItemDiscAmt,
    getPkgRedeemAmt: getPkgRedeemAmt,
    canAdjust: canAdjust,
    subtotalBefore: subtotalBefore,
    itemDiscTotal: itemDiscTotal,
    pkgRedeemTotal: pkgRedeemTotal,
    discountTotal: discountTotal,
    allDiscounts: allDiscounts,
    taxAmount: taxAmount,
    taxableAmount: taxableAmount,
    totalBeforeTip: totalBeforeTip,
    grandTotal: grandTotal,
    paidTotal: paidTotal,
    hasCashPayment: hasCashPayment,
    effectiveTotal: effectiveTotal,
    reopenedBalanceDue: reopenedBalanceDue,
    remaining: remaining,
    hasItems: hasItems,
    hasUnpricedOpen: hasUnpricedOpen,
    techGroups: techGroups,
  };
}
