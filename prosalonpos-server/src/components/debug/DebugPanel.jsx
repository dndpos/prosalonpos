/**
 * DebugPanel.jsx — Floating Debug Log Panel
 * Session 83B
 *
 * Shows a scrolling list of debug log entries in the bottom-right corner.
 * Collapsible, draggable, color-coded by type.
 * Only renders when debug mode is ON.
 *
 * Types & colors:
 *   API (blue) — HTTP requests + responses
 *   STORE (green) — Zustand store loads + counts
 *   NAV (purple) — Page navigation
 *   AUTH (amber) — Login / PIN attempts
 *   ERROR (red) — Any errors
 *   SYSTEM (gray) — Debug toggle, startup info
 *   SOCKET (cyan) — WebSocket events
 *   PRINT (pink) — Print jobs
 */

import { useState, useEffect, useRef } from 'react';
import { useDebugStore } from '../../lib/stores/debugStore';

var TYPE_COLORS = {
  API:    '#3B82F6',
  STORE:  '#10B981',
  NAV:    '#8B5CF6',
  AUTH:   '#F59E0B',
  ERROR:  '#EF4444',
  SYSTEM: '#6B7280',
  SOCKET: '#06B6D4',
  PRINT:  '#EC4899',
};

var TYPE_BG = {
  API:    'rgba(59,130,246,0.12)',
  STORE:  'rgba(16,185,129,0.12)',
  NAV:    'rgba(139,92,246,0.12)',
  AUTH:   'rgba(245,158,11,0.12)',
  ERROR:  'rgba(239,68,68,0.15)',
  SYSTEM: 'rgba(107,114,128,0.12)',
  SOCKET: 'rgba(6,182,212,0.12)',
  PRINT:  'rgba(236,72,153,0.12)',
};

function formatTime(d) {
  var h = d.getHours(); var m = d.getMinutes(); var s = d.getSeconds(); var ms = d.getMilliseconds();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
}

