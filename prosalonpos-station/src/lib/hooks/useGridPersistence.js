/**
 * useGridPersistence — Persists grid layout (catSlots, svcSlots, empSlots, columns, rows) to salon settings DB.
 * Session 79 — TD-102 fix
 *
 * The grid layout is stored as a JSON object inside the salon_settings `settings` blob
 * under the key `grid_layout`. This means no schema migration is needed.
 *
 * Usage (in App.jsx):
 *   var gridPersist = useGridPersistence(salonSettings, handleSettingsUpdate);
 *   // On load: gridPersist.load() returns saved layout or null
 *   // On change: gridPersist.save({ catSlots, svcSlots, empSlots, ... })
 */

import { useRef, useCallback } from 'react';

var GRID_KEY = 'grid_layout';

/**
 * Debounced save to avoid hammering the backend during rapid drag operations.
 * Waits 1 second after last change before saving.
 */
export default function useGridPersistence(salonSettings, onSettingsUpdate) {
  var saveTimer = useRef(null);

  /**
   * Load grid layout from salon settings.
   * Returns the saved layout object or null if none exists.
   */
  function load() {
    if (!salonSettings || !salonSettings[GRID_KEY]) return null;
    return salonSettings[GRID_KEY];
  }

  /**
   * Save grid layout to salon settings (debounced — 1s delay).
   * Call this whenever catSlots, svcSlots, empSlots, or column/row counts change.
   */
  var save = useCallback(function(layout) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      if (onSettingsUpdate) {
        onSettingsUpdate(GRID_KEY, layout);
      }
    }, 1000);
  }, [onSettingsUpdate]);

  /**
   * Save immediately (no debounce) — for explicit user actions like "Save Layout".
   */
  function saveNow(layout) {
    clearTimeout(saveTimer.current);
    if (onSettingsUpdate) {
      onSettingsUpdate(GRID_KEY, layout);
    }
  }

  return {
    load: load,
    save: save,
    saveNow: saveNow,
  };
}
