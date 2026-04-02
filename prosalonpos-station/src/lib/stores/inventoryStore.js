/**
 * inventoryStore.js — Zustand Store for Inventory
 * Session 88 | Mock data REMOVED — API only
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';

var useInventoryStore = create(function(set, get) {
  return {
    products: [],
    suppliers: [],
    categories: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,

    fetchProducts: async function() {
      if (isBackendAvailable() === false) { set({ initialized: true, source: 'error', error: 'Server not available' }); return; }

      set({ loading: true, error: null });
      try {
        var data = await api.get('/inventory/products');
        var catData = await api.get('/inventory/categories');
        set({ products: data.products || [], categories: catData.categories || [], loading: false, source: 'api', initialized: true });
      } catch (err) { set({ loading: false, error: err.message, initialized: true, source: 'error' }); }
    },

    fetchSuppliers: async function() {
      try {
        var data = await api.get('/inventory/suppliers');
        set({ suppliers: data.suppliers || [] });
      } catch (err) { console.warn('[inventoryStore] Suppliers fetch failed:', err.message); }
    },

    createProduct: async function(productData) {
      var data = await api.post('/inventory/products', productData);
      set(function(s) { return { products: [data.product].concat(s.products) }; });
      return data.product;
    },

    updateProduct: async function(id, updates) {
      var data = await api.put('/inventory/products/' + id, updates);
      set(function(s) {
        return { products: s.products.map(function(p) { return p.id === id ? Object.assign({}, p, data.product) : p; }) };
      });
      return data.product;
    },

    adjustStock: async function(id, adjustment) {
      var data = await api.post('/inventory/products/' + id + '/adjust', adjustment);
      set(function(s) {
        return { products: s.products.map(function(p) { return p.id === id ? Object.assign({}, p, data.product) : p; }) };
      });
      return data.product;
    },

    createSupplier: async function(supplierData) {
      var data = await api.post('/inventory/suppliers', supplierData);
      set(function(s) { return { suppliers: [data.supplier].concat(s.suppliers) }; });
      return data.supplier;
    },

    updateSupplier: async function(id, updates) {
      var data = await api.put('/inventory/suppliers/' + id, updates);
      set(function(s) {
        return { suppliers: s.suppliers.map(function(sup) { return sup.id === id ? Object.assign({}, sup, data.supplier) : sup; }) };
      });
      return data.supplier;
    },
  };
});

export { useInventoryStore };
