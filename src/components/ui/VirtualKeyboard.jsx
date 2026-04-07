/**
 * Pro Salon POS — Virtual Keyboard
 * Auto-appears when any input/textarea is focused.
 * Dark theme, QWERTY layout, supports shift, backspace, space.
 * Place once in App.jsx — works globally.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';

const ROWS_LOWER = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['⇧','z','x','c','v','b','n','m','⌫'],
];
const ROWS_UPPER = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['⇧','Z','X','C','V','B','N','M','⌫'],
];
const ROWS_SYMBOL = [
  ['!','@','#','$','%','&','*','(',')','-'],
  ['+','=','_','"',"'",'/',':',';','?','~'],
  [',','.','{','}','[',']','<','>','|'],
  ['ABC','!','@','#','$','%','^','&','⌫'],
];

// Native setter trick to work with React controlled inputs
const inputSetter = typeof HTMLInputElement !== 'undefined'
  ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set : null;
const textareaSetter = typeof HTMLTextAreaElement !== 'undefined'
  ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set : null;

function setNativeValue(el, value) {
  if (el.tagName === 'TEXTAREA' && textareaSetter) {
    textareaSetter.call(el, value);
  } else if (inputSetter) {
    inputSetter.call(el, value);
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function VirtualKeyboard() {
  var C = useTheme();
  const [visible, setVisible] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const activeRef = useRef(null);
  const kbRef = useRef(null);

  useEffect(() => {
    function handleFocusIn(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // Skip if input type is hidden or the keyboard itself
        const type = e.target.type || 'text';
        if (type === 'hidden' || type === 'submit' || type === 'button') return;
        // Skip inputs that have their own numpad (money/pricing fields)
        if (e.target.dataset.noKeyboard === 'true') return;
        activeRef.current = e.target;
        setVisible(true);
        // Scroll into view after a small delay to let keyboard render
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
    function handleFocusOut(e) {
      // Don't hide if clicking on the keyboard itself
      setTimeout(() => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        // Check if focus went to a keyboard button
        if (kbRef.current && kbRef.current.contains(document.activeElement)) return;
        setVisible(false);
        activeRef.current = null;
      }, 100);
    }
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleKey = useCallback((key) => {
    const el = activeRef.current;
    if (!el) return;
    // Re-focus the input (clicking keyboard button stole focus)
    el.focus();

    if (key === '⌫') {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const val = el.value;
      if (start === end && start > 0) {
        setNativeValue(el, val.slice(0, start - 1) + val.slice(end));
        setTimeout(() => el.setSelectionRange(start - 1, start - 1), 0);
      } else if (start !== end) {
        setNativeValue(el, val.slice(0, start) + val.slice(end));
        setTimeout(() => el.setSelectionRange(start, start), 0);
      }
      return;
    }
    if (key === '⇧') { setShifted(prev => !prev); return; }
    if (key === 'ABC') { setSymbols(false); return; }
    if (key === '#+=') { setSymbols(true); return; }
    if (key === 'SPACE') key = ' ';
    if (key === 'DONE') { el.blur(); setVisible(false); return; }

    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const val = el.value;
    const newVal = val.slice(0, start) + key + val.slice(end);
    setNativeValue(el, newVal);
    setTimeout(() => el.setSelectionRange(start + key.length, start + key.length), 0);

    // Auto-unshift after typing a letter
    if (shifted && key !== ' ') setShifted(false);
  }, [shifted]);

  if (!visible) return null;

  const rows = symbols ? ROWS_SYMBOL : (shifted ? ROWS_UPPER : ROWS_LOWER);
  const KH = 48; // key height
  const GAP = 4;

  return (
    <div ref={kbRef} style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: C.bg, borderTop: `1px solid ${C.border}`,
      padding: '8px 8px 12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
    }}
    onMouseDown={e => e.preventDefault()} // prevent stealing focus from input
    >
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: GAP, marginBottom: GAP }}>
          {row.map((key, ki) => {
            const isShift = key === '⇧';
            const isBksp = key === '⌫';
            const isSpecial = isShift || isBksp || key === 'ABC';
            const isActive = isShift && shifted;
            const w = isSpecial ? 56 : undefined;
            return (
              <button key={`${ri}-${ki}`}
                onClick={() => handleKey(key)}
                tabIndex={-1}
                style={{
                  height: KH, minWidth: 36, width: w || undefined, flex: isSpecial ? undefined : 1,
                  background: isActive ? C.blue : isSpecial ? C.raised : C.surface,
                  border: `1px solid ${isActive ? C.blue : C.border}`,
                  borderRadius: 6, color: isBksp ? C.danger : C.text,
                  fontSize: isSpecial ? 14 : 16, fontWeight: 500, fontFamily: 'Inter,system-ui,sans-serif',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  userSelect: 'none', WebkitUserSelect: 'none',
                }}>
                {key}
              </button>
            );
          })}
        </div>
      ))}
      {/* Bottom row: symbols toggle, space, done */}
      <div style={{ display: 'flex', gap: GAP, justifyContent: 'center' }}>
        <button onClick={() => handleKey(symbols ? 'ABC' : '#+=')} tabIndex={-1}
          style={{ height: KH, width: 72, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', userSelect: 'none' }}>
          {symbols ? 'ABC' : '#+='}
        </button>
        <button onClick={() => handleKey(',')} tabIndex={-1}
          style={{ height: KH, width: 44, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 16, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', userSelect: 'none' }}>
          ,
        </button>
        <button onClick={() => handleKey('SPACE')} tabIndex={-1}
          style={{ height: KH, flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', userSelect: 'none' }}>
          space
        </button>
        <button onClick={() => handleKey('.')} tabIndex={-1}
          style={{ height: KH, width: 44, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted, fontSize: 16, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', userSelect: 'none' }}>
          .
        </button>
        <button onClick={() => handleKey('DONE')} tabIndex={-1}
          style={{ height: KH, width: 72, background: C.blue, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', userSelect: 'none' }}>
          Done
        </button>
      </div>
    </div>
  );
}
