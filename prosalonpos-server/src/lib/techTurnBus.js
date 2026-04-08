/**
 * techTurnBus.js — Lightweight event bus for tech turn actions
 * 
 * Problem: Tech turn state lives in CalendarDayView but App.jsx needs to
 * trigger markAvailable when a ticket closes (checkout or print & hold).
 * 
 * Solution: CalendarDayView registers its handler here on mount.
 * App.jsx calls techTurnBus.markAvailable(staffIds) on ticket close.
 * No Zustand store needed — just a shared callback reference.
 * 
 * Session 68c | Connection 1 + 2
 */

var _onMarkAvailable = null;  // set by CalendarDayView on mount
var _onMarkBusy = null;        // set by CalendarDayView on mount

function registerHandlers(onMarkAvailable, onMarkBusy) {
  _onMarkAvailable = onMarkAvailable;
  _onMarkBusy = onMarkBusy;
}

function markAvailable(staffIds) {
  if (_onMarkAvailable && staffIds && staffIds.length > 0) {
    _onMarkAvailable(staffIds);
  }
}

function markBusy(staffIds) {
  if (_onMarkBusy && staffIds && staffIds.length > 0) {
    _onMarkBusy(staffIds);
  }
}

export { registerHandlers, markAvailable, markBusy };
