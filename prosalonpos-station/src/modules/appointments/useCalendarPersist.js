/**
 * useCalendarPersist.js — Server persistence for calendar operations
 * Session 99 | Wires local-only calendar state to the real API
 *
 * PROBLEM: Mock-to-live migration left all calendar operations as
 * local state only (setServiceLines). Nothing was saved to the database.
 * Appointments would disappear on page refresh.
 *
 * SOLUTION: After each local state update (optimistic UI), this hook
 * fires the corresponding API call in the background. If the API call
 * fails, the next store refetch will correct the UI.
 *
 * Usage in CalendarDayView:
 *   var persist = useCalendarPersist(fetchServiceLines);
 *   // After a booking: persist.saveBooking(newLines, clientName);
 *   // After a status change: persist.saveStatus(sl, newStatus);
 *   // After a drag move: persist.saveMove(serviceLineId, updates);
 */

import { useAppointmentStore } from '../../lib/stores/appointmentStore';
import { debugLog } from '../../lib/debugLog';

function useCalendarPersist() {
  var createAppointment = useAppointmentStore(function(s) { return s.createAppointment; });
  var updateAppointment = useAppointmentStore(function(s) { return s.updateAppointment; });
  var updateServiceLine = useAppointmentStore(function(s) { return s.updateServiceLine; });
  var cancelAppointment = useAppointmentStore(function(s) { return s.cancelAppointment; });

  /**
   * Save a new booking to the server.
   * Called after handleBookingSave adds lines to local state.
   *
   * @param {Array} lines - the new service line objects from the booking
   * @param {string} clientName - display name of the client
   * @param {string} clientId - client ID (if known)
   */
  function saveBooking(lines, clientName, clientId) {
    if (!lines || lines.length === 0) return;

    // Group by client+tech (each group becomes one Appointment)
    var groups = {};
    lines.forEach(function(sl) {
      var key = (sl.client || clientName || 'Walk-in') + '__' + sl.staff_id;
      if (!groups[key]) groups[key] = { clientName: sl.client || clientName || 'Walk-in', clientId: sl.client_id || clientId || null, lines: [] };
      groups[key].lines.push(sl);
    });

    Object.keys(groups).forEach(function(key) {
      var group = groups[key];
      var payload = {
        client_name: group.clientName,
        client_id: group.clientId,
        status: 'pending',
        source: 'staff',
        walk_in: false,
        service_lines: group.lines.map(function(sl) {
          return {
            service_catalog_id: sl.service_catalog_id || null,
            staff_id: sl.staff_id,
            starts_at: sl.starts_at instanceof Date ? sl.starts_at.toISOString() : sl.starts_at,
            duration_minutes: sl.dur || sl.duration_minutes || 30,
            calendar_color: sl.color || sl.calendar_color || '#3B82F6',
            status: sl.status || 'pending',
            client_name: sl.client || group.clientName,
            service_name: sl.service || sl.service_name || 'Service',
            price_cents: sl.price_cents || 0,
          };
        }),
      };

      createAppointment(payload).then(function(appt) {
        debugLog('PERSIST', 'Booking saved: ' + group.clientName + ' (' + group.lines.length + ' services)');
      }).catch(function(err) {
        console.error('[CalendarPersist] Failed to save booking:', err.message);
      });
    });
  }

  /**
   * Save a status change to the server.
   * Called after applyStatusChange updates local state.
   */
  function saveStatus(sl, newStatus) {
    if (!sl || !sl.appointment_id) {
      // Local-only line (just created, not yet saved) — can't update by ID
      debugLog('PERSIST', 'Status change on unsaved line — will sync on next refetch');
      return;
    }
    updateAppointment(sl.appointment_id, { status: newStatus }).then(function() {
      debugLog('PERSIST', 'Status saved: ' + sl.client + ' → ' + newStatus);
    }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save status:', err.message);
    });
  }

  /**
   * Save a service line move (drag-drop, tech change) to the server.
   * Called after the local state is updated.
   */
  function saveMove(serviceLineId, updates) {
    if (!serviceLineId || serviceLineId.indexOf('sl-') === 0) {
      // Temp ID (not yet in DB) — skip
      return;
    }
    var payload = {};
    if (updates.staff_id) payload.staff_id = updates.staff_id;
    if (updates.starts_at) {
      payload.starts_at = updates.starts_at instanceof Date ? updates.starts_at.toISOString() : updates.starts_at;
    }
    if (updates.duration_minutes) payload.duration_minutes = updates.duration_minutes;

    updateServiceLine(serviceLineId, payload).then(function() {
      debugLog('PERSIST', 'Move saved: ' + serviceLineId);
    }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save move:', err.message);
    });
  }

  /**
   * Save duration change (add time) to the server.
   */
  function saveAddTime(sl, newDuration) {
    if (!sl || !sl.id || sl.id.indexOf('sl-') === 0) return;
    updateServiceLine(sl.id, { duration_minutes: newDuration }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save add time:', err.message);
    });
  }

  /**
   * Cancel an appointment on the server.
   */
  function saveCancel(appointmentId) {
    if (!appointmentId) return;
    cancelAppointment(appointmentId).catch(function(err) {
      console.error('[CalendarPersist] Failed to cancel:', err.message);
    });
  }

  return {
    saveBooking: saveBooking,
    saveStatus: saveStatus,
    saveMove: saveMove,
    saveAddTime: saveAddTime,
    saveCancel: saveCancel,
  };
}

export default useCalendarPersist;
