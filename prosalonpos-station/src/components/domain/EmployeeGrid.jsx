import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Shared Employee Grid Component
 * Used by EmployeeManagementScreen (edit), and future screens (view/select).
 *
 * Modes:
 *   'edit'  — draggable, click to edit, "+" in empties, +/- controls
 *   'view'  — tap to select, blank empties (for future use)
 */
import { useState } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';

var ROLE_LABELS = {
  technician: 'Technician',
  manager: 'Manager',
  owner: 'Owner',
};

var ROLE_COLORS = {
  technician: '#3B82F6',
  manager: '#F59E0B',
  owner: '#8B5CF6',
};

export default function EmployeeGrid({
  employees,
  empSlots, empColumns, empRows,
  mode,  // 'edit' | 'view'
  showInactive,
  // Callbacks
  onTap,           // (emp) => void — view mode
  onEdit,          // (emp) => void — edit mode: open edit form
  onAdd,           // (slotIdx) => void — edit mode: open add form at slot
  // Edit mode: drag-drop + resize
  setEmpSlots, setEmpColumns, setEmpRows,
}) {
  var [draggingId, setDraggingId] = useState(null);
  var [dragOverSlot, setDragOverSlot] = useState(null);

  var isEdit = mode === 'edit';
  var cols = empColumns || 4;
  var rows = empRows || 3;
  var totalSlots = cols * rows;
  var slots = empSlots || {};

  // Drag handlers (edit mode only)
  function handleDragStart(empId, e) { setDraggingId(empId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', empId); }
  function handleDragOver(slotIdx, e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSlot(slotIdx); }
  function handleDragLeave() { setDragOverSlot(null); }
  function handleDrop(targetSlot, e) {
    e.preventDefault(); setDragOverSlot(null);
    if (!draggingId || !setEmpSlots) return;
    setEmpSlots(function(prev) {
      var s = { ...prev };
      var sourceSlot = null;
      Object.keys(s).forEach(function(k) { if (s[k] === draggingId) sourceSlot = parseInt(k); });
      if (sourceSlot === null || sourceSlot === targetSlot) return s;
      var targetEmpId = s[targetSlot] || null;
      s[targetSlot] = draggingId;
      if (targetEmpId) { s[sourceSlot] = targetEmpId; } else { delete s[sourceSlot]; }
      return s;
    });
    setDraggingId(null);
  }
  function handleDragEnd() { setDraggingId(null); setDragOverSlot(null); }

  // Build grid items
  var gridItems = [];
  for (var i = 0; i < totalSlots; i++) {
    (function(slotIdx) {
      var empId = slots[slotIdx];
      var emp = empId ? employees.find(function(e) { return e.id === empId; }) : null;

      // Hide inactive if not showing them
      if (emp && !isEdit && !emp.active) { emp = null; }
      if (emp && isEdit && !showInactive && !emp.active) { emp = null; }

      var isDragOver = dragOverSlot === slotIdx;
      var isDragging = draggingId && emp && emp.id === draggingId;

      if (emp) {
        var isInact = !emp.active;
        var roleColor = ROLE_COLORS[emp.role] || '#64748B';
        var roleLabel = ROLE_LABELS[emp.role] || emp.role;
        var staffIdx = employees.indexOf(emp);

        gridItems.push(
          <div
            key={'eg-' + slotIdx}
            draggable={isEdit}
            onDragStart={isEdit ? function(e) { handleDragStart(emp.id, e); } : undefined}
            onDragEnd={isEdit ? handleDragEnd : undefined}
            onDragOver={isEdit ? function(e) { handleDragOver(slotIdx, e); } : undefined}
            onDragLeave={isEdit ? handleDragLeave : undefined}
            onDrop={isEdit ? function(e) { handleDrop(slotIdx, e); } : undefined}
            onClick={function() {
              if (isEdit && onEdit) onEdit(emp);
              else if (onTap) onTap(emp);
            }}
            style={{
              background: isInact ? '#1E293B' : '#334155',
              border: isDragOver ? '2px dashed #2563EB' : '1px solid #475569',
              borderRadius: 8, padding: '16px',
              cursor: isEdit ? 'grab' : 'pointer', position: 'relative',
              opacity: isDragging ? 0.4 : (isInact ? 0.5 : 1),
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', minHeight: 0,
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={function(e) {
              if (!isDragging) {
                e.currentTarget.style.background = '#3B4A63';
                if (!isDragOver) e.currentTarget.style.borderColor = '#64748B';
              }
            }}
            onMouseLeave={function(e) {
              e.currentTarget.style.background = isInact ? '#1E293B' : '#334155';
              if (!isDragOver) e.currentTarget.style.borderColor = '#475569';
            }}
          >
            {/* Avatar */}
            <div style={{ marginBottom: 10 }}>
              {emp.photo_url ? (
                <img src={emp.photo_url} alt={emp.display_name}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: AVATAR_COLORS[staffIdx % AVATAR_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#E2E8F0', fontSize: 16, fontWeight: 500,
                }}>{getInitials(emp.display_name)}</div>
              )}
            </div>
            {/* Name */}
            <div style={{
              color: '#E2E8F0', fontSize: 15, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%', textAlign: 'center',
            }}>{emp.display_name || 'Unknown'}</div>
            {/* Role badge */}
            <div style={{
              marginTop: 6,
              display: 'inline-flex', padding: '2px 8px', borderRadius: 10,
              fontSize: 11, fontWeight: 500, color: roleColor,
              background: 'rgba(0,0,0,0.3)', border: '1px solid ' + roleColor + '33',
            }}>{roleLabel}</div>
            {/* Inactive badge */}
            {isInact && (
              <div style={{
                marginTop: 4,
                display: 'inline-flex', padding: '1px 6px', borderRadius: 8,
                fontSize: 10, fontWeight: 500, color: '#EF4444',
                background: 'rgba(0,0,0,0.3)', border: '1px solid #EF444433',
              }}>Inactive</div>
            )}
            {/* Tech turn eligible indicator */}
            {!isInact && emp.tech_turn_eligible && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 8, height: 8, borderRadius: '50%', background: '#059669',
              }} title="Tech turn eligible" />
            )}
          </div>
        );
      } else {
        // Empty slot
        if (isEdit) {
          gridItems.push(
            <button key={'eg-' + slotIdx}
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
          gridItems.push(<div key={'eg-' + slotIdx} style={{ borderRadius: 8, border: '1px solid #334155' }} />);
        }
      }
    })(i);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(' + cols + ', 1fr)',
        gridTemplateRows: 'repeat(' + rows + ', minmax(0, 1fr))',
        gap: 8, flex: 1,
      }}>
        {gridItems}
      </div>

      {/* Edit mode: cols × rows controls */}
      {isEdit && setEmpColumns && setEmpRows && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <span style={{ color: '#64748B', fontSize: 12 }}>cols</span>
          <PmBtn enabled={cols > 1} label="−" onClick={function() { setEmpColumns(cols - 1); }} />
          <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{cols}</span>
          <PmBtn enabled={true} label="+" onClick={function() { setEmpColumns(cols + 1); }} />
          <span style={{ color: '#475569', fontSize: 14, margin: '0 2px' }}>×</span>
          <span style={{ color: '#64748B', fontSize: 12 }}>rows</span>
          <PmBtn enabled={rows > 1} label="−" onClick={function() { setEmpRows(rows - 1); }} />
          <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, minWidth: 22, textAlign: 'center' }}>{rows}</span>
          <PmBtn enabled={true} label="+" onClick={function() { setEmpRows(rows + 1); }} />
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
      }}
      onMouseEnter={function(e) { if (enabled) e.currentTarget.style.background = '#334155'; }}
      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
    >{label}</button>
  );
}
