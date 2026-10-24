/**
 * Gate 3 — CoreEvent Algebra
 *
 * Events describe **history**. Every Event is immutable, carries a unique
 * EventId, and is causally traceable to the Command that initiated it
 * (Article III: "event without command is a leak").
 *
 * Events are NEVER merged with Commands. They are separate unions.
 * Commands describe intent; Events describe what actually happened.
 *
 * The Core is the sole emitter of Events. Surfaces subscribe to Events;
 * they never generate them directly (Article X: Anti-Branch Rule).
 */

import type {
  EventId,
  CommandId,
  SessionId,
  WindowId,
  TabId,
  NavigationId,
  PageId,
  IdentityVersion,
} from './00_ids';
import type {
  BrowserState,
  SessionState,
  TabState,
  NavigationState,
  ThresholdState,
  IdentityState,
} from './02_lifecycle';
import type {
  SessionMode,
  TabType,
  PageKind,
  ViewType,
} from './01_objects';
import type { SovereignIdentity } from '../03_sovereign_identity';

// ── Base event interface ────────────────────────────────────────────────

/**
 * All CoreEvents share this base. The `commandId` field enforces causal
 * integrity (Shield S7): every Event is traceable to its originating Command.
 * The `causality` field is a monotonic counter within the Core.
 */
export interface BaseEvent {
  readonly eventId: EventId;
  readonly commandId: CommandId;
  readonly causality: number;
  readonly timestamp: number;
  readonly participantId: string; // who the event concerns or who issued the command
}

// ── Core lifecycle events ───────────────────────────────────────────────

export interface CoreBooting extends BaseEvent {
  readonly type: 'CoreBooting';
  readonly identityVersion: IdentityVersion;
}

export interface CoreReady extends BaseEvent {
  readonly type: 'CoreReady';
  readonly identity: SovereignIdentity;
}

export interface CoreSuspending extends BaseEvent {
  readonly type: 'CoreSuspending';
  readonly reason: string;
}

export interface CoreSuspended extends BaseEvent {
  readonly type: 'CoreSuspended';
}

export interface CoreResuming extends BaseEvent {
  readonly type: 'CoreResuming';
}

export interface CoreShutdown extends BaseEvent {
  readonly type: 'CoreShutdown';
}

// ── Session events ─────────────────────────────────────────────────────

export interface SessionCreated extends BaseEvent {
  readonly type: 'SessionCreated';
  readonly sessionId: SessionId;
  readonly mode: SessionMode;
}

export interface SessionFocused extends BaseEvent {
  readonly type: 'SessionFocused';
  readonly sessionId: SessionId;
}

export interface SessionDestroyed extends BaseEvent {
  readonly type: 'SessionDestroyed';
  readonly sessionId: SessionId;
}

export interface SessionStateChanged extends BaseEvent {
  readonly type: 'SessionStateChanged';
  readonly sessionId: SessionId;
  readonly from: SessionState;
  readonly to: SessionState;
}

// ── Window events ──────────────────────────────────────────────────────

export interface WindowCreated extends BaseEvent {
  readonly type: 'WindowCreated';
  readonly windowId: WindowId;
  readonly sessionId: SessionId;
  readonly width: number;
  readonly height: number;
}

export interface WindowClosed extends BaseEvent {
  readonly type: 'WindowClosed';
  readonly windowId: WindowId;
}

export interface WindowFocused extends BaseEvent {
  readonly type: 'WindowFocused';
  readonly windowId: WindowId;
}

export interface WindowResized extends BaseEvent {
  readonly type: 'WindowResized';
  readonly windowId: WindowId;
  readonly width: number;
  readonly height: number;
}

// ── Tab events ─────────────────────────────────────────────────────────

export interface TabCreated extends BaseEvent {
  readonly type: 'TabCreated';
  readonly tabId: TabId;
  readonly windowId: WindowId;
  readonly sessionId: SessionId;
  readonly tabType: TabType;
}

export interface TabActivated extends BaseEvent {
  readonly type: 'TabActivated';
  readonly tabId: TabId;
}

export interface TabClosed extends BaseEvent {
  readonly type: 'TabClosed';
  readonly tabId: TabId;
}

export interface TabStateChanged extends BaseEvent {
  readonly type: 'TabStateChanged';
  readonly tabId: TabId;
  readonly from: TabState;
  readonly to: TabState;
}

// ── Navigation events ──────────────────────────────────────────────────

export interface NavigationRequested extends BaseEvent {
  readonly type: 'NavigationRequested';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly url: string;
  readonly kind: PageKind;
  readonly view: ViewType | null;
}

export interface NavigationStarted extends BaseEvent {
  readonly type: 'NavigationStarted';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly engineUrl: string; // the URL passed to the EngineAdapter
}

