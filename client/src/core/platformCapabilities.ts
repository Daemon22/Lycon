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

// ── Agent capability boundary (Article VII / IX) ─────────────────────────
// Mirrors the native `agents:*` operations exposed by the Android bridge
// (LyconBridge.kt: agents:list/save/remove/request) and the Tauri native
// commands (agents_list/save/remove/request). Core RegisterAgent/UnregisterAgent
// govern the constitutional participant registry (domain policy); native
// connector storage is the persistence surface for agent configs. The Core
// never bypasses this boundary.

/**
 * Canonical local representation of a native agent connector. Field set mirrors
 * LyconAgentService.normalize()/public() exactly — no invented fields. The
 * encrypted apiKey never leaves the native layer (AES-GCM on Android, the
 * app-data JSON store on Tauri), so it is absent here.
 */
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly location: 'local' | 'remote';
  readonly protocol: string;
  readonly endpoint: string;
  readonly model: string;
  readonly enabled: boolean;
  readonly contextScopes: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Input accepted when registering/persisting an agent connector. */
export interface AgentRegisterInput {
  name: string;
  endpoint: string;
  model?: string;
  apiKey?: string;
  location?: 'local' | 'remote';
  contextScopes?: string[];
  enabled?: boolean;
}

/** Payload for an intelligence request through a native connector. */
export interface AgentRequestInput {
  connectorId: string;
  confirmed: boolean;
  scope?: string;
  prompt: string;
  contextText?: string;
  page?: unknown;
}

/**
 * Route an agent action to the native boundary. Returns `undefined` when no
 * native bridge is available (plain browser shells) so callers degrade
 * gracefully — mirroring syncNativeShields' graceful Web no-op.
 */
async function invokeAgent(action: string, payload?: unknown): Promise<unknown> {
  if (typeof window !== "undefined" && window.__lyconNative) {
    const nativeAction = `agents:${action}`;
    return payload === undefined
      ? window.__lyconNative.invoke(nativeAction)
      : window.__lyconNative.invoke(nativeAction, payload);
  }

  if (typeof window === "undefined") return undefined;

  // GeckoView loads the canonical bundle from resource:// and exposes the
  // prompt protocol through MainActivity's PromptDelegate. This fallback keeps
  // the native boundary explicit without making browser prompts part of the
  // normal web runtime (same pattern as syncNativeShields).
  if (window.location.protocol === "resource:" && typeof window.prompt === "function") {
    const message = `lycon:invoke:lycon-agents-${Date.now()}:${action}:${payload ? JSON.stringify(payload) : "null"}`;
    const response = window.prompt(message);
    if (response == null) throw new Error("Android agent bridge returned no response");
    const parsed = JSON.parse(response) as { error?: string; result?: unknown };
    if (parsed.error) throw new Error(parsed.error);
    return parsed.result;
  }

  const tauriInternals = (window as Window & {
    __TAURI_INTERNALS__?: {
      invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }).__TAURI_INTERNALS__;
  if (!tauriInternals?.invoke) return undefined;

  const tauriAction = `agents_${action}`;
  return payload === undefined
    ? tauriInternals.invoke(tauriAction)
    : tauriInternals.invoke(tauriAction, payload as Record<string, unknown>);
}

/** List persisted agent connectors from the native store. Empty in plain browsers. */
export async function listAgents(): Promise<Agent[]> {
  const result = await invokeAgent("list");
  if (result == null) return [];
  return (Array.isArray(result) ? result : []) as Agent[];
}

/**
 * Persist an agent connector to the native store. Returns the saved connector,
 * or `undefined` where no native boundary is available (plain browser shells).
 */
export async function registerAgent(input: AgentRegisterInput): Promise<Agent | undefined> {
  const result = await invokeAgent("save", input);
  return result == null ? undefined : (result as Agent);
}

/** Remove a persisted agent connector by id. Returns the remaining connectors. */
export async function unregisterAgent(id: string): Promise<Agent[] | undefined> {
  const result = await invokeAgent("remove", { id });
  if (result == null) return undefined;
  return (Array.isArray(result) ? result : []) as Agent[];
}

/**
 * Submit an intelligence request through a native connector (the native
 * `agents:request` / `agents_request` capability). Note: the Core's
 * `AgentSuggestion` command is a separate constitutional command handled by
 * useLyconCore — it is not an intelligence execution.
 */
export async function requestAgentSuggestion(input: AgentRequestInput): Promise<unknown> {
  return invokeAgent("request", input);
}
