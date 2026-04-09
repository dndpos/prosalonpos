/**
 * payrollStore.js — Zustand Store for Payroll
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var usePayrollStore = create(function(set, get) {
  return {
    runs: [], commissionRules: [],
    loading: false, error: null, source: 'pending', initialized: false,

    fetchRuns: async function() {
      if (isBackendAvailable() === false) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }
      set({ loading: true, error: null });
      try {
        var data = await api.get('/payroll/runs');
        set({ runs: data.runs || [], loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    fetchRun: async function(runId) {
      var data = await api.get('/payroll/runs/' + runId);
      return data.run || null;
    },

    createRun: async function(periodStart, periodEnd) {
      var data = await api.post('/payroll/runs', { period_start: periodStart, period_end: periodEnd });
      set(function(s) { return { runs: [data.run].concat(s.runs) }; });
      return data.run;
    },

    approveRun: async function(runId) {
      var data = await api.put('/payroll/runs/' + runId, { status: 'approved' });
      get().fetchRuns();
      return data.run;
    },

    fetchCommissionRules: async function() {
      try {
        var data = await api.get('/commission');
        set({ commissionRules: data.rules || [] });
      } catch (err) { console.warn('[payrollStore] Commission rules fetch failed:', err.message); }
    },

    saveCommissionRule: async function(ruleData) {
      var data = ruleData.id
        ? await api.put('/commission/rules/' + ruleData.id, ruleData)
        : await api.post('/commission/rules', ruleData);
      get().fetchCommissionRules();
      return data.rule;
    },
  };
});

export { usePayrollStore };
