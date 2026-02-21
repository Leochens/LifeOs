// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens - Default Values
// ─────────────────────────────────────────────────────────────────────────────
// This file exports the default Design Tokens for both dark and light themes.
// These values are synchronized with the CSS variables in src/index.css

import type {
  DesignTokens,
  ThemeTokens,
  ColorTokens,
  SpacingTokens,
  TypographyTokens,
  RadiusTokens,
  ShadowTokens,
  AnimationTokens,
  BreakpointTokens,
  ZIndexTokens,
  ThemeMode,
} from "../types/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Spacing Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const spacingTokens: SpacingTokens = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  11: "44px",
  12: "48px",
  13: "52px",
  14: "56px",
  15: "60px",
  16: "64px",
  20: "80px",
  24: "96px",
  32: "128px",
  auto: "auto",
};

// ─────────────────────────────────────────────────────────────────────────────
// Typography Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const typographyTokens: TypographyTokens = {
  fontFamily: {
    sans: '"Noto Sans SC", sans-serif',
    mono: '"Space Mono", monospace',
    display: '"Bebas Neue", sans-serif',
    body: '"Inter", system-ui, -apple-system, sans-serif',
  },

  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "15px",
    lg: "16px",
    xl: "18px",
    "2xl": "20px",
    "3xl": "24px",
    "4xl": "30px",
    "5xl": "36px",
    "6xl": "48px",
    "7xl": "60px",
  },

  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const radiusTokens: RadiusTokens = {
  none: "0",
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "10px",
  xl: "12px",
  "2xl": "16px",
  "3xl": "24px",
  full: "9999px",
};

