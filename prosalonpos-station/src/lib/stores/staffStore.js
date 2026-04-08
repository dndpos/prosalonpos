/**
 * staffStore.js — Zustand Store for Staff Data
 * Session 88 | Mock data REMOVED — API only
 *
 * All operations go through the real API. No mock fallback.
 * If the backend is unavailable, the store stays empty and shows an error.
 *
 * Usage:
 *   import { useStaffStore } from '../lib/stores/staffStore';
 *   const staff = useStaffStore(s => s.staff);
 *   const { fetchStaff, updateStaff } = useStaffStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var _lastCrudTs = 0;
var CRUD_COOLDOWN = 800;

var useStaffStore = create(function(set, get) {
  return {
    // ─── State ───
    staff: [],
    loading: false,
    error: null,
    source: 'pending',            // 'pending' | 'api' | 'error'
    initialized: false,

    // ─── Actions ───

    fetchStaff: async function() {
      // Skip if a local CRUD just happened (socket echo)
      if (Date.now() - _lastCrudTs < CRUD_COOLDOWN) return;
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      // Only show loading on initial fetch, not background refetches
      if (!get().initialized) {
        set({ loading: true, error: null });
      }
      try {
        var data = await api.get('/staff');
        set({
          staff: data.staff || [],
          loading: false,
          source: 'api',
          initialized: true,
        });
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    createStaff: async function(staffData) {
      _lastCrudTs = Date.now();
      var data = await api.post('/staff', staffData);
      set(function(s) { return { staff: s.staff.concat([data.staff]) }; });
      return data.staff;
    },

    updateStaff: async function(id, updates) {
      _lastCrudTs = Date.now();
      // Optimistic: update local state immediately
      var previousStaff = get().staff.map(function(emp) { return Object.assign({}, emp); });
      set(function(s) {
        return { staff: s.staff.map(function(emp) {
          return emp.id === id ? Object.assign({}, emp, updates) : emp;
        })};
      });
      try {
        var data = await api.put('/staff/' + id, updates);
        // Merge server response (may include computed fields)
        set(function(s) {
          return { staff: s.staff.map(function(emp) {
            return emp.id === id ? Object.assign({}, emp, data.staff) : emp;
          })};
        });
        return data.staff;
      } catch (err) {
        // Rollback to previous state
        set({ staff: previousStaff });
        throw err;
      }
    },

    deactivateStaff: async function(id) {
      var data = await api.del('/staff/' + id);
      set(function(s) {
        return { staff: s.staff.map(function(emp) {
          return emp.id === id ? Object.assign({}, emp, data.staff) : emp;
        })};
      });
    },

    deleteStaff: async function(id) {
      var data = await api.del('/staff/' + id + '?permanent=true');
      set(function(s) {
        return { staff: s.staff.map(function(emp) {
          return emp.id === id ? Object.assign({}, emp, data.staff) : emp;
        })};
      });
    },

    reactivateStaff: async function(id) {
      var data = await api.put('/staff/' + id, { active: true, status: 'active' });
      set(function(s) {
        return { staff: s.staff.map(function(emp) {
          return emp.id === id ? Object.assign({}, emp, data.staff) : emp;
        })};
      });
    },

    restoreStaff: async function(id) {
      var data = await api.put('/staff/' + id, { active: false, status: 'deactivated', deleted_at: null });
      set(function(s) {
        return { staff: s.staff.map(function(emp) {
          return emp.id === id ? Object.assign({}, emp, data.staff) : emp;
        })};
      });
    },

    verifyPin: async function(id, pin) {
      try {
        var data = await api.post('/staff/' + id + '/verify-pin', { pin: pin });
        return data;
      } catch (err) {
        return { valid: false, error: err.message };
      }
    },

    verifyAnyPin: async function(pin) {
      try {
        var data = await api.post('/staff/verify-any-pin', { pin: pin });
        return data;
      } catch (err) {
        return { valid: false, error: err.message };
      }
    },

    // ─── Selectors ───
    getActiveStaff: function() {
      return get().staff.filter(function(s) { return s.active && s.status !== 'deleted'; });
    },
    getDeactivatedStaff: function() {
      return get().staff.filter(function(s) { return s.status === 'deactivated'; });
    },
    getDeletedStaff: function() {
      return get().staff.filter(function(s) { return s.status === 'deleted'; });
    },
    getStaffById: function(id) {
      return get().staff.find(function(s) { return s.id === id; });
    },
  };
});

export { useStaffStore };
