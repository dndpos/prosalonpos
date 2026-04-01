import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Inventory Catalog Screen
 * Module 10 — Session 13 Decisions #244–#257
 *
 * Same layout as ServiceCatalogScreen: categories left panel, product cards right panel.
 * Tap a category → see its products. Tap a product → edit modal.
 * Tap empty slot → add product modal.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { dollars } from '../../lib/formatUtils';
import { useInventoryStore } from '../../lib/stores/inventoryStore';
import ProductModal from './ProductModal';


// ═══════════════════════════════════════
// ADD CATEGORY MODAL
// ═══════════════════════════════════════
function AddCategoryModal({ onSave, onClose }) {
  var T = useTheme();
  var [name, setName] = useState('');
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter',sans-serif" }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, borderRadius: 12, border: '1px solid ' + T.border, width: 400, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 20 }}>Add Product Category</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Category Name <span style={{ color: T.danger }}>*</span></div>
        <input value={name} onChange={function(e) { setName(e.target.value); }} placeholder="e.g. Hair Care, Styling, Tools..."
          onKeyDown={function(e) { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); } if (e.key === 'Escape') onClose(); }}
          autoFocus
          style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 16, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <div onClick={onClose} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
          <div onClick={function() { if (name.trim()) onSave(name.trim()); }}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, background: name.trim() ? T.primary : T.grid, color: name.trim() ? '#fff' : T.textMuted, fontSize: 14, fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { if (name.trim()) e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={function(e) { if (name.trim()) e.currentTarget.style.background = T.primary; }}
          >Save</div>
        </div>
      </div>
    </div>
  );
}

function RenameCategoryModal({ category, onSave, onClose }) {
  var T = useTheme();
  var [name, setName] = useState(category.name);
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter',sans-serif" }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, borderRadius: 12, border: '1px solid ' + T.border, width: 400, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 20 }}>Rename Category</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Category Name <span style={{ color: T.danger }}>*</span></div>
        <input value={name} onChange={function(e) { setName(e.target.value); }} placeholder="Category name..."
          onKeyDown={function(e) { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); } if (e.key === 'Escape') onClose(); }}
          autoFocus
          style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 16, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <div onClick={onClose} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
          <div onClick={function() { if (name.trim() && name.trim() !== category.name) onSave(name.trim()); }}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, background: (name.trim() && name.trim() !== category.name) ? T.primary : T.grid, color: (name.trim() && name.trim() !== category.name) ? '#fff' : T.textMuted, fontSize: 14, fontWeight: 500, cursor: (name.trim() && name.trim() !== category.name) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { if (name.trim() && name.trim() !== category.name) e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={function(e) { if (name.trim() && name.trim() !== category.name) e.currentTarget.style.background = T.primary; }}
          >Rename</div>
        </div>
      </div>
    </div>
  );
}

