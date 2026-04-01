import { useEffect } from 'react';

/**
 * useNumpadKeyboard — shared hook for keyboard → numpad bridging
 *
 * When `active` is true, listens for keyboard digits/backspace and calls
 * the same handler the touch numpad uses.
 *
 * @param {boolean} active       — only listen when a numpad is visible
 * @param {function} onDigit     — called with digit string '0'-'9'
 * @param {function} onBackspace — called on Backspace key
 * @param {function} [onEnter]   — optional: called on Enter key
 * @param {function} [onEscape]  — optional: called on Escape key
 * @param {Array}    deps        — extra useEffect dependencies
 */
export function useNumpadKeyboard(active, onDigit, onBackspace, onEnter, onEscape, deps) {
  useEffect(function() {
    if (!active) return;
    function handleKey(e) {
      if (/^\d$/.test(e.key)) { e.preventDefault(); onDigit(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); onBackspace(); return; }
      if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); return; }
      if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); return; }
    }
    window.addEventListener('keydown', handleKey);
    return function() { window.removeEventListener('keydown', handleKey); };
  }, [active].concat(deps || []));
}
