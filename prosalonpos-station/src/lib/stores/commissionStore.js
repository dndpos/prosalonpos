/**
 * commissionStore.js — Zustand Store for Commission Rules & Tiers
 * Session 88 | Mock data REMOVED — API only
 *
 * Usage:
 *   import { useCommissionStore } from '../lib/stores/commissionStore';
 *   const rules = useCommissionStore(s => s.rules);
 *   const tiers = useCommissionStore(s => s.tiers);
 *   const { fetchCommission } = useCommissionStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useCommissionStore = create(function(set, get) {
  return {
    rules: [],
    tiers: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    fetchCommission: async function() {
      var available = isBackendAvailable();
      if (available === null) available = await checkBackend();
      if (!available) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      set({ loading: true, error: null });
      try {
        var data = await api.get('/commission');
        set({
          rules: data.rules || [],
          tiers: data.tiers || [],
          loading: false,
          source: 'api',
          initialized: true,
        });
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    addRule: async function(ruleData) {
      var data = await api.post('/commission/rules', ruleData);
      set(function(s) { return { rules: s.rules.concat([data.rule]) }; });
      return data.rule;
    },

    updateRule: async function(id, updates) {
      var data = await api.put('/commission/rules/' + id, updates);
      set(function(s) {
        return { rules: s.rules.map(function(r) {
          return r.id === id ? Object.assign({}, r, data.rule) : r;
        })};
      });
      return data.rule;
    },

    deleteRule: async function(id) {
      await api.del('/commission/rules/' + id);
      set(function(s) {
        return { rules: s.rules.filter(function(r) { return r.id !== id; }) };
      });
    },

    addTier: async function(tierData) {
      var data = await api.post('/commission/tiers', tierData);
      set(function(s) { return { tiers: s.tiers.concat([data.tier]) }; });
      return data.tier;
    },

    updateTier: async function(id, updates) {
      var data = await api.put('/commission/tiers/' + id, updates);
      set(function(s) {
        return { tiers: s.tiers.map(function(t) {
          return t.id === id ? Object.assign({}, t, data.tier) : t;
        })};
      });
      return data.tier;
    },

    deleteTier: async function(id) {
      await api.del('/commission/tiers/' + id);
      set(function(s) {
        return { tiers: s.tiers.filter(function(t) { return t.id !== id; }) };
      });
    },

    getRulesForStaff: function(staffId) {
      return get().rules.filter(function(r) {
        return r.staff_id === staffId || r.staff_id === null;
      });
    },

    getTiersForStaff: function(staffId) {
      var tiers = get().tiers.filter(function(t) {
        return t.staff_id === staffId;
      });
      if (tiers.length === 0) {
        tiers = get().tiers.filter(function(t) { return t.staff_id === null; });
      }
      return tiers.sort(function(a, b) { return a.position - b.position; });
    },
  };
});

export { useCommissionStore };
