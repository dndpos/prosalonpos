/**
 * serviceStore.js — Zustand Store for Services + Categories
 * Session 88 | Mock data REMOVED — API only
 *
 * Usage:
 *   import { useServiceStore } from '../lib/stores/serviceStore';
 *   const services = useServiceStore(s => s.services);
 *   const categories = useServiceStore(s => s.categories);
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';
import { debugLog } from '../debugLog';

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

    fetchServices: async function() {
      var available = isBackendAvailable();
      if (available === null) available = await checkBackend();
      if (!available) {
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
        debugLog('STORE', 'serviceStore loaded ' + (svcData.services ? svcData.services.length : 0) + ' services, ' + (catData.categories ? catData.categories.length : 0) + ' categories');
      } catch (err) {
        debugLog('ERROR', 'serviceStore fetch failed: ' + err.message);
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    // ─── Service CRUD ───

    createService: async function(serviceData) {
      var data = await api.post('/services', serviceData);
      await get().fetchServices();
      return data.service;
    },

    updateService: async function(id, updates) {
      await api.put('/services/' + id, updates);
      await get().fetchServices();
    },

    deleteService: async function(id) {
      await api.del('/services/' + id);
      set(function(s) {
        return { services: s.services.map(function(svc) {
          return svc.id === id ? Object.assign({}, svc, { active: false }) : svc;
        })};
      });
    },

    // ─── Category CRUD ───

    createCategory: async function(catData) {
      var data = await api.post('/services/categories', catData);
      set(function(s) { return { categories: s.categories.concat([data.category]) }; });
      return data.category;
    },

    updateCategory: async function(id, updates) {
      await api.put('/services/categories/' + id, updates);
      await get().fetchServices();
    },

    deleteCategory: async function(id) {
      await api.del('/services/categories/' + id);
      set(function(s) {
        return { categories: s.categories.map(function(cat) {
          return cat.id === id ? Object.assign({}, cat, { active: false }) : cat;
        })};
      });
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
