// ─────────────────────────────────────────────────────────────────────────────
// Theme Store - Design Tokens & Theme Management
// ─────────────────────────────────────────────────────────────────────────────
// Manages Design Tokens, theme switching, and custom theme persistence.

import { create } from "zustand";
import type { ThemeMode } from "@/types/tokens";
import {
  designTokens,
  type ThemeTokens,
  type ColorTokens,
} from "@/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    dark: Partial<ColorTokens>;
    light: Partial<ColorTokens>;
  };
}

export interface CustomThemeConfig {
  colors: {
    dark: Partial<ColorTokens>;
    light: Partial<ColorTokens>;
  };
  // Future: add other token customizations
  // radius?: Partial<RadiusTokens>;
  // typography?: Partial<TypographyTokens>;
}

interface ThemeState {
  // Current theme mode
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;

  // Active preset
  activePresetId: string;
  setActivePreset: (presetId: string) => void;

  // Custom theme overrides
  customTheme: CustomThemeConfig | null;
  setCustomTheme: (config: CustomThemeConfig) => void;
  updateCustomColor: (
    mode: ThemeMode,
    colorKey: keyof ColorTokens,
    value: string
  ) => void;
  resetCustomTheme: () => void;

  // Computed: get effective tokens
  getEffectiveTokens: () => ThemeTokens;

  // Apply theme to DOM
  applyEffectiveTheme: () => void;

  // Persistence
  saveThemeToVault: () => Promise<void>;
  loadThemeFromVault: () => Promise<void>;

