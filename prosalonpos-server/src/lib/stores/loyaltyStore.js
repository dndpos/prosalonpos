/**
 * loyaltyStore.js — Zustand Store for Loyalty Program
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useLoyaltyStore = create(function(set, get) {
  return {
    program: null, tiers: [], rewards: [], members: [],
    loading: false, error: null, source: 'pending', initialized: false,

    fetchProgram: async function() {
      if (isBackendAvailable() === false) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }
      set({ loading: true, error: null });
      try {
        var data = await api.get('/loyalty/program');
        // Handle both top-level and nested tiers/rewards (backward compat)
        var prog = data.program;
        var tiers = data.tiers || (prog && prog.tiers) || [];
        var rewards = data.rewards || (prog && prog.rewards) || [];
        set({ program: prog, tiers: tiers, rewards: rewards, loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    fetchMembers: async function() {
      try { var data = await api.get('/loyalty/members'); set({ members: data.members || [] }); }
      catch (err) { console.warn('[loyaltyStore] Members fetch failed:', err.message); }
    },

    updateProgram: async function(updates) {
      var data = await api.put('/loyalty/program', updates);
      set({ program: data.program });
      return data.program;
    },

    addTier: async function(tierData) {
      var data = await api.post('/loyalty/tiers', tierData);
      set(function(s) { return { tiers: s.tiers.concat([data.tier]) }; });
      return data.tier;
    },

    updateTier: async function(id, updates) {
      var data = await api.put('/loyalty/tiers/' + id, updates);
      set(function(s) { return { tiers: s.tiers.map(function(t) { return t.id === id ? Object.assign({}, t, data.tier) : t; }) }; });
      return data.tier;
    },

    deleteTier: async function(id) {
      await api.del('/loyalty/tiers/' + id);
      set(function(s) { return { tiers: s.tiers.filter(function(t) { return t.id !== id; }) }; });
    },

    addReward: async function(rewardData) {
      var data = await api.post('/loyalty/rewards', rewardData);
      set(function(s) { return { rewards: s.rewards.concat([data.reward]) }; });
      return data.reward;
    },

    updateReward: async function(id, updates) {
      var data = await api.put('/loyalty/rewards/' + id, updates);
      set(function(s) { return { rewards: s.rewards.map(function(r) { return r.id === id ? Object.assign({}, r, data.reward) : r; }) }; });
      return data.reward;
    },

    deleteReward: async function(id) {
      await api.del('/loyalty/rewards/' + id);
      set(function(s) { return { rewards: s.rewards.filter(function(r) { return r.id !== id; }) }; });
    },

    earnPoints: async function(earnData) {
      var data = await api.post('/loyalty/earn', earnData);
      return data;
    },

    redeemReward: async function(redeemData) {
      var data = await api.post('/loyalty/redeem', redeemData);
      return data;
    },
  };
});

export { useLoyaltyStore };