export interface NavigationCommitted extends BaseEvent {
  readonly type: 'NavigationCommitted';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly pageId: PageId;
}

export interface NavigationLoading extends BaseEvent {
  readonly type: 'NavigationLoading';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly progress: number; // 0-100
}

export interface NavigationCompleted extends BaseEvent {
  readonly type: 'NavigationCompleted';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly finalUrl: string;
  readonly statusCode: number;
}

export interface NavigationFailed extends BaseEvent {
  readonly type: 'NavigationFailed';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly url: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface NavigationCancelled extends BaseEvent {
  readonly type: 'NavigationCancelled';
  readonly navigationId: NavigationId;
  readonly tabId: TabId;
  readonly url: string;
}

export interface NavigationStateChanged extends BaseEvent {
  readonly type: 'NavigationStateChanged';
  readonly navigationId: NavigationId;
  readonly from: NavigationState;
  readonly to: NavigationState;
}

// ── Boundary (threshold) events ─────────────────────────────────────────

export interface ThresholdOpening extends BaseEvent {
  readonly type: 'ThresholdOpening';
  readonly tabId: TabId;
  readonly url: string;
}

export interface ThresholdOpened extends BaseEvent {
  readonly type: 'ThresholdOpened';
  readonly tabId: TabId;
  readonly url: string;
  readonly capabilitiesRevoked: string[]; // capabilities removed from this tab
}

export interface ThresholdClosing extends BaseEvent {
  readonly type: 'ThresholdClosing';
  readonly tabId: TabId;
  readonly reason: string;
}

export interface ThresholdSealed extends BaseEvent {
  readonly type: 'ThresholdSealed';
  readonly tabId: TabId;
  readonly capabilitiesRevoked: string[]; // ALL external capabilities revoked
}

// ── Identity events ───────────────────────────────────────────────────

export interface IdentityDeclared extends BaseEvent {
  readonly type: 'IdentityDeclared';
  readonly identity: SovereignIdentity;
  readonly state: IdentityState;
}

export interface IdentityRatified extends BaseEvent {
  readonly type: 'IdentityRatified';
  readonly identity: SovereignIdentity;
  readonly version: IdentityVersion;
  readonly author: string;
}

export interface IdentityAmended extends BaseEvent {
  readonly type: 'IdentityAmended';
  readonly identity: SovereignIdentity;
  readonly previousVersion: IdentityVersion;
  readonly newVersion: IdentityVersion;
  readonly author: string;
  readonly changes: Array<{ field: string; from: unknown; to: unknown }>;
}

// ── Agent events ───────────────────────────────────────────────────────

export interface AgentRegistered extends BaseEvent {
  readonly type: 'AgentRegistered';
  readonly agentName: string;
  readonly domain: string;
}

export interface AgentUnregistered extends BaseEvent {
  readonly type: 'AgentUnregistered';
  readonly agentName: string;
}

// ── System events ──────────────────────────────────────────────────────

/**
 * Per Article III: a Command that fails validation or cannot be executed
 * produces a CommandRejected event. There is no other path.
 */
export interface CommandRejected extends BaseEvent {
  readonly type: 'CommandRejected';
  /** The original command that was rejected. */
  readonly rejectedCommand: {
    readonly type: string;
    readonly commandId: CommandId;
  };
  readonly reason: string;
  readonly details?: Record<string, unknown>;
}

// ── Event union ────────────────────────────────────────────────────────

export type CoreEvent =
  | CoreBooting
  | CoreReady
  | CoreSuspending
  | CoreSuspended
  | CoreResuming
  | CoreShutdown
  | SessionCreated
  | SessionFocused
  | SessionDestroyed
  | SessionStateChanged
  | WindowCreated
  | WindowClosed
  | WindowFocused
  | WindowResized
  | TabCreated
  | TabActivated
  | TabClosed
  | TabStateChanged
  | NavigationRequested
  | NavigationStarted
  | NavigationCommitted
  | NavigationLoading
  | NavigationCompleted
  | NavigationFailed
  | NavigationCancelled
  | NavigationStateChanged
  | ThresholdOpening
  | ThresholdOpened
  | ThresholdClosing
  | ThresholdSealed
  | IdentityDeclared
  | IdentityRatified
  | IdentityAmended
  | AgentRegistered
  | AgentUnregistered
  | CommandRejected;

// ── Event stream ───────────────────────────────────────────────────────

/**
 * The EventStream is the Core's historical record. Each entry is an event
 * with its causality counter. This stream is immutable — events are only
 * appended, never modified or deleted.
 *
 * Per Shield S7 (Causal Integrity), every event in the stream is traceable
 * to its originating command.
 */
export interface EventStream {
  readonly events: readonly CoreEvent[];
  readonly count: number;
  readonly lastCausality: number;
}
