import { createContext, useContext } from 'react';
import { getTheme } from './theme';

/**
 * ThemeContext — provides resolved theme tokens to all modules.
 * 
 * Usage in any module:
 *   import { useTheme } from '../../lib/ThemeContext';
 *   var T = useTheme();
 *   style={{ background: T.surface, color: T.text }}
 *
 * The provider wraps the app in App.jsx and reads from salonSettings.theme.
 * Client-facing screens (Kiosk, Customer Display, Online Booking) don't use this.
 */
export var ThemeContext = createContext(getTheme('dark'));

export function useTheme() {
  return useContext(ThemeContext);
}
