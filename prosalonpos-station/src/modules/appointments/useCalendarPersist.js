/**
 * useCalendarPersist.js — Server persistence for calendar operations
 * Session 99 | Session C6: Added toast on error + Promise return for rollback
 *
 * KEY DESIGN: Calls the API directly (not through the store) to avoid
 * triggering fetchServiceLines() which causes a full calendar flash.
 * The local state is already correct from the optimistic update.
 * The store will sync naturally via Socket.io events from other stations.
 *
 * C6 CHANGE: All methods now return Promises and accept an onError callback
 * so callers can snapshot→rollback on failure. Toast shown on any error.
 *
 * Usage in CalendarDayView:
 *   var persist = useCalendarPersist(toast);
 *   persist.saveBooking(newLines, clientName);
 *   persist.saveStatus(sl, newStatus);
 *   persist.saveMove(serviceLineId, updates);
 */

import { api } from '../../lib/apiClient';

function useCalendarPersist(toast) {

  function showError(action, err) {
    console.error('[CalendarPersist] Failed to ' + action + ':', err.message);
    if (toast) toast.show('Save failed — change reverted', 'error');
  }

  /**
   * Save a new booking to the server.
   * Returns a Promise that rejects on failure (caller can rollback).
   */
  function saveBooking(lines, clientName, clientId) {
    if (!lines || lines.length === 0) return Promise.resolve();

    // Group by client+tech (each group becomes one Appointment)
    var groups = {};
    lines.forEach(function(sl) {
      var key = (sl.client || clientName || 'Walk-in') + '__' + sl.staff_id;
      if (!groups[key]) groups[key] = { clientName: sl.client || clientName || 'Walk-in', clientId: sl.client_id || clientId || null, lines: [] };
      groups[key].lines.push(sl);
    });

    // If multiple groups (multi-tech booking), generate a shared booking_group_id
    var groupKeys = Object.keys(groups);
    var bookingGroupId = groupKeys.length > 1 ? ('bg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)) : null;

    var promises = groupKeys.map(function(key) {
      var group = groups[key];
      var payload = {
        client_name: group.clientName,
        client_id: group.clientId,
        status: 'pending',
        source: 'staff',
        walk_in: false,
        booking_group_id: bookingGroupId,
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

      return api.post('/appointments', payload);
    });

    return Promise.all(promises).catch(function(err) {
      showError('save booking', err);
      throw err;
    });
  }

  /**
   * Save a status change to the server.
   * Returns a Promise that rejects on failure.
   */
  function saveStatus(sl, newStatus) {
    if (!sl || !sl.appointment_id) {
      return Promise.resolve();
    }
    return api.put('/appointments/' + sl.appointment_id, { status: newStatus }).catch(function(err) {
      showError('save status', err);
      throw err;
    });
  }

  /**
   * Save a service line move (drag-drop, tech change) to the server.
   * Returns a Promise so callers can rollback on failure.
   */
  function saveMove(serviceLineId, updates) {
    if (!serviceLineId || serviceLineId.indexOf('sl-') === 0) {
      return Promise.resolve();
    }
    var payload = {};
    if (updates.staff_id) payload.staff_id = updates.staff_id;
    if (updates.starts_at) {
      payload.starts_at = updates.starts_at instanceof Date ? updates.starts_at.toISOString() : updates.starts_at;
    }
    if (updates.duration_minutes) payload.duration_minutes = updates.duration_minutes;

    return api.put('/appointments/service-line/' + serviceLineId, payload).catch(function(err) {
      showError('save move', err);
      throw err;
    });
  }

  /**
   * Save duration change (add time) to the server.
   * Returns a Promise that rejects on failure.
   */
  function saveAddTime(sl, newDuration) {
    if (!sl || !sl.id || sl.id.indexOf('sl-') === 0) return Promise.resolve();
    return api.put('/appointments/service-line/' + sl.id, { duration_minutes: newDuration }).catch(function(err) {
      showError('save add time', err);
      throw err;
    });
  }

  /**
   * Cancel an appointment on the server.
   * Returns a Promise that rejects on failure.
   */
  function saveCancel(appointmentId) {
    if (!appointmentId) return Promise.resolve();
    return api.del('/appointments/' + appointmentId).catch(function(err) {
      showError('cancel appointment', err);
      throw err;
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
