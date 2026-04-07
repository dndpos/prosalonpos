/**
 * techSlipCounter — Per-tech daily slip numbering
 * Session 79 — TD-077 fix
 *
 * Each tech starts at slip #1 for the day. Every time they finish a client
 * and a tech slip prints, the counter increments. Resets at midnight.
 *
 * Usage:
 *   import { getNextSlipNumber } from '../lib/techSlipCounter';
 *   var slipNum = getNextSlipNumber('staff-01'); // returns 1, then 2, then 3...
 */

var _counts = {};   // { techId: number }
var _dateKey = '';   // 'YYYY-MM-DD' — resets when this changes

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function checkReset() {
  var today = todayKey();
  if (_dateKey !== today) {
    _counts = {};
    _dateKey = today;
  }
}

/**
 * Get the next slip number for a tech. Auto-increments.
 * First call of the day returns 1.
 */
export function getNextSlipNumber(techId) {
  checkReset();
  if (!_counts[techId]) _counts[techId] = 0;
  _counts[techId] += 1;
  return _counts[techId];
}

/**
 * Get the current slip count for a tech WITHOUT incrementing.
 */
export function getCurrentSlipCount(techId) {
  checkReset();
  return _counts[techId] || 0;
}

/**
 * Reset all counters (for testing or manual reset).
 */
export function resetAllSlipCounters() {
  _counts = {};
  _dateKey = todayKey();
}
