/**
 * clientStore.js — Zustand Store for Client Data
 * Session 88 | Mock data REMOVED — API only
 *
 * Usage:
 *   import { useClientStore } from '../lib/stores/clientStore';
 *   const clients = useClientStore(s => s.clients);
 *   const { searchClients, createClient } = useClientStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useClientStore = create(function(set, get) {
  return {
    // ─── State ───
    clients: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    // ─── Actions ───

    fetchClients: async function() {
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      set({ loading: true, error: null });
      try {
        var data = await api.get('/clients');
        set({
          clients: data.clients || [],
          loading: false,
          source: 'api',
          initialized: true,
        });
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    searchClients: async function(term) {
      try {
        var data = await api.get('/clients?search=' + encodeURIComponent(term));
        return data.clients || [];
      } catch (err) {
        console.warn('[clientStore] Search failed:', err.message);
        return [];
      }
    },

    createClient: async function(clientData) {
      var data = await api.post('/clients', clientData);
      set(function(s) { return { clients: s.clients.concat([data.client]) }; });
      return data.client;
    },

    updateClient: async function(id, updates) {
      var data = await api.put('/clients/' + id, updates);
      set(function(s) {
        return { clients: s.clients.map(function(c) {
          return c.id === id ? Object.assign({}, c, data.client) : c;
        })};
      });
      return data.client;
    },

    deleteClient: async function(id) {
      await api.del('/clients/' + id + '?permanent=true');
      set(function(s) {
        return { clients: s.clients.map(function(c) {
          return c.id === id ? Object.assign({}, c, { active: false, status: 'deleted' }) : c;
        })};
      });
    },

    addNote: async function(clientId, note) {
      try {
        await api.post('/clients/' + clientId + '/notes', { note: note });
      } catch (err) {
        console.warn('[clientStore] Failed to add note:', err.message);
      }
    },

    // ─── Selectors ───
    getActiveClients: function() {
      return get().clients.filter(function(c) { return c.active !== false; });
    },
    getClientById: function(id) {
      return get().clients.find(function(c) { return c.id === id; });
    },
    getClientByPhone: function(phone) {
      if (!phone) return null;
      var digits = phone.replace(/\D/g, '');
      return get().clients.find(function(c) {
        return (c.phone || '').replace(/\D/g, '') === digits;
      });
    },
  };
});

export { useClientStore };
