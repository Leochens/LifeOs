// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
// This file defines the TypeScript types for the Design Tokens system.
// All token values are type-safe and support both light and dark themes.

// ─────────────────────────────────────────────────────────────────────────────
// Theme Mode
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeMode = "dark" | "light";

// ─────────────────────────────────────────────────────────────────────────────
// Color Tokens
// ─────────────────────────────────────────────────────────────────────────────

export interface ColorTokens {
  // Base colors
  bg: string;
  panel: string;
  panel2: string;
  panel3: string;

  // Border colors
  border: string;
  border2: string;
  border3: string;

  // Text colors
  text: string;
  textDim: string;
  textMid: string;
  textInverted: string;

  // Brand/Primary colors
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySubtle: string;

  // Secondary colors
  secondary: string;
  secondaryHover: string;
  secondaryActive: string;
  secondarySubtle: string;

  // Accent colors (brand accents)
  accent: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;

  // Semantic colors - Success
  success: string;
  successHover: string;
  successSubtle: string;
  successBorder: string;

  // Semantic colors - Warning
  warning: string;
  warningHover: string;
  warningSubtle: string;
  warningBorder: string;

  // Semantic colors - Error/Danger
  error: string;
  errorHover: string;
  errorSubtle: string;
  errorBorder: string;

  // Semantic colors - Info
  info: string;
  infoHover: string;
  infoSubtle: string;
  infoBorder: string;

  // Neutral palette
  neutral50: string;
  neutral100: string;
  neutral200: string;
  neutral300: string;
  neutral400: string;
  neutral500: string;
  neutral600: string;
  neutral700: string;
  neutral800: string;
  neutral900: string;

  // Glow effects
  glow: string;
  glow2: string;
  glow3: string;

  // Overlay colors
  overlay: string;
  overlayLight: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spacing Tokens (Scale 0-16, based on 4px base unit)
// ─────────────────────────────────────────────────────────────────────────────

export type SpacingScale =
  | 0      // 0px
  | 1      // 4px
  | 2      // 8px
  | 3      // 12px
  | 4      // 16px
  | 5      // 20px
  | 6      // 24px
  | 7      // 28px
  | 8      // 32px
  | 9      // 36px
  | 10     // 40px
  | 11     // 44px
  | 12     // 48px
  | 13     // 52px
  | 14     // 56px
  | 15     // 60px
  | 16     // 64px
  | 20     // 80px
  | 24     // 96px
  | 32;    // 128px

export interface SpacingTokens {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  9: string;
  10: string;
  11: string;
  12: string;
  13: string;
  14: string;
  15: string;
  16: string;
  20: string;
  24: string;
  32: string;
  auto: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typography Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type FontFamily = "sans" | "mono" | "display" | "body";

export type FontSize =
  | "xs"      // 11px
  | "sm"      // 12px
  | "base"    // 14px
  | "md"      // 15px
  | "lg"      // 16px
  | "xl"      // 18px
  | "2xl"     // 20px
  | "3xl"     // 24px
  | "4xl"     // 30px
  | "5xl"     // 36px
  | "6xl"     // 48px
  | "7xl"     // 60px;

export type FontWeight =
  | "thin"       // 100
  | "extralight" // 200
  | "light"      // 300
  | "normal"     // 400
  | "medium"     // 500
  | "semibold"   // 600
  | "bold"       // 700
  | "extrabold"  // 800
  | "black";     // 900

export type LineHeight =
  | "none"      // 1
  | "tight"     // 1.25
  | "snug"      // 1.375
  | "normal"    // 1.5
  | "relaxed"   // 1.625
  | "loose";    // 2

export interface TypographyTokens {
  // Font families
  fontFamily: {
    sans: string;
    mono: string;
    display: string;
    body: string;
  };

  // Font sizes
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
    "5xl": string;
    "6xl": string;
    "7xl": string;
  };

  // Font weights
  fontWeight: {
    thin: number;
    extralight: number;
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
    black: number;
  };

