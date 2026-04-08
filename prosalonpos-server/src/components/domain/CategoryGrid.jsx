import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Shared Category Grid Component
 * Used by ServiceCatalogScreen (edit), CheckoutTabs (view), BookingFlow (tabs).
 *
 * Modes:
 *   'edit'  — draggable, context menu, rename, "+" in empties, +/- col controls
 *   'view'  — tap to select, blank empties, no editing
 *   'tabs'  — horizontal scrolling tab bar (BookingFlow)
 */
import { useState } from 'react';

// ── Shared button style ──
function catBtnStyle(isActive, isInactive) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6,
    padding: '4px 12px', borderRadius: 6,
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", outline: 'none',
    overflow: 'hidden',
    background: isActive ? '#2563EB' : '#334155',
    color: isActive ? '#FFFFFF' : (isInactive ? '#475569' : '#E2E8F0'),
    border: '1px solid ' + (isActive ? '#2563EB' : '#475569'),
    width: '100%', boxSizing: 'border-box',
    opacity: isInactive ? 0.6 : 1,
    fontStyle: isInactive ? 'italic' : 'normal',
  };
}
function hoverOn(e, isActive) {
  if (!isActive) { e.currentTarget.style.background = '#3E4C5E'; e.currentTarget.style.color = '#E2E8F0'; e.currentTarget.style.borderColor = '#64748B'; }
}
function hoverOff(e, isActive, isInactive) {
  if (!isActive) { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = isInactive ? '#475569' : '#E2E8F0'; e.currentTarget.style.borderColor = '#475569'; }
}

