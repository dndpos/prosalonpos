import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Shared Service Grid Component
 * Used by ServiceCatalogScreen (edit), CheckoutTabs (select), BookingFlow (multi).
 *
 * Modes:
 *   'edit'   — draggable, click to edit, "+" in empties, badges, +/- controls
 *   'select' — tap to add to ticket, blank empties (checkout)
 *   'multi'  — tap to toggle checkmark (booking flow)
 */
import { useState } from 'react';
import { fmt } from '../../lib/formatUtils';


export default function ServiceGrid({
  services, activeCat,
  svcSlots, svcColumns, svcRows,
  mode,  // 'edit' | 'select' | 'multi'
  // Display toggles (from salon settings)
  showTime,          // boolean — show duration on tiles (default true)
  showProductCost,   // boolean — show product cost deduction on tiles (default true)
  // Callbacks
  onTap,           // (svc) => void — select/multi: add or toggle
  onEdit,          // (svc) => void — edit: open edit modal
  onAdd,           // (slotIdx) => void — edit: open add modal at slot
  selectedIds,     // string[] — multi: which services are selected
  // Edit mode: drag-drop + resize
  setSvcSlots, setSvcColumns, setSvcRows,
}) {
  var C = useTheme();
  var [draggingId, setDraggingId] = useState(null);
  var [dragOverSlot, setDragOverSlot] = useState(null);

  var isEdit = mode === 'edit';
  var isMulti = mode === 'multi';
  var cols = svcColumns || 4;
  var rows = svcRows || 3;
  var totalSlots = cols * rows;
  var currentSlots = (svcSlots && svcSlots[activeCat]) || {};
  var selSet = isMulti && selectedIds ? new Set(selectedIds) : null;

  // Drag handlers (edit mode only)
  function handleDragStart(svcId, e) { setDraggingId(svcId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', svcId); }
  function handleDragOver(slotIdx, e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSlot(slotIdx); }
  function handleDragLeave() { setDragOverSlot(null); }
  function handleDrop(targetSlot, e) {
    e.preventDefault(); setDragOverSlot(null);
    if (!draggingId || !setSvcSlots) return;
    setSvcSlots(function(prev) {
      var catMap = prev[activeCat] ? { ...prev[activeCat] } : {};
      var sourceSlot = null;
      Object.keys(catMap).forEach(function(k) { if (catMap[k] === draggingId) sourceSlot = parseInt(k); });
      if (sourceSlot === null || sourceSlot === targetSlot) return prev;
      var targetSvcId = catMap[targetSlot] || null;
      catMap[targetSlot] = draggingId;
      if (targetSvcId) { catMap[sourceSlot] = targetSvcId; } else { delete catMap[sourceSlot]; }
      return { ...prev, [activeCat]: catMap };
    });
    setDraggingId(null);
  }
  function handleDragEnd() { setDraggingId(null); setDragOverSlot(null); }

  // ── Build grid items ──
  var gridItems = [];
  for (var i = 0; i < totalSlots; i++) {
    (function(slotIdx) {
      var svcId = currentSlots[slotIdx];
      var svc = svcId ? services.find(function(s) { return s.id === svcId; }) : null;

      // S104: Hide inactive in non-edit modes; edit mode always shows them dimmed
      if (svc && !isEdit && svc.active === false) { svc = null; }
      // Only show if in this category
      if (svc && (!svc.category_ids || !svc.category_ids.includes(activeCat))) { svc = null; }

      var isDragOver = dragOverSlot === slotIdx;
      var isDragging = draggingId && svc && svc.id === draggingId;

      if (svc) {
        var isInact = !svc.active;
        var isSelected = selSet && selSet.has(svc.id);

        gridItems.push(
          <div
            key={'sg-' + slotIdx}
            draggable={isEdit}
            onDragStart={isEdit ? function(e) { handleDragStart(svc.id, e); } : undefined}
            onDragEnd={isEdit ? handleDragEnd : undefined}
            onDragOver={isEdit ? function(e) { handleDragOver(slotIdx, e); } : undefined}
            onDragLeave={isEdit ? handleDragLeave : undefined}
            onDrop={isEdit ? function(e) { handleDrop(slotIdx, e); } : undefined}
            onClick={function() {
              if (isEdit && onEdit) onEdit(svc);
              else if (onTap) onTap(svc);
            }}
            style={{
              background: isSelected ? C.blueTint : (isInact ? '#1E293B' : '#334155'),
              border: isDragOver ? '2px dashed #2563EB' : (isSelected ? '2px solid ' + C.blue : '1px solid #475569'),
              borderRadius: 8, padding: 'clamp(6px, 1vw, 14px) clamp(8px, 1.2vw, 16px)',
              cursor: isEdit ? 'grab' : 'pointer', position: 'relative',
              opacity: isDragging ? 0.4 : (isInact ? 0.5 : 1),
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              overflow: 'hidden', minHeight: 0,
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={function(e) {
              if (!isDragging && !isSelected) {
                e.currentTarget.style.background = '#3B4A63';
                if (!isDragOver) e.currentTarget.style.borderColor = svc.calendar_color || C.blue;
              }
            }}
            onMouseLeave={function(e) {
              if (!isSelected) {
                e.currentTarget.style.background = isInact ? '#1E293B' : '#334155';
                if (!isDragOver) e.currentTarget.style.borderColor = isSelected ? C.blue : '#475569';
              }
            }}
          >
            {/* Color square + name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, minHeight: 0 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: svc.calendar_color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ color: '#E2E8F0', fontSize: 'clamp(10px, 1.1vw, 15px)', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1, wordBreak: 'break-word' }}>{svc.name}</div>
            </div>
            {/* Price + duration + product cost */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: 'clamp(10px, 1vw, 13px)' }}>{svc.open_price ? 'Open Price' : fmt(svc.price_cents)}</span>
              {showProductCost !== false && svc.product_cost_cents > 0 && (
                <span style={{ color: '#F59E0B', fontSize: 'clamp(9px, 0.8vw, 11px)' }}>-{fmt(svc.product_cost_cents)}</span>
              )}
              {showTime !== false && svc.default_duration_minutes > 0 && (
                <span style={{ color: '#64748B', fontSize: 'clamp(10px, 1vw, 13px)' }}>{svc.default_duration_minutes} min</span>
              )}
            </div>
            {/* Badges (edit mode only) */}
            {isEdit && (isInact || !svc.online_booking_enabled || svc.requires_room || (svc.category_ids && svc.category_ids.length > 1)) && (
              <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                {isInact && <Badge color="#EF4444" label="Inactive" />}
                {!svc.online_booking_enabled && <Badge color="#64748B" label="No Online" />}
                {svc.requires_room && <Badge color="#8B5CF6" label="Room" />}
                {svc.category_ids && svc.category_ids.length > 1 && <Badge color="#14B8A6" label={svc.category_ids.length + ' cats'} />}
              </div>
            )}
            {/* Checkmark (multi mode) */}
            {isMulti && isSelected && (
              <div style={{ position: 'absolute', top: 10, right: 12, color: C.blueLight, fontSize: 18, fontWeight: 500 }}>✓</div>
            )}
          </div>
        );
      } else {
        // Empty slot
        if (isEdit) {
          gridItems.push(
            <button key={'sg-' + slotIdx}
              onClick={function() { if (onAdd) onAdd(slotIdx); }}
              onDragOver={function(e) { handleDragOver(slotIdx, e); }}
              onDragLeave={handleDragLeave}
              onDrop={function(e) { handleDrop(slotIdx, e); }}
              style={{
                borderRadius: 8,
                border: isDragOver ? '2px dashed #2563EB' : '1px dashed #475569',
                background: isDragOver ? 'rgba(37,99,235,0.08)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: 28, fontWeight: 300,
                fontFamily: "'Inter', sans-serif", outline: 'none',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#64748B'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(51,65,85,0.25)'; }}
              onMouseLeave={function(e) { if (!isDragOver) { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; } }}
            >+</button>
          );
        } else {
          // View/multi: invisible placeholder to keep grid layout
          gridItems.push(<div key={'sg-' + slotIdx} />);
        }
      }
    })(i);
  }

  // Edit mode: gridAutoRows so grid can scroll when lots of rows
  // Select/Multi mode: gridTemplateRows with 1fr so all rows fit on screen
  var gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(' + cols + ', 1fr)',
    gap: 8,
  };
  if (isEdit) {
    gridStyle.gridAutoRows = '90px';
  } else {
    gridStyle.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
    gridStyle.height = '100%';
  }

  return (
    <div style={isEdit ? {} : { height: '100%' }}>
      <div style={gridStyle}>
        {gridItems}
      </div>

      {/* Edit mode: cols × rows controls */}
      {isEdit && setSvcColumns && setSvcRows && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <span style={{ color: '#64748B', fontSize: 12 }}>cols</span>
          <PmBtn enabled={cols > 1} label="−" onClick={function() { setSvcColumns(cols - 1); }} />
          <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{cols}</span>
          <PmBtn enabled={true} label="+" onClick={function() { setSvcColumns(cols + 1); }} />
          <span style={{ color: '#475569', fontSize: 14, margin: '0 2px' }}>×</span>
          <span style={{ color: '#64748B', fontSize: 12 }}>rows</span>
          <PmBtn enabled={rows > 1} label="−" onClick={function() { setSvcRows(rows - 1); }} />
          <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{rows}</span>
          <PmBtn enabled={true} label="+" onClick={function() { setSvcRows(rows + 1); }} />
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
        width: 28, height: 28, borderRadius: 6, cursor: enabled ? 'pointer' : 'default',
        border: '1px solid #475569', background: 'transparent', outline: 'none',
        color: enabled ? '#94A3B8' : '#334155', fontSize: 16, fontWeight: 500,
        WebkitTapHighlightColor: 'transparent',
      }}
      onFocus={function(e) { e.currentTarget.style.outline = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
      onMouseEnter={function(e) { if (enabled) e.currentTarget.style.background = '#334155'; }}
      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
    >{label}</button>
  );
}

function Badge({ color, label }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '1px 6px', borderRadius: 8,
      fontSize: 10, fontWeight: 500, color: color,
      background: 'rgba(0,0,0,0.3)', border: '1px solid ' + color + '33',
    }}>{label}</span>
  );
}
