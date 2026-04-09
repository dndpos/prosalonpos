import { useEffect, useRef } from 'react';

/**
 * useMembershipPerks — Auto-apply membership plan perks to checkout.
 * Session V8: percentage_discount applies as total-level discount on gross sales.
 * free_service and service_credit remain per-item.
 */
export default function useMembershipPerks(items, clientMembership, membershipBanner, storeServices, itemDiscounts, setItemDiscounts, discounts, setDiscounts) {
  var appliedRef = useRef({});
  var pctAppliedRef = useRef(false);

  useEffect(function() {
    // No membership → clean up everything
    if (!clientMembership) {
      if (pctAppliedRef.current) {
        setDiscounts(function(prev) { return prev.filter(function(d) { return !d.membership; }); });
        pctAppliedRef.current = false;
      }
      // Also remove any item-level membership discounts
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        var changed = false;
        Object.keys(next).forEach(function(k) {
          if (next[k] && next[k].membership) { delete next[k]; changed = true; }
        });
        return changed ? next : prev;
      });
      appliedRef.current = {};
      return;
    }
    if (membershipBanner) return;
    if (clientMembership.status !== 'active') return;

    var plan = clientMembership.plan;
    if (!plan || !plan.perks || plan.perks.length === 0) return;
    if (plan.perk_apply_mode === 'manual') return;

    var perks = plan.perks;

    // Step 1: Remove ALL old membership item discounts that are percentage type
    // This ensures no stale per-item pct discounts linger from any previous code
    var hasStale = false;
    Object.keys(itemDiscounts).forEach(function(k) {
      if (itemDiscounts[k] && itemDiscounts[k].membership && itemDiscounts[k].type === 'pct' && itemDiscounts[k].value < 100) hasStale = true;
    });
    if (hasStale) {
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        Object.keys(next).forEach(function(k) {
          if (next[k] && next[k].membership && next[k].type === 'pct' && next[k].value < 100) delete next[k];
        });
        return next;
      });
    }

    // Step 2: percentage_discount → one total-level discount entry
    for (var pi = 0; pi < perks.length; pi++) {
      var perk = perks[pi];
      if (perk.type === 'percentage_discount' && perk.discount_percentage > 0 && !pctAppliedRef.current) {
        var alreadyExists = discounts.some(function(d) { return d.membership; });
        if (!alreadyExists) {
          setDiscounts(function(prev) {
            return prev.concat([{
              id: 'mem-pct-' + perk.id,
              type: 'pct_total',
              value: perk.discount_percentage,
              label: 'Member Discount',
              desc: '🎫 Member ' + perk.discount_percentage + '% off',
              membership: true,
              perkId: perk.id,
            }]);
          });
        }
        pctAppliedRef.current = true;
      }
    }

    // Step 3: free_service and service_credit → item-level only
    var newItemDiscounts = {};
    var freeServiceCounts = {};
    items.forEach(function(item) {
      if (item.type !== 'service') return;
      if (appliedRef.current[item.id]) return;
      // Skip if already has a non-pct membership discount
      var existing = itemDiscounts[item.id];
      if (existing && existing.membership && (existing.type !== 'pct' || existing.value >= 100)) return;

      var svcId = item.serviceCatalogId || item.id;
      var catalogEntry = storeServices.find(function(s) { return s.id === svcId; });
      var catIds = (catalogEntry && catalogEntry.category_ids) || item.category_ids || [];

      for (var pi = 0; pi < perks.length; pi++) {
        var perk = perks[pi];
        if (perk.type === 'percentage_discount') continue;

        var matches = false;
        if (perk.service_catalog_id && perk.service_catalog_id === svcId) matches = true;
        else if (perk.category_id && catIds.indexOf(perk.category_id) >= 0) matches = true;
        else if (!perk.service_catalog_id && !perk.category_id) matches = true;
        if (!matches) continue;

        if (perk.type === 'free_service') {
          var limit = perk.quantity_per_cycle || 1;
          var used = freeServiceCounts[perk.id] || 0;
          if (used < limit) {
            freeServiceCounts[perk.id] = used + 1;
            newItemDiscounts[item.id] = { type: 'pct', value: 100, desc: '🎫 Member free service', membership: true, perkId: perk.id };
            break;
          }
        }
        if (perk.type === 'service_credit' && perk.credit_amount_cents > 0) {
          newItemDiscounts[item.id] = { type: 'flat', value: perk.credit_amount_cents, desc: '🎫 Member $' + (perk.credit_amount_cents / 100).toFixed(2) + ' credit', membership: true, perkId: perk.id };
          break;
        }
      }
    });

    var keys = Object.keys(newItemDiscounts);
    if (keys.length > 0) {
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        keys.forEach(function(k) { next[k] = newItemDiscounts[k]; appliedRef.current[k] = true; });
        return next;
      });
    }
  }, [items, clientMembership, membershipBanner, storeServices]);

  // Clean up item discounts when items are removed
  useEffect(function() {
    var itemIds = {};
    items.forEach(function(it) { itemIds[it.id] = true; });
    var staleKeys = Object.keys(appliedRef.current).filter(function(k) { return !itemIds[k]; });
    if (staleKeys.length > 0) {
      staleKeys.forEach(function(k) { delete appliedRef.current[k]; });
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        var changed = false;
        staleKeys.forEach(function(k) { if (next[k] && next[k].membership) { delete next[k]; changed = true; } });
        return changed ? next : prev;
      });
    }
  }, [items]);
}
