/**
 * Orion — Pseudonyms PDS-v5 Design System
 * Unified porcelain/obsidian palette adapted for Orion's voice & reflective companion.
 */
export const Colors = {
  // ── Core Dark Studio Backgrounds (Default for Orion Voice Interface) ──
  bg:            '#07080C', // PDS-v5 Dark Canvas (Warm Obsidian)
  bgCard:        '#0E1118', // Surface-1 Frosted Glass base
  bgElevated:    '#161922', // Surface-2 Elevated Panel
  bgSheet:       '#1D212D', // Surface-3 Modal / Sheet Surface

  // ── Core Light Mode Tokens ──
  lightCanvas:   '#F8F7F4', // Porcelain page background
  lightCard:     '#FFFFFF', // Surface-1 card
  lightElevated: '#F1F0EC', // Surface-2 recessed
  lightHover:    '#EBEBE6', // Surface-3 hover

  // ── Primary Accent & Specular Glow ──
  accent:        '#FFFFFF', // Pure crisp CTA
  accentGlow:    'rgba(255, 255, 255, 0.15)',
  accentText:    '#07080C', // Obsidian text on accent pill
  accentMuted:   'rgba(255, 255, 255, 0.20)',

  // ── Typography ──
  textPrimary:   '#EEF0F8', // Crisp off-white
  textSecondary: 'rgba(238, 240, 248, 0.65)',
  textMuted:     'rgba(238, 240, 248, 0.40)',
  textInverse:   '#07080C',

  // ── Section Card Backgrounds (Refined Deep Studio Tones) ──
  sectionTeal:   '#16282E',
  sectionSage:   '#1B2620',
  sectionLavender: '#21223A',
  sectionPeach:  '#2D1F1C',
  sectionLime:   '#1F2913',
  sectionMint:   '#142B1A',
  sectionBrown:  '#24231E',
  sectionNavy:   '#111927',
  sectionYellow: '#2A2614',

  // ── Borders & Dividers ──
  borderSubtle:  'rgba(255, 255, 255, 0.06)',
  borderLight:   'rgba(255, 255, 255, 0.10)',
  borderAccent:  'rgba(255, 255, 255, 0.22)',

  // ── Semantic States ──
  success:       '#22C55E',
  warning:       '#F59E0B',
  error:         '#EF4444',
  info:          '#38BDF8',

  // ── Legacy aliases for backward compatibility ──
  porcelain:        '#F8F7F4',
  porcelainCard:    '#FFFFFF',
  porcelainSubtle:  '#F1F0EC',
  obsidian:         '#07080C',
  signalAmber:      '#F59E0B',
};
