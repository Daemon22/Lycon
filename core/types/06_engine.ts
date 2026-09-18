/**
 * Gate 5 — EngineAdapter Contract
 *
 * Per Article II: "The EngineAdapter is the only gate. No layer may
 * communicate with a browser engine except through the EngineAdapter.
 * No UI-to-Engine shortcuts."
 *
 * The Core is engine-agnostic — it knows EngineCapabilities, never "Chromium."
 * The concrete engine (GeckoView, WebView2, etc.) is a replaceable strategy
 * behind the Adapter.
 *
 * Per Article II, Paragraph 4: "The EngineAdapter attachs only when a tab
 * becomes visible. It detaches when a tab is hidden or destroyed."
 *
 * This interface is intentionally narrow. Per Shield S2: "No non-EngineAdapter
 * code path ever directly invokes engine APIs."
 */

import type { TabId, WindowId, SessionId } from './00_ids';
import type {
  PageKind,
  ViewType,
} from './01_objects';
import type { ThresholdState } from './02_lifecycle';
import type { Capability } from './05_policy';

// ── Engine capabilities ─────────────────────────────────────────────────

/**
 * The concrete capabilities of a browser engine implementation.
 * These describe what the engine CAN do, not what it SHOULD do in a
 * given context. The Core's CapabilityResolver determines effective
 * capabilities; the EngineCapabilities describes the engine's theoretical max.
 *
 * Per Article II: "The Core knows EngineCapabilities, never 'Chromium'."
 * The Core does not know or care whether the engine is GeckoView,
 * WebView2, or a fake test engine.
 */
export interface EngineCapabilities {
  /** Can the engine render HTML content? */
  readonly canRenderHtml: boolean;
  /** Can the engine handle sandboxed iframe embedding? */
  readonly canEmbedContent: boolean;
  /** Can the engine intercept and block network requests? */
  readonly canBlockRequests: boolean;
  /** Can the engine inject scripts into pages? */
  readonly canInjectScripts: boolean;
  /** Can the engine take screenshots of rendered content? */
  readonly canScreenshot: boolean;
  /** Can the engine handle file downloads? */
  readonly canDownload: boolean;
  /** Can the engine handle file uploads (file:// / content://)? */
  readonly canAccessFile: boolean;
  /** Can the engine execute JavaScript? */
  readonly canRunJavaScript: boolean;
  /** Can the engine manage cookies? */
  readonly canManageCookies: boolean;
  /** Can the engine handle geolocation? */
  readonly canGeolocation: boolean;
  /** Can the engine handle media (microphone/camera)? */
  readonly canMedia: boolean;
  /** Can the engine handle fullscreen? */
  readonly canFullscreen: boolean;
  /** Can the engine handle clipboard? */
  readonly canClipboard: boolean;
  /** Can the engine handle zoom? */
  readonly canZoom: boolean;
  /** A human-readable name for this engine adapter. */
  readonly name: string;
  /** The engine version string. */
  readonly version: string;
}

// ── Engine context ──────────────────────────────────────────────────────

/**
 * The context provided when the Core asks the EngineAdapter to attach
 * an engine instance to a tab.
 *
 * Per Article V: "A private session receives a RESTRICTED capability set
 * by construction." The effective capabilities are computed by the Core
 * and passed to the adapter — the adapter never computes its own policy.
 */
export interface EngineContext {
  readonly tabId: TabId;
  readonly windowId: WindowId;
  readonly sessionId: SessionId;
  /** The effective capabilities for THIS tab/context. */
  readonly effectiveCapabilities: readonly Capability[];
  /** The current threshold state (sealed/opening/open/closing). */
  readonly thresholdState: ThresholdState;
  /** Initial URL to load (if any). */
  readonly initialUrl: string | null;
  /** HTML container element for the engine to render into. */
  readonly container: HTMLElement | null;
  /**
   * Sandbox attributes for the engine container.
   * Private sessions get stricter sandbox attributes.
   */
  readonly sandboxAttributes: readonly string[];
  /**
   * The tab's type — normal or private. The adapter uses this only to
   * configure engine-level privacy settings (cookies disabled, etc.),
   * NOT to decide business logic.
   */
  readonly tabType: 'normal' | 'private';
  /**
   * Session mode — persistent or private. Same caveat as tabType.
   */
  readonly sessionMode: 'persistent' | 'private';
}

