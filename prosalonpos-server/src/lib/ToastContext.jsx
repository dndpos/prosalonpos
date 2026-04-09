import { createContext, useContext, useState, useCallback } from 'react';
import { useTheme } from './ThemeContext';

/**
 * ToastContext — Session 76
 *
 * In-app toast notification to replace native alert() popups.
 * Shows a themed notification bar at the top of the screen that
 * auto-dismisses after 3 seconds (or click to dismiss).
 *
 * Usage:
 *   var toast = useToast();
 *   toast.show('Client profile saved!');                    // default (info)
 *   toast.show('Cannot delete category', 'error');         // error style
 *   toast.show('Package saved successfully', 'success');   // success style
 *   toast.confirm('Delete this plan?', function() { doDelete(); });  // confirmation modal
 */

var ToastCtx = createContext(null);

export function useToast() {
  var ctx = useContext(ToastCtx);
  if (!ctx) return { show: function() {}, confirm: function(_msg, cb) { cb(); } };
  return ctx;
}

export function ToastProvider({ children }) {
  var C = useTheme();
  var [toasts, setToasts] = useState([]);
  var [confirmState, setConfirmState] = useState(null); // { message, onConfirm, onCancel }

  var show = useCallback(function(message, type) {
    var id = Date.now() + Math.random();
    var t = type || 'info';
    setToasts(function(prev) { return prev.concat([{ id: id, message: message, type: t }]); });
    setTimeout(function() {
      setToasts(function(prev) { return prev.filter(function(x) { return x.id !== id; }); });
    }, 3500);
  }, []);

  var dismiss = useCallback(function(id) {
    setToasts(function(prev) { return prev.filter(function(x) { return x.id !== id; }); });
  }, []);

  var confirm = useCallback(function(message, onConfirm, onCancel) {
    setConfirmState({ message: message, onConfirm: onConfirm, onCancel: onCancel || null });
  }, []);

  function handleConfirmYes() {
    var cb = confirmState.onConfirm;
    setConfirmState(null);
    if (cb) cb();
  }

  function handleConfirmNo() {
    var cb = confirmState && confirmState.onCancel;
    setConfirmState(null);
    if (cb) cb();
  }

  var STYLES = {
    info:    { bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', color: '#7DD3FC', icon: 'ℹ️' },
    success: { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.3)',  color: '#6EE7B7', icon: '✓' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  color: '#FCA5A5', icon: '⚠' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: '#FBBF24', icon: '⚠' },
  };

  return (
    <ToastCtx.Provider value={{ show: show, confirm: confirm }}>
      {children}

      {/* Toast notifications — top center */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          {toasts.map(function(t) {
            var s = STYLES[t.type] || STYLES.info;
            return (
              <div key={t.id} onClick={function() { dismiss(t.id); }}
                style={{ pointerEvents: 'auto', background: C.chrome, border: '1px solid ' + s.border, borderLeft: '4px solid ' + s.color, borderRadius: 8, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 280, maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', cursor: 'pointer', animation: 'toastSlideIn 0.2s ease-out' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, flex: 1 }}>{t.message}</span>
                <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal — replaces window.confirm() */}
      {confirmState && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleConfirmNo}>
          <div style={{ backgroundColor: C.chrome, border: '1px solid ' + C.borderMedium, borderRadius: 12, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Confirm</div>
              <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: '1.5' }}>{confirmState.message}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 24px', justifyContent: 'flex-end', borderTop: '1px solid ' + C.borderLight }}>
              <div onClick={handleConfirmNo}
                style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid ' + C.borderMedium, background: 'none', color: C.textPrimary, fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = C.chromeDark; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}
              >Cancel</div>
              <div onClick={handleConfirmYes}
                style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: '#3B1010', color: '#FCA5A5', fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none', transition: 'border-color 150ms' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#5A1515'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#3B1010'; }}
              >Yes, Continue</div>
            </div>
          </div>
        </div>
      )}

      {/* Toast animation */}
      <style>{`@keyframes toastSlideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastCtx.Provider>
  );
}
