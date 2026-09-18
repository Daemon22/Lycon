/**
 * Gate 1 — Domain Vocabulary: Core Object Types
 *
 * Strongly-typed, immutable nouns. No behavior — these are pure data
 * definitions. The Core owns these objects and their lifecycles.
 *
 * Per Article I, nothing outside the Core may redefine these.
 * Per Article III, Commands describe intent and Events describe history;
 * these objects are the state that results from that history.
 */

import type {
  BrowserId,
  SessionId,
  WindowId,
  TabId,
  PageId,
  NavigationId,
  IdentityVersion,
  CommandId,
  EventId,
} from './00_ids';
import type { NavigationState, ThresholdState, TabState } from './02_lifecycle';

/** Alias: the Tab's lifecycle field uses this name for domain clarity. */
export type TabLifecycle = TabState;

// ── Browser ─────────────────────────────────────────────────────────────

/**
 * The top-level browser object. There is exactly one Browser per Core
 * instance. The Browser owns all sessions.
 */
export interface Browser {
  readonly id: BrowserId;
  readonly createdAt: number; // epoch milliseconds
  /** Ordered set of SessionId — no duplicates, insertion-ordered. */
  readonly sessionIds: readonly SessionId[];
  /** The SessionId currently receiving input (may be null on first boot). */
  readonly activeSessionId: SessionId | null;
  /** The SovereignIdentity version this browser was last ratified against. */
  readonly identityVersion: IdentityVersion;
}

// ── Session ─────────────────────────────────────────────────────────────

export type SessionMode = 'persistent' | 'private';

/**
 * A session is the unit of user affinity. A single boot may host multiple
 * sessions (e.g. personal + work). Each session owns windows.
 */
export interface Session {
  readonly id: SessionId;
  readonly browserId: BrowserId;
  readonly mode: SessionMode;
  readonly createdAt: number;
  readonly lastActiveAt: number;
  /** Ordered set of WindowId. */
  readonly windowIds: readonly WindowId[];
  /** The WindowId currently focused within this session (null if empty). */
  readonly activeWindowId: WindowId | null;
}

// ── Window ──────────────────────────────────────────────────────────────

/**
 * A window is a top-level rendering surface. On desktop each window maps to
 * an OS window; on mobile there is typically one.
 */
export interface Window {
  readonly id: WindowId;
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly title: string;
  /** Ordered set of TabId. */
  readonly tabIds: readonly TabId[];
  readonly activeTabId: TabId | null;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

// ── Tab ─────────────────────────────────────────────────────────────────

export type TabType = 'normal' | 'private';

/**
 * A tab is a navigable container. It has a stack of page records for
 * back/forward navigation and a lifecycle state.
 */
export interface Tab {
  readonly id: TabId;
  readonly windowId: WindowId;
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly title: string;
  readonly faviconUrl: string | null;
  readonly type: TabType;
  /** Ordered navigation history for this tab. */
  readonly pageIds: readonly PageId[];
  /** Index into pageIds — the currently displayed page. */
  readonly activePageIndex: number;
  /** Current lifecycle state (dormant, active, inactive, destroyed). */
  readonly lifecycle: TabLifecycle;
  /** The NavigationId currently in progress, if any. */
  readonly pendingNavigationId: NavigationId | null;
}

// ── Page ────────────────────────────────────────────────────────────────

/**
 * A page record represents one entry in a tab's navigation history.
 * It captures the address and metadata at the moment of navigation.
 */
export interface Page {
  readonly id: PageId;
  readonly tabId: TabId;
  readonly url: string;
  readonly title: string;
  readonly faviconUrl: string | null;
  readonly kind: PageKind;
  readonly viewType: ViewType;
  readonly createdAt: number;
  readonly navigationId: NavigationId | null;
}

export type PageKind = 'local' | 'online' | 'search' | 'file';

export type ViewType =
  | 'start'
  | 'search'
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'settings'
  | 'online';

// ── Navigation ──────────────────────────────────────────────────────────

/**
 * A navigation is the Core's record of a single user-initiated or
 * programmatic page-load attempt. It tracks the full lifecycle from
 * request to completion (or failure).
 */
export interface Navigation {
  readonly id: NavigationId;
  readonly tabId: TabId;
  readonly commandId: CommandId; // the Command that initiated this navigation
  readonly targetUrl: string;
  readonly targetKind: PageKind;
  readonly targetView: ViewType | null;
  readonly state: NavigationState;
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly committedAt: number | null;
  readonly completedAt: number | null;
  readonly failedAt: number | null;
  readonly cancelledAt: number | null;
  readonly failureReason: string | null;
  readonly finalUrl: string | null;
}

// ── Threshold (exposure / boundary state) ───────────────────────────────

/**
 * The Threshold is the boundary between the Den (local) and the Forest
 * (online). Its state machine enforces the deliberate handoff.
 *
 * Per Article IV, transitions are only:
 *   sealed → opening → open → closing → sealed
 * No transition skips a state.
 */
export interface Threshold {
  readonly tabId: TabId;
  readonly state: ThresholdState;
  /** The URL being handed off to the Forest (null when sealed). */
  readonly pendingUrl: string | null;
  /** When the boundary last opened (null until first open). */
  readonly openedAt: number | null;
  /** When the current open session began. */
  readonly openSince: number | null;
}

// ── Event reference (for causal tracing) ────────────────────────────────

/**
 * A causal link: every Event records the CommandId that initiated it.
 * Per Article III, an Event without a causally prior Command is a leak.
 */
export interface CausalLink {
  readonly commandId: CommandId;
  readonly eventId: EventId;
  readonly causality: number; // monotonic counter within the Core
}
