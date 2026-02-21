/**
 * Environment Detection
 * Detects whether running in Tauri or web browser
 */

let isTauriCache: boolean | null = null;

export const isTauri = (): boolean => {
  if (isTauriCache !== null) return isTauriCache;

  // Check if running in Tauri by looking for __TAURI__ or __TAURI_INTERNALS__ global
  // Tauri v2 may use __TAURI_INTERNALS__ instead of __TAURI__
  isTauriCache =
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

  return isTauriCache;
};

export const isWeb = (): boolean => {
  return !isTauri();
};

export const getEnvironment = (): "tauri" | "web" => {
  return isTauri() ? "tauri" : "web";
};