  // Initialize
  initializeTheme: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset Themes
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "默认",
    description: "青蓝色调，科技感",
    colors: {
      dark: {},
      light: {},
    },
  },
  {
    id: "ocean",
    name: "海洋",
    description: "深海蓝色调",
    colors: {
      dark: {
        bg: "#0a1929",
        panel: "#0d2137",
        panel2: "#112840",
        primary: "#5090d3",
        accent: "#5090d3",
        accent2: "#66b2d8",
      },
      light: {
        bg: "#f5f9fc",
        panel: "#ffffff",
        panel2: "#e8f4fc",
        primary: "#1976d2",
        accent: "#1976d2",
        accent2: "#42a5f5",
      },
    },
  },
  {
    id: "forest",
    name: "森林",
    description: "自然绿色调",
    colors: {
      dark: {
        bg: "#0d1210",
        panel: "#131a16",
        panel2: "#1a2420",
        primary: "#22c55e",
        accent: "#22c55e",
        accent2: "#4ade80",
      },
      light: {
        bg: "#f6faf7",
        panel: "#ffffff",
        panel2: "#e9f5eb",
        primary: "#16a34a",
        accent: "#16a34a",
        accent2: "#22c55e",
      },
    },
  },
  {
    id: "sunset",
    name: "日落",
    description: "温暖橙色调",
    colors: {
      dark: {
        bg: "#12100d",
        panel: "#1a1612",
        panel2: "#231e18",
        primary: "#f97316",
        accent: "#f97316",
        accent2: "#fb923c",
      },
      light: {
        bg: "#fdf8f3",
        panel: "#ffffff",
        panel2: "#fef3e7",
        primary: "#ea580c",
        accent: "#ea580c",
        accent2: "#f97316",
      },
    },
  },
  {
    id: "violet",
    name: "紫罗兰",
    description: "优雅紫色调",
    colors: {
      dark: {
        bg: "#0f0a14",
        panel: "#16101c",
        panel2: "#1e1626",
        primary: "#a855f7",
        accent: "#a855f7",
        accent2: "#c084fc",
      },
      light: {
        bg: "#faf8fc",
        panel: "#ffffff",
        panel2: "#f3e8ff",
        primary: "#9333ea",
        accent: "#9333ea",
        accent2: "#a855f7",
      },
    },
  },
  {
    id: "minimal",
    name: "极简",
    description: "黑白灰色调",
    colors: {
      dark: {
        bg: "#000000",
        panel: "#0a0a0a",
        panel2: "#141414",
        primary: "#ffffff",
        accent: "#ffffff",
        accent2: "#a0a0a0",
      },
      light: {
        bg: "#ffffff",
        panel: "#fafafa",
        panel2: "#f0f0f0",
        primary: "#000000",
        accent: "#000000",
        accent2: "#666666",
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useThemeStore = create<ThemeState>((set, get) => ({
  // Initial state
  themeMode: "dark",
  activePresetId: "default",
  customTheme: null,

  // Theme mode actions
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    document.documentElement.setAttribute("data-theme", mode);
    get().saveThemeToVault();
  },

  toggleThemeMode: () => {
    const next = get().themeMode === "dark" ? "light" : "dark";
    get().setThemeMode(next);
  },

  // Preset actions
  setActivePreset: (presetId) => {
    set({ activePresetId: presetId });
    get().applyEffectiveTheme();
    get().saveThemeToVault();
  },

  // Custom theme actions
  setCustomTheme: (config) => {
    set({ customTheme: config, activePresetId: "custom" });
    get().applyEffectiveTheme();
    get().saveThemeToVault();
  },

  updateCustomColor: (mode, colorKey, value) => {
    const { customTheme, activePresetId } = get();

    // If using a preset, start with that as base
    const preset = THEME_PRESETS.find((p) => p.id === activePresetId);
    const baseColors = preset?.colors[mode] || {};

    const newCustomTheme: CustomThemeConfig = {
      colors: {
        dark: customTheme?.colors.dark || baseColors,
        light: customTheme?.colors.light || {},
      },
    };

    // Override the specific color
    newCustomTheme.colors[mode] = {
      ...newCustomTheme.colors[mode],
      [colorKey]: value,
    };

    set({
      customTheme: newCustomTheme,
      activePresetId: "custom",
    });

    get().applyEffectiveTheme();
    get().saveThemeToVault();
  },

  resetCustomTheme: () => {
    set({ customTheme: null, activePresetId: "default" });
    get().applyEffectiveTheme();
    get().saveThemeToVault();
  },

  // Computed: get effective tokens
  getEffectiveTokens: () => {
    const { themeMode, activePresetId, customTheme } = get();
    const baseTokens = designTokens[themeMode];

    // Start with base tokens
    let effectiveTokens = { ...baseTokens };

    // Apply preset overrides
    if (activePresetId !== "default" && activePresetId !== "custom") {
      const preset = THEME_PRESETS.find((p) => p.id === activePresetId);
      if (preset) {
        const presetColors = preset.colors[themeMode];
        effectiveTokens = {
          ...effectiveTokens,
          colors: { ...effectiveTokens.colors, ...presetColors },
        };
      }
    }

    // Apply custom overrides
    if (customTheme) {
      const customColors = customTheme.colors[themeMode];
      effectiveTokens = {
        ...effectiveTokens,
        colors: { ...effectiveTokens.colors, ...customColors },
      };
    }

    return effectiveTokens;
  },

  // Helper: apply effective theme to DOM
  applyEffectiveTheme: () => {
    const { themeMode } = get();
    const effectiveTokens = get().getEffectiveTokens();

    // Apply to CSS variables
    const root = document.documentElement;

    // Map effective tokens to CSS variables
    const colorMap: Record<string, string> = {
      "--bg": effectiveTokens.colors.bg,
      "--panel": effectiveTokens.colors.panel,
      "--panel2": effectiveTokens.colors.panel2,
      "--panel3": effectiveTokens.colors.panel3,
      "--border": effectiveTokens.colors.border,
      "--border2": effectiveTokens.colors.border2,
      "--border3": effectiveTokens.colors.border3,
      "--text": effectiveTokens.colors.text,
      "--text-dim": effectiveTokens.colors.textDim,
      "--text-mid": effectiveTokens.colors.textMid,
      "--accent": effectiveTokens.colors.accent,
      "--accent2": effectiveTokens.colors.accent2,
      "--accent3": effectiveTokens.colors.accent3,
      "--accent4": effectiveTokens.colors.accent4,
      "--accent5": effectiveTokens.colors.accent5,
      "--primary": effectiveTokens.colors.primary,
      "--secondary": effectiveTokens.colors.secondary,
      "--success": effectiveTokens.colors.success,
      "--warning": effectiveTokens.colors.warning,
      "--error": effectiveTokens.colors.error,
      "--info": effectiveTokens.colors.info,
      "--glow": effectiveTokens.colors.glow,
      "--glow2": effectiveTokens.colors.glow2,
    };

    Object.entries(colorMap).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value);
      }
    });

    // Set theme attribute
    root.setAttribute("data-theme", themeMode);
  },

  // Persistence
  saveThemeToVault: async () => {
    // Theme persistence is integrated with app settings
    // The vaultPath access is handled in the app store
  },

  loadThemeFromVault: async () => {
    // Theme loading is integrated with app settings
    // This is handled during app initialization
  },

  // Initialize theme on app start
  initializeTheme: () => {
    const { themeMode } = get();

    // Apply theme attribute
    document.documentElement.setAttribute("data-theme", themeMode);

    // Apply effective theme (preset + custom)
    get().applyEffectiveTheme();
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Selector Hooks
// ─────────────────────────────────────────────────────────────────────────────

export const useThemeMode = () => useThemeStore((s) => s.themeMode);
export const useActivePreset = () => useThemeStore((s) => s.activePresetId);
export const useCustomTheme = () => useThemeStore((s) => s.customTheme);

// ─────────────────────────────────────────────────────────────────────────────
// Integration with main app store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync theme mode with the main app store
 * Call this when the app initializes
 */
export function syncThemeWithAppStore(theme: ThemeMode) {
  const { setThemeMode } = useThemeStore.getState();

  // Only update if different
  if (useThemeStore.getState().themeMode !== theme) {
    setThemeMode(theme);
  }
}
