/**
 * membershipStore.js — Zustand Store for Memberships
 * Session 96 | Plans include perks. Full CRUD wired to API.
 */

import { create } from 'zustand';
import { api, isBackendAvailable } from '../apiClient';

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

    createPlan: async function(planData) {
      var data = await api.post('/memberships/plans', planData);
      set(function(s) { return { plans: s.plans.concat([data.plan]) }; });
      return data.plan;
    },

    updatePlan: async function(id, planData) {
      var data = await api.put('/memberships/plans/' + id, planData);
      set(function(s) { return { plans: s.plans.map(function(p) { return p.id === id ? data.plan : p; }) }; });
      return data.plan;
    },

    deletePlan: async function(id) {
      await api.del('/memberships/plans/' + id);
      set(function(s) { return { plans: s.plans.filter(function(p) { return p.id !== id; }) }; });
    },

    fetchMembers: async function(status) {
      try {
        var path = '/memberships/members' + (status ? '?status=' + status : '');
        var data = await api.get(path);
        set({ members: data.members || [] });
      } catch (err) { console.warn('[membershipStore] Members fetch failed:', err.message); }
    },

    enrollMember: async function(clientId, planId) {
      var data = await api.post('/memberships/members', { client_id: clientId, plan_id: planId });
      set(function(s) { return { members: s.members.concat([data.member]) }; });
      return data.member;
    },

    updateMember: async function(id, updates) {
      var data = await api.put('/memberships/members/' + id, updates);
      set(function(s) { return { members: s.members.map(function(m) { return m.id === id ? data.member : m; }) }; });
      return data.member;
    },

    fetchClientMembership: async function(clientId) {
      try {
        var data = await api.get('/memberships/members/client/' + clientId);
        return data.membership || null;
      } catch (err) { console.warn('[membershipStore] Client membership fetch failed:', err.message); return null; }
    },

    renewMember: async function(id) {
      var data = await api.put('/memberships/members/' + id + '/renew');
      set(function(s) { return { members: s.members.map(function(m) { return m.id === id ? data.member : m; }) }; });
      return data.member;
    },
  };
});

export { useMembershipStore };
