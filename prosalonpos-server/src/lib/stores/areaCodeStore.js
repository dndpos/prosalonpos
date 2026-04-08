/**
 * areaCodeStore.js — Zustand Store for Area Code Tags
 * Session 102
 *
 * Simple toggle for showing/hiding area code tags on screen.
 * Tags are big readable labels showing section IDs (e.g. CAL, SC-CAT, CO-TIP).
 * Toggle lives in Salon Settings → Dev Tools.
 * State is session-only (resets on refresh).
 */

import { create } from 'zustand';

var useAreaCodeStore = create(function(set, get) {
  return {
    enabled: true,  // Default ON during development — toggle off in Salon Settings > Dev Tools
    toggle: function() { set({ enabled: !get().enabled }); },
    setEnabled: function(val) { set({ enabled: !!val }); },
  };
});

export { useAreaCodeStore };
export default useAreaCodeStore;
