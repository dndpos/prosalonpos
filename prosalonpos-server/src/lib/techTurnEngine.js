/**
 * Pro Salon POS — Tech Turn Engine
 * src/lib/techTurnEngine.js
 *
 * Pure business logic — no UI, no side effects.
 * Every function takes state + inputs, returns { state, logEntry }.
 *
 * Session 39 — True Round Robin (15 locked rules)
 * Replaces Session 3 Decisions #70-94 where different.
 *
 * KEY SESSION 39 CHANGE:
 * Tech moves to bottom when ASSIGNED (not when finished).
 * Price minimum is checked at assignment time (services are known).
 * completeService() only increments count + logs — no position change.
 * markAvailable() reads assignedQualifying to decide return position.
 *
 * Rotation modes: round_robin, fewest_clients, fixed_order, first_available
 * Counting modes: simple (one minimum for all), advanced (separate walk-in + requested/appointment minimums)
 *
 * STATE SHAPE:
 * {
 *   techs: [{ id, name, photo_url, status, position, clockedInAt, dailyServiceCount, preservedPosition, lastFreeAt, assignedQualifying }],
 *   turnLog: [{ id, timestamp, event, techId, techName, detail }]
 * }
 *
 * Tech status: 'available' | 'busy' | 'break' | 'off'
 * assignedQualifying: true|false|null — set at assignment time, determines return position on completion
 */

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

var _logId = 1;
function logEntry(event, techId, techName, detail) {
  return { id: _logId++, timestamp: new Date().toISOString(), event: event, techId: techId, techName: techName, detail: detail || '' };
}

function nextPosition(techs) {
  var positions = techs.filter(function(t) { return t.status === 'available' && t.position != null; }).map(function(t) { return t.position; });
  return positions.length === 0 ? 1 : Math.max.apply(null, positions) + 1;
}

function reindex(techs) {
  // Re-number positions 1,2,3... for available techs in current position order
  var avail = techs.filter(function(t) { return t.status === 'available'; }).sort(function(a, b) { return (a.position || 999) - (b.position || 999); });
  var map = {};
  avail.forEach(function(t, i) { map[t.id] = i + 1; });
  return techs.map(function(t) {
    if (t.status === 'available' && map[t.id] != null) return Object.assign({}, t, { position: map[t.id] });
    if (t.status !== 'available') return Object.assign({}, t, { position: null });
    return t;
  });
}

// ═══════════════════════════════════════════
// SORTING — determines who is "up next"
// ═══════════════════════════════════════════

function sortAvailable(techs, settings) {
  var avail = techs.filter(function(t) { return t.status === 'available'; });
  var mode = settings.rotation_mode || 'round_robin';

  if (mode === 'round_robin' || mode === 'fixed_order') {
    // Both use position — fixed_order positions are set by owner, round_robin by rotation
    return avail.sort(function(a, b) { return (a.position || 999) - (b.position || 999); });
  }

  if (mode === 'fewest_clients') {
    // Fewest daily services first. Ties broken by clockedInAt (earlier wins)
    return avail.sort(function(a, b) {
      var ca = a.dailyServiceCount || 0;
      var cb = b.dailyServiceCount || 0;
      if (ca !== cb) return ca - cb;
      var ta = a.clockedInAt || 0;
      var tb = b.clockedInAt || 0;
      return ta - tb;
    });
  }

  if (mode === 'first_available') {
    // Whoever has been free longest is position 1. Sort by lastFreeAt ascending
    return avail.sort(function(a, b) {
      var fa = a.lastFreeAt || 0;
      var fb = b.lastFreeAt || 0;
      return fa - fb;
    });
  }

  return avail;
}

// ═══════════════════════════════════════════
// QUALIFYING — does a service meet the price minimum?
// Session 39 Rule #14: ONLY whether the service meets the applicable price minimum.
// Not based on walk-in vs appointment vs requested.
// ═══════════════════════════════════════════

