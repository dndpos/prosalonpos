import { useState, useEffect, useRef } from 'react';
import { usePackageStore } from '../../lib/stores/packageStore';

/**
 * usePackageRedemption — Package redemption logic for checkout.
 * V6: Auto-applies packages. Reads from Zustand store directly.
 * Resets on client change. Strict remaining check.
 */
export default function usePackageRedemption(items, storeClients, storeServices, client, isReopened, initialItemIds) {
  var [packageRedemptions, setPackageRedemptions] = useState({});
  var [pkgSessionsUsed, setPkgSessionsUsed] = useState({});
  var autoAppliedRef = useRef({});
  var prevClientRef = useRef(null);
  var clientPackages = usePackageStore(function(s) { return s.clientPackages; });
  var clientPackageItems = usePackageStore(function(s) { return s.clientPackageItems; });

  // Reset all state when client changes
  useEffect(function() {
    var cid = client ? client.id : null;
    if (prevClientRef.current !== cid) {
      prevClientRef.current = cid;
      setPackageRedemptions({});
      setPkgSessionsUsed({});
      autoAppliedRef.current = {};
    }
  }, [client?.id]);

  function applyPackageToItem(itemId, match) {
    var item = items.find(function(i){ return i.id === itemId; });
    if (!item) return;
    var upgradeDiff = match.upgradeDifferenceCents || 0;
    var redeemAmt = (item.price_cents || 0) - upgradeDiff;
    setPackageRedemptions(function(prev){
      return Object.assign({}, prev, { [itemId]: {
        cpkgId: match.clientPackage.id,
        cpiId: match.clientPackageItem.id,
        pkgName: match.clientPackage.package_name,
        pkgServiceName: match.clientPackageItem.service_name,
        originalPrice: item.price_cents,
        redeemCents: redeemAmt,
        upgradeDiff: upgradeDiff,
        isExact: match.isExactMatch,
      }});
    });
    setPkgSessionsUsed(function(prev){
      var key = match.clientPackageItem.id;
      return Object.assign({}, prev, { [key]: (prev[key] || 0) + 1 });
    });
  }

  function removePackageFromItem(itemId) {
    var redemption = packageRedemptions[itemId];
    if (!redemption) return;
    delete autoAppliedRef.current[itemId];
    setPackageRedemptions(function(prev){ var n = Object.assign({}, prev); delete n[itemId]; return n; });
    setPkgSessionsUsed(function(prev){
      var key = redemption.cpiId;
      var n = Object.assign({}, prev);
      n[key] = Math.max(0, (n[key] || 0) - 1);
      if (n[key] === 0) delete n[key];
      return n;
    });
  }

  // Find redeemable packages for an item using store data directly
  function findMatches(svcId) {
    if (!client || !client.id) return [];
    var activePkgs = clientPackages.filter(function(cp) { return cp.client_id === client.id && cp.status === 'active'; });
    if (!activePkgs.length) return [];
    var results = [];
    activePkgs.forEach(function(cp) {
      var cpItems = clientPackageItems.filter(function(cpi) { return cpi.client_package_id === cp.id && cpi.remaining > 0; });
      cpItems.forEach(function(cpi) {
        if (cpi.service_id === svcId) {
          results.push({ clientPackage: cp, clientPackageItem: cpi, isExactMatch: true, upgradeDifferenceCents: 0 });
        }
      });
    });
    return results;
  }

  function getRedeemableForItem(item, cl) {
    var c = cl || client;
    if (!c || item.type !== 'service') return [];
    var svcId = item.serviceCatalogId || null;
    if (!svcId) return [];
    var matches = findMatches(svcId);
    return matches.filter(function(m) {
      var usedInCheckout = pkgSessionsUsed[m.clientPackageItem.id] || 0;
      return (m.clientPackageItem.remaining - usedInCheckout) > 0;
    });
  }

  // Auto-apply: when items or client packages change, auto-apply available packages
  // On reopened tickets, only apply to NEWLY ADDED items (not original items)
  useEffect(function() {
    if (!client || !client.id) return;
    if (!clientPackages.length && !clientPackageItems.length) return;
    var localUsed = Object.assign({}, pkgSessionsUsed);
    var toApply = [];
    items.forEach(function(item) {
      if (item.type !== 'service') return;
      if (packageRedemptions[item.id]) return;
      if (autoAppliedRef.current[item.id]) return;
      // On reopened tickets, skip original items — they already have their paid prices
      if (isReopened && initialItemIds && initialItemIds[item.id]) return;
      var svcId = item.serviceCatalogId || null;
      if (!svcId) return;
      var matches = findMatches(svcId);
      var available = matches.filter(function(m) {
        var used = localUsed[m.clientPackageItem.id] || 0;
        return (m.clientPackageItem.remaining - used) > 0;
      });
      if (available.length > 0) {
        var best = available[0];
        localUsed[best.clientPackageItem.id] = (localUsed[best.clientPackageItem.id] || 0) + 1;
        toApply.push({ itemId: item.id, match: best });
        autoAppliedRef.current[item.id] = true;
      }
    });
    toApply.forEach(function(entry) { applyPackageToItem(entry.itemId, entry.match); });
  }, [items, client?.id, clientPackages, clientPackageItems]);

  return {
    packageRedemptions: packageRedemptions,
    pkgSessionsUsed: pkgSessionsUsed,
    applyPackageToItem: applyPackageToItem,
    removePackageFromItem: removePackageFromItem,
    getRedeemableForItem: getRedeemableForItem,
  };
}
