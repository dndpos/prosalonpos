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
import AreaTag from '../../components/ui/AreaTag';


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

function EditCategoryModal({ category, onSave, onClose }) {
  var T = useTheme();
  var [name, setName] = useState(category.name);
  var [taxable, setTaxable] = useState(category.taxable !== false);
  var hasChanges = (name.trim() && name.trim() !== category.name) || (taxable !== (category.taxable !== false));
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter',sans-serif" }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, borderRadius: 12, border: '1px solid ' + T.border, width: 400, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 20 }}>Edit Category</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Category Name <span style={{ color: T.danger }}>*</span></div>
        <input value={name} onChange={function(e) { setName(e.target.value); }} placeholder="Category name..."
          onKeyDown={function(e) { if (e.key === 'Enter' && hasChanges) { onSave({ name: name.trim(), taxable: taxable }); } if (e.key === 'Escape') onClose(); }}
          autoFocus
          style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 16, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid ' + (T.borderLight || T.border), marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: T.text }}>Charge sales tax</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>When OFF, items in this category are tax-exempt</div>
          </div>
          <div onClick={function() { setTaxable(!taxable); }} style={{ width: 44, height: 24, borderRadius: 12, background: taxable ? '#10B981' : (T.borderLight || '#374151'), cursor: 'pointer', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: taxable ? 22 : 2, transition: 'left 150ms' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <div onClick={onClose} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
          <div onClick={function() { if (hasChanges) onSave({ name: name.trim(), taxable: taxable }); }}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, background: hasChanges ? T.primary : T.grid, color: hasChanges ? '#fff' : T.textMuted, fontSize: 14, fontWeight: 500, cursor: hasChanges ? 'pointer' : 'default', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { if (hasChanges) e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={function(e) { if (hasChanges) e.currentTarget.style.background = T.primary; }}
          >Save</div>
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

  // Read directly from store — no local copies
  var categories = useInventoryStore(function(s) { return s.categories; });
  var products = useInventoryStore(function(s) { return s.products; });
  var suppliers = useInventoryStore(function(s) { return s.suppliers; });
  var storeInitialized = useInventoryStore(function(s) { return s.initialized; });
  var fetchProducts = useInventoryStore(function(s) { return s.fetchProducts; });
  var fetchSuppliers = useInventoryStore(function(s) { return s.fetchSuppliers; });
  var createProduct = useInventoryStore(function(s) { return s.createProduct; });
  var updateProduct = useInventoryStore(function(s) { return s.updateProduct; });
  var deleteProduct = useInventoryStore(function(s) { return s.deleteProduct; });
  var createCategory = useInventoryStore(function(s) { return s.createCategory; });
  var updateCategory = useInventoryStore(function(s) { return s.updateCategory; });
  var deleteCategory = useInventoryStore(function(s) { return s.deleteCategory; });

  var [activeCat, setActiveCat] = useState(null);
  var [editingProduct, setEditingProduct] = useState(null);
  var [showAddCat, setShowAddCat] = useState(false);
  var [editingCat, setEditingCat] = useState(null);
  var [deletingCat, setDeletingCat] = useState(null);
  var [searchText, setSearchText] = useState('');
  var [dragCatId, setDragCatId] = useState(null);
  var [dragOverId, setDragOverId] = useState(null);

  // Auto-fetch on mount
  useEffect(function() {
    fetchProducts();
    fetchSuppliers();
  }, []);

  // Auto-select first category when data loads
  useEffect(function() {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].id);
  }, [categories]);

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

  var activeCategories = categories.filter(function(c) { return c.active; }).sort(function(a, b) { return (a.position || 0) - (b.position || 0); });

  // Stats for selected category
  var catStats = useMemo(function() {
    var items = products.filter(function(p) { return p.category_id === activeCat && p.active; });
    var totalValue = items.reduce(function(s, p) { return s + p.price_cents * p.stock_qty; }, 0);
    var lowStock = items.filter(function(p) { return p.low_stock_qty && p.stock_qty <= p.low_stock_qty; }).length;
    var outOfStock = items.filter(function(p) { return p.stock_qty === 0; }).length;
    return { count: items.length, totalValue: totalValue, lowStock: lowStock, outOfStock: outOfStock };
  }, [products, activeCat]);

  // Handlers — all go through the store (which calls the API)
  async function handleAddCategory(name) {
    try {
      var cat = await createCategory({ name: name, position: categories.length + 1 });
      setActiveCat(cat.id);
    } catch (err) { console.error('[Inventory] Create category failed:', err.message); }
    setShowAddCat(false);
  }

  async function handleEditCategory(cat, updates) {
    try {
      var data = {};
      if (updates.name && updates.name !== cat.name) data.name = updates.name;
      if (updates.taxable !== undefined) data.taxable = updates.taxable;
      if (Object.keys(data).length > 0) await updateCategory(cat.id, data);
    } catch (err) { console.error('[Inventory] Edit category failed:', err.message); }
    setEditingCat(null);
  }

  async function handleDeleteCategory(cat) {
    try {
      await deleteCategory(cat.id);
      if (activeCat === cat.id) {
        var remaining = activeCategories.filter(function(c) { return c.id !== cat.id; });
        setActiveCat(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('[Inventory] Delete category failed:', err.message);
      alert(err.data ? err.data.error : err.message);
    }
    setDeletingCat(null);
  }

  async function handleSaveProduct(data) {
    setEditingProduct(null);
    try {
      if (editingProduct === 'new') {
        await createProduct(Object.assign({ category_id: activeCat }, data));
      } else {
        await updateProduct(editingProduct.id, data);
      }
    } catch (err) { toast.show('Failed to save product: ' + (err.message || 'Unknown'), 'error'); }
  }

  async function handleDeleteProduct(prodId) {
    try {
      await deleteProduct(prodId);
    } catch (err) { console.error('[Inventory] Delete product failed:', err.message); }
    setEditingProduct(null);
  }

  function handleCatDragStart(e, catId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', catId);
    setDragCatId(catId);
  }
  function handleCatDragOver(e, catId) {
    e.preventDefault();
    if (catId !== dragCatId) setDragOverId(catId);
  }
  function handleCatDragLeave() { setDragOverId(null); }
  async function handleCatDrop(e, targetId) {
    e.preventDefault();
    setDragOverId(null);
    if (!dragCatId || dragCatId === targetId) { setDragCatId(null); return; }
    // Reorder: move dragCatId to targetId's position
    var ordered = activeCategories.map(function(c) { return c.id; });
    var fromIdx = ordered.indexOf(dragCatId);
    var toIdx = ordered.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragCatId(null); return; }
    ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, dragCatId);
    // Save new positions
    var promises = ordered.map(function(id, i) { return updateCategory(id, { position: i }); });
    try { await Promise.all(promises); } catch (err) { console.error('[Inventory] Reorder failed:', err.message); }
    setDragCatId(null);
  }
  function handleCatDragEnd() { setDragCatId(null); setDragOverId(null); }

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
            var isDragging = dragCatId === cat.id;
            var isDragOver = dragOverId === cat.id;
            return (
              <div key={cat.id}
                draggable
                onDragStart={function(e) { handleCatDragStart(e, cat.id); }}
                onDragOver={function(e) { handleCatDragOver(e, cat.id); }}
                onDragLeave={handleCatDragLeave}
                onDrop={function(e) { handleCatDrop(e, cat.id); }}
                onDragEnd={handleCatDragEnd}
                onClick={function() { setActiveCat(cat.id); setSearchText(''); }}
                style={{
                  padding: '10px 12px', borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                  background: isDragOver ? 'rgba(34,197,94,0.12)' : (isActive ? T.accentBg : T.grid),
                  border: isDragOver ? '1px solid rgba(34,197,94,0.5)' : ('1px solid ' + (isActive ? T.accent + '55' : T.border)),
                  opacity: isDragging ? 0.4 : 1,
                  transition: 'background 150ms, border-color 150ms, opacity 150ms',
                }}
                onMouseEnter={function(e) { if (!isActive && !isDragOver) { e.currentTarget.style.background = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; } }}
                onMouseLeave={function(e) { if (!isActive && !isDragOver) { e.currentTarget.style.background = T.grid; e.currentTarget.style.borderColor = T.border; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: T.textMuted, cursor: 'grab', padding: '0 2px', flexShrink: 0 }}>☰</span>
                    <span style={{ fontSize: 15, fontWeight: isActive ? 600 : 500, color: isActive ? T.blueLight : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                  </div>
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
                    {cat.taxable === false && <span style={{ fontSize: 9, fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.15)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.02em' }}>NO TAX</span>}
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
            var isLow = prod.low_stock_qty && prod.stock_qty <= prod.low_stock_qty;
            var isOut = prod.stock_qty === 0;

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
        <AreaTag id="INV-LIST" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{prod.name}</div>
                    {prod.sku && <div style={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace', letterSpacing: '0.03em', marginTop: 2 }}>{prod.sku}</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.success, marginTop: 4 }}>{dollars(prod.price_cents)}</div>
                    {(isOut || isLow) && (
                      <div style={{ fontSize: 12, fontWeight: 500, color: isOut ? T.danger : T.warning, marginTop: 2 }}>
                        {isOut ? '⚠ Out of stock' : '⚠ Low stock (min ' + prod.low_stock_qty + ')'}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: isOut ? T.danger : isLow ? T.warning : T.text }}>
                      {prod.stock_qty}
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
          suppliers={suppliers}
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
        <EditCategoryModal
          category={editingCat}
          onSave={function(updates) { handleEditCategory(editingCat, updates); }}
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
