/**
 * DebugLabel.jsx — Debug ID Label Badge
 * Session 84
 *
 * Renders a small green badge showing the element's debug ID.
 * Only visible when debug mode is ON.
 *
 * Usage:
 *   <div style={{ position: 'relative' }}>
 *     <DebugLabel id="NAV-STAFF" />
 *     ... actual content ...
 *   </div>
 *
 * Or wrap existing content:
 *   <DebugLabel id="BTN-PAY" wrap>
 *     <button>Pay</button>
 *   </DebugLabel>
 *
 * Position prop controls badge placement:
 *   'tl' (default) = top-left, 'tr' = top-right, 'bl' = bottom-left, 'br' = bottom-right
 */

import { useDebugStore } from '../../lib/stores/debugStore';

var POS = {
  tl: { top: -2, left: -2 },
  tr: { top: -2, right: -2 },
  bl: { bottom: -2, left: -2 },
  br: { bottom: -2, right: -2 },
};

var badgeStyle = {
  position: 'absolute',
  zIndex: 99998,
  fontSize: 8,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  letterSpacing: '0.03em',
  padding: '1px 5px',
  borderRadius: 3,
  background: '#10B981',
  color: '#000',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  lineHeight: '14px',
  opacity: 0.92,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

export default function DebugLabel({ id, pos, wrap, children, style }) {
  var enabled = useDebugStore(function(s) { return s.enabled; });
  if (!enabled) {
    // When off: if wrapping, just return children. Otherwise render nothing.
    return wrap ? (children || null) : null;
  }

  var position = POS[pos || 'tl'] || POS.tl;

  var badge = (
    <div style={Object.assign({}, badgeStyle, position)}>
      {id}
    </div>
  );

  if (wrap) {
    return (
      <div style={Object.assign({ position: 'relative', display: 'contents' }, style)}>
        <div style={{ position: 'relative' }}>
          {badge}
          {children}
        </div>
      </div>
    );
  }

  return badge;
}
