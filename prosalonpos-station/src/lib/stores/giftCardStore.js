/**
 * giftCardStore.js — Zustand Store for Gift Cards
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useGiftCardStore = create(function(set, get) {
  return {
    giftCards: [],
    transactions: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    fetchGiftCards: async function() {
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      set({ loading: true, error: null });
      try {
        var data = await api.get('/gift-cards');
        set({
          giftCards: data.giftCards || [],
          transactions: data.transactions || [],
          loading: false,
          source: 'api',
          initialized: true,
        });
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    createGiftCard: async function(cardData) {
      var data = await api.post('/gift-cards', cardData);
      set(function(s) { return { giftCards: [data.giftCard].concat(s.giftCards) }; });
      return data.giftCard;
    },

    lookupGiftCard: async function(code) {
      var data = await api.get('/gift-cards/lookup/' + encodeURIComponent(code));
      return data.giftCard || null;
    },

    redeemGiftCard: async function(id, redeemData) {
      var data = await api.post('/gift-cards/' + id + '/redeem', redeemData);
      get().fetchGiftCards();
      return data;
    },

    reloadGiftCard: async function(id, reloadData) {
      var data = await api.post('/gift-cards/' + id + '/reload', reloadData);
      get().fetchGiftCards();
      return data;
    },
  };
});

export { useGiftCardStore };