// ── Engine navigation request ────────────────────────────────────────────

/**
 * A request to navigate within the engine.
 * Per Article II: "No UI-to-Engine shortcuts." Navigation always goes
 * through the Core → EngineAdapter.
 */
export interface EngineNavigationRequest {
  readonly tabId: TabId;
  readonly url: string;
  /** HTTP method (default: GET). */
  readonly method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE';
  /** Headers to send with the request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Whether to replace the current history entry. */
  readonly replace?: boolean;
  /** Referrer policy (default: 'no-referrer' — Shadcn/ui privacy default). */
  readonly referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  /** Sandbox attributes for the content (if iframe-based). */
  readonly sandbox?: string;
}

// ── Engine events ───────────────────────────────────────────────────────

/**
 * Events emitted by the engine through the EngineAdapter back to the Core.
 * These are NOT CoreEvents — they are lower-level signals about what the
 * engine observed. The Core translates them into CoreEvents.
 *
 * Per Article II: "No layer may communicate with a browser engine except
 * through the EngineAdapter." These events are the return channel.
 */
export type EngineEvent =
  | EnginePageLoaded
  | EngineNavigationStarted
  | EngineNavigationCompleted
  | EngineNavigationFailed
  | EngineTitleChanged
  | EngineFaviconReceived
  | EngineConsoleMessage
  | EngineDialogRequest
  | EngineDownloadRequested
  | EngineCertificateError
  | EngineRequestBlocked
  | EngineThresholdCrossed;

export interface EnginePageLoaded {
  readonly type: 'EnginePageLoaded';
  readonly tabId: TabId;
  readonly url: string;
  readonly statusCode: number;
  readonly finalUrl: string;
}

export interface EngineNavigationStarted {
  readonly type: 'EngineNavigationStarted';
  readonly tabId: TabId;
  readonly url: string;
}

export interface EngineNavigationCompleted {
  readonly type: 'EngineNavigationCompleted';
  readonly tabId: TabId;
  readonly url: string;
  readonly statusCode: number;
}

export interface EngineNavigationFailed {
  readonly type: 'EngineNavigationFailed';
  readonly tabId: TabId;
  readonly url: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface EngineTitleChanged {
  readonly type: 'EngineTitleChanged';
  readonly tabId: TabId;
  readonly title: string;
}

export interface EngineFaviconReceived {
  readonly type: 'EngineFaviconReceived';
  readonly tabId: TabId;
  readonly faviconUrl: string;
}

export interface EngineConsoleMessage {
  readonly type: 'EngineConsoleMessage';
  readonly tabId: TabId;
  readonly level: 'log' | 'info' | 'warn' | 'error';
  readonly message: string;
  /** Whether this console message represents a security violation. */
  readonly isSecurityViolation: boolean;
}

export interface EngineDialogRequest {
  readonly type: 'EngineDialogRequest';
  readonly tabId: TabId;
  readonly dialogType: 'alert' | 'confirm' | 'prompt';
  readonly message: string;
  /** The default value for prompt dialogs. */
  readonly defaultValue?: string;
}

export interface EngineDownloadRequested {
  readonly type: 'EngineDownloadRequested';
  readonly tabId: TabId;
  readonly url: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly contentLength: number | null;
}

export interface EngineCertificateError {
  readonly type: 'EngineCertificateError';
  readonly tabId: TabId;
  readonly url: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface EngineRequestBlocked {
  readonly type: 'EngineRequestBlocked';
  readonly tabId: TabId;
  readonly url: string;
  readonly resourceType: 'script' | 'image' | 'stylesheet' | 'media' | 'font' | 'connect' | 'object' | 'sub_frame' | 'main_frame' | 'other';
  /** Which shield rule blocked this request (for telemetry/audit). */
  readonly blockedBy: string;
}

/**
 * Emitted when the engine observes a navigation crossing the threshold
 * (entering or leaving the Forest). The Core uses this to drive the
 * Threshold state machine.
 */
export interface EngineThresholdCrossed {
  readonly type: 'EngineThresholdCrossed';
  readonly tabId: TabId;
  readonly direction: 'enter' | 'exit';
  readonly url: string;
}

// ── Engine event listener & subscription ────────────────────────────────

export type EngineEventListener = (event: EngineEvent) => void;
export type Unsubscribe = () => void;

// ── The EngineAdapter interface ─────────────────────────────────────────

/**
 * The EngineAdapter is the ONLY interface through which the Core
 * communicates with a browser engine (Article II).
 *
 * Implementations:
 * - `FakeEngineAdapter` — a deliberately boring test double (Gate 7)
 * - `GeckoViewAdapter` — Android's GeckoView engine
 * - `TauriWebViewAdapter` — desktop Tauri webview
 * - `WebView2Adapter` — Windows WebView2 (if needed)
 *
 * The Core never imports or references concrete implementations.
 * It only knows the EngineAdapter interface and EngineCapabilities.
 *
 * Per Article II, Paragraph 4: "attach" is called only when a tab becomes
 * visible; "detach" is called when a tab is hidden or destroyed.
 */
export interface EngineAdapter {
  /**
   * The concrete engine's theoretical capabilities.
   * This is NOT the effective capability set — that is computed by
   * the Core's CapabilityResolver and passed via EngineContext.
   */
  readonly capabilities: EngineCapabilities;

