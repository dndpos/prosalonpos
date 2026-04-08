import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
import { useServiceStore } from '../../lib/stores/serviceStore';
import AreaTag from '../../components/ui/AreaTag';
/**
 * ServiceCatalogScreen.jsx
 * Module 4 — Service Catalog Management (Owner-facing)
 * Session 9 Decisions #193–#206
 *
 * Uses shared CategoryGrid + ServiceGrid components.
 * All layout state (categories, services, slots, columns, rows) comes from App.jsx props.
 */
import { useState, useEffect } from 'react';
import { SERVICE_COLORS } from '../../lib/tokens';
import { AddCategoryModal, AddServiceModal } from './ServiceModals';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';

export default function ServiceCatalogScreen({ categories, setCategories, services, setServices, catColumns, setCatColumns, catRows, setCatRows, svcColumns, setSvcColumns, svcRows, setSvcRows, catSlots, setCatSlots, svcSlots, setSvcSlots }) {
  var C = useTheme();
  var toast = useToast();
  var svcStore = useServiceStore();
  var [activeCat, setActiveCat] = useState(catSlots && catSlots[0] ? catSlots[0] : (categories.length > 0 ? categories[0].id : null));
  var [editingService, setEditingService] = useState(null);
  var [showAddCatModal, setShowAddCatModal] = useState(false);
  var [addSvcSlotIdx, setAddSvcSlotIdx] = useState(null);

  // Auto-select first category if activeCat is null and categories become available
  useEffect(function() {
    if (!activeCat && categories.length > 0) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  // One-time sync: apply category colors to services that don't match
  var [colorSynced, setColorSynced] = useState(false);
  useEffect(function() {
    if (colorSynced || categories.length === 0 || services.length === 0) return;
    var catColorMap = {};
    categories.forEach(function(c) { if (c.calendar_color) catColorMap[c.id] = c.calendar_color; });
    var updated = false;
    services.forEach(function(svc) {
      if (!svc.category_ids || svc.category_ids.length === 0) return;
      var primaryCatColor = catColorMap[svc.category_ids[0]];
      if (primaryCatColor && svc.calendar_color !== primaryCatColor) {
        svcStore.updateService(svc.id, { calendar_color: primaryCatColor });
        updated = true;
      }
    });
    setColorSynced(true);
  }, [categories, services, colorSynced]);

  // ── Handlers ──
  function handleSaveService(data) {
    var svc = editingService;
    var updates = {
      name: data.name.trim(),
      calendar_color: data.color || svc.calendar_color,
      default_duration_minutes: data.duration,
      price_cents: data.openPrice ? 0 : data.priceCents,
      product_cost_cents: data.productCostCents || 0,
      open_price: !!data.openPrice,
    };
    if (data.categoryIds) updates.category_ids = data.categoryIds;
    svcStore.updateService(svc.id, updates);
    setEditingService(null);
  }

  function handleQuickAddService(data) {
    var newSvcData = {
      name: data.name.trim(),
      default_duration_minutes: data.duration,
      price_cents: data.openPrice ? 0 : data.priceCents,
      product_cost_cents: data.productCostCents || 0,
      open_price: !!data.openPrice,
      calendar_color: data.color || (categories.find(function(c) { return c.id === activeCat; }) || {}).calendar_color || SERVICE_COLORS[0].hex,
      online_booking_enabled: true,
      description: '',
      requires_room: false,
      category_ids: [activeCat],
      position: 99,
    };
    var slotIdx = addSvcSlotIdx;
    svcStore.createService(newSvcData).then(function(created) {
      if (created && slotIdx !== null) {
        setSvcSlots(function(prev) {
          var catMap = prev[activeCat] ? { ...prev[activeCat] } : {};
          catMap[slotIdx] = created.id;
          return { ...prev, [activeCat]: catMap };
        });
      }
    });
    setAddSvcSlotIdx(null);
  }

  var [_catSaving, _setCatSaving] = useState(false);
  function handleAddCategory(name, color) {
    if (!name || !name.trim() || _catSaving) return;
    _setCatSaving(true);
    setShowAddCatModal(false);
    var catData = {
      name: name.trim(),
      position: categories.length + 1,
      calendar_color: color || null,
    };
    svcStore.createCategory(catData).then(function(created) {
      _setCatSaving(false);
      if (created) {
        setCatSlots(function(prev) {
          var slots = { ...prev };
          for (var i = 0; i < 100; i++) {
            if (!slots[i]) { slots[i] = created.id; break; }
          }
          return slots;
        });
        setSvcSlots(function(prev) { return { ...prev, [created.id]: {} }; });
        setActiveCat(created.id);
      }
    }).catch(function() { _setCatSaving(false); });
  }

  function handleRenameCategory(catId, newName) {
    svcStore.updateCategory(catId, { name: newName });
  }

  function handleEditCategoryColor(catId, color) {
    svcStore.updateCategory(catId, { calendar_color: color });
    // Auto-apply color to all services in this category
    if (color) {
      services.forEach(function(svc) {
        if (svc.category_ids && svc.category_ids.includes(catId)) {
          svcStore.updateService(svc.id, { calendar_color: color });
        }
      });
    }
  }

  function handleDeleteCategory(catId) {
    var cat = categories.find(function(c) { return c.id === catId; });
    if (!cat) return;
    var svcsInCat = services.filter(function(s) { return s.category_ids && s.category_ids.includes(catId); });
    var onlyInThis = svcsInCat.filter(function(s) { return !s.category_ids || s.category_ids.length <= 1; });
    var inMultiple = svcsInCat.length - onlyInThis.length;
    var msg = 'Delete "' + cat.name + '"?';
    if (onlyInThis.length > 0) msg += '\n\n' + onlyInThis.length + ' service' + (onlyInThis.length !== 1 ? 's' : '') + ' will be permanently deleted.';
    if (inMultiple > 0) msg += '\n' + inMultiple + ' service' + (inMultiple !== 1 ? 's' : '') + ' will be removed from this category but kept in other categories.';
    if (svcsInCat.length === 0) msg += '\n\nThis category is empty.';
    if (!window.confirm(msg)) return;
    svcStore.deleteCategory(catId);
    // Clean up slots
    setCatSlots(function(prev) {
      var next = {};
      Object.keys(prev).forEach(function(k) { if (prev[k] !== catId) next[k] = prev[k]; });
      return next;
    });
    // Clean up svc slots for this category
    setSvcSlots(function(prev) {
      var next = Object.assign({}, prev);
      delete next[catId];
      return next;
    });
    // Remove orphaned services from all svcSlots
    if (onlyInThis.length > 0) {
      var orphanSet = {};
      onlyInThis.forEach(function(s) { orphanSet[s.id] = true; });
      setSvcSlots(function(prev) {
        var next = {};
        Object.keys(prev).forEach(function(catKey) {
          var catMap = {};
          Object.keys(prev[catKey]).forEach(function(slotKey) {
            if (!orphanSet[prev[catKey][slotKey]]) catMap[slotKey] = prev[catKey][slotKey];
          });
          next[catKey] = catMap;
        });
        return next;
      });
    }
    // Move active cat if needed
    if (activeCat === catId) {
      var remaining = categories.filter(function(c) { return c.id !== catId && c.active; });
      if (remaining.length > 0) setActiveCat(remaining[0].id);
    }
  }

  function handleDeleteService(svcId) {
    svcStore.deleteService(svcId);
    setSvcSlots(function(prev) {
      var next = {};
      Object.keys(prev).forEach(function(catKey) {
        var catMap = {};
        Object.keys(prev[catKey]).forEach(function(slotKey) {
          if (prev[catKey][slotKey] !== svcId) catMap[slotKey] = prev[catKey][slotKey];
        });
        next[catKey] = catMap;
      });
      return next;
    });
    setEditingService(null);
  }

  function handleToggleService(svcId) {
    var svc = services.find(function(s) { return s.id === svcId; });
    if (!svc) return;
    var newActive = !svc.active;
    svcStore.updateService(svcId, { active: newActive });
    setEditingService(null);
  }

  function formatPrice(cents) {
    if (!cents) return '$0';
    return '$' + (cents / 100).toFixed(2);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#0F172A', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Two content panels ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px 16px 16px 24px', gap: 16 }}>

        {/* Left: Category panel */}
        <div style={{ width: 230, minWidth: 230, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #475569', borderRadius: 8, background: '#1E293B', position: 'relative' }}>
          <AreaTag id="SC-CAT" />
          <CategoryGrid
            categories={categories}
            activeCat={activeCat}
            onSelect={setActiveCat}
            catSlots={catSlots}
            catColumns={catColumns}
            catRows={catRows}
            layout="grid"
            mode="edit"
            onRename={handleRenameCategory}
            onEditColor={handleEditCategoryColor}
            onDelete={handleDeleteCategory}
            onAdd={function() { setShowAddCatModal(true); }}
            setCatSlots={setCatSlots}
            setCatColumns={setCatColumns}
            setCatRows={setCatRows}
          />
        </div>

        {/* Right: Service card grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, border: '1px solid #475569', borderRadius: 8, background: '#1E293B', position: 'relative' }}>
          <AreaTag id="SC-SVC" pos="tr" />
          <ServiceGrid
            services={services}
            activeCat={activeCat}
            svcSlots={svcSlots}
            svcColumns={svcColumns}
            svcRows={svcRows}
            mode="edit"
            onEdit={function(svc) { setEditingService(svc); }}
            onAdd={function(slotIdx) { setAddSvcSlotIdx(slotIdx); }}
            setSvcSlots={setSvcSlots}
            setSvcColumns={setSvcColumns}
            setSvcRows={setSvcRows}
          />
        </div>
      </div>

      {/* ── Edit Service Modal ── */}
      {editingService !== null && (
        <AddServiceModal
          service={editingService}
          categoryColor={categories.find(function(c) { return c.id === activeCat; })?.calendar_color || null}
          categories={categories}
          onSave={handleSaveService}
          onDelete={function() { handleDeleteService(editingService.id); }}
          onToggleActive={function() { handleToggleService(editingService.id); }}
          onClose={function() { setEditingService(null); }}
        />
      )}

      {/* ── Add Service Modal (quick-add from grid slot) ── */}
      {addSvcSlotIdx !== null && (
        <AddServiceModal
          categoryColor={categories.find(function(c) { return c.id === activeCat; })?.calendar_color || null}
          onSave={handleQuickAddService}
          onClose={function() { setAddSvcSlotIdx(null); }}
        />
      )}

      {/* ── Add Category Modal ── */}
      {showAddCatModal && (
        <AddCategoryModal
          onSave={handleAddCategory}
          onClose={function() { setShowAddCatModal(false); }}
        />
      )}
    </div>
  );
}
