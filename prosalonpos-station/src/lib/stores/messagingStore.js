/**
 * messagingStore.js — Zustand Store for Messaging
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useMessagingStore = create(function(set, get) {
  return {
    templates: [], log: [],
    loading: false, error: null, source: 'pending', initialized: false,

    fetchTemplates: async function() {
      var available = isBackendAvailable();
      if (available === null) available = await checkBackend();
      if (!available) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }
      set({ loading: true, error: null });
      try {
        var data = await api.get('/messaging/templates');
        set({ templates: data.templates || [], loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    fetchLog: async function(start, end) {
      try {
        var path = '/messaging/log' + (start ? '?start=' + start + (end ? '&end=' + end : '') : '');
        var data = await api.get(path);
        set({ log: data.messages || [] });
      } catch (err) { console.warn('[messagingStore] Log fetch failed:', err.message); }
    },

    createTemplate: async function(templateData) {
      var data = await api.post('/messaging/templates', templateData);
      set(function(s) { return { templates: s.templates.concat([data.template]) }; });
      return data.template;
    },

    updateTemplate: async function(id, updates) {
      var data = await api.put('/messaging/templates/' + id, updates);
      set(function(s) { return { templates: s.templates.map(function(t) { return t.id === id ? Object.assign({}, t, data.template) : t; }) }; });
      return data.template;
    },

    deleteTemplate: async function(id) {
      await api.del('/messaging/templates/' + id);
      set(function(s) { return { templates: s.templates.filter(function(t) { return t.id !== id; }) }; });
    },

    sendMessage: async function(msgData) {
      var data = await api.post('/messaging/send', msgData);
      return data;
    },

    sendBlast: async function(blastData) {
      var data = await api.post('/messaging/blast', blastData);
      return data;
    },
  };
});

export { useMessagingStore };
