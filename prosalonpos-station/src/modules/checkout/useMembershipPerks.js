import { useEffect, useRef } from 'react';

/**
 * useMembershipPerks — Auto-apply membership plan perks to checkout line items.
 * Extracted into hook for Session 109 (TD-112).
 *
 * Perk types (from MembershipPerk schema):
 *   percentage_discount — X% off matching services (by service_catalog_id or category_id, or all if neither set)
 *   free_service — specific service free, up to quantity_per_cycle times per cycle
 *   service_credit — flat dollar credit toward matching services
 *
 * Perks only apply when:
 *   - Client has an active membership (status === 'active')
 *   - Membership is NOT overdue (no membershipBanner showing)
 *   - Plan has perk_apply_mode === 'auto' (default)
 *
 * Applied perks are tracked as itemDiscounts with a `membership: true` flag
 * so the UI can distinguish them from manual discounts.
 */
export default function useMembershipPerks(items, clientMembership, membershipBanner, storeServices, itemDiscounts, setItemDiscounts) {
  // Track which items we've already applied membership perks to (prevent re-application on re-render)
  var appliedRef = useRef({});

  useEffect(function() {
    // Only apply if active membership, not overdue, and perks exist
    if (!clientMembership) { appliedRef.current = {}; return; }
    if (membershipBanner) return; // overdue — no perks until renewed
    if (clientMembership.status !== 'active') return;

    var plan = clientMembership.plan;
    if (!plan || !plan.perks || plan.perks.length === 0) return;
    if (plan.perk_apply_mode === 'manual') return; // manual mode — owner applies manually

    var perks = plan.perks;
    var newDiscounts = {};
    var freeServiceCounts = {}; // track quantity_per_cycle usage

    items.forEach(function(item) {
      // Only apply to service items
      if (item.type !== 'service') return;
      // Skip if already has a membership perk discount
      if (itemDiscounts[item.id] && itemDiscounts[item.id].membership) return;
      // Skip if already applied this render cycle
      if (appliedRef.current[item.id]) return;

      // Find matching perks for this item
      var svcId = item.serviceCatalogId || item.id;
      // Look up category_ids from the service catalog
      var catalogEntry = storeServices.find(function(s) { return s.id === svcId; });
      var catIds = (catalogEntry && catalogEntry.category_ids) || item.category_ids || [];

      for (var pi = 0; pi < perks.length; pi++) {
        var perk = perks[pi];

        // Check if perk matches this service
        var matches = false;
        if (perk.service_catalog_id && perk.service_catalog_id === svcId) {
          matches = true;
        } else if (perk.category_id && catIds.indexOf(perk.category_id) >= 0) {
          matches = true;
        } else if (!perk.service_catalog_id && !perk.category_id) {
          // No filter — applies to all services
          matches = true;
        }

        if (!matches) continue;

        if (perk.type === 'percentage_discount' && perk.discount_percentage > 0) {
          newDiscounts[item.id] = {
            type: 'pct',
            value: perk.discount_percentage,
            desc: '🎫 Member ' + perk.discount_percentage + '% off',
            membership: true,
            perkId: perk.id,
          };
          break; // one perk per item
        }

        if (perk.type === 'free_service') {
          var limit = perk.quantity_per_cycle || 1;
          var used = freeServiceCounts[perk.id] || 0;
          if (used < limit) {
            freeServiceCounts[perk.id] = used + 1;
            newDiscounts[item.id] = {
              type: 'pct',
              value: 100,
              desc: '🎫 Member free service',
              membership: true,
              perkId: perk.id,
            };
            break;
          }
        }

        if (perk.type === 'service_credit' && perk.credit_amount_cents > 0) {
          newDiscounts[item.id] = {
            type: 'flat',
            value: perk.credit_amount_cents,
            desc: '🎫 Member $' + (perk.credit_amount_cents / 100).toFixed(2) + ' credit',
            membership: true,
            perkId: perk.id,
          };
          break;
        }
      }
    });

    // Apply any new membership discounts
    var keys = Object.keys(newDiscounts);
    if (keys.length > 0) {
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        keys.forEach(function(k) {
          if (!next[k] || !next[k].membership) {
            next[k] = newDiscounts[k];
            appliedRef.current[k] = true;
          }
        });
        return next;
      });
    }
  }, [items, clientMembership, membershipBanner, storeServices]);

  // Clean up membership discounts when items are removed
  useEffect(function() {
    var itemIds = {};
    items.forEach(function(it) { itemIds[it.id] = true; });
    var staleKeys = Object.keys(appliedRef.current).filter(function(k) { return !itemIds[k]; });
    if (staleKeys.length > 0) {
      staleKeys.forEach(function(k) { delete appliedRef.current[k]; });
      setItemDiscounts(function(prev) {
        var next = Object.assign({}, prev);
        var changed = false;
        staleKeys.forEach(function(k) {
          if (next[k] && next[k].membership) { delete next[k]; changed = true; }
        });
        return changed ? next : prev;
      });
    }
  }, [items]);
}
