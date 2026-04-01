/**
 * useCalendarDrag.js — Drag-and-Drop Hook for Calendar Grid
 * Session 47 | Extracted from CalendarDayView.jsx to stay under 800-line limit.
 *
 * Handles:
 * - Block dragging (grab appointment block, move to new time/tech column)
 * - Empty slot clicks (start new booking)
 * - Drag preview (ghost block showing where it'll land)
 * - Auto-scroll when dragging near edges
 * - Move confirmation (single + group booking moves)
 * - Group booking awareness (prompt: move all clients or just this one?)
 *
 * Returns all drag state + handlers that CalendarDayView renders.
 */

import { useState, useEffect, useRef } from 'react';
import { timeToMinutes, minutesToTime, formatTimeFull, snapTo15, getGroup, ROW_H } from '../../lib/calendarHelpers';
import { useRBAC } from '../../lib/RBACContext';
import { useToast } from '../../lib/ToastContext';
import { ACTIONS } from '../../lib/rbac';

export default function useCalendarDrag({
  serviceLines, setServiceLines,
  gridRef, gridContainerRef, headerRef,
  gridStartMin, colW, visibleStaff,
  setSelectedAppt, setActivityLog,
  blockedTimes, isBlockedSlot,
  setBookingCtx,
  STAFF,
}) {
  var rbac = useRBAC();
  var toast = useToast();

  // ─── Drag state ───
  const [dragging, setDragging] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [pendingGroupMove, setPendingGroupMove] = useState(null);
  const dragStartRef = useRef(null);
  const emptySlotRef = useRef(null);
  const autoScrollRef = useRef(null);

  // ─── Block drag start ───
  function handleBlockStart(cx, cy, sl) {
    const scrollTop = gridRef.current ? gridRef.current.scrollTop : 0;
    const gridRect = gridRef.current ? gridRef.current.getBoundingClientRect() : { top: 0 };
    const relY = cy - gridRect.top + scrollTop;
    const slStartMin = timeToMinutes(sl.starts_at);
    const blockTopPx = ((slStartMin - gridStartMin) / 15) * ROW_H;
    const grabOffsetPx = relY - blockTopPx;
    const group = getGroup(sl.id, serviceLines);
    const groupDur = group.reduce((sum, s) => sum + s.dur, 0);
    dragStartRef.current = { x: cx, y: cy, hasMoved: false, sl, grabOffsetPx };
    setDragging({ slId: sl.id, groupIds: group.map(s => s.id), groupDur, startY: cy, startScrollTop: scrollTop, origStaffId: sl.staff_id, origStartMin: slStartMin });
  }

  // ─── Drag move ───
  var DRAG_THRESHOLD = 5;
  function handleDragMove(cx, cy) {
    if (!dragging || !gridRef.current || !gridContainerRef.current) return;
    if (dragStartRef.current && !dragStartRef.current.hasMoved) {
      if (Math.abs(cx - dragStartRef.current.x) < DRAG_THRESHOLD && Math.abs(cy - dragStartRef.current.y) < DRAG_THRESHOLD) return;
      dragStartRef.current.hasMoved = true;
    }
    const gridRect = gridRef.current.getBoundingClientRect();
    const scrollTop = gridRef.current.scrollTop;
    const scrollLeft = gridRef.current.scrollLeft;
    const grabOffset = dragStartRef.current ? dragStartRef.current.grabOffsetPx : 0;
    const relY = cy - gridRect.top + scrollTop - grabOffset;
    const relX = cx - gridRect.left + scrollLeft;
    const snappedMin = snapTo15(gridStartMin + (relY / ROW_H) * 15);
    let staffIdx = Math.floor(relX / colW);
    staffIdx = Math.max(0, Math.min(visibleStaff.length - 1, staffIdx));
    setDragPreview({ staffIdx, startMin: snappedMin });

    // ── Auto-scroll edges ──
    const EDGE = 60;
    const MAX_SPEED = 18;
    const localX = cx - gridRect.left;
    const localY = cy - gridRect.top;
    let scrollDx = 0, scrollDy = 0;
    if (localX < EDGE) scrollDx = -MAX_SPEED * ((EDGE - localX) / EDGE);
    else if (localX > gridRect.width - EDGE) scrollDx = MAX_SPEED * ((localX - (gridRect.width - EDGE)) / EDGE);
    if (localY < EDGE) scrollDy = -MAX_SPEED * ((EDGE - localY) / EDGE);
    else if (localY > gridRect.height - EDGE) scrollDy = MAX_SPEED * ((localY - (gridRect.height - EDGE)) / EDGE);

    if (scrollDx !== 0 || scrollDy !== 0) {
      if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null; }
      autoScrollRef.current = setInterval(() => {
        if (gridRef.current) {
          gridRef.current.scrollLeft += scrollDx;
          gridRef.current.scrollTop += scrollDy;
          if (headerRef.current) headerRef.current.scrollLeft = gridRef.current.scrollLeft;
        }
      }, 16);
    } else {
      if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null; }
    }
  }

  // ─── Drag end ───
  function handleDragEnd() {
    if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null; }
    if (dragStartRef.current && !dragStartRef.current.hasMoved && dragStartRef.current.sl) {
      const slId = dragStartRef.current.sl.id;
      const currentSl = serviceLines.find(s => s.id === slId) || dragStartRef.current.sl;
      setSelectedAppt(currentSl);
      dragStartRef.current = null;
      setDragging(null); setDragPreview(null);
      return;
    }
    dragStartRef.current = null;
    if (!dragging || !dragPreview) { setDragging(null); setDragPreview(null); return; }
    const sl = serviceLines.find(s => s.id === dragging.slId);
    if (!sl) { setDragging(null); setDragPreview(null); return; }
    const newStaffId = visibleStaff[dragPreview.staffIdx]?.id;
    const newStartMin = dragPreview.startMin;
    if (newStaffId === sl.staff_id && newStartMin === timeToMinutes(sl.starts_at)) {
      setDragging(null); setDragPreview(null); return;
    }
    const origMin = dragging.origStartMin;
    const timeChanged = newStartMin !== origMin;
    if (timeChanged && sl.bookingId) {
      const groupMembers = serviceLines.filter(s => s.bookingId === sl.bookingId && s.id !== sl.id);
      const otherClients = groupMembers.filter(s => s.client !== sl.client);
      if (otherClients.length > 0) {
        setPendingGroupMove({ sl, newStaffId, newStartMin, timeDelta: newStartMin - origMin });
        setDragging(null); setDragPreview(null); return;
      }
    }
    setPendingMove({ sl, newStaffId, newStartMin });
    setDragging(null); setDragPreview(null);
  }

  // ─── Empty slot click ───
  function handleSlotStart(cx, cy, target, container) {
    let el = target;
    while (el && el !== container) { if (el.dataset && el.dataset.block) return; el = el.parentElement; }
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const relY = cy - rect.top + gridRef.current.scrollTop;
    const relX = cx - rect.left + gridRef.current.scrollLeft;
    if (relX < 0) return;
    let staffIdx = Math.floor(relX / colW);
    staffIdx = Math.max(0, Math.min(visibleStaff.length - 1, staffIdx));
    const staff = visibleStaff[staffIdx];
    if (staff) emptySlotRef.current = { x: cx, y: cy, staffId: staff.id, startMin: snapTo15(gridStartMin + (relY / ROW_H) * 15) };
  }
  function handleSlotEnd(cx, cy) {
    if (!emptySlotRef.current) return;
    const { x, y, staffId, startMin } = emptySlotRef.current;
    emptySlotRef.current = null;
    if (Math.abs(cx - x) > 5 || Math.abs(cy - y) > 5) return;
    rbac.requirePermission(ACTIONS.CREATE_EDIT_APPOINTMENTS, function () {
      setBookingCtx({ staffId, startMin });
    });
  }

  // ─── Confirm single move ───
  function confirmMove() {
    if (!pendingMove) return;
    rbac.requirePermission(ACTIONS.MOVE_APPOINTMENTS, function () {
      const { sl, newStaffId, newStartMin } = pendingMove;
      const group = getGroup(sl.id, serviceLines);
      const groupDur = group.reduce(function (s, g) { return s + g.dur; }, 0);
      if (isBlockedSlot(newStaffId, newStartMin, newStartMin + groupDur)) { setPendingMove(null); toast.show('Cannot move here — this time is blocked.', 'error'); return; }
      const groupIds = group.map(s => s.id);
      const delta = newStartMin - timeToMinutes(sl.starts_at);
      const oldStaff = STAFF.find(s => s.id === sl.staff_id);
      const newStaff = STAFF.find(s => s.id === newStaffId);
      const oldTime = formatTimeFull(sl.starts_at);
      const newTime = formatTimeFull(minutesToTime(newStartMin));
      const changedTech = newStaffId !== sl.staff_id;
      const changedTime = delta !== 0;
      let description = '';
      if (changedTech && changedTime) description = `Moved from ${oldStaff?.display_name} at ${oldTime} to ${newStaff?.display_name} at ${newTime}`;
      else if (changedTech) description = `Reassigned from ${oldStaff?.display_name} to ${newStaff?.display_name}`;
      else description = `Rescheduled from ${oldTime} to ${newTime}`;
      if (group.length > 1) description += ` (${group.length} services)`;
      setActivityLog(prev => [{ id: Date.now(), timestamp: new Date(), action: 'moved', client: sl.client, service: sl.service, description, requested: sl.requested, changedTech }, ...prev]);
      setServiceLines(prev => prev.map(s => {
        if (!groupIds.includes(s.id)) return s;
        const oldMin = timeToMinutes(s.starts_at);
        return { ...s, staff_id: newStaffId, starts_at: minutesToTime(oldMin + delta) };
      }));
      setPendingMove(null);
    });
  }
  function cancelMove() { setPendingMove(null); }

  // ─── Group booking move ───
  function confirmGroupMoveAll() {
    if (!pendingGroupMove) return;
    rbac.requirePermission(ACTIONS.MOVE_APPOINTMENTS, function () {
      const { sl, newStaffId, newStartMin } = pendingGroupMove;
      const bkId = sl.bookingId;
      const allGroupLines = serviceLines.filter(s => s.bookingId === bkId);
      const dragGroup = getGroup(sl.id, serviceLines);
      const dragGroupIds = new Set(dragGroup.map(s => s.id));

      const chains = {};
      allGroupLines.forEach(s => {
        const key = s.client + '__' + s.staff_id;
        if (!chains[key]) chains[key] = [];
        chains[key].push(s);
      });
      Object.values(chains).forEach(arr => arr.sort((a, b) => timeToMinutes(a.starts_at) - timeToMinutes(b.starts_at)));

      const newTimes = {};
      Object.values(chains).forEach(arr => {
        let runMin = newStartMin;
        arr.forEach(s => {
          newTimes[s.id] = runMin;
          runMin += s.dur;
        });
      });

      setServiceLines(prev => prev.map(s => {
        if (newTimes[s.id] === undefined) return s;
        if (dragGroupIds.has(s.id)) {
          return { ...s, staff_id: newStaffId, starts_at: minutesToTime(newTimes[s.id]) };
        }
        return { ...s, starts_at: minutesToTime(newTimes[s.id]) };
      }));
      const clients = [...new Set(allGroupLines.map(s => s.client))];
      setActivityLog(prev => [{ id: Date.now(), timestamp: new Date(), action: 'moved', client: clients.join(', '), service: 'Group booking', description: `Group booking rescheduled (${clients.length} clients, ${allGroupLines.length} services)`, requested: sl.requested, changedTech: newStaffId !== sl.staff_id }, ...prev]);
      setPendingGroupMove(null);
    });
  }
  function confirmGroupMoveOne() {
    if (!pendingGroupMove) return;
    const { sl, newStaffId, newStartMin } = pendingGroupMove;
    setPendingMove({ sl, newStaffId, newStartMin });
    setPendingGroupMove(null);
  }
  function cancelGroupMove() { setPendingGroupMove(null); }

  // ─── Window event listeners for drag ───
  useEffect(() => {
    if (!dragging) return;
    const mm = e => handleDragMove(e.clientX, e.clientY);
    const mu = () => handleDragEnd();
    const tm = e => { e.preventDefault(); const t = e.touches[0]; if (t) handleDragMove(t.clientX, t.clientY); };
    const te = () => handleDragEnd();
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: false }); window.addEventListener('touchend', te);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te); };
  }, [dragging, dragPreview, serviceLines, visibleStaff]);

  return {
    // State
    dragging,
    dragPreview,
    pendingMove,
    pendingGroupMove,
    // Handlers
    handleBlockStart,
    handleSlotStart,
    handleSlotEnd,
    confirmMove,
    cancelMove,
    confirmGroupMoveAll,
    confirmGroupMoveOne,
    cancelGroupMove,
  };
}
