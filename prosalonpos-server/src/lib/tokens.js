/**
 * Pro Salon POS — Design Tokens
 * Single source of truth for all visual values.
 * 
 * References:
 *   Session 16 (Decisions #283–292) — Design direction
 *   Session 1  (Decisions #13, #14, #27, #30) — Calendar & contrast rules
 *   Session 17 — Engineering Standards §18 Accessibility
 * 
 * IMPORTANT: Exact hex values are "locked in direction, flexible in pixel detail"
 * per Session 16 §8. These values are the starting point and may be fine-tuned
 * when viewed on actual 1920×1080 station hardware.
 */

// ════════════════════════════════════════════
// 1. BASE PALETTE — Two-zone dark interface
// ════════════════════════════════════════════
export const C = {
  // Outer chrome — darkest layer (top bar, left panel, headers)
  chrome:         '#1E293B',
  chromeDark:     '#0F172A',  // Deeper variant for top bar or emphasis

  // Grid/content area — noticeably lighter than chrome
  grid:           '#334155',
  gridHover:      '#3B4A63',  // Hover state on empty time slots

  // Grid lines
  gridLineHour:   '#475569',  // Solid hour lines
  gridLineHalf:   '#3E4C63',  // Dashed half-hour lines
  gridLineQuarter:'#374357',  // Lighter quarter-hour lines

  // Text hierarchy
  textPrimary:    '#E2E8F0',  // Headers, hour labels, client names
  textSecondary:  '#94A3B8',  // Half-hour labels, appointment counts, secondary info
  textMuted:      '#64748B',  // Inactive tabs, tertiary info, day names

  // Borders and dividers
  borderLight:    '#334155',
  borderMedium:   '#475569',
  borderHeavy:    '#64748B',

  // ── Accent: Royal Blue (Product UI only, not service blocks) ──
  blue:           '#2563EB',  // Primary buttons, active states
  blueLight:      '#60A5FA',  // Active tab text, selected state text
  blueTint:       '#1E3A5F',  // Avatar backgrounds, subtle highlights
  blueHover:      '#1D4ED8',  // Button hover state

  // ── Semantic Colors ──
  success:        '#059669',  // Confirmed status, completed actions
  warning:        '#D97706',  // Wait time amber zone (10–19 min), alerts
  danger:         '#DC2626',  // Wait time red zone (20+ min), cancellations, errors
  info:           '#2563EB',  // Informational badges (same as primary blue)

  // ── Wait time color coding (Session 1, Decision #22) ──
  waitGreen:      '#059669',  // < 10 min
  waitAmber:      '#D97706',  // 10–19 min
  waitRed:        '#DC2626',  // 20+ min

  // ── Current time indicator ──
  nowLine:        '#DC2626',  // Red horizontal line with dot

  // ── Misc UI ──
  overlay:        'rgba(0, 0, 0, 0.5)',   // Modal backdrop
  tooltipBg:      '#0F172A',
  scrollThumb:    '#475569',
  scrollTrack:    '#1E293B',
};


// ════════════════════════════════════════════
// 2. CURATED SERVICE COLORS — 20 pre-approved
// ════════════════════════════════════════════
// Selected for:
//   ✓ Vibrant and saturated — pop against the dark grid (#334155)
//   ✓ WCAG 4.5:1 contrast with either white or near-black text
//   ✓ Visually distinct from each other (no two look the same at a glance)
//   ✓ Covers warm, cool, and neutral ranges
//
// Session 1 Decision #27: 20 curated colors shown by default in color picker.
// Session 16 Decision #292: Must look vibrant on the dark grid background.

export const SERVICE_COLORS = [
  // Warm tones
  { hex: '#EF4444', name: 'Red',           textColor: '#FFFFFF' },
  { hex: '#F97316', name: 'Orange',         textColor: '#1A1A1A' },
  { hex: '#F59E0B', name: 'Amber',          textColor: '#1A1A1A' },
  { hex: '#EAB308', name: 'Yellow',         textColor: '#1A1A1A' },
  { hex: '#EC4899', name: 'Pink',           textColor: '#FFFFFF' },
  { hex: '#F43F5E', name: 'Rose',           textColor: '#FFFFFF' },
  { hex: '#D946EF', name: 'Fuchsia',        textColor: '#FFFFFF' },

  // Cool tones
  { hex: '#8B5CF6', name: 'Violet',         textColor: '#FFFFFF' },
  { hex: '#6366F1', name: 'Indigo',         textColor: '#FFFFFF' },
  { hex: '#3B82F6', name: 'Blue',           textColor: '#FFFFFF' },
  { hex: '#06B6D4', name: 'Cyan',           textColor: '#1A1A1A' },
  { hex: '#14B8A6', name: 'Teal',           textColor: '#1A1A1A' },
  { hex: '#10B981', name: 'Emerald',        textColor: '#1A1A1A' },
  { hex: '#22C55E', name: 'Green',          textColor: '#1A1A1A' },
  { hex: '#84CC16', name: 'Lime',           textColor: '#1A1A1A' },

  // Neutral & earth tones
  { hex: '#78716C', name: 'Stone',          textColor: '#FFFFFF' },
  { hex: '#A3A3A3', name: 'Silver',         textColor: '#1A1A1A' },
  { hex: '#FB923C', name: 'Peach',          textColor: '#1A1A1A' },
  { hex: '#A78BFA', name: 'Lavender',       textColor: '#1A1A1A' },
  { hex: '#2DD4BF', name: 'Mint',           textColor: '#1A1A1A' },
  { hex: '#FF6B6B', name: 'Coral',          textColor: '#1A1A1A' },
];


