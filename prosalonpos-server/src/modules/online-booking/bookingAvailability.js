/** Pro Salon POS — Online Booking Availability Helpers (extracted Session 21)
 * Date list builder, time slot calculator, overlap logic.
 * Settings passed as parameter; falls back to settingsStore.
 * Session 48: Wired to stores — replaces direct MOCK_SALON_SETTINGS + INITIAL_SERVICE_LINES imports.
 */
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useAppointmentStore } from '../../lib/stores/appointmentStore';

// Fallback getters — these are called lazily (not at module scope) to get store data
function _getSettings() { return useSettingsStore.getState().settings || {}; }
function _getServiceLines() { return useAppointmentStore.getState().serviceLines || []; }

var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
var OVERLAP_ALLOWANCE = 15;
var MAX_ADVANCE_DAYS = 30;
var MIN_LEAD_HOURS = 0;

export function buildDateList(ss) {
  var s = ss || _getSettings();
  var maxDays = s.online_max_advance_days || MAX_ADVANCE_DAYS;
  var bh = s.business_hours;
  var dates = [];
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  for (var i = 0; i < maxDays && dates.length < 60; i++) {
    var check = new Date(d);
    check.setDate(check.getDate() + i);
    var dayKey = DAY_KEYS[check.getDay()];
    if (bh[dayKey] && bh[dayKey].open) {
      dates.push({ date: new Date(check), dayKey: dayKey, isToday: i === 0 });
    }
  }
  return dates;
}

export function formatSlotTime(min) {
  var h = Math.floor(min / 60);
  var m = min % 60;
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

export function getAvailableSlots(dateObj, totalDuration, requestedTechId, noTechPref, groupMembers, autoRequestMode, onlineTechs, ss) {
  var s = ss || _getSettings();
  var dayKey = DAY_KEYS[dateObj.getDay()];
  var bh = s.business_hours[dayKey];
  if (!bh || !bh.open) return [];

  var increment = s.booking_increment_minutes || 15;
  var minLeadHours = s.online_min_lead_hours || MIN_LEAD_HOURS;

  var now = new Date();
  var isToday = dateObj.toDateString() === now.toDateString();

  var apptsByTech = {};
  onlineTechs.forEach(function (tech) { apptsByTech[tech.id] = []; });

  if (isToday) {
    var _svcLines = _getServiceLines();
    _svcLines.forEach(function (sl) {
      if (!apptsByTech[sl.staff_id]) return;
      if (!autoRequestMode && !sl.requested) return;
      var startMin = sl.starts_at.getHours() * 60 + sl.starts_at.getMinutes();
      apptsByTech[sl.staff_id].push({ start: startMin, end: startMin + sl.dur });
    });
  }

  var isGroup = groupMembers && groupMembers.length > 0;
  var memberNeeds = [];
  if (isGroup) {
    groupMembers.forEach(function (m) {
      var dur = (m.services || []).reduce(function (s, svc) { return s + svc.default_duration_minutes; }, 0);
      memberNeeds.push({ techId: m.tech ? m.tech.id : null, duration: dur });
    });
  }

  var earliestMin = bh.start;
  if (isToday && minLeadHours > 0) {
    var leadMin = now.getHours() * 60 + now.getMinutes() + (minLeadHours * 60);
    leadMin = Math.ceil(leadMin / increment) * increment;
    if (leadMin > earliestMin) earliestMin = leadMin;
  }
  if (isToday) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var roundedNow = Math.ceil(nowMin / increment) * increment;
    if (roundedNow > earliestMin) earliestMin = roundedNow;
  }

  var slots = [];
  for (var slotStart = earliestMin; slotStart <= bh.end - increment; slotStart += increment) {
    if (isGroup) {
      if (checkGroupSlot(slotStart, memberNeeds, apptsByTech, onlineTechs)) {
        slots.push({ time: slotStart, label: formatSlotTime(slotStart) });
      }
    } else {
      if (requestedTechId) {
        if (techHasRoom(requestedTechId, slotStart, totalDuration, apptsByTech)) {
          slots.push({ time: slotStart, label: formatSlotTime(slotStart) });
        }
      } else {
        var anyFree = onlineTechs.some(function (tech) {
          return techHasRoom(tech.id, slotStart, totalDuration, apptsByTech);
        });
        if (anyFree) {
          slots.push({ time: slotStart, label: formatSlotTime(slotStart) });
        }
      }
    }
  }
  return slots;
}

export function techHasRoom(techId, slotStart, duration, apptsByTech) {
  var slotEnd = slotStart + duration;
  var appts = apptsByTech[techId] || [];
  for (var i = 0; i < appts.length; i++) {
    var a = appts[i];
    if (slotStart < a.end && slotEnd > a.start) {
      var overlapIntoNext = slotEnd - a.start;
      if (slotStart >= a.start && slotStart < a.end) return false;
      if (overlapIntoNext > 0 && overlapIntoNext <= OVERLAP_ALLOWANCE) continue;
      return false;
    }
  }
  return true;
}

function checkGroupSlot(slotStart, memberNeeds, apptsByTech, onlineTechs) {
  var claimedTechs = {};
  // First pass: check all members who requested a specific tech
  for (var i = 0; i < memberNeeds.length; i++) {
    var m = memberNeeds[i];
    if (m.techId) {
      if (!techHasRoom(m.techId, slotStart, m.duration, apptsByTech)) return false;
      claimedTechs[m.techId] = true;
    }
  }
  // Second pass: greedily assign unassigned members (longest duration first) to free techs
  var unassigned = memberNeeds.filter(function (m) { return !m.techId; })
    .sort(function (a, b) { return b.duration - a.duration; });
  if (unassigned.length > 0) {
    var availTechIds = onlineTechs.filter(function (tech) { return !claimedTechs[tech.id]; }).map(function (t) { return t.id; });
    for (var j = 0; j < unassigned.length; j++) {
      var found = false;
      for (var k = 0; k < availTechIds.length; k++) {
        if (techHasRoom(availTechIds[k], slotStart, unassigned[j].duration, apptsByTech)) {
          claimedTechs[availTechIds[k]] = true;
          availTechIds.splice(k, 1);
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
  }
  return true;
}
