import { useState, useEffect, useRef } from 'react';
import { useStaffStore } from '../stores/staffStore';
import { useServiceStore } from '../stores/serviceStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * useGridLayoutState — Service/category/employee grid layout state and sync effects.
 * Extracted from App.jsx in Session 109. Manages:
 *   - Category grid (svcCatSlots, columns, rows)
 *   - Service grid (svcSlots, columns, rows)
 *   - Employee grid (empSlots, columns, rows)
 *   - Store → local state sync (auto-assign, cleanup stale IDs)
 *   - TD-102: Grid layout persistence (save/restore from salon_settings)
 */
export default function useGridLayoutState(salonSettings, handleSettingsUpdate, gridPersist) {
  // ── Service Catalog layout state (shared between Owner and Checkout) ──
  var [svcCatCategories, setSvcCatCategories] = useState([]);
  var [svcCatServices, setSvcCatServices] = useState([]);
  var [svcCatColumns, setSvcCatColumns] = useState(1);
  var [svcCatRows, setSvcCatRows] = useState(9);
  var [svcGridColumns, setSvcGridColumns] = useState(7);
  var [svcGridRows, setSvcGridRows] = useState(9);
  var [svcCatSlots, setSvcCatSlots] = useState({});
  var [svcSlots, setSvcSlots] = useState({});

  // ── Employee grid layout state (shared, managed by Owner) ──
  var [empStaff, setEmpStaff] = useState([]);
  var [empColumns, setEmpColumns] = useState(4);
  var [empRows, setEmpRows] = useState(3);
  var [empSlots, setEmpSlots] = useState({});
  var hasHourlyStaff = empStaff.some(function(s) { return s.active && s.pay_type === 'hourly'; });

  // ── Store subscriptions ──
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var storeServices = useServiceStore(function(s) { return s.services; });
  var storeCategories = useServiceStore(function(s) { return s.categories; });
  var storeSettings = useSettingsStore(function(s) { return s.settings; });

  // ── TD-102: Grid layout persistence refs ──
  var gridInitialized = useRef(false);
  var _restoringGrid = useRef(false);
  var _gridLayoutRestored = useRef(false);

  // ── Sync staff from store → local state ──
  useEffect(function() {
    setEmpStaff(storeStaff);
    if (storeStaff.length > 0) {
      var activeIds = {};
      storeStaff.filter(function(s) { return s.active; }).forEach(function(s) { activeIds[s.id] = true; });

      setEmpSlots(function(prev) {
        if (Object.keys(prev).length > 0) {
          var cleaned = {};
          var validCount = 0;
          Object.keys(prev).forEach(function(k) {
            if (activeIds[prev[k]]) { cleaned[k] = prev[k]; validCount++; }
          });
          if (validCount > 0) return cleaned;
        }
        var slots = {};
        storeStaff.filter(function(s) { return s.active; }).forEach(function(emp, i) { slots[i] = emp.id; });
        return slots;
      });
    }
  }, [storeStaff]);

  // ── Sync services from store → local state ──
  useEffect(function() { setSvcCatServices(storeServices); }, [storeServices]);

  // ── Sync categories from store → local state (S105: cleanup ONLY, never auto-append) ──
  useEffect(function() {
    setSvcCatCategories(storeCategories);
    if (storeCategories.length === 0) return;
    var knownIdSet = {}; storeCategories.forEach(function(c) { knownIdSet[c.id] = true; });
    setSvcCatSlots(function(prev) {
      var keys = Object.keys(prev);
      if (keys.length === 0) {
        var s = {}; storeCategories.filter(function(c) { return c.active !== false; }).sort(function(a, b) { return (a.position||0) - (b.position||0); }).forEach(function(c, i) { s[i] = c.id; }); return s;
      }
      var cleaned = {}; var changed = false;
      keys.forEach(function(k) {
        if (knownIdSet[prev[k]]) { cleaned[k] = prev[k]; } else { changed = true; }
      });
      return changed ? cleaned : prev;
    });
  }, [storeCategories]);

  // ── Rebuild svcSlots — fill empty categories, recover stale saved slots (S101) ──
  useEffect(function() {
    if (storeCategories.length === 0 || storeServices.length === 0) return;
    var svcIdSet = {}; storeServices.forEach(function(s) { svcIdSet[s.id] = true; });
    function autoAssign(catId) {
      var inCat = storeServices.filter(function(s) { return s.category_ids && s.category_ids.includes(catId) && s.active !== false; })
        .sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
      if (inCat.length === 0) return null;
      var m = {}; inCat.forEach(function(s, i) { m[i] = s.id; }); return m;
    }
    setSvcSlots(function(prev) {
      var next = Object.assign({}, prev); var changed = false;
      storeCategories.forEach(function(cat) {
        if (next[cat.id] !== undefined) {
          var existing = next[cat.id] || {}; var cleaned = {};
          Object.keys(existing).forEach(function(k) { if (svcIdSet[existing[k]]) cleaned[k] = existing[k]; });
          if (Object.keys(cleaned).length !== Object.keys(existing).length) { next[cat.id] = cleaned; changed = true; }
          if (Object.keys(cleaned).length === 0) {
            var fresh = autoAssign(cat.id);
            if (fresh) { next[cat.id] = fresh; changed = true; }
          }
          return;
        }
        var fresh = autoAssign(cat.id);
        if (fresh) { next[cat.id] = fresh; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [storeServices, storeCategories]);

  // ── TD-102: Restore grid layout from saved settings (ONCE on initial load) ──
  useEffect(function() {
    if (storeSettings && storeSettings.grid_layout && !_gridLayoutRestored.current) {
      _gridLayoutRestored.current = true;
      var gl = storeSettings.grid_layout;
      _restoringGrid.current = true;
      if (gl.catSlots) {
        if (storeCategories.length > 0) {
          var knownCatIds = {}; storeCategories.forEach(function(c) { knownCatIds[c.id] = true; });
          var validCatSlots = {}; Object.keys(gl.catSlots).forEach(function(k) { if (knownCatIds[gl.catSlots[k]]) validCatSlots[k] = gl.catSlots[k]; });
          setSvcCatSlots(validCatSlots);
        } else {
          setSvcCatSlots(gl.catSlots);
        }
      }
      if (gl.svcSlots) {
        if (storeServices.length > 0) {
          var validIds = {}; storeServices.forEach(function(s) { validIds[s.id] = true; });
          var validated = {};
          Object.keys(gl.svcSlots).forEach(function(catKey) {
            var catMap = gl.svcSlots[catKey] || {}; var clean = {};
            Object.keys(catMap).forEach(function(slot) { if (validIds[catMap[slot]]) clean[slot] = catMap[slot]; });
            validated[catKey] = clean;
          });
          setSvcSlots(validated);
        }
      }
      if (gl.empSlots && Object.keys(gl.empSlots).length > 0) setEmpSlots(gl.empSlots);
      if (gl.svcCatColumns !== undefined) setSvcCatColumns(gl.svcCatColumns);
      if (gl.svcCatRows !== undefined) setSvcCatRows(gl.svcCatRows);
      if (gl.svcGridColumns !== undefined) setSvcGridColumns(gl.svcGridColumns);
      if (gl.svcGridRows !== undefined) setSvcGridRows(gl.svcGridRows);
      if (gl.empColumns !== undefined) setEmpColumns(gl.empColumns);
      if (gl.empRows !== undefined) setEmpRows(gl.empRows);
      setTimeout(function() { _restoringGrid.current = false; }, 500);
    }
  }, [storeSettings]);

  // ── TD-102: Auto-save grid layout when it changes ──
  useEffect(function() {
    if (!gridInitialized.current) {
      gridInitialized.current = true;
      return;
    }
    if (_restoringGrid.current) return;
    gridPersist.save({
      catSlots: svcCatSlots, svcSlots: svcSlots, empSlots: empSlots,
      svcCatColumns: svcCatColumns, svcCatRows: svcCatRows, svcGridColumns: svcGridColumns, svcGridRows: svcGridRows,
      empColumns: empColumns, empRows: empRows,
    });
  }, [svcCatSlots, svcSlots, empSlots, svcCatColumns, svcCatRows, svcGridColumns, svcGridRows, empColumns, empRows]);

  return {
    // Category grid
    svcCatCategories: svcCatCategories, setSvcCatCategories: setSvcCatCategories,
    svcCatServices: svcCatServices, setSvcCatServices: setSvcCatServices,
    svcCatColumns: svcCatColumns, setSvcCatColumns: setSvcCatColumns,
    svcCatRows: svcCatRows, setSvcCatRows: setSvcCatRows,
    svcGridColumns: svcGridColumns, setSvcGridColumns: setSvcGridColumns,
    svcGridRows: svcGridRows, setSvcGridRows: setSvcGridRows,
    svcCatSlots: svcCatSlots, setSvcCatSlots: setSvcCatSlots,
    svcSlots: svcSlots, setSvcSlots: setSvcSlots,
    // Employee grid
    empStaff: empStaff, setEmpStaff: setEmpStaff,
    empColumns: empColumns, setEmpColumns: setEmpColumns,
    empRows: empRows, setEmpRows: setEmpRows,
    empSlots: empSlots, setEmpSlots: setEmpSlots,
    hasHourlyStaff: hasHourlyStaff,
    // Catalog layout shortcut (used by many screens)
    catalogLayout: {
      categories: svcCatCategories, services: svcCatServices,
      catColumns: svcCatColumns, catRows: svcCatRows,
      svcColumns: svcGridColumns, svcRows: svcGridRows,
      catSlots: svcCatSlots, svcSlots: svcSlots,
    },
  };
}
