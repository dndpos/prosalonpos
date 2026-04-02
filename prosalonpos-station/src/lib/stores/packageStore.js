/**
 * packageStore.js — Zustand Store for Packages
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var usePackageStore = create(function(set, get) {
  return {
    packages: [], packageItems: [], clientPackages: [], redemptions: [],
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
        set({ clientPackages: data.clientPackages || [] });
      } catch (err) { console.warn('[packageStore] Client packages fetch failed:', err.message); }
    },

    sellPackage: async function(sellData) {
      var data = await api.post('/packages/sell', sellData);
      return data.clientPackage;
    },

    redeemPackage: async function(redeemData) {
      var data = await api.post('/packages/redeem', redeemData);
      return data.redemption;
    },
  };
});

export { usePackageStore };
