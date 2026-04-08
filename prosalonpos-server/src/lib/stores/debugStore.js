/**
 * debugStore.js — Zustand Store for Debug System
 * Session 83B
 *
 * Two features controlled by a single toggle:
 *   1. Debug Log Panel — floating panel showing live API calls, store loads, errors, navigation
 *   2. Debug ID Labels — green badges on every major UI element (Session 84)
 *
 * The toggle is in Salon Settings. State is NOT persisted to backend —
 * it's session-only (resets on page refresh). Owner can also toggle
 * via a keyboard shortcut (Ctrl+Shift+D).
 */

import { create } from 'zustand';

var MAX_LOG_ENTRIES = 500;

var useDebugStore = create(function(set, get) {
  return {
    enabled: false,
    logs: [],
    panelCollapsed: false,
    panelPosition: { x: null, y: null }, // null = default bottom-right

    // Toggle debug on/off
    toggle: function() {
      var next = !get().enabled;
      set({ enabled: next });
      if (next) {
        // Log the activation itself
        get().addLog('SYSTEM', 'Debug mode enabled');
      }
    },

    setEnabled: function(val) {
      set({ enabled: !!val });
    },

    // Add a log entry
    addLog: function(type, message, data) {
      var entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        time: new Date(),
        type: type,       // 'API' | 'STORE' | 'NAV' | 'AUTH' | 'ERROR' | 'SYSTEM' | 'SOCKET' | 'PRINT'
        message: message,
        data: data || null,
      };
      set(function(s) {
        var next = s.logs.concat([entry]);
        if (next.length > MAX_LOG_ENTRIES) next = next.slice(next.length - MAX_LOG_ENTRIES);
        return { logs: next };
      });
    },

    // Clear all logs
    clearLogs: function() {
      set({ logs: [] });
    },

    // Panel UI state
    togglePanel: function() {
      set(function(s) { return { panelCollapsed: !s.panelCollapsed }; });
    },

    setPanelPosition: function(x, y) {
      set({ panelPosition: { x: x, y: y } });
    },
  };
});

// Register on window so apiClient can access without circular import
window.__prosalonDebugStore = useDebugStore;

export { useDebugStore };
export default useDebugStore;
