/**
 * Pro Salon POS — Gift Card Bridge (Store → Component)
 * Session 49: Wired to giftCardStore via Proxy pattern.
 * All export names preserved — downstream components need zero changes.
 */

import { useGiftCardStore } from '../../lib/stores/giftCardStore';

// Lazy getter
function _getCards() { return useGiftCardStore.getState().giftCards || []; }
function _getTxns() { return useGiftCardStore.getState().transactions || []; }

// ─── MOCK_GIFT_CARDS — from giftCardStore ───
export var MOCK_GIFT_CARDS = new Proxy([], {
  get: function(target, key) {
    var live = _getCards();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'some') return function(fn) { return live.some(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});

// ─── MOCK_GC_TRANSACTIONS — from giftCardStore ───
export var MOCK_GC_TRANSACTIONS = new Proxy([], {
  get: function(target, key) {
    var live = _getTxns();
    if (key === 'length') return live.length;
    if (key === 'find') return function(fn) { return live.find(fn); };
    if (key === 'filter') return function(fn) { return live.filter(fn); };
    if (key === 'map') return function(fn) { return live.map(fn); };
    if (key === 'forEach') return function(fn) { return live.forEach(fn); };
    if (key === 'some') return function(fn) { return live.some(fn); };
    if (key === Symbol.iterator) return function() { return live[Symbol.iterator](); };
    var idx = Number(key);
    if (!isNaN(idx)) return live[idx];
    return live[key];
  }
});
