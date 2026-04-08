/**
 * appointmentStore.js — Zustand Store for Appointment Data
 * Session 88 | Mock data REMOVED — API only
 *
 * KEY CONCEPT: The calendar renders SERVICE LINES, not appointments.
 * Each service line = one colored block on the calendar grid.
 * One appointment can have multiple service lines (e.g. Haircut + Color).
 *
 * NORMALIZER: All service lines are normalized to the calendar-friendly shape:
 *   API fields → Calendar fields
 *   duration_minutes → dur
 *   client_name     → client
 *   service_name    → service
 *   calendar_color  → color
 *   starts_at (ISO) → starts_at (Date)
 *
 * Usage:
 *   import { useAppointmentStore } from '../lib/stores/appointmentStore';
 *   const serviceLines = useAppointmentStore(s => s.serviceLines);
 *   const { fetchServiceLines, createAppointment } = useAppointmentStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

function normalizeServiceLine(sl) {
  if (sl._normalized) return sl;

  var startsAt = sl.starts_at;
  if (typeof startsAt === 'string') {
    startsAt = new Date(startsAt);
  }

  return {
    id: sl.id,
    appointment_id: sl.appointment_id,
    service_catalog_id: sl.service_catalog_id,
    staff_id: sl.staff_id,
    status: sl.status,
    requested: !!sl.requested,
    price_cents: sl.price_cents || 0,
    open_price: !!sl.open_price,
    client_id: sl.client_id || null,
    source: sl.source || null,
    notes: sl.notes || null,
    bookingId: sl.bookingId || null,
    note: sl.note || '',
    payment_method: sl.payment_method || null,
    starts_at: startsAt,
    dur: sl.duration_minutes != null ? sl.duration_minutes : (sl.dur || 30),
    color: sl.calendar_color || sl.color || '#3B82F6',
    client: sl.client_name || sl.client || 'Walk-in',
    service: sl.service_name || sl.service || 'Service',
    is_vip: !!sl.is_vip,
    _normalized: true,
  };
}

function normalizeAll(lines) {
  return (lines || []).map(normalizeServiceLine);
}

var useAppointmentStore = create(function(set, get) {
  return {
    // ─── State ───
    serviceLines: [],
    appointments: [],
    loading: false,
    refreshing: false,
    error: null,
    source: 'pending',
    initialized: false,
    loadedDate: null,

    // ─── Actions ───

    fetchServiceLines: async function(dateStr) {
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available', loadedDate: dateStr || 'today' });
        return;
      }

      if (!dateStr) {
        var today = new Date();
        dateStr = today.getFullYear() + '-' +
          String(today.getMonth() + 1).padStart(2, '0') + '-' +
          String(today.getDate()).padStart(2, '0');
      }

      // Silent refresh: only show loading skeleton on first load or date change.
      // If we already have data for this date, refresh in background (no flash).
      var state = get();
      var isSameDate = state.loadedDate === dateStr;
      var hasLoaded = state.initialized && isSameDate;
      var showLoading = !hasLoaded;
      // Only set loading if we actually need to show skeleton (first load / date change).
      // For silent refreshes, don't touch loading at all — prevents spinner flash.
      if (showLoading) {
        set({ loading: true, refreshing: true, error: null });
      } else {
        set({ refreshing: true, error: null });
      }
      try {
        var data = await api.get('/appointments/service-lines?start=' + dateStr + '&end=' + dateStr);
        var newLines = normalizeAll(data.serviceLines);
        // Skip replacing serviceLines if data hasn't changed (same IDs in same order).
        // This prevents unnecessary re-renders from socket-triggered refetches.
        var oldLines = get().serviceLines;
        var changed = newLines.length !== oldLines.length;
        if (!changed) {
          for (var i = 0; i < newLines.length; i++) {
            if (newLines[i].id !== oldLines[i].id || 
                newLines[i].status !== oldLines[i].status ||
                newLines[i].staff_id !== oldLines[i].staff_id ||
                newLines[i].starts_at.getTime() !== oldLines[i].starts_at.getTime() ||
                newLines[i].dur !== oldLines[i].dur ||
                newLines[i].price_cents !== oldLines[i].price_cents ||
                newLines[i].client !== oldLines[i].client ||
                newLines[i].service !== oldLines[i].service) {
              changed = true;
              break;
            }
          }
        }
        var updates = {
          loading: false,
          refreshing: false,
          source: 'api',
          initialized: true,
          loadedDate: dateStr,
        };
        if (changed) {
          updates.serviceLines = newLines;
        }
        set(updates);
      } catch (err) {
        set({ loading: false, refreshing: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    fetchAppointments: async function(startDate, endDate) {
      try {
        var path = '/appointments?start=' + startDate;
        if (endDate) path += '&end=' + endDate;
        var data = await api.get(path);
        var appts = data.appointments || [];
        set({ appointments: appts });
        return appts;
      } catch (err) {
        console.warn('[appointmentStore] Fetch appointments failed:', err.message);
        return [];
      }
    },

    fetchClientAppointments: async function(clientId) {
      try {
        var data = await api.get('/appointments/client/' + clientId);
        return data.appointments || [];
      } catch (err) {
        console.warn('[appointmentStore] Client appointments fetch failed:', err.message);
        return [];
      }
    },

    fetchAppointment: async function(appointmentId) {
      try {
        var data = await api.get('/appointments/' + appointmentId);
        return data.appointment || null;
      } catch (err) {
        console.warn('[appointmentStore] Single appointment fetch failed:', err.message);
        return null;
      }
    },

    createAppointment: async function(appointmentData) {
      var data = await api.post('/appointments', appointmentData);
      var currentDate = get().loadedDate;
      if (currentDate) {
        get().fetchServiceLines(currentDate);
      }
      return data.appointment;
    },

    updateAppointment: async function(appointmentId, updates) {
      var data = await api.put('/appointments/' + appointmentId, updates);
      var currentDate = get().loadedDate;
      if (currentDate) {
        get().fetchServiceLines(currentDate);
      }
      return data.appointment;
    },

    updateServiceLine: async function(serviceLineId, updates) {
      await api.put('/appointments/service-line/' + serviceLineId, updates);
      var currentDate = get().loadedDate;
      if (currentDate) {
        get().fetchServiceLines(currentDate);
      }
    },

    cancelAppointment: async function(appointmentId) {
      await api.del('/appointments/' + appointmentId);
      var currentDate = get().loadedDate;
      if (currentDate) {
        get().fetchServiceLines(currentDate);
      }
    },

    // ─── Selectors ───

    getServiceLinesForStaff: function(staffId) {
      return get().serviceLines.filter(function(sl) { return sl.staff_id === staffId; });
    },

    getServiceLinesForAppointment: function(appointmentId) {
      return get().serviceLines.filter(function(sl) { return sl.appointment_id === appointmentId; });
    },

    getServiceLineById: function(id) {
      return get().serviceLines.find(function(sl) { return sl.id === id; });
    },
  };
});

export { useAppointmentStore, normalizeServiceLine, normalizeAll };
