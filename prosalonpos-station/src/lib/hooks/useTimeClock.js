import { useState } from 'react';

/**
 * useTimeClock — Time Clock punch state management (TD-056, Session 38)
 * Extracted from App.jsx in Session 109.
 */
export default function useTimeClock() {
  var [clockPunches, setClockPunches] = useState([]);
  var [showTimeClockModal, setShowTimeClockModal] = useState(false);

  function handleClockPunch(staffId, type) {
    setClockPunches(function(prev) {
      return prev.concat([{
        id: 'punch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        staff_id: staffId,
        type: type,
        timestamp: Date.now(),
      }]);
    });
  }

  function handleAddManualPunch(staffId, type, timestamp) {
    setClockPunches(function(prev) {
      return prev.concat([{
        id: 'punch-manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        staff_id: staffId,
        type: type,
        timestamp: timestamp,
      }]).sort(function(a, b) { return a.timestamp - b.timestamp; });
    });
  }

  function handleDeletePunch(punchId) {
    setClockPunches(function(prev) { return prev.filter(function(p) { return p.id !== punchId; }); });
  }

  return {
    clockPunches: clockPunches,
    showTimeClockModal: showTimeClockModal,
    setShowTimeClockModal: setShowTimeClockModal,
    handleClockPunch: handleClockPunch,
    handleAddManualPunch: handleAddManualPunch,
    handleDeletePunch: handleDeletePunch,
  };
}
