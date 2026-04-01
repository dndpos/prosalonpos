/**
 * reportsStore.js — Zustand Store for Reports
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useReportsStore = create(function(set, get) {
  return {
    loading: false, error: null, source: 'pending', initialized: false,

    _init: async function() {
      var available = isBackendAvailable();
      if (available === null) available = await checkBackend();
      if (!available) { set({ initialized: true, source: 'error', error: 'Server not available' }); return null; }
      set({ source: 'api', initialized: true });
      return true;
    },

    fetchDailySummary: async function(start, end) {
      if (!get().initialized) await get()._init();
      try {
        var data = await api.get('/reports/daily-summary?start=' + start + '&end=' + end);
        return data;
      } catch (err) { console.warn('[reportsStore] Daily summary failed:', err.message); return null; }
    },

    fetchSales: async function(start, end) {
      try { var data = await api.get('/reports/sales?start=' + start + '&end=' + end); return data.sales || []; }
      catch (err) { console.warn('[reportsStore] Sales failed:', err.message); return []; }
    },

    fetchStaffPerformance: async function(start, end) {
      try { var data = await api.get('/reports/staff-performance?start=' + start + '&end=' + end); return data.staff || []; }
      catch (err) { console.warn('[reportsStore] Staff perf failed:', err.message); return []; }
    },

    fetchServiceBreakdown: async function(start, end) {
      try { var data = await api.get('/reports/service-breakdown?start=' + start + '&end=' + end); return data.services || []; }
      catch (err) { console.warn('[reportsStore] Service breakdown failed:', err.message); return []; }
    },

    fetchPaymentMethods: async function(start, end) {
      try { var data = await api.get('/reports/payment-methods?start=' + start + '&end=' + end); return data.payments || []; }
      catch (err) { console.warn('[reportsStore] Payment methods failed:', err.message); return []; }
    },

    fetchTips: async function(start, end) {
      try { var data = await api.get('/reports/tips?start=' + start + '&end=' + end); return data.tips || []; }
      catch (err) { console.warn('[reportsStore] Tips failed:', err.message); return []; }
    },
  };
});

export { useReportsStore };
