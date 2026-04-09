/**
 * AreaTag.jsx — Area Code Tag Badge
 * Session 102
 *
 * Shows a big readable area code label on screen panels.
 * Only visible when area code mode is ON (Salon Settings → Dev Tools).
 *
 * Usage:
 *   <div style={{ position: 'relative' }}>
 *     <AreaTag id="SC-CAT" />
 *     ... actual content ...
 *   </div>
 */

import { useAreaCodeStore } from '../../lib/stores/areaCodeStore';

var POS = {
  tl: { top: 4, left: 4 },
  tr: { top: 4, right: 4 },
  bl: { bottom: 4, left: 4 },
  br: { bottom: 4, right: 4 },
};

export default function AreaTag({ id, pos }) {
  var enabled = useAreaCodeStore(function(s) { return s.enabled; });
  if (!enabled) return null;

  var position = POS[pos || 'tl'] || POS.tl;

  return (
    <div style={{
      position: 'absolute',
      zIndex: 99998,
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      letterSpacing: '0.05em',
      padding: '4px 10px',
      borderRadius: 6,
      background: 'rgba(16,185,129,0.9)',
      color: '#000',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      lineHeight: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      ...position,
    }}>
      {id}
    </div>
  );
}