function isQualifyingService(appointment, settings) {
  // appointment shape: { totalPriceCents, requested }
  var countingMode = settings.turn_counting_mode || 'simple';

  if (countingMode === 'simple') {
    // Session 39 Rule #12: One number for everything
    var min = settings.turn_price_minimum_cents || 0;
    return appointment.totalPriceCents >= min;
  }

  // Advanced mode — Session 39 Rule #13: Separate minimums for walk-ins vs requested/appointments
  var isRequested = !!appointment.requested;

  if (isRequested) {
    var reqMin = settings.requested_appt_minimum_cents || 0;
    return appointment.totalPriceCents >= reqMin;
  }

  // Walk-in or non-requested appointment
  var walkInMin = settings.walkin_turn_minimum_cents || 0;
  return appointment.totalPriceCents >= walkInMin;
}

// ═══════════════════════════════════════════
// CORE ACTIONS
// ═══════════════════════════════════════════

/**
 * Initialize turn list for a new day from clocked-in staff.
 * Position = clock-in order. Session 39 Rule #1
 */
function dailyReset(staff, settings) {
  var eligible = staff.filter(function(s) { return s.active && s.tech_turn_eligible !== false; });
  var fixedOrder = settings.fixed_turn_order || [];
  var now = Date.now();

  var techs = eligible.map(function(s, i) {
    return {
      id: s.id,
      name: s.display_name,
      photo_url: s.photo_url || null,
      status: 'available',
      position: i + 1,
      clockedInAt: now + i,
      dailyServiceCount: 0,
      preservedPosition: null,
      lastFreeAt: now + i,
      assignedQualifying: null,
    };
  });

  // For fixed_order mode, apply the owner's static priority
  if (settings.rotation_mode === 'fixed_order' && fixedOrder.length > 0) {
    techs.forEach(function(t) {
      var idx = fixedOrder.indexOf(t.id);
      t.position = idx >= 0 ? idx + 1 : 999;
    });
    techs = reindex(techs);
  }

  return {
    state: { techs: techs, turnLog: [logEntry('daily_reset', null, null, 'Turn list reset for new day')] },
  };
}

/**
 * Clock in a tech. Enters at bottom of rotation. Session 39 Rule #1
 */
function clockIn(state, techId, techName) {
  var now = Date.now();
  var pos = nextPosition(state.techs);

  // Check if tech already exists (re-clock-in = split shift). Session 39 Rule #6
  var existing = state.techs.find(function(t) { return t.id === techId; });
  var techs;
  if (existing) {
    // Split shift re-entry: goes to bottom. Session 39 Rule #6
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, { status: 'available', position: pos, clockedInAt: now, lastFreeAt: now, assignedQualifying: null });
    });
  } else {
    techs = state.techs.concat([{
      id: techId,
      name: techName,
      photo_url: null,
      status: 'available',
      position: pos,
      clockedInAt: now,
      dailyServiceCount: 0,
      preservedPosition: null,
      lastFreeAt: now,
      assignedQualifying: null,
    }]);
  }

  var entry = logEntry('clock_in', techId, techName, existing ? 'Split shift re-entry at bottom' : 'Entered rotation at position ' + pos);
  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Clock out a tech. Removed from rotation immediately.
 */
function clockOut(state, techId) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var techs = state.techs.map(function(t) {
    if (t.id !== techId) return t;
    return Object.assign({}, t, { status: 'off', position: null, assignedQualifying: null });
  });
  techs = reindex(techs);
  var entry = logEntry('clock_out', techId, tech ? tech.name : techId, 'Removed from rotation');
  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Go on break. Position preserved. Session 39 Rule #5
 */
function goOnBreak(state, techId) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var techs = state.techs.map(function(t) {
    if (t.id !== techId) return t;
    return Object.assign({}, t, { status: 'break', preservedPosition: t.position, position: null });
  });
  techs = reindex(techs);
  var entry = logEntry('break_start', techId, tech ? tech.name : techId, 'Went on break (position preserved)');
  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Return from break. Re-enters at preserved position.
 * Session 39 Rule #6: Clock out + back in = bottom. Break return = preserved position.
 */