function DeleteCategoryConfirm({ category, productCount, onConfirm, onClose }) {
  var T = useTheme();
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter',sans-serif" }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, borderRadius: 12, border: '1px solid ' + T.border, width: 420, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.danger, marginBottom: 12 }}>Delete Category</div>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 8 }}>Are you sure you want to delete <strong>{category.name}</strong>?</div>
        {productCount > 0 && (
          <div style={{ fontSize: 13, color: T.warning, marginBottom: 16, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.25)' }}>
            ⚠️ This will deactivate {productCount} product{productCount > 1 ? 's' : ''} in this category.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <div onClick={onClose} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
          <div onClick={onConfirm}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, background: T.danger, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#DC2626'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.danger; }}
          >Delete</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════
export default function InventoryScreen() {
  var T = useTheme();
  var MOCK_PRODUCT_CATEGORIES = useInventoryStore(function(s) { return s.categories; });
  var MOCK_PRODUCTS = useInventoryStore(function(s) { return s.products; });
  var MOCK_SUPPLIERS = useInventoryStore(function(s) { return s.suppliers; });
  var [categories, setCategories] = useState(MOCK_PRODUCT_CATEGORIES);
  var [products, setProducts] = useState(MOCK_PRODUCTS);
  var [activeCat, setActiveCat] = useState(categories.length > 0 ? categories[0].id : null);

  // Auto-select first category when data loads (production mode)
  useEffect(function() {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].id);
  }, [categories]);
  var [editingProduct, setEditingProduct] = useState(null);   // product object or 'new'
  var [showAddCat, setShowAddCat] = useState(false);
  var [editingCat, setEditingCat] = useState(null); // cat object for rename
  var [deletingCat, setDeletingCat] = useState(null); // cat object for delete confirm
  var [searchText, setSearchText] = useState('');

  // Filter products by active category
  var catProducts = useMemo(function() {
    var list = products.filter(function(p) { return p.category_id === activeCat && p.active; })
      .sort(function(a, b) { return a.position - b.position; });
    if (searchText.trim()) {
      var q = searchText.trim().toLowerCase();
      list = list.filter(function(p) { return p.name.toLowerCase().indexOf(q) !== -1 || (p.sku || '').toLowerCase().indexOf(q) !== -1; });
    }
    return list;
  }, [products, activeCat, searchText]);

  var activeCategories = categories.filter(function(c) { return c.active; });

  // Stats for selected category
  var catStats = useMemo(function() {
    var items = products.filter(function(p) { return p.category_id === activeCat && p.active; });
    var totalValue = items.reduce(function(s, p) { return s + p.price_cents * p.stock_quantity; }, 0);
    var lowStock = items.filter(function(p) { return p.low_stock_threshold && p.stock_quantity <= p.low_stock_threshold; }).length;
    var outOfStock = items.filter(function(p) { return p.stock_quantity === 0; }).length;
    return { count: items.length, totalValue: totalValue, lowStock: lowStock, outOfStock: outOfStock };
  }, [products, activeCat]);

  // Handlers
  function handleAddCategory(name) {
    var newCat = { id: 'pcat-new-' + Date.now(), location_id: 'loc-01', name: name, position: categories.length + 1, active: true };
    setCategories(function(prev) { return prev.concat([newCat]); });
    setActiveCat(newCat.id);
    setShowAddCat(false);
  }

  function handleRenameCategory(cat, newName) {
    setCategories(function(prev) {
      return prev.map(function(c) { return c.id === cat.id ? Object.assign({}, c, { name: newName }) : c; });
    });
    setEditingCat(null);
  }

  function handleDeleteCategory(cat) {
    setCategories(function(prev) {
      return prev.filter(function(c) { return c.id !== cat.id; });
    });
    setProducts(function(prev) {
      return prev.map(function(p) { return p.category_id === cat.id ? Object.assign({}, p, { active: false }) : p; });
    });
    if (activeCat === cat.id) {
      var remaining = activeCategories.filter(function(c) { return c.id !== cat.id; });
      setActiveCat(remaining.length > 0 ? remaining[0].id : null);
    }
    setDeletingCat(null);
  }

  function handleSaveProduct(data) {
    if (editingProduct === 'new') {
      var newProd = Object.assign({
        id: 'prod-new-' + Date.now(),
        category_id: activeCat,
        photo_url: null,
        location_id: 'loc-01',
        position: catProducts.length + 1,
      }, data);
      setProducts(function(prev) { return prev.concat([newProd]); });
    } else {
      var id = editingProduct.id;
      setProducts(function(prev) { return prev.map(function(p) { return p.id === id ? Object.assign({}, p, data) : p; }); });
    }
    setEditingProduct(null);
  }

  function handleDeleteProduct(prodId) {
    setProducts(function(prev) { return prev.map(function(p) { return p.id === prodId ? Object.assign({}, p, { active: false }) : p; }); });
    setEditingProduct(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: T.dark, fontFamily: "'Inter',sans-serif" }}>

      {/* ── Two content panels ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 16, gap: 16 }}>

        {/* ══ Left: Category panel ══ */}
        <div style={{ width: 220, minWidth: 220, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Categories</div>

          {activeCategories.map(function(cat) {
            var isActive = activeCat === cat.id;
            var catCount = products.filter(function(p) { return p.category_id === cat.id && p.active; }).length;
            return (
              <div key={cat.id} onClick={function() { setActiveCat(cat.id); setSearchText(''); }}
                style={{
                  padding: '10px 12px', borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                  background: isActive ? T.accentBg : T.grid,
                  border: '1px solid ' + (isActive ? T.accent + '55' : T.border),
                  transition: 'background 150ms, border-color 150ms',
                }}
                onMouseEnter={function(e) { if (!isActive) { e.currentTarget.style.background = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; } }}
                onMouseLeave={function(e) { if (!isActive) { e.currentTarget.style.background = T.grid; e.currentTarget.style.borderColor = T.border; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: isActive ? 600 : 500, color: isActive ? T.blueLight : T.text, flex: 1 }}>{cat.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isActive && (
                      <>
                        <span onClick={function(e) { e.stopPropagation(); setEditingCat(cat); }}
                          style={{ fontSize: 12, cursor: 'pointer', padding: '2px 4px', color: T.textMuted, opacity: 0.7 }}
                          onMouseEnter={function(e) { e.currentTarget.style.opacity = '1'; }}
                          onMouseLeave={function(e) { e.currentTarget.style.opacity = '0.7'; }}>✏️</span>
                        {activeCategories.length > 1 && (
                          <span onClick={function(e) { e.stopPropagation(); setDeletingCat(cat); }}
                            style={{ fontSize: 12, cursor: 'pointer', padding: '2px 4px', color: T.textMuted, opacity: 0.7 }}
                            onMouseEnter={function(e) { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={function(e) { e.currentTarget.style.opacity = '0.7'; }}>🗑️</span>
                        )}
                      </>
                    )}
                    <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 700, background: T.grid, borderRadius: 10, padding: '1px 8px' }}>{catCount}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add category button */}
          <div onClick={function() { setShowAddCat(true); }}
            style={{ padding: '10px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + T.border, textAlign: 'center', color: T.textSecondary, fontSize: 14, fontWeight: 500, marginTop: 4, background: T.grid, transition: 'background 150ms, border-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; e.currentTarget.style.borderColor = T.border; }}
          >+ Add Category</div>

          <div style={{ flex: 1 }} />
        </div>

        {/* ══ Right: Product list — half width ══ */}
        <div style={{ flex: 1, maxWidth: 700, overflow: 'auto', padding: 16, border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome }}>

          {/* Header: category name + add button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
                {(activeCategories.find(function(c) { return c.id === activeCat; }) || {}).name || 'Products'}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <span style={{ color: T.textSecondary }}>{catStats.count} products</span>
                {catStats.lowStock > 0 && <span style={{ color: T.warning }}>{catStats.lowStock} low stock</span>}
                {catStats.outOfStock > 0 && <span style={{ color: T.danger }}>{catStats.outOfStock} out</span>}
                <span style={{ color: T.textSecondary }}>Value: {dollars(catStats.totalValue)}</span>
              </div>
            </div>
            <div onClick={function() { setEditingProduct('new'); }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
              style={{ padding: '7px 16px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms' }}
            >+ Add Product</div>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 12 }}>
            <input value={searchText} onChange={function(e) { setSearchText(e.target.value); }} placeholder="Search by name or SKU..."
              style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.dark, color: T.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Product rows */}
          {catProducts.map(function(prod) {
            var isLow = prod.low_stock_threshold && prod.stock_quantity <= prod.low_stock_threshold;
            var isOut = prod.stock_quantity === 0;

            return (
              <div key={prod.id} onClick={function() { setEditingProduct(prod); }}
                style={{
                  padding: '14px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                  background: T.grid, border: '1px solid ' + T.border,
                  transition: 'background 150ms, border-color 150ms',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; e.currentTarget.style.borderColor = T.border; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{prod.name}</div>
                    {prod.sku && <div style={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace', letterSpacing: '0.03em', marginTop: 2 }}>{prod.sku}</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.success, marginTop: 4 }}>{dollars(prod.price_cents)}</div>
                    {(isOut || isLow) && (
                      <div style={{ fontSize: 12, fontWeight: 500, color: isOut ? T.danger : T.warning, marginTop: 2 }}>
                        {isOut ? '⚠ Out of stock' : '⚠ Low stock (min ' + prod.low_stock_threshold + ')'}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: isOut ? T.danger : isLow ? T.warning : T.text }}>
                      {prod.stock_quantity}
                    </span>
                    <span style={{ fontSize: 13, color: T.textSecondary, marginLeft: 4 }}>in stock</span>
                  </div>
                </div>
              </div>
            );
          })}

          {catProducts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSecondary, fontSize: 15 }}>
              {searchText.trim() ? 'No products match "' + searchText.trim() + '"' : 'No products in this category yet. Tap "+ Add Product" to get started.'}
            </div>
          )}
        </div>
      </div>

      {/* ── Product Modal ── */}
      {editingProduct !== null && (
        <ProductModal
          product={editingProduct === 'new' ? null : editingProduct}
          categories={categories}
          activeCat={activeCat}
          suppliers={MOCK_SUPPLIERS}
          onSave={handleSaveProduct}
          onClose={function() { setEditingProduct(null); }}
        />
      )}

      {/* ── Add Category Modal ── */}
      {showAddCat && (
        <AddCategoryModal
          onSave={handleAddCategory}
          onClose={function() { setShowAddCat(false); }}
        />
      )}

      {/* ── Rename Category Modal ── */}
      {editingCat && (
        <RenameCategoryModal
          category={editingCat}
          onSave={function(newName) { handleRenameCategory(editingCat, newName); }}
          onClose={function() { setEditingCat(null); }}
        />
      )}

      {/* ── Delete Category Confirm ── */}
      {deletingCat && (
        <DeleteCategoryConfirm
          category={deletingCat}
          productCount={products.filter(function(p) { return p.category_id === deletingCat.id && p.active; }).length}
          onConfirm={function() { handleDeleteCategory(deletingCat); }}
          onClose={function() { setDeletingCat(null); }}
        />
      )}
    </div>
  );
}
