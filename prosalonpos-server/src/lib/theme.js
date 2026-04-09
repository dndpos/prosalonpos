/**
 * Pro Salon POS — Theme System
 * Centralized color tokens for dark and light themes.
 *
 * Both themes include ALL legacy key names from calendarHelpers.C
 * and OwnerDashboard.T so existing code works with minimal changes.
 */

var DARK = {
  mode: 'dark',
  bg: '#0F172A', chrome: '#1E293B', chromeDark: '#162032',
  surface: '#1E293B', raised: '#283549',
  border: '#475569', borderLight: '#334155', borderFaint: '#2A3A4E',
  text: '#FFFFFF', textSecondary: '#94A3B8', textMuted: '#64748B', textDim: '#475569',
  accent: '#38BDF8', accentHover: '#0EA5E9',
  accentBg: 'rgba(56,189,248,0.2)', accentText: '#38BDF8',
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
  dangerBg: 'rgba(239,68,68,0.15)',
  inputBg: '#283548', inputBorder: '#475569', inputText: '#E2E8F0',
  btnBg: '#334155', btnText: '#E2E8F0', btnBorder: '#475569',
  overlay: 'rgba(0,0,0,0.6)', modalBg: '#1E293B',
  modalGradient: 'linear-gradient(145deg, #1E293B 0%, #162032 50%, #0F172A 100%)',
  apptStyle: 'solid',
  // Legacy aliases (calendarHelpers.C)
  grid: '#3D4D62', gridHover: '#4A5A70',
  gridLineHour: '#8494A7', gridLineHalf: '#7485A0', gridLineQuarter: '#677B93',
  colDivider: '#6B7B8F',
  textPrimary: '#FFFFFF', borderMedium: '#475569',
  blue: '#38BDF8', blueLight: '#7DD3FC', blueTint: '#0C4A6E',
  nowLine: '#DC2626',
  // Legacy aliases (OwnerDashboard.T)
  primary: '#38BDF8', primaryHover: '#0EA5E9', primaryLight: '#7DD3FC', cardBg: '#1E293B',
  dark: '#0F172A',
};

var LIGHT = {
  mode: 'light',
  bg: '#F8FAFC', chrome: '#FFFFFF', chromeDark: '#F1F5F9',
  surface: '#FFFFFF', raised: '#FFFFFF',
  border: '#E2E8F0', borderLight: '#F1F5F9', borderFaint: '#F8FAFC',
  text: '#0F172A', textSecondary: '#475569', textMuted: '#94A3B8', textDim: '#CBD5E1',
  accent: '#2563EB', accentHover: '#1D4ED8',
  accentBg: 'rgba(37,99,235,0.1)', accentText: '#2563EB',
  success: '#16A34A', warning: '#D97706', danger: '#DC2626',
  dangerBg: '#FEF2F2',
  inputBg: '#FFFFFF', inputBorder: '#CBD5E1', inputText: '#0F172A',
  btnBg: '#FFFFFF', btnText: '#0F172A', btnBorder: '#CBD5E1',
  overlay: 'rgba(0,0,0,0.35)', modalBg: '#FFFFFF',
  modalGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 50%, #F1F5F9 100%)',
  apptStyle: 'pastel',
  // Legacy aliases
  grid: '#FFFFFF', gridHover: '#F1F5F9',
  gridLineHour: '#CBD5E1', gridLineHalf: '#E2E8F0', gridLineQuarter: '#F1F5F9',
  colDivider: '#E2E8F0',
  textPrimary: '#0F172A', borderMedium: '#CBD5E1',
  blue: '#2563EB', blueLight: '#3B82F6', blueTint: 'rgba(37,99,235,0.08)',
  nowLine: '#DC2626',
  // Legacy aliases (OwnerDashboard.T)
  primary: '#2563EB', primaryHover: '#1D4ED8', primaryLight: '#3B82F6', cardBg: '#FFFFFF',
  dark: '#F1F5F9',
};

var PASTEL_MAP = {
  '#EF4444': { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  '#F97316': { bg: '#FFEDD5', text: '#9A3412', border: '#F97316' },
  '#F59E0B': { bg: '#FEF3C7', text: '#78350F', border: '#F59E0B' },
  '#22C55E': { bg: '#DCFCE7', text: '#14532D', border: '#22C55E' },
  '#10B981': { bg: '#D1FAE5', text: '#064E3B', border: '#10B981' },
  '#3B82F6': { bg: '#DBEAFE', text: '#1E3A5F', border: '#3B82F6' },
  '#2563EB': { bg: '#DBEAFE', text: '#1E3A5F', border: '#2563EB' },
  '#8B5CF6': { bg: '#EDE9FE', text: '#3B0764', border: '#8B5CF6' },
  '#EC4899': { bg: '#FCE7F3', text: '#831843', border: '#EC4899' },
  '#06B6D4': { bg: '#CFFAFE', text: '#155E75', border: '#06B6D4' },
  '#14B8A6': { bg: '#CCFBF1', text: '#134E4A', border: '#14B8A6' },
  '#84CC16': { bg: '#ECFCCB', text: '#365314', border: '#84CC16' },
  '#A855F7': { bg: '#F3E8FF', text: '#581C87', border: '#A855F7' },
  '#D946EF': { bg: '#FAE8FF', text: '#701A75', border: '#D946EF' },
  '#6366F1': { bg: '#E0E7FF', text: '#312E81', border: '#6366F1' },
  '#0EA5E9': { bg: '#E0F2FE', text: '#0C4A6E', border: '#0EA5E9' },
  '#E11D48': { bg: '#FFE4E6', text: '#881337', border: '#E11D48' },
  '#65A30D': { bg: '#ECFCCB', text: '#365314', border: '#65A30D' },
  '#EA580C': { bg: '#FFF7ED', text: '#7C2D12', border: '#EA580C' },
  '#0891B2': { bg: '#CFFAFE', text: '#155E75', border: '#0891B2' },
};

export function getApptStyle(mode, color) {
  if (mode === 'light') {
    var p = PASTEL_MAP[color];
    if (p) return { bg: p.bg, text: p.text, border: 'none', borderLeft: '3px solid ' + p.border };
    return { bg: color + '18', text: '#1E293B', border: 'none', borderLeft: '3px solid ' + color };
  }
  return { bg: color, text: '#FFFFFF', border: 'none', borderLeft: 'none' };
}

export function getTheme(mode) {
  return mode === 'light' ? LIGHT : DARK;
}

export { DARK, LIGHT };
