// Budget Tracker Design System — Color Tokens
// Inspired by Robinhood, Origin, and Monarch

export const Colors = {
  // ── Background ──────────────────────────────────────────────────────────────
  dark: {
    background: {
      primary: '#0F0F14',    // App background
      secondary: '#16161F',  // Card / surface background
      tertiary: '#1E1E2A',   // Elevated surface
    },
    border: {
      subtle: '#2A2A3A',
      default: '#3A3A4A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8A8A9A',
      muted: '#4A4A5A',
      inverse: '#000000',
    },
  },

  light: {
    background: {
      primary: '#F8F8FC',
      secondary: '#FFFFFF',
      tertiary: '#F0F0F8',
    },
    border: {
      subtle: '#E8E8F0',
      default: '#D8D8E8',
    },
    text: {
      primary: '#0F0F14',
      secondary: '#6A6A7A',
      muted: '#AAAABC',
      inverse: '#FFFFFF',
    },
  },

  // ── Brand / Accent ───────────────────────────────────────────────────────────
  brand: {
    green: '#00C896',      // Primary action / positive / income
    greenDim: '#00A07A',   // Pressed / darker variant
    greenSubtle: '#003D2E', // Background tint for green elements
  },

  // ── Semantic ─────────────────────────────────────────────────────────────────
  semantic: {
    danger: '#FF4D4D',
    dangerSubtle: '#3D1010',
    warning: '#FFAA00',
    warningSubtle: '#3D2A00',
    success: '#00C896',
    successSubtle: '#003D2E',
    info: '#4A9EFF',
    infoSubtle: '#0A1A3D',
  },

  // ── Category Colors ──────────────────────────────────────────────────────────
  categories: {
    foodDining: '#FF6B6B',
    groceries: '#FF9F43',
    transportation: '#5F27CD',
    shopping: '#FF6348',
    entertainment: '#A29BFE',
    subscriptions: '#74B9FF',
    health: '#00CEC9',
    housing: '#FDCB6E',
    travel: '#6C5CE7',
    education: '#00B894',
    income: '#00C896',
    transfers: '#636E72',
    fees: '#D63031',
    uncategorized: '#4A4A5A',
  },
} as const;

export type ColorScheme = 'dark' | 'light';
