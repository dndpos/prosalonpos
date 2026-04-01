/**
 * formatUtils.js — Shared formatting and string utilities
 * Session 55
 *
 * Pure utility functions used across multiple modules.
 * Separated from mockData.js so components don't need to import
 * a large mock data file just for a helper function.
 */

/**
 * Strip all non-digit characters from a phone string.
 * Used for phone number comparison and search.
 * @param {string} phone — formatted or raw phone string
 * @returns {string} — digits only (e.g., "5551234567")
 */
export function phoneToDigits(phone) {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Format cents as a dollar string: 3500 → "$35.00"
 * @param {number} cents — amount in cents (may be negative)
 * @returns {string} — formatted dollar string
 */
export function fmt(cents) {
  return '$' + (Math.abs(cents || 0) / 100).toFixed(2);
}

/**
 * Format a digit string as a US phone: "5551234567" → "(555) 123-4567"
 * Handles partial input for live formatting in phone fields.
 * @param {string} d — digits-only string (or raw phone)
 * @returns {string} — formatted phone string
 */
export function fp(d) {
  if (!d) return '';
  var v = d.replace(/\D/g, '');
  if (v.length <= 3) return '(' + v;
  if (v.length <= 6) return '(' + v.slice(0, 3) + ') ' + v.slice(3);
  return '(' + v.slice(0, 3) + ') ' + v.slice(3, 6) + '-' + v.slice(6, 10);
}

// Format cents as dollars string — $35.00
export function dollars(cents) { return '$' + ((cents || 0) / 100).toFixed(2); }
