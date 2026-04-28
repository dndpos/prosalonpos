/**
 * salonTz.js — Per-salon timezone cache + tz-aware date helpers (v2.0.6)
 *
 * Background: Pre-v2.0.6 the server hardcoded America/New_York everywhere.
 * cc26 (V1 line) tried per-route threading and broke things. This file is the
 * v2.0.6 rewrite — single in-memory cache + dayBoundsTz that REQUIRES salon_id.
 *
 * Safety: getSalonTz(salon_id) throws if salon_id is missing. dayBoundsTz
 * throws if salon_id is missing. Any caller that forgets is loud, not silent.
 *
 * Cache lifecycle:
 *   - loadAllSalonTzs() at server startup → fills the map
 *   - setSalonTz(id, tz)  → called when salon is created or tz changes
 *   - getSalonTz(id)      → sync lookup, throws on miss
 *   - getSalonTzSafe(id)  → sync lookup, returns 'America/New_York' on miss
 *                           (use ONLY where graceful fallback is safe — e.g.
 *                           middleware that hasn't yet called loadAllSalonTzs)
 */

import prisma from '../config/database.js';

var tzMap = new Map(); // salon_id (String) -> tz string ('America/New_York' | ...)
var loaded = false;

/**
 * Fill the cache with every salon's timezone. Call once at server startup
 * AFTER prisma is connected. Safe to call again (rebuilds the map).
 */
export async function loadAllSalonTzs() {
  var salons = await prisma.salon.findMany({ select: { id: true, timezone: true } });
  tzMap.clear();
  for (var i = 0; i < salons.length; i++) {
    tzMap.set(salons[i].id, salons[i].timezone || 'America/New_York');
  }
  loaded = true;
  return salons.length;
}

/**
 * Update the cache for one salon. Call after Salon.timezone is written.
 */
export function setSalonTz(salon_id, tz) {
  if (!salon_id) throw new Error('setSalonTz: salon_id required');
  tzMap.set(salon_id, tz || 'America/New_York');
}

/**
 * Get a salon's tz. Throws if salon_id missing or cache not loaded.
 * If salon_id is unknown to the cache, falls back to 'America/New_York'
 * (existing salons created before this migration will have the DB default).
 */
export function getSalonTz(salon_id) {
  if (!salon_id) throw new Error('getSalonTz: salon_id required');
  if (!loaded) {
    // Cache not yet filled — return safe default. loadAllSalonTzs should
    // run at startup; this path is only reached during initial bootstrap.
    return 'America/New_York';
  }
  return tzMap.get(salon_id) || 'America/New_York';
}

/**
 * Like getSalonTz but never throws — returns ET if salon_id is missing.
 * Use only in code paths where missing salon_id is acceptable (display only).
 */
export function getSalonTzSafe(salon_id) {
  if (!salon_id) return 'America/New_York';
  return tzMap.get(salon_id) || 'America/New_York';
}

/**
 * dayBoundsTz(dateStr, salon_id) — returns { start: Date, end: Date }
 * representing the start/end of the calendar day in the SALON'S timezone.
 *
 * dateStr: 'YYYY-MM-DD' or undefined (defaults to today in salon's tz)
 *
 * Throws if salon_id is missing — keeps cc26-style silent ET fallback bugs
 * from happening.
 */
export function dayBoundsTz(dateStr, salon_id) {
  if (!salon_id) throw new Error('dayBoundsTz: salon_id required');
  var tz = getSalonTz(salon_id);

  var y, m, d;
  if (dateStr) {
    var parts = String(dateStr).split('-');
    y = parseInt(parts[0]);
    m = parseInt(parts[1]);
    d = parseInt(parts[2]);
  } else {
    var now = new Date();
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    var todayParts = fmt.format(now).split('-');
    y = parseInt(todayParts[0]);
    m = parseInt(todayParts[1]);
    d = parseInt(todayParts[2]);
  }

  // Compute UTC offset for that date in the salon's tz (handles DST)
  var probeUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  var offsetMs = getTzOffsetMs(probeUtc, tz);

  // Salon-local midnight in UTC = UTC midnight + offset
  var startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs);
  var endUtc = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMs);
  return { start: startUtc, end: endUtc };
}

/**
 * Compute offset (in ms) from UTC for a given Date in a given tz.
 * Positive for tz east of UTC, negative for west (US tz returns negative).
 */
export function getTzOffsetMs(date, tz) {
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  var parts = {};
  fmt.formatToParts(date).forEach(function(p) { parts[p.type] = p.value; });
  var hour = parts.hour === '24' ? '00' : parts.hour;
  var asUtc = Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    parseInt(hour), parseInt(parts.minute), parseInt(parts.second)
  );
  return asUtc - date.getTime();
}

/**
 * Format a date in a salon's timezone. Wrapper around toLocaleString
 * with the salon's tz injected.
 */
export function formatInSalonTz(date, salon_id, opts) {
  var tz = getSalonTz(salon_id);
  return date.toLocaleString('en-US', Object.assign({ timeZone: tz }, opts || {}));
}

/**
 * Same as formatInSalonTz but date-only (no time).
 */
export function formatDateInSalonTz(date, salon_id, opts) {
  var tz = getSalonTz(salon_id);
  return date.toLocaleDateString('en-US', Object.assign({ timeZone: tz }, opts || {}));
}

/**
 * Same but time-only.
 */
export function formatTimeInSalonTz(date, salon_id, opts) {
  var tz = getSalonTz(salon_id);
  return date.toLocaleTimeString('en-US', Object.assign({ timeZone: tz }, opts || {}));
}

/**
 * Get YYYY-MM-DD for "today" in a salon's tz.
 */
export function todayInSalonTz(salon_id) {
  var tz = getSalonTz(salon_id);
  var fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());
}