function returnFromBreak(state, techId, settings) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var preserved = tech ? tech.preservedPosition : null;
  var now = Date.now();

  var techs;
  if (settings.rotation_mode === 'first_available') {
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, { status: 'available', preservedPosition: null, lastFreeAt: now });
    });
  } else if (preserved != null) {
    techs = state.techs.map(function(t) {
      if (t.id === techId) return Object.assign({}, t, { status: 'available', position: preserved, preservedPosition: null, lastFreeAt: now });
      if (t.status === 'available' && t.position != null && t.position >= preserved) {
        return Object.assign({}, t, { position: t.position + 1 });
      }
      return t;
    });
  } else {
    var pos = nextPosition(state.techs);
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, { status: 'available', position: pos, preservedPosition: null, lastFreeAt: now });
    });
  }

  techs = reindex(techs);
  var entry = logEntry('break_end', techId, tech ? tech.name : techId, 'Returned from break');
  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Mark tech as busy (internal helper — no position logic, no qualifying check).
 * Used for calendar status toggles that aren't turn assignments.
 */
function markBusy(state, techId) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var techs = state.techs.map(function(t) {
    if (t.id !== techId) return t;
    return Object.assign({}, t, { status: 'busy', preservedPosition: t.position, position: null });
  });
  techs = reindex(techs);
  return { state: { techs: techs, turnLog: state.turnLog } };
}

/**
 * Mark tech as available again after completing a service.
 * Session 39: Position was already decided at assignment time.
 * - assignedQualifying === true  → return at bottom (next available position)
 * - assignedQualifying === false → return at preserved position
 * - assignedQualifying === null  → calendar status change (not a turn assignment), return at bottom
 */
function markAvailable(state, techId, settings) {
  var now = Date.now();
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var wasQualifying = tech ? tech.assignedQualifying : null;
  var preserved = tech ? tech.preservedPosition : null;

  var techs;

  if (settings.rotation_mode === 'fixed_order') {
    // Fixed order: always restore owner-defined order
    var fixedOrder = settings.fixed_turn_order || [];
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, { status: 'available', preservedPosition: null, lastFreeAt: now, assignedQualifying: null });
    });
    techs.forEach(function(t) {
      if (t.status === 'available') {
        var idx = fixedOrder.indexOf(t.id);
        t.position = idx >= 0 ? idx + 1 : 999;
      }
    });
  } else if (wasQualifying === false && preserved != null) {
    // Non-qualifying assignment: restore preserved position. Session 39 Rule #4
    techs = state.techs.map(function(t) {
      if (t.id === techId) {
        return Object.assign({}, t, { status: 'available', position: preserved, preservedPosition: null, lastFreeAt: now, assignedQualifying: null });
      }
      if (t.status === 'available' && t.position != null && t.position >= preserved) {
        return Object.assign({}, t, { position: t.position + 1 });
      }
      return t;
    });
  } else {
    // Qualifying assignment OR calendar status toggle (null) → go to bottom
    var pos = nextPosition(state.techs);
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, { status: 'available', position: pos, preservedPosition: null, lastFreeAt: now, assignedQualifying: null });
    });
  }

  techs = reindex(techs);
  return { state: { techs: techs, turnLog: state.turnLog } };
}

/**
 * Assign a walk-in or appointment to a tech.
 * Session 39 Rule #2: Top available tech gets the walk-in.
 * Session 39 Rule #3: Tech moves to bottom when ASSIGNED.
 * Session 39 Rule #4: Non-qualifying (below price minimum) → tech stays in position.
 * Session 39 Rule #8: Requested client — same price minimum rules apply.
 * Session 39 Rule #9: Scheduled appointment — same price minimum rules apply.
 *
 * appointment shape: { totalPriceCents, requested }
 * totalPriceCents = sum of selected service prices (known at assignment time).
 */
