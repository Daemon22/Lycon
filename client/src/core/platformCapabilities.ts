export interface NativeShieldState {
  enabled: boolean;
  https_only: boolean;
  tracker_blocking: boolean;
}

interface LyconNativeBridge {
  invoke: (action: string, payload?: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    __lyconNative?: LyconNativeBridge;
  }
}

function nativeState(enabled: boolean): NativeShieldState {
  return {
    enabled,
    https_only: true,
    tracker_blocking: enabled,
  };
}

/**
 * Mirrors the constitutional threshold at an available native boundary.
 * Browser sessions have no native boundary and are intentionally a no-op.
 */
export async function syncNativeShields(enabled: boolean): Promise<boolean> {
  if (typeof window !== "undefined" && window.__lyconNative) {
    await window.__lyconNative.invoke("shields:toggle", { enabled });
    return true;
  }

  if (typeof window === "undefined") return false;

  // GeckoView loads the canonical bundle from resource:// and exposes the
  // prompt protocol through MainActivity's PromptDelegate. This fallback
  // keeps the native boundary explicit without making browser prompts part of
  // the normal web runtime.
  if (window.location.protocol === "resource:" && typeof window.prompt === "function") {
    const response = window.prompt(
      `lycon:invoke:lycon-shields-${Date.now()}:shields:toggle:${JSON.stringify({ enabled })}`,
    );
    if (!response) throw new Error("Android shield bridge returned no response");
    const parsed = JSON.parse(response) as { error?: string };
    if (parsed.error) throw new Error(parsed.error);
    return true;
  }

  const tauriInternals = (window as Window & {
    __TAURI_INTERNALS__?: {
      invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }).__TAURI_INTERNALS__;
  if (!tauriInternals?.invoke) return false;

  await tauriInternals.invoke("set_shields_state", { state: nativeState(enabled) });
  return true;
}