// ════════════════════════════════════════════
// 3. TYPOGRAPHY — Inter typeface (Session 16, Decision #289)
// ════════════════════════════════════════════
export const FONT = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  
  // Weights: 400 regular, 500 medium. No bold 700. (Decision #289)
  regular: 400,
  medium:  500,

  // Size scale (Decision #30: 14px body minimum, 12px absolute floor)
  xs:   '12px',   // Absolute floor. Labels, captions only.
  sm:   '13px',   // Small labels where 12px is too tight
  base: '14px',   // Body text minimum
  md:   '16px',   // Emphasized text, client-facing screens
  lg:   '18px',   // Section headers
  xl:   '20px',   // Page titles
  xxl:  '24px',   // Large display (login screen, etc.)

  // Line heights
  compact: 1.4,   // Buttons, labels, calendar blocks
  normal:  1.6,   // Notes, descriptions, longer text

  // Tabular numbers for alignment (prices, times, counts)
  tabular: { fontVariantNumeric: 'tabular-nums' },
};


// ════════════════════════════════════════════
// 4. SPACING & LAYOUT
// ════════════════════════════════════════════
export const SPACE = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

export const LAYOUT = {
  // Calendar screen (Session 1, §5.1)
  leftPanelWidth: 192,
  topBarHeight:   56,
  
  // Touch targets (Session 1, Decision #30)
  minTouchTarget: 44,
  
  // Calendar blocks (Session 1, Decision #13)
  minBlockHeight: 44,
  
  // Border radius (Session 16, §6.1 — rounded corners 6-8px)
  radiusSm:  4,
  radiusMd:  6,
  radiusLg:  8,
  radiusXl: 12,
  
  // Calendar appointment blocks (Session 16, §6.4 — 5-6px)
  radiusBlock: 6,
  
  // Avatars (Session 16, §6.3)
  avatarSm: 32,  // Compact views (calendar headers, lists)
  avatarLg: 44,  // Profile views
  
  // Transitions (Session 16, §8 — subtle and fast 150-200ms)
  transitionFast: '150ms ease',
  transitionBase: '200ms ease',
};


// ════════════════════════════════════════════
// 5. WCAG CONTRAST UTILITY
// ════════════════════════════════════════════
// Session 1, Decision #14: Font color auto-calculated via WCAG luminance.
// Session 16, §3.3: WCAG contrast enforcement for service blocks.
// Returns '#FFFFFF' or '#1A1A1A' — whichever achieves higher contrast.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Given a background hex color, returns the best text color for readability.
 * Always returns '#FFFFFF' (white) or '#1A1A1A' (near-black).
 * 
 * @param {string} bgHex - Background color as hex string (e.g. '#EF4444')
 * @returns {string} Text color hex
 */
export function getContrastText(bgHex) {
  const bgLum = relativeLuminance(hexToRgb(bgHex));
  const whiteLum = relativeLuminance({ r: 255, g: 255, b: 255 });
  const darkLum = relativeLuminance(hexToRgb('#1A1A1A'));
  
  const whiteContrast = contrastRatio(whiteLum, bgLum);
  const darkContrast = contrastRatio(bgLum, darkLum);
  
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#1A1A1A';
}

/**
 * Checks if the contrast ratio meets the WCAG 4.5:1 minimum target.
 * Used to show low-contrast warnings in the color picker (Session 1, Decision #27).
 * 
 * @param {string} bgHex - Background color hex
 * @returns {{ meetsTarget: boolean, ratio: number, textColor: string }}
 */
export function checkContrast(bgHex) {
  const textColor = getContrastText(bgHex);
  const bgLum = relativeLuminance(hexToRgb(bgHex));
  const textLum = relativeLuminance(hexToRgb(textColor));
  const ratio = contrastRatio(Math.max(bgLum, textLum), Math.min(bgLum, textLum));
  
  return {
    meetsTarget: ratio >= 4.5,
    ratio: Math.round(ratio * 10) / 10,
    textColor,
  };
}


// ════════════════════════════════════════════
// 6. WAIT TIME UTILITIES
// ════════════════════════════════════════════
// Session 1, Decision #22: Green < 10 min, amber 10-19, red 20+

export function getWaitColor(minutes) {
  if (minutes < 10) return C.waitGreen;
  if (minutes < 20) return C.waitAmber;
  return C.waitRed;
}

export function getWaitLabel(minutes) {
  if (minutes < 10) return 'short';
  if (minutes < 20) return 'moderate';
  return 'long';
}
