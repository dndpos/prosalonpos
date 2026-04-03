/**
 * serviceStore.js — Zustand Store for Services + Categories
 * Session 104 | Category slot ownership fix
 *
 * ARCHITECTURE (S104):
 *   - createCategory does NOT touch local state. It returns the created
 *     record so the caller can place it in catSlots. The socket-triggered
 *     fetchServices() is the ONLY thing that updates the categories array.
 *   - updateCategory does NOT call fetchServices — socket handles it.
 *     It does an optimistic local merge so the UI feels instant.
 *   - _lastCrudTs is set on every write. fetchServices skips if called
 *     within 800ms of a local write (prevents socket echo from creating
 *     a duplicate render cycle).
 *
 * Usage:
 *   import { useServiceStore } from '../lib/stores/serviceStore';
 *   const services = useServiceStore(s => s.services);
 *   const categories = useServiceStore(s => s.categories);
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var _lastCrudTs = 0;
var CRUD_COOLDOWN = 800; // ms — ignore socket re-fetch within this window

var useServiceStore = create(function(set, get) {
  return {
    // ─── State ───
    services: [],
    categories: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    // ─── Fetch ───

    fetchServices: async function(force) {
      // Skip if a local CRUD just happened (socket echo) — unless forced
      if (!force && (Date.now() - _lastCrudTs < CRUD_COOLDOWN)) {
        return;
      }
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      set({ loading: true, error: null });
      try {
        var svcData = await api.get('/services');
        var catData = await api.get('/services/categories');
        set({
          services: svcData.services || [],
          categories: catData.categories || [],
          loading: false,
          source: 'api',
          initialized: true,
        });
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    // ─── Service CRUD ───

    createService: async function(serviceData) {
      _lastCrudTs = Date.now();
      var data = await api.post('/services', serviceData);
      if (data.service) {
        set(function(s) { return { services: s.services.concat([data.service]) }; });
      }
      return data.service;
    },

    updateService: async function(id, updates) {
      _lastCrudTs = Date.now();
      // Optimistic local merge
      set(function(s) {
        return { services: s.services.map(function(svc) {
          return svc.id === id ? Object.assign({}, svc, updates) : svc;
        })};
      });
      await api.put('/services/' + id, updates);
    },

    deleteService: async function(id) {
      _lastCrudTs = Date.now();
      await api.del('/services/' + id);
      set(function(s) {
        return { services: s.services.map(function(svc) {
          return svc.id === id ? Object.assign({}, svc, { active: false }) : svc;
        })};
      });
    },

    // ─── Category CRUD ───

    createCategory: async function(catData) {
      _lastCrudTs = Date.now();
      var data = await api.post('/services/categories', catData);
      // DO NOT append to local categories array.
      // The caller (handleAddCategory) manages catSlots.
      // The socket-triggered fetchServices() will add it to the array.
      // We do a delayed force-fetch to guarantee the array updates
      // even if the socket event is lost.
      setTimeout(function() { get().fetchServices(true); }, 1000);
      return data.category;
    },

    updateCategory: async function(id, updates) {
      _lastCrudTs = Date.now();
      // Optimistic local merge — no fetchServices needed
      set(function(s) {
        return { categories: s.categories.map(function(cat) {
          return cat.id === id ? Object.assign({}, cat, updates) : cat;
        })};
      });
      await api.put('/services/categories/' + id, updates);
    },

    deleteCategory: async function(id) {
      _lastCrudTs = Date.now();
      // Optimistic remove — hard delete, not soft-delete
      set(function(s) {
        return { categories: s.categories.filter(function(cat) { return cat.id !== id; }) };
      });
      await api.del('/services/categories/' + id);
    },

    // ─── Selectors ───
    getActiveServices: function() {
      return get().services.filter(function(s) { return s.active !== false; });
    },
    getActiveCategories: function() {
      return get().categories.filter(function(c) { return c.active !== false; });
    },
    getServiceById: function(id) {
      return get().services.find(function(s) { return s.id === id; });
    },
    getCategoryById: function(id) {
      return get().categories.find(function(c) { return c.id === id; });
    },
    getServicesByCategory: function(catId) {
      return get().services.filter(function(s) {
        return s.active !== false && s.category_ids && s.category_ids.includes(catId);
      });
    },
  };
});

export { useServiceStore };
