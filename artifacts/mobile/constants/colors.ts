/**
 * NutriAI design tokens — fresh health-tech palette.
 * Primary: vibrant forest green. Surfaces: clean white / dark navy.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#111827',
    tint: '#16a34a',

    // Core surfaces
    background: '#f8fafc',
    foreground: '#111827',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#111827',

    // Primary action — NutriAI green
    primary: '#16a34a',
    primaryForeground: '#ffffff',
    primaryLight: '#dcfce7',
    primaryMid: '#22c55e',

    // Secondary
    secondary: '#f1f5f9',
    secondaryForeground: '#374151',

    // Muted
    muted: '#f1f5f9',
    mutedForeground: '#6b7280',

    // Accent
    accent: '#dcfce7',
    accentForeground: '#15803d',

    // Destructive
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders & inputs
    border: '#e5e7eb',
    input: '#e5e7eb',

    // Nutrition macro colors
    calories: '#f97316',   // orange
    protein: '#3b82f6',    // blue
    carbs: '#f59e0b',      // amber
    fat: '#ec4899',        // pink
    fiber: '#8b5cf6',      // purple
  },

  dark: {
    text: '#f9fafb',
    tint: '#22c55e',

    background: '#0a0f1a',
    foreground: '#f9fafb',

    card: '#111827',
    cardForeground: '#f9fafb',

    primary: '#22c55e',
    primaryForeground: '#0a0f1a',
    primaryLight: '#14532d',
    primaryMid: '#16a34a',

    secondary: '#1f2937',
    secondaryForeground: '#d1d5db',

    muted: '#1f2937',
    mutedForeground: '#9ca3af',

    accent: '#14532d',
    accentForeground: '#4ade80',

    destructive: '#dc2626',
    destructiveForeground: '#ffffff',

    border: '#1f2937',
    input: '#1f2937',

    calories: '#fb923c',
    protein: '#60a5fa',
    carbs: '#fbbf24',
    fat: '#f472b6',
    fiber: '#a78bfa',
  },

  radius: 12,
};

export default colors;
