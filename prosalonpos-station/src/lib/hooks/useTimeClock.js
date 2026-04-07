import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../apiClient';
import { onSocketEvent, offSocketEvent } from '../socket';

/**
 * useTimeClock — Time Clock punch + presence state management
 *
 * Two separate systems:
 *   1. Clock Punches — hourly staff only, stored in ClockPunch table, used for timesheet/payroll
 *   2. Presence — non-hourly staff, stored in StaffPresence table, used for turn system only
 *
 * Both systems drive the turn list (who is "signed in" for the day).
 * Only punches appear on timesheets and affect payroll calculations.
 *
 * API endpoints used:
 *   GET    /timeclock/punches           — load today's punches on mount
 *   POST   /timeclock/punch             — clock in/out (hourly staff)
 *   POST   /timeclock/punches/manual    — add manual punch (manager)
 *   PUT    /timeclock/punches/:id       — edit a punch
 *   DELETE /timeclock/punches/:id       — delete a punch (manager)
 *   GET    /timeclock/presence          — load presence records on mount
 *   POST   /timeclock/presence          — sign in/out (non-hourly staff)
 */
export default function useTimeClock() {
  var [clockPunches, setClockPunches] = useState([]);
  var [presenceRecords, setPresenceRecords] = useState([]);
  var [showTimeClockModal, setShowTimeClockModal] = useState(false);
  var [loading, setLoading] = useState(false);
  var mountedRef = useRef(true);

  // ── Load today's punches on mount ──
  var fetchTodayPunches = useCallback(function() {
    setLoading(true);
    // Send explicit start/end in ISO format based on local midnight,
    // so punches at 11pm ET (which are next-day UTC) aren't missed.
    var now = new Date();
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    var dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    api.get('/timeclock/punches?start=' + dayStart.toISOString() + '&end=' + dayEnd.toISOString()).then(function(data) {
      if (mountedRef.current && data && data.punches) {
        setClockPunches(data.punches);
      }
    }).catch(function(err) {
      console.warn('[useTimeClock] Failed to fetch punches:', err.message);
    }).finally(function() {
      if (mountedRef.current) setLoading(false);
    });
  }, []);

  // ── Load presence records on mount ──
  var fetchPresence = useCallback(function() {
    api.get('/timeclock/presence').then(function(data) {
      if (mountedRef.current && data && data.presence) {
        setPresenceRecords(data.presence);
      }
    }).catch(function(err) {
      console.warn('[useTimeClock] Failed to fetch presence:', err.message);
    });
  }, []);

  useEffect(function() {
    mountedRef.current = true;
    fetchTodayPunches();
    fetchPresence();
    return function() { mountedRef.current = false; };
  }, [fetchTodayPunches, fetchPresence]);

  // ── Listen for socket events (other station clocked someone in/out) ──
  useEffect(function() {
    function handleSocketPunch() {
      fetchTodayPunches();
    }
    function handleSocketPresence() {
      fetchPresence();
    }
    onSocketEvent('timeclock:punch', handleSocketPunch);
    onSocketEvent('timeclock:presence', handleSocketPresence);
    return function() {
      offSocketEvent('timeclock:punch', handleSocketPunch);
      offSocketEvent('timeclock:presence', handleSocketPresence);
    };
  }, [fetchTodayPunches, fetchPresence]);

  // ── Clock in or out — HOURLY STAFF (creates punch record for payroll) ──
  function handleClockPunch(staffId, type) {
    var optimisticPunch = {
      id: 'temp-' + Date.now(),
      staff_id: staffId,
      type: type,
      timestamp: Date.now(),
    };
    setClockPunches(function(prev) { return prev.concat([optimisticPunch]); });

    api.post('/timeclock/punch', { staff_id: staffId, type: type }).then(function(data) {
      if (mountedRef.current && data && data.punch) {
        setClockPunches(function(prev) {
          return prev.filter(function(p) { return p.id !== optimisticPunch.id; }).concat([data.punch]);
        });
      }
    }).catch(function(err) {
      console.error('[useTimeClock] Clock punch failed:', err.message);
      setClockPunches(function(prev) {
        return prev.filter(function(p) { return p.id !== optimisticPunch.id; });
      });
    });
  }

  // ── Sign in or out — NON-HOURLY STAFF (presence only, no payroll record) ──
  function handlePresencePunch(staffId, status) {
    var optimistic = {
      id: 'temp-pres-' + Date.now(),
      staff_id: staffId,
      status: status,
      timestamp: Date.now(),
    };
    setPresenceRecords(function(prev) {
      var filtered = prev.filter(function(r) { return r.staff_id !== staffId; });
      return filtered.concat([optimistic]);
    });

    api.post('/timeclock/presence', { staff_id: staffId, status: status }).then(function(data) {
      if (mountedRef.current && data && data.presence) {
        setPresenceRecords(function(prev) {
          var filtered = prev.filter(function(r) { return r.staff_id !== staffId; });
          return filtered.concat([data.presence]);
        });
      }
    }).catch(function(err) {
      console.error('[useTimeClock] Presence punch failed:', err.message);
      setPresenceRecords(function(prev) {
        return prev.filter(function(r) { return r.id !== optimistic.id; });
      });
    });
  }

  // ── Add manual punch (owner/manager from Timesheets tab) ──
  function handleAddManualPunch(staffId, type, timestamp) {
    var optimisticPunch = {
      id: 'temp-manual-' + Date.now(),
      staff_id: staffId,
      type: type,
      timestamp: timestamp,
      manual: true,
    };
    setClockPunches(function(prev) {
      return prev.concat([optimisticPunch]).sort(function(a, b) {
        return (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime()) -
               (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime());
      });
    });

    api.post('/timeclock/punches/manual', {
      staff_id: staffId,
      type: type,
      timestamp: typeof timestamp === 'number' ? new Date(timestamp).toISOString() : timestamp,
    }).then(function(data) {
      if (mountedRef.current && data && data.punch) {
        setClockPunches(function(prev) {
          return prev.filter(function(p) { return p.id !== optimisticPunch.id; }).concat([data.punch]).sort(function(a, b) {
            return (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime()) -
                   (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime());
          });
        });
        // Refetch to ensure clockPunches only contains today's punches
        setTimeout(fetchTodayPunches, 500);
      }
    }).catch(function(err) {
      console.error('[useTimeClock] Manual punch failed:', err.message);
      setClockPunches(function(prev) {
        return prev.filter(function(p) { return p.id !== optimisticPunch.id; });
      });
    });
  }

  // ── Delete a punch (owner/manager from Timesheets tab) ──
  function handleDeletePunch(punchId) {
    var deleted = null;
    setClockPunches(function(prev) {
      deleted = prev.find(function(p) { return p.id === punchId; });
      return prev.filter(function(p) { return p.id !== punchId; });
    });

    api.del('/timeclock/punches/' + punchId).then(function() {
      // Refetch to ensure clockPunches stays in sync with server
      if (mountedRef.current) setTimeout(fetchTodayPunches, 500);
    }).catch(function(err) {
      console.error('[useTimeClock] Delete punch failed:', err.message);
      if (deleted) {
        setClockPunches(function(prev) { return prev.concat([deleted]); });
      }
    });
  }

  // ── Edit an existing punch (from Timesheets manager) ──
  function handleEditPunch(punchId, updates, changedByName) {
    var oldPunch = null;
    setClockPunches(function(prev) {
      return prev.map(function(p) {
        if (p.id === punchId) {
          oldPunch = p;
          var updated = Object.assign({}, p);
          if (updates.timestamp) updated.timestamp = updates.timestamp;
          if (updates.type) updated.type = updates.type;
          return updated;
        }
        return p;
      });
    });

    var payload = {};
    if (updates.timestamp) {
      payload.timestamp = typeof updates.timestamp === 'number'
        ? new Date(updates.timestamp).toISOString() : updates.timestamp;
    }
    if (updates.type) payload.type = updates.type;
    if (changedByName) payload.changed_by_name = changedByName;

    api.put('/timeclock/punches/' + punchId, payload).then(function(data) {
      if (mountedRef.current && data && data.punch) {
        setClockPunches(function(prev) {
          return prev.map(function(p) { return p.id === punchId ? data.punch : p; });
        });
        // Refetch to ensure clockPunches stays in sync with server
        setTimeout(fetchTodayPunches, 500);
      }
    }).catch(function(err) {
      console.error('[useTimeClock] Edit punch failed:', err.message);
      if (oldPunch) {
        setClockPunches(function(prev) {
          return prev.map(function(p) { return p.id === punchId ? oldPunch : p; });
        });
      }
    });
  }

  return {
    clockPunches: clockPunches,
    presenceRecords: presenceRecords,
    loading: loading,
    showTimeClockModal: showTimeClockModal,
    setShowTimeClockModal: setShowTimeClockModal,
    handleClockPunch: handleClockPunch,
    handlePresencePunch: handlePresencePunch,
    handleAddManualPunch: handleAddManualPunch,
    handleEditPunch: handleEditPunch,
    handleDeletePunch: handleDeletePunch,
    refetchPunches: fetchTodayPunches,
    refetchPresence: fetchPresence,
  };
}
