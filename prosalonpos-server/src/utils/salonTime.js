/**
 * salonTime.js — Salon Timezone Utilities
 * Session C62 | PROTECTED C62: timezone-naive time handling
 *
 * PURPOSE: Salons operate in a single physical location. A 9 AM appointment
 * should ALWAYS display as 9 AM regardless of the viewer's browser timezone.
 *
 * PROBLEM: PostgreSQL stores DateTime as UTC. The browser's new Date(isoString)
 * converts to local timezone — so a 9 AM Eastern appointment stored as
 * "2026-04-15T13:00:00.000Z" shows as 6 AM in a Pacific timezone browser.
 *
 * SOLUTION: Two conversion functions used at server boundaries:
 *   utcToSalonLocal(date) — strips timezone, returns "2026-04-15T09:00:00" (no Z)
 *   salonLocalToUtc(str)  — parses naive string as salon-local, returns UTC Date
 *
 * The frontend receives timezone-naive strings. new Date("2026-04-15T09:00:00")
 * is parsed as browser-local time — always shows 9 AM in any timezone.
 *
 * DEFAULT TIMEZONE: America/New_York (matches all existing dayBounds helpers).
 * When we add per-salon timezone settings, change SALON_TZ here — one place.
 */

var SALON_TZ = 'America/New_York';

/**
 * Convert a UTC Date (from Prisma/Postgres) to a timezone-naive ISO string
 * in the salon's local time. Returns "YYYY-MM-DDTHH:mm:ss" (no Z, no offset).
 *
 * Example: UTC "2026-04-15T13:00:00.000Z" → Eastern "2026-04-15T09:00:00"
 */
function utcToSalonLocal(date) {
  if (!date) return null;
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return null;

  // Use Intl to get salon-local date parts
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SALON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  var parts = {};
  fmt.formatToParts(date).forEach(function(p) {
    parts[p.type] = p.value;
  });

  // hour12:false can return "24" for midnight in some environments — normalize
  var hour = parts.hour === '24' ? '00' : parts.hour;

  return parts.year + '-' + parts.month + '-' + parts.day +
    'T' + hour + ':' + parts.minute + ':' + parts.second;
}

/**
 * Convert a timezone-naive local time string to a UTC Date for Prisma storage.
 * Input: "2026-04-15T09:00:00" (salon local time, no Z)
 * Output: Date object in UTC (e.g. 2026-04-15T13:00:00.000Z for EDT)
 *
 * Also handles Date objects — extracts local components and re-interprets
 * them as salon-local time.
 */
function salonLocalToUtc(input) {
  if (!input) return null;

  var str = input;
  if (input instanceof Date) {
    // Already a Date — if it came from the frontend with no Z,
    // the server's new Date() would have parsed it as server-local.
    // We treat it as-is since the string form is what matters.
    str = input.toISOString();
  }

  // Strip trailing Z or offset if present — we want to parse the raw digits
  str = String(str).replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');

  // Parse the components
  var parts = str.split('T');
  if (parts.length < 2) return new Date(input); // fallback

  var dateParts = parts[0].split('-');
  var timeParts = parts[1].split(':');

  var y = parseInt(dateParts[0]);
  var mo = parseInt(dateParts[1]) - 1;
  var d = parseInt(dateParts[2]);
  var h = parseInt(timeParts[0]) || 0;
  var mi = parseInt(timeParts[1]) || 0;
  var s = parseInt(timeParts[2]) || 0;

  // Get the UTC offset for this specific date/time in the salon timezone
  // Create a rough UTC date to probe the offset
  var probeUtc = new Date(Date.UTC(y, mo, d, h, mi, s));
  var salonStr = probeUtc.toLocaleString('en-US', { timeZone: SALON_TZ, timeZoneName: 'short' });
  var isEDT = salonStr.indexOf('EDT') >= 0;
  var offsetMinutes = isEDT ? 240 : 300; // EDT = UTC-4 (240 min), EST = UTC-5 (300 min)

  // Salon local time + offset = UTC
  // If salon says 9:00 AM EDT (UTC-4), then UTC = 9:00 + 4:00 = 13:00
  return new Date(Date.UTC(y, mo, d, h, mi, s) + offsetMinutes * 60000);
}

export { utcToSalonLocal, salonLocalToUtc, SALON_TZ };
