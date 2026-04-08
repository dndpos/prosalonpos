/**
 * useCheckoutDrag — Drag-and-drop to move services between techs in Checkout
 * Session V1 — Works for reopened tickets AND open tickets
 *
 * Pattern: Same drag mechanics as BookingTicketPanel (data-drop-zone hit-test).
 * Touch: hold 350ms then drag. Mouse: 5px movement threshold.
 * Drop zone = tech group header (data-drop-zone="techId").
 */

import { useState, useRef } from 'react';

export default function useCheckoutDrag(items, setItems, staffList) {
  var [dragItem, setDragItem] = useState(null);       // {itemId, fromTechId, name}
  var [dropTarget, setDropTarget] = useState(null);    // techId string
  var [ghostPos, setGhostPos] = useState({x:0,y:0});
  var isDragging = useRef(false);
  var dragRef = useRef(null);
  var dropRef = useRef(null);
  var holdTimer = useRef(null);
  var touchStart = useRef({x:0,y:0});

  function beginDrag(item, x, y) {
    isDragging.current = true;
    var info = {itemId: item.id, fromTechId: item.techId, name: item.name};
    dragRef.current = info;
    setDragItem(info);
    setGhostPos({x:x, y:y});
  }

  function moveGhost(x, y) {
    if (!isDragging.current) return;
    setGhostPos({x:x, y:y});
    var els = document.querySelectorAll('[data-checkout-drop]');
    var found = null;
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        found = els[i].getAttribute('data-checkout-drop');
        break;
      }
    }
    dropRef.current = found;
    setDropTarget(found);
  }

  function endDrag() {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (!isDragging.current) return;
    isDragging.current = false;
    var src = dragRef.current;
    var dst = dropRef.current;
    if (src && dst && src.fromTechId !== dst) {
      // Move item to new tech
      var newTech = staffList.find(function(s) { return s.id === dst; });
      setItems(function(prev) {
        return prev.map(function(it) {
          if (it.id === src.itemId) {
            return Object.assign({}, it, {
              techId: dst,
              tech: newTech ? newTech.display_name : '?',
            });
          }
          return it;
        });
      });
    }
    dragRef.current = null;
    dropRef.current = null;
    setDragItem(null);
    setDropTarget(null);
  }

  // ── Touch: hold 350ms then drag ──
  function onItemTouchStart(e, item) {
    if (item.type === 'giftcard' || item.type === 'package_sale' || item.type === 'membership_sale') return;
    var touch = e.touches[0];
    touchStart.current = {x: touch.clientX, y: touch.clientY};
    holdTimer.current = setTimeout(function() {
      beginDrag(item, touch.clientX, touch.clientY);
    }, 350);
  }

  function onTouchMove(e) {
    if (holdTimer.current) {
      var touch = e.touches[0];
      var dx = Math.abs(touch.clientX - touchStart.current.x);
      var dy = Math.abs(touch.clientY - touchStart.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
        return;
      }
    }
    if (isDragging.current) {
      e.preventDefault();
      moveGhost(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onTouchEnd() {
    endDrag();
  }

  // ── Mouse: 5px movement threshold then drag ──
  function onItemMouseDown(e, item) {
    if (e.button !== 0) return;
    if (item.type === 'giftcard' || item.type === 'package_sale' || item.type === 'membership_sale') return;
    e.preventDefault();
    touchStart.current = {x: e.clientX, y: e.clientY, item: item, started: false};
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
  }

  function onGlobalMouseMove(e) {
    if (!touchStart.current.started) {
      var dx = Math.abs(e.clientX - touchStart.current.x);
      var dy = Math.abs(e.clientY - touchStart.current.y);
      if (dx < 5 && dy < 5) return;
      touchStart.current.started = true;
      beginDrag(touchStart.current.item, e.clientX, e.clientY);
    }
    moveGhost(e.clientX, e.clientY);
  }

  function onGlobalMouseUp() {
    window.removeEventListener('mousemove', onGlobalMouseMove);
    window.removeEventListener('mouseup', onGlobalMouseUp);
    if (isDragging.current) {
      endDrag();
    }
    touchStart.current = {x:0, y:0};
  }

  return {
    dragItem: dragItem,
    dropTarget: dropTarget,
    ghostPos: ghostPos,
    onItemTouchStart: onItemTouchStart,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd,
    onItemMouseDown: onItemMouseDown,
  };
}