export default function DebugPanel() {
  var enabled = useDebugStore(function(s) { return s.enabled; });
  var logs = useDebugStore(function(s) { return s.logs; });
  var collapsed = useDebugStore(function(s) { return s.panelCollapsed; });
  var togglePanel = useDebugStore(function(s) { return s.togglePanel; });
  var clearLogs = useDebugStore(function(s) { return s.clearLogs; });

  var [filter, setFilter] = useState('ALL');
  var [autoScroll, setAutoScroll] = useState(true);
  var scrollRef = useRef(null);

  // Dragging state
  var [pos, setPos] = useState({ x: null, y: null });
  var dragRef = useRef(null);
  var dragStart = useRef(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(function() {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  // Keyboard shortcut: Ctrl+Shift+D toggles debug
  useEffect(function() {
    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        useDebugStore.getState().toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  if (!enabled) return null;

  var filtered = filter === 'ALL' ? logs : logs.filter(function(l) { return l.type === filter; });

  // Drag handlers
  function onMouseDown(e) {
    if (e.target.tagName === 'DIV' && e.target === dragRef.current) {
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x || (window.innerWidth - 430), py: pos.y || (window.innerHeight - 370) };
      e.preventDefault();
    }
  }
  function onMouseMove(e) {
    if (!dragStart.current) return;
    var dx = e.clientX - dragStart.current.mx;
    var dy = e.clientY - dragStart.current.my;
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  }
  function onMouseUp() { dragStart.current = null; }

  useEffect(function() {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return function() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  var panelX = pos.x !== null ? pos.x : (window.innerWidth - 430);
  var panelY = pos.y !== null ? pos.y : (window.innerHeight - 370);

  // Collapsed: just show a small pill
  if (collapsed) {
    return (
      <div
        style={{
          position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
          background: '#1A2736', border: '1px solid #10B981', borderRadius: 20,
          padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
        onClick={togglePanel}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>DEBUG</span>
        <span style={{ fontSize: 11, color: '#64748B' }}>{logs.length}</span>
      </div>
    );
  }

  var filterTypes = ['ALL', 'API', 'STORE', 'NAV', 'AUTH', 'ERROR', 'SYSTEM', 'SOCKET', 'PRINT'];

  return (
    <div style={{
      position: 'fixed', left: panelX, top: panelY, zIndex: 99999,
      width: 420, height: 350,
      background: '#0B1220', border: '1px solid #1E3A5F', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 11,
    }}>
      {/* Title bar — draggable */}
      <div
        ref={dragRef}
        onMouseDown={onMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', background: '#162032', borderRadius: '10px 10px 0 0',
          cursor: 'grab', userSelect: 'none', borderBottom: '1px solid #1E3A5F',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', letterSpacing: '0.05em' }}>DEBUG LOG</span>
          <span style={{ fontSize: 10, color: '#475569' }}>({filtered.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div onClick={clearLogs}
            style={{ fontSize: 10, color: '#64748B', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px solid #2A3A50' }}
            onMouseEnter={function(e) { e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={function(e) { e.currentTarget.style.color = '#64748B'; }}
          >Clear</div>
          <div onClick={function() { setAutoScroll(!autoScroll); }}
            style={{ fontSize: 10, color: autoScroll ? '#10B981' : '#64748B', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px solid #2A3A50' }}
          >{autoScroll ? '⬇ Auto' : '⬇ Manual'}</div>
          <div onClick={togglePanel}
            style={{ fontSize: 12, color: '#64748B', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
            onMouseEnter={function(e) { e.currentTarget.style.color = '#E2E8F0'; }}
            onMouseLeave={function(e) { e.currentTarget.style.color = '#64748B'; }}
          >—</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '4px 8px', background: '#0F172A',
        borderBottom: '1px solid #1E3A5F', flexWrap: 'wrap',
      }}>
        {filterTypes.map(function(ft) {
          var active = filter === ft;
          var color = ft === 'ALL' ? '#94A3B8' : (TYPE_COLORS[ft] || '#94A3B8');
          return (
            <div key={ft} onClick={function() { setFilter(ft); }}
              style={{
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                cursor: 'pointer', letterSpacing: '0.03em',
                background: active ? (ft === 'ALL' ? 'rgba(148,163,184,0.15)' : (TYPE_BG[ft] || 'rgba(148,163,184,0.15)')) : 'transparent',
                color: active ? color : '#475569',
                border: active ? '1px solid ' + color + '40' : '1px solid transparent',
              }}
            >{ft}</div>
          );
        })}
      </div>

      {/* Log entries */}
      <div ref={scrollRef} style={{
        flex: 1, overflow: 'auto', padding: '4px 0',
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 11 }}>
            No log entries{filter !== 'ALL' ? ' for ' + filter : ''}.
          </div>
        )}
        {filtered.map(function(entry) {
          var color = TYPE_COLORS[entry.type] || '#94A3B8';
          var bg = TYPE_BG[entry.type] || 'transparent';
          return (
            <div key={entry.id} style={{
              display: 'flex', gap: 6, padding: '3px 10px', alignItems: 'flex-start',
              borderBottom: '1px solid #0F172A',
            }}>
              <span style={{ fontSize: 9, color: '#475569', flexShrink: 0, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(entry.time)}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: color, background: bg,
                padding: '1px 4px', borderRadius: 3, flexShrink: 0, marginTop: 0,
                minWidth: 42, textAlign: 'center',
              }}>
                {entry.type}
              </span>
              <span style={{ fontSize: 11, color: '#CBD5E1', wordBreak: 'break-word', lineHeight: 1.4 }}>
                {entry.message}
                {entry.data && (
                  <span style={{ color: '#475569', marginLeft: 6, fontSize: 10 }}>
                    {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 10px', borderTop: '1px solid #1E3A5F', background: '#0F172A',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderRadius: '0 0 10px 10px',
      }}>
        <span style={{ fontSize: 9, color: '#475569' }}>Ctrl+Shift+D to toggle</span>
        <span style={{ fontSize: 9, color: '#475569' }}>{logs.length} total entries</span>
      </div>
    </div>
  );
}
