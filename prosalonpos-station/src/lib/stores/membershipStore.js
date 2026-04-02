/**
 * membershipStore.js — Zustand Store for Memberships
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useMembershipStore = create(function(set, get) {
  return {
    plans: [], members: [],
    loading: false, error: null, source: 'pending', initialized: false,

    fetchPlans: async function() {
      if (isBackendAvailable() === false) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }
      set({ loading: true, error: null });
      try {
        var data = await api.get('/memberships/plans');
        set({ plans: data.plans || [], loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    fetchMembers: async function(status) {
      try {
        var path = '/memberships/members' + (status ? '?status=' + status : '');
        var data = await api.get(path);
        set({ members: data.members || [] });
      } catch (err) { console.warn('[membershipStore] Members fetch failed:', err.message); }
    },

    createPlan: async function(planData) {
      var data = await api.post('/memberships/plans', planData);
      set(function(s) { return { plans: s.plans.concat([data.plan]) }; });
      return data.plan;
    },

    updatePlan: async function(id, updates) {
      var data = await api.put('/memberships/plans/' + id, updates);
      set(function(s) { return { plans: s.plans.map(function(p) { return p.id === id ? Object.assign({}, p, data.plan) : p; }) }; });
      return data.plan;
    },

    addPerk: async function(planId, perkData) {
      var data = await api.post('/memberships/plans/' + planId + '/perks', perkData);
      get().fetchPlans();
      return data.perk;
    },

    enrollMember: async function(clientId, planId) {
      var data = await api.post('/memberships/members', { client_id: clientId, plan_id: planId });
      set(function(s) { return { members: s.members.concat([data.member]) }; });
      return data.member;
    },

    updateMember: async function(id, updates) {
      var data = await api.put('/memberships/members/' + id, updates);
      set(function(s) { return { members: s.members.map(function(m) { return m.id === id ? Object.assign({}, m, data.member) : m; }) }; });
      return data.member;
    },
  };
});

export { useMembershipStore };
