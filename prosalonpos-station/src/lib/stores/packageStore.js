/**
 * packageStore.js — Zustand Store for Packages
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var usePackageStore = create(function(set, get) {
  return {
    packages: [], packageItems: [], clientPackages: [], clientPackageItems: [], redemptions: [],
    loading: false, error: null, source: 'pending', initialized: false,

    fetchPackages: async function() {
      if (isBackendAvailable() === false) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }
      set({ loading: true, error: null });
      try {
        var data = await api.get('/packages');
        set({ packages: data.packages || [], packageItems: data.packageItems || [], loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    createPackage: async function(pkgData, items) {
      var data = await api.post('/packages', { package: pkgData, items: items });
      get().fetchPackages();
      return data.package;
    },

    updatePackage: async function(id, updates, items) {
      var data = await api.put('/packages/' + id, { package: updates, items: items });
      get().fetchPackages();
      return data.package;
    },

    fetchClientPackages: async function(clientId) {
      try {
        var data = await api.get('/packages/client/' + clientId);
        set({ clientPackages: data.clientPackages || [], clientPackageItems: data.clientPackageItems || [] });
      } catch (err) { console.warn('[packageStore] Client packages fetch failed:', err.message); }
    },

    clearClientPackages: function() {
      set({ clientPackages: [], clientPackageItems: [] });
    },

    cleanupPackages: async function() {
      try {
        var data = await api.post('/packages/cleanup', {});
        if (data.packagesFixed > 0) {
        }
        return data;
      } catch (err) { console.warn('[packageStore] Cleanup failed:', err.message); }
    },

    sellPackage: async function(sellData) {
      var data = await api.post('/packages/sell', sellData);
      return data.clientPackage;
    },

    redeemPackage: async function(redeemData) {
      var data = await api.post('/packages/redeem', redeemData);
      return data.redemption;
    },

    deleteClientPackage: async function(cpId) {
      var data = await api.del('/packages/client-package/' + cpId);
      // Remove from local state
      set(function(s) {
        return {
          clientPackages: s.clientPackages.filter(function(cp) { return cp.id !== cpId; }),
          clientPackageItems: s.clientPackageItems.filter(function(cpi) { return cpi.client_package_id !== cpId; }),
        };
      });
      return data;
    },

    deleteAllClientPackages: async function(clientId) {
      var data = await api.del('/packages/client-packages/client/' + clientId);
      set({ clientPackages: [], clientPackageItems: [] });
      return data;
    },

    deactivateClientPackage: async function(cpId) {
      var data = await api.put('/packages/client-package/' + cpId + '/deactivate', {});
      // Remove from local state (no longer active)
      set(function(s) {
        return {
          clientPackages: s.clientPackages.filter(function(cp) { return cp.id !== cpId; }),
          clientPackageItems: s.clientPackageItems.filter(function(cpi) { return cpi.client_package_id !== cpId; }),
        };
      });
      return data;
    },
  };
});

export { usePackageStore };