  // Line heights
  lineHeight: {
    none: number;
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };

  // Letter spacing
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type RadiusScale =
  | "none"    // 0px
  | "xs"      // 2px
  | "sm"      // 4px
  | "md"      // 6px
  | "lg"      // 8px
  | "xl"      // 12px
  | "2xl"     // 16px
  | "3xl"     // 24px
  | "full";   // 9999px

export interface RadiusTokens {
  none: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  full: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shadow Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type ShadowScale =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "inner"
  | "glow";

export interface ShadowTokens {
  none: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  inner: string;
  glow: string;
  glow2: string;
  card: string;
  float: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation/Transition Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type DurationScale =
  | "instant"  // 0ms
  | "fast"     // 100ms
  | "normal"   // 200ms
  | "slow"     // 300ms
  | "slower"   // 500ms
  | "slowest"; // 1000ms

export type EasingFunction =
  | "linear"
  | "ease"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "spring";

export interface AnimationTokens {
  // Durations
  duration: {
    instant: string;
    fast: string;
    normal: string;
    slow: string;
    slower: string;
    slowest: string;
  };

  // Easing functions
  easing: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    easeInQuad: string;
    easeOutQuad: string;
    easeInOutQuad: string;
    easeInCubic: string;
    easeOutCubic: string;
    easeInOutCubic: string;
    spring: string;
  };

  // Preset transitions
  transition: {
    fast: string;
    normal: string;
    slow: string;
    spring: string;
  };

  // Keyframe animations
  keyframes: {
    fadeUp: string;
    fadeDown: string;
    fadeIn: string;
    fadeOut: string;
    slideUp: string;
    slideDown: string;
    slideLeft: string;
    slideRight: string;
    scaleIn: string;
    scaleOut: string;
    spin: string;
    ping: string;
    pulse: string;
    bounce: string;
    shake: string;
    float: string;
    glow: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type BreakpointScale = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

export interface BreakpointTokens {
  xs: string;   // 0px
  sm: string;   // 640px
  md: string;   // 768px
  lg: string;   // 1024px
  xl: string;   // 1280px
  "2xl": string; // 1536px
  "3xl": string; // 1920px
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-Index Tokens
// ─────────────────────────────────────────────────────────────────────────────

export type ZIndexScale =
  | "base"
  | "dropdown"
  | "sticky"
  | "fixed"
  | "modalBackdrop"
  | "modal"
  | "popover"
  | "tooltip"
  | "max";

export interface ZIndexTokens {
  base: number;
  dropdown: number;
  sticky: number;
  fixed: number;
  modalBackdrop: number;
  modal: number;
  popover: number;
  tooltip: number;
  max: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete Token Set by Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  animation: AnimationTokens;
  breakpoints: BreakpointTokens;
  zIndex: ZIndexTokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Set with both themes
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignTokens {
  dark: ThemeTokens;
  light: ThemeTokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Config for Runtime Access
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenConfig {
  theme: ThemeMode;
  tokens: DesignTokens;
  customTokens?: Partial<ThemeTokens>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Path Types for Typed Access
// ─────────────────────────────────────────────────────────────────────────────

export type ColorTokenPath = keyof ColorTokens;
export type SpacingTokenPath = keyof SpacingTokens;
export type FontSizePath = keyof TypographyTokens["fontSize"];
export type FontWeightPath = keyof TypographyTokens["fontWeight"];
export type RadiusTokenPath = keyof RadiusTokens;
export type ShadowTokenPath = keyof ShadowTokens;
export type DurationPath = keyof AnimationTokens["duration"];
export type EasingPath = keyof AnimationTokens["easing"];
export type BreakpointPath = keyof BreakpointTokens;
export type ZIndexPath = keyof ZIndexTokens;

// ─────────────────────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────────────────────

export type TokenValue<T extends object, K extends keyof T> = T[K];

export type GetToken<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? GetToken<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

// Example: GetToken<ThemeTokens, "colors.primary"> -> string