function assignWalkIn(state, techId, appointment, settings) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var isRequest = appointment && appointment.requested;
  var mode = settings.rotation_mode || 'round_robin';

  // Check qualifying at assignment time — we know the services/price
  var qualifies = isQualifyingService(appointment || { totalPriceCents: 0 }, settings);

  var techs;

  if (mode === 'round_robin') {
    if (qualifies) {
      // Session 39 Rule #3: Qualifying → clear preservedPosition so they return at bottom
      techs = state.techs.map(function(t) {
        if (t.id !== techId) return t;
        return Object.assign({}, t, {
          status: 'busy',
          position: null,
          preservedPosition: null,
          assignedQualifying: true,
        });
      });
    } else {
      // Session 39 Rule #4: Non-qualifying → preserve position for restoration
      techs = state.techs.map(function(t) {
        if (t.id !== techId) return t;
        return Object.assign({}, t, {
          status: 'busy',
          preservedPosition: t.position,
          position: null,
          assignedQualifying: false,
        });
      });
    }
  } else {
    // fewest_clients, fixed_order, first_available — just go busy
    techs = state.techs.map(function(t) {
      if (t.id !== techId) return t;
      return Object.assign({}, t, {
        status: 'busy',
        preservedPosition: t.position,
        position: null,
        assignedQualifying: qualifies,
      });
    });
  }

  techs = reindex(techs);

  var detail = isRequest
    ? 'Requested ' + (tech ? tech.name : techId) + (qualifies ? ' (qualifying)' : ' (non-qualifying)')
    : 'Assigned to ' + (tech ? tech.name : techId) + ' (turn rotation' + (qualifies ? ', qualifying' : ', non-qualifying') + ')';
  var eventType = isRequest ? 'walkin_request' : 'turn_assigned';
  var entry = logEntry(eventType, techId, tech ? tech.name : techId, detail);

  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Complete a service — increment daily count and log.
 * Session 39: Position is NOT changed here. It was already decided at assignment time.
 * The tech returns to available via markAvailable() which reads assignedQualifying.
 */
function completeService(state, techId, appointment, settings) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var qualifies = isQualifyingService(appointment, settings);

  // Increment daily service count (always, regardless of qualifying)
  var techs = state.techs.map(function(t) {
    if (t.id !== techId) return t;
    return Object.assign({}, t, {
      dailyServiceCount: (t.dailyServiceCount || 0) + 1,
    });
  });

  var detail = qualifies
    ? 'Qualifying service ($' + (appointment.totalPriceCents / 100).toFixed(2) + ')'
    : 'Non-qualifying service ($' + (appointment.totalPriceCents / 100).toFixed(2) + ') — position will be restored';
  var eventType = qualifies ? 'turn_earned' : 'non_qualifying';
  var entry = logEntry(eventType, techId, tech ? tech.name : techId, detail);

  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Decline/pass on a turn. Tech stays in position. Session 39 Rule #7
 */
function declineTurn(state, techId) {
  var tech = state.techs.find(function(t) { return t.id === techId; });
  var entry = logEntry('turn_declined', techId, tech ? tech.name : techId, 'Declined turn — position unchanged');
  return { state: { techs: state.techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Manual reorder by manager. Current day only. Session 39 Rule #10
 */
function manualReorder(state, newOrder, managerName) {
  var techs = state.techs.map(function(t) {
    if (t.status !== 'available') return t;
    var idx = newOrder.indexOf(t.id);
    return Object.assign({}, t, { position: idx >= 0 ? idx + 1 : 999 });
  });
  techs = reindex(techs);
  var entry = logEntry('manual_reorder', null, managerName || 'Manager', 'Turn order manually changed');
  return { state: { techs: techs, turnLog: state.turnLog.concat([entry]) } };
}

/**
 * Get the current "up next" tech based on rotation mode.
 * Session 39 Rule #15: Top of list = always next up.
 */
function getNextTech(state, settings) {
  var sorted = sortAvailable(state.techs, settings);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Get the full sorted available queue for display.
 */
function getAvailableQueue(state, settings) {
  return sortAvailable(state.techs, settings);
}

/**
 * Get busy techs for display.
 */
function getBusyTechs(state) {
  return state.techs.filter(function(t) { return t.status === 'busy'; });
}

/**
 * Get break techs for display.
 */
function getBreakTechs(state) {
  return state.techs.filter(function(t) { return t.status === 'break'; });
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

export {
  dailyReset,
  clockIn,
  clockOut,
  goOnBreak,
  returnFromBreak,
  markBusy,
  markAvailable,
  completeService,
  declineTurn,
  manualReorder,
  assignWalkIn,
  getNextTech,
  getAvailableQueue,
  getBusyTechs,
  getBreakTechs,
  isQualifyingService,
};
