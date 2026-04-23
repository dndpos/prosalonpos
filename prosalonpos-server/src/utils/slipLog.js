/**
 * slipLog.js — cc15 — SlipEvent audit logger.
 *
 * The check-in slip's barcode encodes the last 8 hex chars of the
 * appointment UUID (stripped of dashes, lowercase). That barcode does
 * NOT change between slip-print and checkout-close — it's the one stable
 * identifier across the whole lifecycle of a ticket. Every write that
 * touches a ticket's state writes a row here keyed by that short_id, so
 * the full timeline can be reconstructed by querying a single barcode.
 *
 * PROTECTED cc15: Every ticket-write route MUST call logSlipEvent. If a
 * future route mutates a ticket's items/status/payment without logging,
 * the audit trail silently loses that step and the cc15 feature
 * degrades. When adding a new route that writes tickets, add a
 * logSlipEvent call in the same commit.
 */
import prisma from '../config/database.js';

// Canonical event types. Keep the string values stable — the client's
// History viewer matches on them.
export var SLIP_EVENT_TYPES = {
  SLIP_PRINTED:    'slip_printed',     // appointment created (slip printable)
  SCANNED:         'scanned',          // slip barcode scanned at checkout
  TICKET_CREATED:  'ticket_created',   // first POST /tickets for this slip
  TICKET_UPDATED:  'ticket_updated',   // PUT /tickets/:id (held with new items)
  TICKET_REOPENED: 'ticket_reopened',  // paid ticket reopened for edit
  COMBINED:        'combined',         // this barcode's ticket merged into another
  ABSORBED:        'absorbed',         // this barcode's ticket is the absorber of a merge
  TICKET_PAID:     'ticket_paid',      // ticket closed (paid)
  TICKET_VOIDED:   'ticket_voided',
  TICKET_REFUNDED: 'ticket_refunded',
};

// Derive the 8-hex short_id from an appointment or ticket UUID.
export function shortIdFromUuid(uuid) {
  if (!uuid) return null;
  return String(uuid).replace(/-/g, '').slice(-8).toLowerCase();
}

/**
 * Core logger. All args optional except salonId + eventType + one of
 * (shortId | appointmentId | ticket with appointment_id).
 *
 * Swallows errors — logging MUST NOT break the underlying write. If the
 * SlipEvent table is unreachable or the row is malformed, we log to
 * console and let the caller's response succeed.
 */
export async function logSlipEvent(opts) {
  try {
    if (!opts || !opts.salonId || !opts.eventType) return;
    var shortId = opts.shortId || shortIdFromUuid(opts.appointmentId);
    if (!shortId && opts.ticketAppointmentId) {
      shortId = shortIdFromUuid(opts.ticketAppointmentId);
    }
    // If we still have no short_id, the write isn't tied to a slip at
    // all (walk-in that skipped check-in, retail-only purchase). Skip —
    // the log is scoped to slip-barcode lifecycles by design.
    if (!shortId) return;
    await prisma.slipEvent.create({
      data: {
        salon_id:       opts.salonId,
        short_id:       shortId,
        appointment_id: opts.appointmentId || null,
        ticket_id:      opts.ticketId || null,
        event_type:     opts.eventType,
        payload:        opts.payload || null,
        station_id:     opts.stationId || null,
        staff_id:       opts.staffId || null,
        staff_name:     opts.staffName || null,
      },
    });
  } catch (err) {
    console.warn('[slipLog] failed to log event:', opts && opts.eventType, err.message);
  }
}

/**
 * Extract staff + station context from the Express req. Every route has
 * req.salon_id (set by authenticate middleware). Staff id/name and
 * station id are optional — passed in headers or body by the client.
 */
export function reqContext(req) {
  var body = req.body || {};
  return {
    salonId:   req.salon_id,
    stationId: req.headers['x-station-id'] || body.station_id || null,
    staffId:   body.cashier_id || body.edited_by_id || body.created_by_id || null,
    staffName: body.cashier_name || body.edited_by_name || body.created_by_name || null,
  };
}

/**
 * Snapshot helper for item arrays. Full item rows are large; the log
 * just needs names + price so the cashier can eyeball what was present
 * at each step.
 */
export function itemsSnapshot(items) {
  if (!items || !Array.isArray(items)) return [];
  return items.map(function(it) {
    return {
      name:  it.name || 'Service',
      price: it.price_cents || 0,
      tech:  it.tech_name || it.tech || null,
    };
  });
}
