/**
 * useCalendarPersist.js — Server persistence for calendar operations
 * Session 99 | Wires local-only calendar state to the real API
 *
 * KEY DESIGN: Calls the API directly (not through the store) to avoid
 * triggering fetchServiceLines() which causes a full calendar flash.
 * The local state is already correct from the optimistic update.
 * The store will sync naturally via Socket.io events from other stations.
 *
 * Usage in CalendarDayView:
 *   var persist = useCalendarPersist();
 *   persist.saveBooking(newLines, clientName);
 *   persist.saveStatus(sl, newStatus);
 *   persist.saveMove(serviceLineId, updates);
 */

import { api } from '../../lib/apiClient';

function useCalendarPersist() {

  /**
   * Save a new booking to the server.
   * Called after handleBookingSave adds lines to local state.
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

      api.post('/appointments', payload).then(function() {
      }).catch(function(err) {
        console.error('[CalendarPersist] Failed to save booking:', err.message);
      });
    });
  }

  /**
   * Save a status change to the server.
   */
  function saveStatus(sl, newStatus) {
    if (!sl || !sl.appointment_id) {
      return;
    }
    api.put('/appointments/' + sl.appointment_id, { status: newStatus }).then(function() {
    }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save status:', err.message);
    });
  }

  /**
   * Save a service line move (drag-drop, tech change) to the server.
   */
  function saveMove(serviceLineId, updates) {
    if (!serviceLineId || serviceLineId.indexOf('sl-') === 0) {
      return;
    }
    var payload = {};
    if (updates.staff_id) payload.staff_id = updates.staff_id;
    if (updates.starts_at) {
      payload.starts_at = updates.starts_at instanceof Date ? updates.starts_at.toISOString() : updates.starts_at;
    }
    if (updates.duration_minutes) payload.duration_minutes = updates.duration_minutes;

    api.put('/appointments/service-line/' + serviceLineId, payload).then(function() {
    }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save move:', err.message);
    });
  }

  /**
   * Save duration change (add time) to the server.
   */
  function saveAddTime(sl, newDuration) {
    if (!sl || !sl.id || sl.id.indexOf('sl-') === 0) return;
    api.put('/appointments/service-line/' + sl.id, { duration_minutes: newDuration }).catch(function(err) {
      console.error('[CalendarPersist] Failed to save add time:', err.message);
    });
  }

  /**
   * Cancel an appointment on the server.
   */
  function saveCancel(appointmentId) {
    if (!appointmentId) return;
    api.del('/appointments/' + appointmentId).catch(function(err) {
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
