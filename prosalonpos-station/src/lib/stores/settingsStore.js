/**
 * settingsStore.js — Zustand Store for Salon Settings
 * Session 88 | Mock data REMOVED — API only
 *
 * Usage:
 *   import { useSettingsStore } from '../lib/stores/settingsStore';
 *   const settings = useSettingsStore(s => s.settings);
 *   const { updateSetting } = useSettingsStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';
import { debugLog } from '../debugLog';

// Safe defaults so the app doesn't crash before API data arrives
var _DEFAULT_SETTINGS = {
  salon_name: '', salon_phone: '', salon_email: '', salon_address: '',
  salon_address_line1: '', salon_address_line2: '',
  open_hour: 9, open_min: 0, close_hour: 19, close_min: 0, buffer_minutes: 30,
  tax_rate_percentage: 7.5, tip_enabled: true, tip_presets: [18, 20, 25],
  price_adjust_permission: 'all_staff',
  discount_types_enabled: ['pct_total', 'flat_total', 'pct_line_item'],
  discount_default_type: 'flat_total',
  discount_presets_pct: [10, 15, 20, 25],
  discount_presets_flat_cents: [500, 1000, 1500, 2000],
  discount_permission: 'all_staff',
  commission_enabled: false,
  retail_commission_enabled: false,
  retail_commission_pct: 0,
  check_next_number: 1001,
};

var useSettingsStore = create(function(set, get) {
  return {
    // ─── State ───
    settings: _DEFAULT_SETTINGS,
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    // ─── Actions ───

    fetchSettings: async function() {
      var available = isBackendAvailable();
      if (available === null) available = await checkBackend();
      if (!available) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      set({ loading: true, error: null });
      try {
        var data = await api.get('/settings');
        // Merge API settings with defaults (API may not have all frontend keys)
        var merged = Object.assign({}, _DEFAULT_SETTINGS, data.settings || {});
        set({
          settings: merged,
          loading: false,
          source: 'api',
          initialized: true,
        });
        debugLog('STORE', 'settingsStore loaded from API', { salon_name: merged.salon_name || '(empty)', keys: Object.keys(data.settings || {}).length });
      } catch (err) {
        debugLog('ERROR', 'settingsStore fetch failed: ' + err.message);
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    updateSetting: async function(key, value) {
      // Optimistic local update
      set(function(s) {
        var next = Object.assign({}, s.settings);
        next[key] = value;
        return { settings: next };
      });

      try {
        var payload = {};
        if (key === 'clearance_required') {
          payload.clearance_required = value;
        } else {
          payload[key] = value;
        }
        await api.put('/settings', payload);
      } catch (err) {
        console.warn('[settingsStore] Failed to save setting:', key, err.message);
      }
    },

    updateSettings: async function(updates) {
      set(function(s) {
        return { settings: Object.assign({}, s.settings, updates) };
      });

      try {
        await api.put('/settings', updates);
      } catch (err) {
        console.warn('[settingsStore] Failed to save settings:', err.message);
      }
    },

    // ─── Selectors ───
    getSetting: function(key) {
      return get().settings[key];
    },
  };
});

export { useSettingsStore };
