/**
 * useCalendarHandlers.js — Calendar action handlers
 * Extracted from CalendarDayView.jsx (Session V18) to stay under 800-line cap.
 *
 * Handles: status changes, tech reassignment, add time/service,
 * booking save, copy/paste, waitlist, tech break/end break.
 */
import { STATUS_CONFIG } from './AppointmentDetailPopup';
import { timeToMinutes, minutesToTime, formatTimeFull, snapTo15, getGroup } from '../../lib/calendarHelpers';
import { SERVICE_PRICES } from './calendarBridge';
import * as TurnEngine from '../../lib/techTurnEngine';
import { ACTIONS } from '../../lib/rbac';

export default function useCalendarHandlers(ctx) {
  var rbac = ctx.rbac;
  var toast = ctx.toast;
  var STAFF = ctx.STAFF;
  var persist = ctx.persist;
  var _settings = ctx._settings;
  var serviceLines = ctx.serviceLines;
  var setServiceLines = ctx.setServiceLines;
  var setActivityLog = ctx.setActivityLog;
  var setTurnState = ctx.setTurnState;
  var setSelectedAppt = ctx.setSelectedAppt;
  var setBookingCtx = ctx.setBookingCtx;
  var setBookingConfirm = ctx.setBookingConfirm;
  var setBlockedTimes = ctx.setBlockedTimes;
  var setWaitlist = ctx.setWaitlist;
  var setVipCheckInAlert = ctx.setVipCheckInAlert;
  var copiedAppt = ctx.copiedAppt;
  var setCopiedAppt = ctx.setCopiedAppt;
  var setCtxMenu = ctx.setCtxMenu;
  var gridRef = ctx.gridRef;
  var visibleStaff = ctx.visibleStaff;
  var colW = ctx.colW;
  var gridStartMin = ctx.gridStartMin;
  var gridEndMin = ctx.gridEndMin;
  var turnState = ctx.turnState;
  var blockedTimes = ctx.blockedTimes;
  var isBlockedSlot = ctx.isBlockedSlot;
  var ROW_H = ctx.ROW_H;
  var onClockPunch = ctx.onClockPunch;
  var onPresencePunch = ctx.onPresencePunch;
  var _clockedInIds = ctx._clockedInIds;

  // ── Status / Tech / Service changes ──
  function handleStatusChange(sl, newStatus) {
    if (newStatus === 'cancelled' || newStatus === 'no_show') {
      rbac.requirePermission(ACTIONS.DELETE_CANCEL_APPOINTMENTS, function() {
        applyStatusChange(sl, newStatus);
      });
      return;
    }
    rbac.requirePermission(ACTIONS.CREATE_EDIT_APPOINTMENTS, function() {
      applyStatusChange(sl, newStatus);
    });
  }

  function applyStatusChange(sl, newStatus) {
    var oldLabel = (STATUS_CONFIG[sl.status] || {}).label || sl.status;
    var newLabel = (STATUS_CONFIG[newStatus] || {}).label || newStatus;
    // Snapshot for rollback before optimistic update
    var snapshot = serviceLines.slice();
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'status_change', client: sl.client, service: sl.service, techName: ((STAFF.find(function(s) { return s.id === sl.staff_id; })) || {}).display_name || '—', description: 'Status changed: ' + oldLabel + ' → ' + newLabel, requested: sl.requested, changedTech: false}].concat(prev); });
    setServiceLines(function(prev) { return prev.map(function(s) { return s.id !== sl.id ? s : Object.assign({}, s, {status: newStatus}); }); });
    persist.saveStatus(sl, newStatus).catch(function() { setServiceLines(snapshot); });
    setSelectedAppt(function(prev) { return prev && prev.id === sl.id ? Object.assign({}, prev, {status: newStatus}) : prev; });
    if (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'no_show') {
      setTurnState(function(prev) { return TurnEngine.markAvailable(prev, sl.staff_id, _settings).state; });
    } else if (newStatus === 'in_progress') {
      // Auto clock-in: if tech isn't clocked in yet, clock them in first (full protocol)
      // then mark busy. This ensures turn rotation stays correct.
      if (!_clockedInIds[sl.staff_id]) {
        var staffMember = STAFF.find(function(s) { return s.id === sl.staff_id; });
        if (staffMember) {
          var isHourly = staffMember.pay_type === 'hourly';
          if (isHourly) {
            // Hourly: clock punch (payroll) + presence record (turn system)
            if (onClockPunch) onClockPunch(sl.staff_id, 'in');
            if (onPresencePunch) onPresencePunch(sl.staff_id, 'in');
          } else {
            // Non-hourly: presence record only (turn system)
            if (onPresencePunch) onPresencePunch(sl.staff_id, 'in');
          }
          // Immediately add to turn state via clockIn so markBusy has a target.
          // The useEffect in CalendarDayView will also fire when _clockedInIds updates,
          // but we do it here synchronously so the markBusy below doesn't miss.
          setTurnState(function(prev) {
            var s = TurnEngine.clockIn(prev, sl.staff_id, staffMember.display_name || staffMember.name || '').state;
            return TurnEngine.markBusy(s, sl.staff_id).state;
          });
        } else {
          setTurnState(function(prev) { return TurnEngine.markBusy(prev, sl.staff_id).state; });
        }
      } else {
        setTurnState(function(prev) { return TurnEngine.markBusy(prev, sl.staff_id).state; });
      }
    }
  }

  function handleChangeTech(serviceLineIds, newStaffId, timing, remainingOnSource) {
    rbac.requirePermission(ACTIONS.MOVE_APPOINTMENTS, function() {
      // Snapshot for rollback before optimistic update
      var snapshot = serviceLines.slice();
      var newStaff = STAFF.find(function(s) { return s.id === newStaffId; });
      serviceLineIds.forEach(function(slId) {
        var sl = serviceLines.find(function(s) { return s.id === slId; }); if (!sl) return;
        var oldStaff = STAFF.find(function(s) { return s.id === sl.staff_id; });
        setActivityLog(function(prev) { return [{id: Date.now() + Math.random(), timestamp: new Date(), action: 'tech_change', client: sl.client, service: sl.service, techName: (newStaff || {}).display_name || '—', description: 'Reassigned from ' + ((oldStaff || {}).display_name || '—') + ' to ' + ((newStaff || {}).display_name || '—') + ' (' + (timing || 'sequential') + ')', requested: sl.requested, changedTech: true}].concat(prev); });
      });
      setServiceLines(function(prev) {
        var updated = prev.map(function(s) { return s; });
        var movedLines = updated.filter(function(s) { return serviceLineIds.includes(s.id); }).sort(function(a, b) { return a.starts_at - b.starts_at; });
        if (movedLines.length === 0) return updated;
        var clientName = movedLines[0].client;
        var allClientLines = updated.filter(function(s) { return s.client === clientName; }).sort(function(a, b) { return a.starts_at - b.starts_at; });
        var apptStartTime = allClientLines[0].starts_at;
        var sourceStaffId = movedLines[0].staff_id;
        var remainIds = (remainingOnSource || []).map(function(r) { return r.id; });
        var remainOnSrc = updated.filter(function(s) { return s.client === clientName && s.staff_id === sourceStaffId && !serviceLineIds.includes(s.id); }).sort(function(a, b) { return a.starts_at - b.starts_at; });
        var runTime = apptStartTime.getTime();
        remainOnSrc.forEach(function(rl) {
          var idx = updated.findIndex(function(s) { return s.id === rl.id; });
          if (idx >= 0) {
            updated[idx] = Object.assign({}, updated[idx], {starts_at: new Date(runTime)});
            runTime += updated[idx].dur * 60000;
          }
        });
        var destStartMs;
        if (timing === 'same_time' || !remainOnSrc.length) {
          destStartMs = apptStartTime.getTime();
        } else {
          destStartMs = runTime;
        }
        movedLines.forEach(function(ml) {
          var idx = updated.findIndex(function(s) { return s.id === ml.id; });
          if (idx >= 0) {
            updated[idx] = Object.assign({}, updated[idx], {staff_id: newStaffId, starts_at: new Date(destStartMs)});
            destStartMs += updated[idx].dur * 60000;
          }
        });
        return updated;
      });
      setSelectedAppt(function(prev) { if (!prev || !serviceLineIds.includes(prev.id)) return prev; return Object.assign({}, prev, {staff_id: newStaffId}); });
      var movePromises = serviceLineIds.map(function(slId) { return persist.saveMove(slId, {staff_id: newStaffId}); });
      Promise.all(movePromises).catch(function() { setServiceLines(snapshot); });
    });
  }

  function handleAddTime(sl, extraMinutes) {
    var snapshot = serviceLines.slice();
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'add_time', client: sl.client, service: sl.service, techName: ((STAFF.find(function(s) { return s.id === sl.staff_id; })) || {}).display_name || '—', description: 'Added ' + extraMinutes + ' min extra time (' + sl.dur + ' → ' + (sl.dur + extraMinutes) + ' min)', requested: sl.requested, changedTech: false}].concat(prev); });
    setServiceLines(function(prev) { return prev.map(function(s) { return s.id !== sl.id ? s : Object.assign({}, s, {dur: s.dur + extraMinutes}); }); });
    persist.saveAddTime(sl, sl.dur + extraMinutes).catch(function() { setServiceLines(snapshot); });
    setSelectedAppt(function(prev) { return prev && prev.id === sl.id ? Object.assign({}, prev, {dur: prev.dur + extraMinutes}) : prev; });
  }

  function handleAddService(sl, svc) {
    var snapshot = serviceLines.slice();
    var clientLines = serviceLines.filter(function(s) { return s.client === sl.client && s.staff_id === sl.staff_id; }).sort(function(a, b) { return a.starts_at - b.starts_at; });
    var lastLine = clientLines[clientLines.length - 1] || sl;
    var newStart = new Date(lastLine.starts_at.getTime() + lastLine.dur * 60000);
    var newId = 'sl-new-' + Date.now();
    var newLine = {id: newId, staff_id: sl.staff_id, starts_at: newStart, dur: svc.dur, color: svc.color, client: sl.client, service: svc.name, status: sl.status, requested: sl.requested, price_cents: svc.price, open_price: !!svc.open_price};
    setServiceLines(function(prev) { return prev.concat([newLine]); });
    persist.saveBooking([newLine], sl.client, sl.client_id).catch(function() { setServiceLines(snapshot); });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'add_service', client: sl.client, service: svc.name, techName: ((STAFF.find(function(s) { return s.id === sl.staff_id; })) || {}).display_name || '—', description: 'Added ' + svc.name + ' (' + svc.dur + ' min) at ' + formatTimeFull(newStart), requested: sl.requested, changedTech: false}].concat(prev); });
  }

  // ── Booking flow ──
  function handleBookingSave(data) {
    var services = data.services;
    var startHour = data.startHour;
    var sMin = data.startMin;
    // Block Time
    if (services[0] && services[0].name === 'Blocked') {
      var svc = services[0]; var bStartMin = startHour * 60 + sMin;
      setBlockedTimes(function(prev) { return prev.concat([{id: 'blk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), staff_id: svc.techId, startMin: bStartMin, endMin: bStartMin + svc.dur, starts_at: minutesToTime(bStartMin), dur: svc.dur}]); });
      setBookingCtx(null); return;
    }
    // Regular booking
    var byClient = {}; var clientOrder = [];
    services.forEach(function(svc) {
      var key = svc.clientName + '__' + svc.techId;
      if (!byClient[key]) { byClient[key] = {clientName: svc.clientName, techId: svc.techId, requested: svc.requested, timing: svc.timing, note: svc.note || '', svcs: []}; clientOrder.push(key); }
      byClient[key].svcs.push(svc);
    });
    var newLines = [];
    var bookingId = 'bk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    var prevClientTechEnd = {};
    var blocked = false;
    clientOrder.forEach(function(key) {
      var group = byClient[key];
      var runMin;
      if (group.timing === 'sequential') {
        runMin = prevClientTechEnd[group.clientName] || startHour * 60 + sMin;
      } else {
        runMin = startHour * 60 + sMin;
      }
      group.svcs.forEach(function(svc, i) {
        var endMin = runMin + svc.dur;
        if (isBlockedSlot(svc.techId, runMin, endMin)) blocked = true;
        var start = minutesToTime(runMin);
        newLines.push({id: 'sl-book-' + Date.now() + '-' + group.techId + '-' + i + '-' + Math.random().toString(36).slice(2, 6), staff_id: svc.techId, starts_at: start, dur: svc.dur, color: svc.color, client: svc.clientName, service: svc.name, status: 'pending', requested: !!svc.requested, price_cents: svc.price || 0, open_price: !!svc.open_price, note: group.note || '', bookingId: bookingId});
        runMin += svc.dur;
      });
      if (!prevClientTechEnd[group.clientName] || runMin > prevClientTechEnd[group.clientName]) {
        prevClientTechEnd[group.clientName] = runMin;
      }
    });
    if (blocked) { setBookingCtx(null); toast.show('This time slot is blocked. Choose a different time.', 'error'); return; }
    var snapshot = serviceLines.slice();
    setServiceLines(function(prev) { return prev.concat(newLines); });
    persist.saveBooking(newLines).catch(function() { setServiceLines(snapshot); });
    var clients = []; services.forEach(function(s) { if (clients.indexOf(s.clientName) === -1) clients.push(s.clientName); });
    var anyRequested = services.some(function(s) { return s.requested; });
    var logDetails = [];
    clientOrder.forEach(function(key) {
      var group = byClient[key];
      var techObj = STAFF.find(function(s) { return s.id === group.techId; });
      logDetails.push({client: group.clientName, tech: techObj ? techObj.display_name : '—', services: group.svcs.map(function(s) { return {name: s.name, dur: s.dur}; })});
    });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'booked', client: clients.join(', '), service: services.map(function(s) { return s.name; }).join(', '), description: 'New ' + services.length + '-service booking for ' + clients.length + ' client' + (clients.length > 1 ? 's' : '') + ' at ' + formatTimeFull(minutesToTime(startHour * 60 + sMin)), requested: anyRequested, changedTech: false, details: logDetails}].concat(prev); });
    setBookingCtx(null);
    if (services[0] && services[0].name !== 'Reserved') {
      var techNames = []; services.forEach(function(s) { var st = STAFF.find(function(x) { return x.id === s.techId; }); var tn = st ? st.display_name : '?'; if (techNames.indexOf(tn) === -1) techNames.push(tn); });
      setBookingConfirm({clients: clients, services: services.map(function(s) { return {name: s.name, dur: s.dur, price: s.price || 0}; }), techs: techNames, time: formatTimeFull(minutesToTime(startHour * 60 + sMin))});
      setTimeout(function() { setBookingConfirm(null); }, 5000);
    }
  }

  function handleBookingCancel() { setBookingCtx(null); }

  // ── Copy / Paste ──
  function handleContextMenu(e) {
    e.preventDefault();
    if (!gridRef.current) return;
    var rect = gridRef.current.getBoundingClientRect();
    var scrollTop = gridRef.current.scrollTop;
    var scrollLeft = gridRef.current.scrollLeft;
    var relY = e.clientY - rect.top + scrollTop;
    var relX = e.clientX - rect.left + scrollLeft;
    if (relX < 0 || relY < 0) return;
    var staffIdx = Math.max(0, Math.min(visibleStaff.length - 1, Math.floor(relX / colW)));
    var startMin = snapTo15(gridStartMin + (relY / ROW_H) * 15);
    var staffId = visibleStaff[staffIdx] ? visibleStaff[staffIdx].id : null;
    if (!staffId) return;
    var target = e.target;
    var blockEl = target.closest('[data-block="1"]');
    if (blockEl) {
      var slId = blockEl.getAttribute('data-sl-id');
      var sl = slId ? serviceLines.find(function(s) { return s.id === slId; }) : null;
      if (!sl) {
        sl = serviceLines.find(function(s) {
          var slStart = timeToMinutes(s.starts_at);
          return s.staff_id === staffId && startMin >= slStart && startMin < slStart + s.dur;
        });
      }
      if (sl) setCtxMenu({x: e.clientX, y: e.clientY, type: 'copy', sl: sl});
      return;
    }
    if (copiedAppt) setCtxMenu({x: e.clientX, y: e.clientY, type: 'paste', staffId: staffId, startMin: startMin});
  }

  function handleCopyAppt(sl) {
    setCopiedAppt({
      client: sl.client, client_id: sl.client_id || null, service: sl.service,
      dur: sl.dur, color: sl.color, price_cents: sl.price_cents || 0,
      open_price: sl.open_price || false, requested: sl.requested || false,
    });
    setCtxMenu(null);
  }

  function handlePasteAppt(staffId, startMin) {
    if (!copiedAppt) return;
    var snapshot = serviceLines.slice();
    var newLine = {
      id: 'sl-paste-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      staff_id: staffId, starts_at: minutesToTime(startMin), dur: copiedAppt.dur,
      color: copiedAppt.color, client: copiedAppt.client, client_id: copiedAppt.client_id,
      service: copiedAppt.service, status: 'pending', requested: copiedAppt.requested,
      price_cents: copiedAppt.price_cents, open_price: copiedAppt.open_price,
    };
    setServiceLines(function(prev) { return prev.concat([newLine]); });
    persist.saveBooking([newLine], copiedAppt.client, copiedAppt.client_id).catch(function() { setServiceLines(snapshot); });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'booked', client: copiedAppt.client, service: copiedAppt.service, description: 'Copied appointment pasted for ' + copiedAppt.client + ' at ' + formatTimeFull(minutesToTime(startMin)), requested: copiedAppt.requested, changedTech: false}].concat(prev); });
    setCtxMenu(null);
  }

  // ── Waitlist ──
  function handleWaitlistStart(entry, tech) {
    var nowMin = timeToMinutes(new Date());
    var snappedMin = Math.max(gridStartMin, Math.min(gridEndMin - 15, snapTo15(nowMin)));
    var snappedTime = minutesToTime(snappedMin);
    var snapshot = serviceLines.slice();
    var existing = serviceLines.find(function(sl) { return sl.client === entry.client && sl.service === entry.service && (sl.status === 'pending' || sl.status === 'confirmed' || sl.status === 'checked_in'); });
    if (existing) {
      setServiceLines(function(prev) { return prev.map(function(sl) { if (sl.id !== existing.id) return sl; return Object.assign({}, sl, {staff_id: tech.id, status: 'in_progress', starts_at: snappedTime}); }); });
      Promise.all([
        persist.saveMove(existing.id, {staff_id: tech.id, starts_at: snappedTime}),
        persist.saveStatus(existing, 'in_progress')
      ]).catch(function() { setServiceLines(snapshot); });
      setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'start_working', client: entry.client, service: entry.service, description: 'Started working with ' + tech.display_name + ' (updated existing appointment)', requested: !!entry.requested, changedTech: existing.staff_id !== tech.id}].concat(prev); });
    } else {
      var color = {'Blowout': '#EC4899', "Women's Cut": '#EF4444', 'Beard Trim': '#78716C', 'Full Color': '#8B5CF6', 'Manicure': '#06B6D4', 'Facial': '#10B981'}[entry.service] || '#3B82F6';
      var dur = {Blowout: 30, "Women's Cut": 45, 'Beard Trim': 15, 'Full Color': 90, 'Manicure': 30, 'Facial': 60}[entry.service] || 30;
      var newSl = {id: 'sl-wl-' + Date.now(), staff_id: tech.id, starts_at: snappedTime, dur: dur, color: color, client: entry.client, service: entry.service, status: 'in_progress', requested: !!entry.requested, price_cents: SERVICE_PRICES[entry.service] || 0, is_vip: !!entry.is_vip};
      setServiceLines(function(prev) { return prev.concat([newSl]); });
      persist.saveBooking([newSl], entry.client).catch(function() { setServiceLines(snapshot); });
      setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'start_working', client: entry.client, service: entry.service, description: 'Started working with ' + tech.display_name + ' (walk-in)', requested: !!entry.requested, changedTech: false}].concat(prev); });
    }
    setWaitlist(function(prev) { return prev.filter(function(w) { return w.id !== entry.id; }); });
    setTurnState(function(prev) { return TurnEngine.markBusy(prev, tech.id).state; });
    setTimeout(function() { if (gridRef.current) { var blockY = ((snappedMin - gridStartMin) / 15) * ROW_H; gridRef.current.scrollTop = Math.max(0, blockY - 150); } }, 50);
  }

  function handleWaitlistRemove(entry) {
    setWaitlist(function(prev) { return prev.filter(function(w) { return w.id !== entry.id; }); });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'waitlist_remove', client: entry.client, service: entry.service, description: 'Removed from waitlist', requested: false, changedTech: false}].concat(prev); });
  }

  function handleCheckIn(entry) {
    setWaitlist(function(prev) { return prev.concat([entry]); });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'check_in', client: entry.client, service: entry.service, description: 'Checked in (' + (entry.walk_in ? 'walk-in' : 'appointment') + ')' + (entry.requested ? ' — requested ' + entry.requested : ''), requested: !!entry.requested, changedTech: false}].concat(prev); });
    if (entry.is_vip) {
      setVipCheckInAlert({client: entry.client, service: entry.service, requested: entry.requested || null});
    }
  }

  // ── Check-In Save (from BookingFlow in check-in mode → waitlist only) ──
  function handleCheckInSave(data) {
    var services = data.services;
    if (!services || services.length === 0) { setBookingCtx(null); return; }
    // Build client name and service list from booking data
    var clientName = services[0].clientName || 'Walk-in';
    var serviceNames = [];
    services.forEach(function(s) { if (serviceNames.indexOf(s.name) === -1) serviceNames.push(s.name); });
    var serviceSummary = serviceNames.join(', ');
    // Find requested tech name if any service was marked requested
    var requestedTechName = null;
    var anyRequested = services.some(function(s) { return s.requested; });
    if (anyRequested) {
      var techObj = STAFF.find(function(s) { return s.id === services[0].techId; });
      if (techObj) requestedTechName = techObj.display_name;
    }
    var isWalkIn = clientName === 'Walk-in';
    // If matched appointment service lines, mark them as checked_in on the calendar
    if (data.matchedSlIds && data.matchedSlIds.length > 0) {
      setServiceLines(function(prev) {
        return prev.map(function(sl) {
          if (data.matchedSlIds.indexOf(sl.id) >= 0) {
            return Object.assign({}, sl, { status: 'checked_in' });
          }
          return sl;
        });
      });
      isWalkIn = false;
    }
    var entry = {
      id: 'w-' + Date.now(),
      client: clientName,
      service: serviceSummary,
      walk_in: isWalkIn,
      requested: requestedTechName,
      checked_in_at: Date.now(),
    };
    handleCheckIn(entry);
    setBookingCtx(null);
  }

  // ── Tech Turn: Break / End Break ──
  function handleTechBreak(techId) {
    var tech = turnState.techs.find(function(t) { return t.id === techId; });
    setTurnState(function(prev) { return TurnEngine.goOnBreak(prev, techId).state; });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'break', client: '—', service: '—', description: ((tech || {}).name || 'Tech') + ' went on break', requested: false, changedTech: false}].concat(prev); });
  }

  function handleTechEndBreak(techId) {
    var tech = turnState.techs.find(function(t) { return t.id === techId; });
    setTurnState(function(prev) { return TurnEngine.returnFromBreak(prev, techId, _settings).state; });
    setActivityLog(function(prev) { return [{id: Date.now(), timestamp: new Date(), action: 'end_break', client: '—', service: '—', description: ((tech || {}).name || 'Tech') + ' returned from break', requested: false, changedTech: false}].concat(prev); });
  }

  return {
    handleStatusChange: handleStatusChange,
    handleChangeTech: handleChangeTech,
    handleAddTime: handleAddTime,
    handleAddService: handleAddService,
    handleBookingSave: handleBookingSave,
    handleBookingCancel: handleBookingCancel,
    handleContextMenu: handleContextMenu,
    handleCopyAppt: handleCopyAppt,
    handlePasteAppt: handlePasteAppt,
    handleWaitlistStart: handleWaitlistStart,
    handleWaitlistRemove: handleWaitlistRemove,
    handleCheckIn: handleCheckIn,
    handleCheckInSave: handleCheckInSave,
    handleTechBreak: handleTechBreak,
    handleTechEndBreak: handleTechEndBreak,
  };
}