// ─────────────────────────────────────────────────────────────────────────────
// Shadow Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const shadowTokens: ShadowTokens = {
  none: "none",
  xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
  "2xl": "0 25px 50px rgba(0, 0, 0, 0.25)",
  inner: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
  glow: "0 0 20px rgba(0, 200, 255, 0.25)",
  glow2: "0 0 20px rgba(123, 97, 255, 0.25)",
  card: "0 4px 20px rgba(0, 0, 0, 0.4)",
  float: "0 8px 32px rgba(0, 0, 0, 0.6)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Animation Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const animationTokens: AnimationTokens = {
  duration: {
    instant: "0ms",
    fast: "100ms",
    normal: "200ms",
    slow: "300ms",
    slower: "500ms",
    slowest: "1000ms",
  },

  easing: {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    easeInQuad: "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
    easeOutQuad: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    easeInOutQuad: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
    easeInCubic: "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
    easeOutCubic: "cubic-bezier(0.215, 0.61, 0.355, 1)",
    easeInOutCubic: "cubic-bezier(0.645, 0.045, 0.355, 1)",
    spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },

  transition: {
    fast: "all 100ms cubic-bezier(0.4, 0, 0.2, 1)",
    normal: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "all 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },

  keyframes: {
    fadeUp: "fade-up 0.25s ease both",
    fadeDown: "fade-down 0.25s ease both",
    fadeIn: "fade-in 0.2s ease both",
    fadeOut: "fade-out 0.2s ease both",
    slideUp: "slide-up 0.3s ease both",
    slideDown: "slide-down 0.3s ease both",
    slideLeft: "slide-left 0.3s ease both",
    slideRight: "slide-right 0.3s ease both",
    scaleIn: "scale-in 0.2s ease both",
    scaleOut: "scale-out 0.2s ease both",
    spin: "spin 1s linear infinite",
    ping: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
    pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    bounce: "bounce 1s infinite",
    shake: "shake 0.5s ease-in-out",
    float: "float 3s ease-in-out infinite",
    glow: "glow 2s ease-in-out infinite",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const breakpointTokens: BreakpointTokens = {
  xs: "0px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  "3xl": "1920px",
};

// ─────────────────────────────────────────────────────────────────────────────
// Z-Index Tokens (shared across themes)
// ─────────────────────────────────────────────────────────────────────────────

export const zIndexTokens: ZIndexTokens = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  max: 9999,
};

// ─────────────────────────────────────────────────────────────────────────────
// Color Tokens - Dark Theme
// ─────────────────────────────────────────────────────────────────────────────

export const darkColorTokens: ColorTokens = {
  // Base colors
  bg: "#060810",
  panel: "#0b0f1a",
  panel2: "#0f1420",
  panel3: "#141a2a",

  // Border colors
  border: "rgba(0, 200, 255, 0.1)",
  border2: "rgba(0, 200, 255, 0.2)",
  border3: "rgba(0, 200, 255, 0.3)",

  // Text colors
  text: "#e2eaf5",
  textDim: "#5a6a82",
  textMid: "#8a9ab5",
  textInverted: "#060810",

  // Brand/Primary colors
  primary: "#00c8ff",
  primaryHover: "#00d9ff",
  primaryActive: "#00b8e8",
  primarySubtle: "rgba(0, 200, 255, 0.1)",

  // Secondary colors
  secondary: "#7b61ff",
  secondaryHover: "#8e75ff",
  secondaryActive: "#6a57e8",
  secondarySubtle: "rgba(123, 97, 255, 0.1)",

  // Accent colors
  accent: "#00c8ff",
  accent2: "#7b61ff",
  accent3: "#00ffa3",
  accent4: "#ff6b6b",
  accent5: "#ffb347",

  // Semantic colors - Success
  success: "#00ffa3",
  successHover: "#00ffb8",
  successSubtle: "rgba(0, 255, 163, 0.1)",
  successBorder: "rgba(0, 255, 163, 0.3)",

  // Semantic colors - Warning
  warning: "#ffb347",
  warningHover: "#ffc05f",
  warningSubtle: "rgba(255, 179, 71, 0.1)",
  warningBorder: "rgba(255, 179, 71, 0.3)",

  // Semantic colors - Error/Danger
  error: "#ff6b6b",
  errorHover: "#ff8080",
  errorSubtle: "rgba(255, 107, 107, 0.1)",
  errorBorder: "rgba(255, 107, 107, 0.3)",

  // Semantic colors - Info
  info: "#00c8ff",
  infoHover: "#00d9ff",
  infoSubtle: "rgba(0, 200, 255, 0.1)",
  infoBorder: "rgba(0, 200, 255, 0.3)",

  // Neutral palette (dark mode)
  neutral50: "#f7f8fa",
  neutral100: "#e2eaf5",
  neutral200: "#b8c5d9",
  neutral300: "#8a9ab5",
  neutral400: "#5a6a82",
  neutral500: "#3d4a5f",
  neutral600: "#2a3444",
  neutral700: "#1a222e",
  neutral800: "#0f1420",
  neutral900: "#060810",

  // Glow effects
  glow: "0 0 20px rgba(0, 200, 255, 0.25)",
  glow2: "0 0 20px rgba(123, 97, 255, 0.25)",
  glow3: "0 0 20px rgba(0, 255, 163, 0.25)",

  // Overlay colors
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayLight: "rgba(0, 0, 0, 0.3)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Color Tokens - Light Theme
// ─────────────────────────────────────────────────────────────────────────────

export const lightColorTokens: ColorTokens = {
  // Base colors
  bg: "#fafbfc",
  panel: "#ffffff",
  panel2: "#f4f5f7",
  panel3: "#eaeef3",

  // Border colors
  border: "rgba(27, 31, 36, 0.08)",
  border2: "rgba(27, 31, 36, 0.15)",
  border3: "rgba(27, 31, 36, 0.25)",

  // Text colors
  text: "#1f2328",
  textDim: "#656d76",
  textMid: "#57606a",
  textInverted: "#fafbfc",

  // Brand/Primary colors
  primary: "#0969da",
  primaryHover: "#0756b3",
  primaryActive: "#0652c0",
  primarySubtle: "rgba(9, 105, 218, 0.1)",

  // Secondary colors
  secondary: "#8250df",
  secondaryHover: "#7045c7",
  secondaryActive: "#7a4bd8",
  secondarySubtle: "rgba(130, 80, 223, 0.1)",

  // Accent colors
  accent: "#0969da",
  accent2: "#8250df",
  accent3: "#1a7f37",
  accent4: "#cf222e",
  accent5: "#bf8700",

  // Semantic colors - Success
  success: "#1a7f37",
  successHover: "#156e30",
  successSubtle: "rgba(26, 127, 55, 0.1)",
  successBorder: "rgba(26, 127, 55, 0.3)",

  // Semantic colors - Warning
  warning: "#bf8700",
  warningHover: "#a67300",
  warningSubtle: "rgba(191, 135, 0, 0.1)",
  warningBorder: "rgba(191, 135, 0, 0.3)",

  // Semantic colors - Error/Danger
  error: "#cf222e",
  errorHover: "#b41e28",
  errorSubtle: "rgba(207, 34, 46, 0.1)",
  errorBorder: "rgba(207, 34, 46, 0.3)",

  // Semantic colors - Info
  info: "#0969da",
  infoHover: "#0756b3",
  infoSubtle: "rgba(9, 105, 218, 0.1)",
  infoBorder: "rgba(9, 105, 218, 0.3)",

  // Neutral palette (light mode)
  neutral50: "#fafbfc",
  neutral100: "#f4f5f7",
  neutral200: "#eaeef3",
  neutral300: "#d0d7de",
  neutral400: "#afb8c1",
  neutral500: "#8b949e",
  neutral600: "#656d76",
  neutral700: "#484f58",
  neutral800: "#24292f",
  neutral900: "#1f2328",

  // Glow effects
  glow: "0 0 20px rgba(9, 105, 218, 0.1)",
  glow2: "0 0 20px rgba(130, 80, 223, 0.1)",
  glow3: "0 0 20px rgba(26, 127, 55, 0.1)",

  // Overlay colors
  overlay: "rgba(0, 0, 0, 0.3)",
  overlayLight: "rgba(0, 0, 0, 0.15)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Complete Theme Tokens
// ─────────────────────────────────────────────────────────────────────────────

export const darkThemeTokens: ThemeTokens = {
  colors: darkColorTokens,
  spacing: spacingTokens,
  typography: typographyTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  animation: animationTokens,
  breakpoints: breakpointTokens,
  zIndex: zIndexTokens,
};

export const lightThemeTokens: ThemeTokens = {
  colors: lightColorTokens,
  spacing: spacingTokens,
  typography: typographyTokens,
  radius: radiusTokens,
  shadow: {
    ...shadowTokens,
    // Light mode uses lighter shadows
    xs: "0 1px 2px rgba(0, 0, 0, 0.03)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
    md: "0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.02)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.04), 0 10px 10px rgba(0, 0, 0, 0.02)",
    "2xl": "0 25px 50px rgba(0, 0, 0, 0.08)",
    card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
    float: "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
  },
  animation: animationTokens,
  breakpoints: breakpointTokens,
  zIndex: zIndexTokens,
};

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens Export
// ─────────────────────────────────────────────────────────────────────────────

export const designTokens: DesignTokens = {
  dark: darkThemeTokens,
  light: lightThemeTokens,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get tokens for a specific theme
 */
export function getTokens(theme: ThemeMode = "dark"): ThemeTokens {
  return designTokens[theme];
}

/**
 * Get a color value for a specific theme
 */
export function getColor(
  colorKey: keyof ColorTokens,
  theme: ThemeMode = "dark"
): string {
  return designTokens[theme].colors[colorKey];
}

/**
 * Get a spacing value
 */
export function getSpacing(spacingKey: keyof SpacingTokens): string {
  return spacingTokens[spacingKey];
}

/**
 * Get a font size value
 */
export function getFontSize(sizeKey: keyof TypographyTokens["fontSize"]): string {
  return typographyTokens.fontSize[sizeKey];
}

/**
 * Get a radius value
 */
export function getRadius(radiusKey: keyof RadiusTokens): string {
  return radiusTokens[radiusKey];
}

/**
 * Get a shadow value
 */
export function getShadow(shadowKey: keyof ShadowTokens): string {
  return shadowTokens[shadowKey];
}

/**
 * Get a duration value
 */
export function getDuration(durationKey: keyof AnimationTokens["duration"]): string {
  return animationTokens.duration[durationKey];
}

/**
 * Get an easing function value
 */
export function getEasing(easingKey: keyof AnimationTokens["easing"]): string {
  return animationTokens.easing[easingKey];
}

/**
 * Get a breakpoint value
 */
export function getBreakpoint(breakpointKey: keyof BreakpointTokens): string {
  return breakpointTokens[breakpointKey];
}

/**
 * Get a z-index value
 */
export function getZIndex(zIndexKey: keyof ZIndexTokens): number {
  return zIndexTokens[zIndexKey];
}

/**
 * Convert tokens to CSS custom properties for runtime theme switching
 * This generates CSS variables compatible with the existing index.css
 */
export function tokensToCSSVariables(theme: ThemeMode = "dark"): Record<string, string> {
  const colors = designTokens[theme].colors;

  return {
    // Base colors
    "--bg": colors.bg,
    "--panel": colors.panel,
    "--panel2": colors.panel2,
    "--panel3": colors.panel3,

    // Border colors
    "--border": colors.border,
    "--border2": colors.border2,
    "--border3": colors.border3,

    // Text colors
    "--text": colors.text,
    "--text-dim": colors.textDim,
    "--text-mid": colors.textMid,

    // Accent colors
    "--accent": colors.accent,
    "--accent2": colors.accent2,
    "--accent3": colors.accent3,
    "--accent4": colors.accent4,
    "--accent5": colors.accent5,

    // Primary/Secondary
    "--primary": colors.primary,
    "--secondary": colors.secondary,

    // Semantic colors
    "--success": colors.success,
    "--warning": colors.warning,
    "--error": colors.error,
    "--info": colors.info,

    // Glow effects
    "--glow": colors.glow,
    "--glow2": colors.glow2,
    "--glow3": colors.glow3,

    // Radius
    "--radius": radiusTokens.lg,
    "--radius-sm": radiusTokens.sm,

    // Shadows
    "--shadow-card": shadowTokens.card,
    "--shadow-float": shadowTokens.float,

    // Fonts
    "--font-sans": typographyTokens.fontFamily.sans,
    "--font-mono": typographyTokens.fontFamily.mono,
    "--font-disp": typographyTokens.fontFamily.display,
  };
}

/**
 * Apply theme to document (for runtime theme switching)
 */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  const vars = tokensToCSSVariables(theme);

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Set data-theme attribute
  root.setAttribute("data-theme", theme);

  // Set color-scheme
  root.style.setProperty("color-scheme", theme);
}

/**
 * Get current theme from DOM
 */
export function getCurrentTheme(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): ThemeMode {
  const current = getCurrentTheme();
  const next: ThemeMode = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type {
  DesignTokens,
  ThemeTokens,
  ColorTokens,
  SpacingTokens,
  TypographyTokens,
  RadiusTokens,
  ShadowTokens,
  AnimationTokens,
  BreakpointTokens,
  ZIndexTokens,
  ThemeMode,
} from "../types/tokens";
