/**
 * DebugToggleSection.jsx — Debug toggle for Salon Settings
 * Session 83B
 */

import { useDebugStore } from '../../lib/stores/debugStore';

export default function DebugToggleSection({ T }) {
  var debugEnabled = useDebugStore(function(s) { return s.enabled; });
  var toggleDebug = useDebugStore(function(s) { return s.toggle; });
  var logCount = useDebugStore(function(s) { return s.logs.length; });
  var clearLogs = useDebugStore(function(s) { return s.clearLogs; });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Debug Mode</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Shows floating log panel + element labels. Ctrl+Shift+D to toggle.</div>
        </div>
        <div onClick={toggleDebug} style={{
          width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
          transition: 'background-color 150ms', flexShrink: 0,
          backgroundColor: debugEnabled ? '#10B981' : T.grid, border: '1px solid ' + (debugEnabled ? '#10B981' : T.border),
        }}>
          <div style={{ position: 'absolute', top: 2, left: debugEnabled ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
        </div>
      </div>
      {debugEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.grid, borderRadius: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ fontSize: 12, color: T.text, flex: 1 }}>Debug active — {logCount} log entries</span>
          <div onClick={clearLogs} style={{ fontSize: 11, color: T.danger, cursor: 'pointer', padding: '2px 8px', borderRadius: 4, border: '1px solid ' + T.border }}>Clear</div>
        </div>
      )}
    </div>
  );
}
