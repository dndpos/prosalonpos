/**
 * debugLog.js — Debug Logging Helper
 * Session 83B
 *
 * Usage:
 *   import { debugLog } from '../lib/debugLog';
 *   debugLog('API', 'GET /api/v1/staff → 200 (5 items)');
 *   debugLog('STORE', 'staffStore initialized', { count: 5, source: 'api' });
 *   debugLog('ERROR', 'Failed to load clients', { error: err.message });
 *   debugLog('NAV', 'Page changed → calendar');
 *   debugLog('AUTH', 'Login attempt', { salon_id: 'xxx', pin_length: 4 });
 *
 * When debug mode is OFF, calls are no-ops (zero cost).
 * Also logs to browser console with color-coded prefixes.
 */

import { useDebugStore } from './stores/debugStore';

var TYPE_COLORS = {
  API:    '#3B82F6', // blue
  STORE:  '#10B981', // green
  NAV:    '#8B5CF6', // purple
  AUTH:   '#F59E0B', // amber
  ERROR:  '#EF4444', // red
  SYSTEM: '#6B7280', // gray
  SOCKET: '#06B6D4', // cyan
  PRINT:  '#EC4899', // pink
};

function debugLog(type, message, data) {
  var store = useDebugStore.getState();
  if (!store.enabled) return;

  store.addLog(type, message, data);

  // Also log to browser console with color
  var color = TYPE_COLORS[type] || '#6B7280';
  var prefix = '%c[' + type + ']';
  var style = 'color: ' + color + '; font-weight: bold;';
  if (data) {
    console.log(prefix, style, message, data);
  } else {
    console.log(prefix, style, message);
  }
}

export { debugLog };
export default debugLog;