  /**
   * Attach the engine to a tab's rendering surface.
   * Called by the Core when a tab becomes visible (Article II, Paragraph 4).
   *
   * The Core passes the effective capabilities for this context.
   * The adapter must configure its engine to NOT exceed these capabilities.
   *
   * @throws if the adapter cannot attach (e.g., engine initialization failure)
   */
  attach(context: EngineContext): Promise<void>;

  /**
   * Detach the engine from a tab's rendering surface.
   * Called by the Core when a tab is hidden or destroyed.
   * The adapter must release all engine resources (memory, network, etc.)
   * and emit no further EngineEvents for this tabId.
   */
  detach(tabId: TabId): Promise<void>;

  /**
   * Navigate the engine to a new URL.
   * Per Article II: "No UI-to-Engine shortcuts." All navigation goes through
   * the Core → EngineAdapter.
   */
  navigate(request: EngineNavigationRequest): Promise<void>;

  /**
   * Navigate back in the engine's session history.
   */
  goBack(tabId: TabId): Promise<void>;

  /**
   * Navigate forward in the engine's session history.
   */
  goForward(tabId: TabId): Promise<void>;

  /**
   * Stop the current navigation / page load.
   */
  stop(tabId: TabId): Promise<void>;

  /**
   * Subscribe to engine-level events.
   * The adapter emits EngineEvents through this listener.
   * Returns an Unsubscribe function.
   */
  subscribe(listener: EngineEventListener): Unsubscribe;

  /**
   * Get the engine's current zoom level for a tab.
   * Returns a multiplier (1.0 = 100%).
   */
  getZoom(tabId: TabId): Promise<number>;

  /**
   * Set the engine's zoom level for a tab.
   */
  setZoom(tabId: TabId, level: number): Promise<void>;

  /**
   * Execute the EngineAdapter contract: verify that this adapter conforms
   * to the contract. Used by the Core at boot to validate the adapter.
   */
  verifyContract(): Promise<boolean>;
}

/**
 * Factory function type. The Core receives a factory (not an instance)
 * so the concrete engine can be swapped without touching Core code.
 *
 * Per Article II: "Swapping the engine may only touch the Adapter and
 * Shell — if a Core change is needed, the boundary leaked."
 */
export type EngineAdapterFactory = () => Promise<EngineAdapter>;

/**
 * The Core's reference to its engine adapter. This is the ONLY engine
 * reference the Core holds. There is no back-channel.
 */
export interface EngineAttachment {
  readonly adapter: EngineAdapter;
  readonly attachedTabIds: readonly TabId[];
}
