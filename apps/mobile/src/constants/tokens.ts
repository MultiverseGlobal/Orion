import { Colors } from '../theme/colors';
// Orion Design System Tokens — Natural Light & Command Amber Themes

export const TOKENS = {
  colors: {
    ...Colors,
    // Semantic mappings used in Phase 8 components
    primary: Colors.textPrimary,
    text: Colors.textPrimary,
    muted: Colors.textMuted,
    borderLight: Colors.borderLight,
    surfaceHighlight: Colors.bgElevated,
    border: Colors.borderSubtle,
    surface: Colors.bgCard,
    
    // Natural Light Theme (Glebich Voice AI Design)
    background: Colors.porcelainSubtle,     // Soft crisp white mist
    elevated: Colors.porcelainSubtle,       // Subtle grey container
    textFaint: Colors.textMuted,      // Faint placeholder text
    accentGlowSoft: 'rgba(37, 99, 235, 0.08)',
    waveDark: '#2C2D30',       // Dark liquid wave path
    waveMid: '#5C5E64',        // Mid liquid wave path
    waveLight: '#9CA0A8',      // Light liquid wave ribbon
    particle: 'rgba(50, 50, 60, 0.45)', // Floating particle dust
  },
  fonts: {
    display: 'System',
    ui: 'System',
    data: 'System',
  },
  animation: {
    easingExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    entranceDuration: 500,
    microDuration: 150,
  },
} as const;

