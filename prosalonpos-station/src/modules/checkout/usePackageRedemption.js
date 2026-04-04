import { useState } from 'react';
import { findRedeemablePackageItems, MOCK_CLIENT_PACKAGES, MOCK_CLIENT_PACKAGE_ITEMS } from '../packages/packageBridge';

/**
 * usePackageRedemption — Package redemption logic for checkout.
 * Extracted from CheckoutScreen.jsx in Session 109.
 *
 * Manages: applyPackageToItem, removePackageFromItem, getRedeemableForItem,
 * packageRedemptions state, and pkgSessionsUsed tracking.
 */
export default function usePackageRedemption(items, serviceOverrides, setServiceOverrides, storeClients, storeServices) {
  var [packageRedemptions, setPackageRedemptions] = useState({});
  var [pkgSessionsUsed, setPkgSessionsUsed] = useState({});

  function applyPackageToItem(itemId, match) {
    var item = items.find(function(i){ return i.id === itemId; });
    if (!item) return;
    var upgradeDiff = match.upgradeDifferenceCents || 0;
    setServiceOverrides(function(prev){ return Object.assign({}, prev, { [itemId]: upgradeDiff }); });
    setPackageRedemptions(function(prev){
      return Object.assign({}, prev, { [itemId]: {
        cpkgId: match.clientPackage.id,
        cpiId: match.clientPackageItem.id,
        pkgName: match.clientPackage.package_name,
        pkgServiceName: match.clientPackageItem.service_name,
        originalPrice: item.price_cents,
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
    setServiceOverrides(function(prev){ var n = Object.assign({}, prev); delete n[itemId]; return n; });
    setPackageRedemptions(function(prev){ var n = Object.assign({}, prev); delete n[itemId]; return n; });
    setPkgSessionsUsed(function(prev){
      var key = redemption.cpiId;
      var n = Object.assign({}, prev);
      n[key] = Math.max(0, (n[key] || 0) - 1);
      if (n[key] === 0) delete n[key];
      return n;
    });
  }

  function getRedeemableForItem(item, client) {
    if (!client || item.type !== 'service') return [];
    var svcId = item.serviceCatalogId || null;
    if (!svcId) return [];
    var clientId = client.id;
    if (!clientId || !clientId.startsWith('cli-')) {
      var ph = (client.phone || '').replace(/\D/g, '');
      if (ph) {
        var mc = storeClients.find(function(c) { return (c.phone || '').replace(/\D/g, '') === ph; });
        if (mc) clientId = mc.id;
      }
    }
    if (!clientId) return [];
    var matches = findRedeemablePackageItems(clientId, svcId, storeServices, []);
    return matches.filter(function(m) {
      var usedInCheckout = pkgSessionsUsed[m.clientPackageItem.id] || 0;
      return (m.clientPackageItem.remaining - usedInCheckout) > 0;
    });
  }

  return {
    packageRedemptions: packageRedemptions,
    pkgSessionsUsed: pkgSessionsUsed,
    applyPackageToItem: applyPackageToItem,
    removePackageFromItem: removePackageFromItem,
    getRedeemableForItem: getRedeemableForItem,
  };
}