export default function CategoryGrid({
  categories, activeCat, onSelect,
  // Layout
  catSlots, catColumns, catRows, layout,  // layout: 'grid' | 'tabs'
  // Edit mode callbacks (optional)
  mode,  // 'edit' | 'view' | 'tabs'
  onRename, onToggleActive, onAdd, onEditColor, onDelete,
  setCatSlots, setCatColumns, setCatRows,
}) {
  var [draggingId, setDraggingId] = useState(null);
  var [dragOverSlot, setDragOverSlot] = useState(null);
  var [menuId, setMenuId] = useState(null);
  var [colorPickerId, setColorPickerId] = useState(null);
  var [renamingId, setRenamingId] = useState(null);
  var [renameValue, setRenameValue] = useState('');

  var isEdit = mode === 'edit';
  var activeCategories = categories.filter(function(c) { return c.active !== false; });
  // S104: Edit mode always shows inactive (dimmed). View/tabs mode hides them.
  var showAll = isEdit;

  // ── TABS MODE (horizontal bar for BookingFlow) ──
  if (layout === 'tabs' || mode === 'tabs') {
    return (
      <div style={{ display: 'flex', gap: 6, overflow: 'auto', flexShrink: 0 }}>
        {activeCategories.map(function(cat) {
          var isAct = activeCat === cat.id;
          return (
            <button key={cat.id} onClick={function() { onSelect(cat.id); }}
              style={{
                ...catBtnStyle(isAct, false),
                width: 'auto', height: 34, padding: '0 16px', fontSize: 13, flexShrink: 0,
              }}
              onMouseEnter={function(e) { hoverOn(e, isAct); }}
              onMouseLeave={function(e) { hoverOff(e, isAct, false); }}
            >
              {cat.calendar_color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.calendar_color, flexShrink: 0 }} />}
              {cat.name}
            </button>
          );
        })}
      </div>
    );
  }

  // ── GRID MODE (slot-based panel) ──
  var slots = catSlots || {};
  var cols = catColumns || 1;
  var rows = catRows || 9;
  var displayCats = showAll ? categories : activeCategories;
  var maxSlot = 0;
  Object.keys(slots).forEach(function(k) { var n = parseInt(k); if (n > maxSlot) maxSlot = n; });
  // View mode: only show slots that have categories (no empty padding)
  // Edit mode: show fixed grid based on cols × rows
  var totalSlots;
  // For view mode, collect ordered list of slot indices that have active categories
  var activeSlotKeys = [];
  if (!isEdit) {
    Object.keys(slots).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(k) {
      var cid = slots[k];
      var c = cid ? categories.find(function(cat) { return cat.id === cid && cat.active; }) : null;
      if (c) activeSlotKeys.push(parseInt(k));
    });
  }
  if (isEdit) {
    totalSlots = cols * rows;
  } else {
    // Use catRows so grid has consistent sizing even with fewer categories
    totalSlots = rows ? Math.max(activeSlotKeys.length, cols * rows) : activeSlotKeys.length;
  }

  // Drag handlers (edit mode only)
  function handleDragStart(catId, e) { setDraggingId(catId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', catId); }
  function handleDragOver(slotIdx, e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSlot(slotIdx); }
  function handleDragLeave() { setDragOverSlot(null); }
  function handleDrop(targetSlot, e) {
    e.preventDefault(); setDragOverSlot(null);
    if (!draggingId || !setCatSlots) return;
    setCatSlots(function(prev) {
      var s = { ...prev };
      var sourceSlot = null;
      Object.keys(s).forEach(function(k) { if (s[k] === draggingId) sourceSlot = parseInt(k); });
      if (sourceSlot === null || sourceSlot === targetSlot) return s;
      var targetCatId = s[targetSlot] || null;
      s[targetSlot] = draggingId;
      if (targetCatId) { s[sourceSlot] = targetCatId; } else { delete s[sourceSlot]; }
      return s;
    });
    setDraggingId(null);
  }
  function handleDragEnd() { setDraggingId(null); setDragOverSlot(null); }
  function handleRenameSubmit(catId) {
    if (renameValue.trim() && onRename) onRename(catId, renameValue.trim());
    setRenamingId(null); setRenameValue('');
  }

  var inputStyle = {
    gridColumn: '1 / -1', height: 56, padding: '0 12px', borderRadius: 6,
    border: '1px solid #2563EB', background: '#334155', color: '#E2E8F0',
    fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  var gridItems = [];
  for (var i = 0; i < totalSlots; i++) {
    (function(slotIdx) {
      // In view mode, slotIdx maps through activeSlotKeys to skip empty/inactive slots
      var actualSlot = isEdit ? slotIdx : activeSlotKeys[slotIdx];
      var catId = slots[actualSlot];
      var cat = catId ? categories.find(function(c) { return c.id === catId; }) : null;
      if (cat && !showAll && !cat.active) { cat = null; }

      var isDragOver = dragOverSlot === slotIdx;
      var isDragging = draggingId && cat && cat.id === draggingId;

      if (cat) {
        var isAct = activeCat === cat.id;
        var isInact = !cat.active;

        if (isEdit && renamingId === cat.id) {
          gridItems.push(
            <input key={'cs-' + slotIdx} style={inputStyle} value={renameValue}
              onChange={function(e) { setRenameValue(e.target.value); }}
              onKeyDown={function(e) {
                if (e.key === 'Enter') handleRenameSubmit(cat.id);
                if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
              }}
              onBlur={function() { handleRenameSubmit(cat.id); }}
              autoFocus />
          );
          return;
        }

        gridItems.push(
          <div key={'cs-' + slotIdx} style={{ position: 'relative', height: '100%' }}
            draggable={isEdit}
            onDragStart={isEdit ? function(e) { handleDragStart(cat.id, e); } : undefined}
            onDragEnd={isEdit ? handleDragEnd : undefined}
            onDragOver={isEdit ? function(e) { handleDragOver(slotIdx, e); } : undefined}
            onDragLeave={isEdit ? handleDragLeave : undefined}
            onDrop={isEdit ? function(e) { handleDrop(slotIdx, e); } : undefined}
          >
            <button
              onClick={function() { onSelect(cat.id); setMenuId(null); }}
              onContextMenu={isEdit ? function(e) { e.preventDefault(); setMenuId(menuId === cat.id ? null : cat.id); } : undefined}
              style={{
                ...catBtnStyle(isAct, isInact),
                minHeight: 44, height: isEdit ? 90 : '100%',
                opacity: isDragging ? 0.4 : (isInact ? 0.6 : 1),
                outline: isDragOver ? '2px dashed #2563EB' : 'none',
                cursor: isEdit ? 'grab' : 'pointer',
              }}
              onMouseEnter={function(e) { hoverOn(e, isAct); }}
              onMouseLeave={function(e) { hoverOff(e, isAct, isInact); }}
            >
              {cat.calendar_color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.calendar_color, flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'left', flex: 1 }}>{cat.name}</span>
            </button>

            {/* Edit mode: ⋯ menu trigger */}
            {isEdit && (
              <button
                onClick={function(e) { e.stopPropagation(); setMenuId(menuId === cat.id ? null : cat.id); }}
                style={{
                  position: 'absolute', top: 1, right: 2, background: 'none', border: 'none',
                  color: isAct ? 'rgba(255,255,255,0.5)' : '#475569', cursor: 'pointer',
                  fontSize: 12, padding: '2px 4px', display: 'flex', lineHeight: 1,
                }}
              >⋯</button>
            )}

            {/* Context menu */}
            {isEdit && menuId === cat.id && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#334155', border: '1px solid #475569', borderRadius: 6,
                padding: 4, minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <MenuBtn label="Rename" onClick={function() { setRenamingId(cat.id); setRenameValue(cat.name); setMenuId(null); }} />
                <MenuBtn label="Change Color" onClick={function() { setColorPickerId(cat.id); setMenuId(null); }} />
                <div style={{ height: 1, background: '#475569', margin: '4px 0' }} />
                <MenuBtn label="Delete" danger onClick={function() { if (onDelete) onDelete(cat.id); setMenuId(null); }} />
              </div>
            )}

            {/* Inline color picker */}
            {isEdit && colorPickerId === cat.id && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#334155', border: '1px solid #475569', borderRadius: 8,
                padding: 10, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6 }}>Category Color</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['#EF4444','#F97316','#F59E0B','#22C55E','#10B981','#3B82F6','#8B5CF6','#EC4899','#06B6D4','#14B8A6','#84CC16','#6366F1'].map(function(hex) {
                    var isSel = cat.calendar_color === hex;
                    return (
                      <div key={hex} onClick={function(e) { e.stopPropagation(); if (onEditColor) onEditColor(cat.id, hex); setColorPickerId(null); }}
                        style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: 'pointer', border: isSel ? '2px solid #fff' : '2px solid transparent' }} />
                    );
                  })}
                  <div onClick={function(e) { e.stopPropagation(); if (onEditColor) onEditColor(cat.id, null); setColorPickerId(null); }}
                    style={{ width: 22, height: 22, borderRadius: 4, background: '#475569', cursor: 'pointer', border: !cat.calendar_color ? '2px solid #fff' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94A3B8' }}>✕</div>
                </div>
              </div>
            )}
          </div>
        );
        } else {
          // Empty slot
          if (isEdit) {
          gridItems.push(
            <button key={'cs-' + slotIdx}
              onClick={function() { if (onAdd) onAdd(); setMenuId(null); }}
              onDragOver={function(e) { handleDragOver(slotIdx, e); }}
              onDragLeave={handleDragLeave}
              onDrop={function(e) { handleDrop(slotIdx, e); }}
              style={{
                height: 90, borderRadius: 6,
                border: isDragOver ? '2px dashed #2563EB' : '1px dashed #475569',
                background: isDragOver ? 'rgba(37,99,235,0.08)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: 24, fontWeight: 300,
                fontFamily: "'Inter', sans-serif", outline: 'none',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#64748B'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(51,65,85,0.25)'; }}
              onMouseLeave={function(e) { if (!isDragOver) { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; } }}
            >+</button>
          );
        } else {
          // View mode: invisible placeholder to keep grid layout consistent
          gridItems.push(<div key={'cs-' + slotIdx} />);
        }
      }
    })(i);
  }

  var gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', 1fr)', gap: 8 };
  if (isEdit) {
    gridStyle.gridAutoRows = '90px';
  } else {
    // Use catRows for consistent sizing — categories fill from top, empty rows stay blank
    var viewRows = rows || totalSlots;
    gridStyle.gridTemplateRows = 'repeat(' + viewRows + ', 1fr)';
    gridStyle.height = '100%';
  }

  return (
    <div style={isEdit ? {} : { height: '100%' }}>
      <div style={gridStyle}>
        {gridItems}
      </div>

      {/* Edit mode: +/- column and row controls */}
      {isEdit && setCatColumns && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <span style={{ color: '#64748B', fontSize: 12 }}>cols</span>
          <PmBtn enabled={cols > 1} label="−" onClick={function() { setCatColumns(cols - 1); }} />
          <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{cols}</span>
          <PmBtn enabled={true} label="+" onClick={function() { setCatColumns(cols + 1); }} />
          {setCatRows && (
            <>
              <span style={{ color: '#475569', fontSize: 14, margin: '0 2px' }}>×</span>
              <span style={{ color: '#64748B', fontSize: 12 }}>rows</span>
              <PmBtn enabled={rows > 1} label="−" onClick={function() { setCatRows(rows - 1); }} />
              <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{rows}</span>
              <PmBtn enabled={true} label="+" onClick={function() { setCatRows(rows + 1); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PmBtn({ enabled, label, onClick }) {
  return (
    <button onClick={enabled ? onClick : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6, cursor: enabled ? 'pointer' : 'default',
        border: '1px solid #475569', background: 'transparent', outline: 'none',
        color: enabled ? '#94A3B8' : '#334155', fontSize: 18, fontWeight: 500,
      }}
      onMouseEnter={function(e) { if (enabled) e.currentTarget.style.background = '#334155'; }}
      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
    >{label}</button>
  );
}

function MenuBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: '6px 12px', borderRadius: 4,
        fontSize: 13, cursor: 'pointer', border: 'none', textAlign: 'left',
        background: 'transparent', color: danger ? '#EF4444' : '#E2E8F0',
        outline: 'none', fontFamily: "'Inter', sans-serif",
      }}
      onMouseEnter={function(e) { e.currentTarget.style.background = '#1E293B'; }}
      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
    >{label}</button>
  );
}
