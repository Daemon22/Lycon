/**
 * Gate 3 — Command Algebra
 *
 * Commands describe **intent**. Every Command is immutable, carries a
 * unique CommandId, and is attributed to a participant (Article IX:
 * Non-Impersonation). The Core is the sole processor of Commands.
 *
 * Per Article III: "Command without event is a rumor; event without
 * command is a leak." Every Command must produce at least one Event
 * (either a domain event or a CommandRejected).
 *
 * Commands are NEVER merged with Events. They are separate unions.
 */

import type {
  CommandId,
  SessionId,
  WindowId,
  TabId,
  NavigationId,
  IdentityVersion,
  PageId,
} from './00_ids';
import type {
  SessionMode,
  TabType,
  PageKind,
  ViewType,
} from './01_objects';
import type { SovereignIdentity } from '../03_sovereign_identity';

// ── Base command interface ──────────────────────────────────────────────

/**
 * All commands share this base. The `participantId` field enforces
 * Article IX (Non-Impersonation): every command is clearly attributed
 * to its issuer, and agents never command "as Lycon."
 */
export interface BaseCommand {
  readonly commandId: CommandId;
  readonly participantId: string; // the issuer's participant identity
  readonly timestamp: number; // epoch milliseconds
}

// ── Core lifecycle commands ─────────────────────────────────────────────

export interface BootCore extends BaseCommand {
  readonly type: 'BootCore';
  readonly identity: SovereignIdentity;
}

export interface ShutdownCore extends BaseCommand {
  readonly type: 'ShutdownCore';
}

export interface SuspendCore extends BaseCommand {
  readonly type: 'SuspendCore';
  readonly reason: string;
}

export interface ResumeCore extends BaseCommand {
  readonly type: 'ResumeCore';
}

// ── Session commands ────────────────────────────────────────────────────

export interface CreateSession extends BaseCommand {
  readonly type: 'CreateSession';
  readonly mode: SessionMode;
}

export interface DestroySession extends BaseCommand {
  readonly type: 'DestroySession';
  readonly sessionId: SessionId;
}

export interface FocusSession extends BaseCommand {
  readonly type: 'FocusSession';
  readonly sessionId: SessionId;
}

// ── Window commands ────────────────────────────────────────────────────

export interface CreateWindow extends BaseCommand {
  readonly type: 'CreateWindow';
  readonly sessionId: SessionId;
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
}

export interface CloseWindow extends BaseCommand {
  readonly type: 'CloseWindow';
  readonly windowId: WindowId;
}

export interface FocusWindow extends BaseCommand {
  readonly type: 'FocusWindow';
  readonly windowId: WindowId;
}

export interface ResizeWindow extends BaseCommand {
  readonly type: 'ResizeWindow';
  readonly windowId: WindowId;
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
}

// ── Tab commands ────────────────────────────────────────────────────────

export interface CreateTab extends BaseCommand {
  readonly type: 'CreateTab';
  readonly windowId: WindowId;
  readonly typeKind: TabType; // 'normal' | 'private'
  readonly initialUrl?: string;
  readonly initialKind?: PageKind;
  readonly initialView?: ViewType;
}

export interface CloseTab extends BaseCommand {
  readonly type: 'CloseTab';
  readonly tabId: TabId;
}

export interface ActivateTab extends BaseCommand {
  readonly type: 'ActivateTab';
  readonly tabId: TabId;
}

export interface Navigate extends BaseCommand {
  readonly type: 'Navigate';
  readonly tabId: TabId;
  readonly url: string;
  readonly replace?: boolean; // true = replace current history entry
}

export interface GoBack extends BaseCommand {
  readonly type: 'GoBack';
  readonly tabId: TabId;
}

export interface GoForward extends BaseCommand {
  readonly type: 'GoForward';
  readonly tabId: TabId;
}

export interface StopNavigation extends BaseCommand {
  readonly type: 'StopNavigation';
  readonly navigationId: NavigationId;
}

export interface Reload extends BaseCommand {
  readonly type: 'Reload';
  readonly tabId: TabId;
}

// ── Boundary (threshold) commands ───────────────────────────────────────

/**
 * Open the boundary: request network access for a tab.
 * Per Article IV, this transitions the Threshold: sealed → opening → open.
 * The Core validates capabilities before allowing the transition.
 */
export interface OpenBoundary extends BaseCommand {
  readonly type: 'OpenBoundary';
  readonly tabId: TabId;
  readonly url: string; // the URL being handed off to the Forest
}

/**
 * Close the boundary: seal the threshold and revoke network capabilities.
 * Per Article IV, "closing the boundary must revoke external capabilities,
 * not merely change presentation."
 */
export interface CloseBoundary extends BaseCommand {
  readonly type: 'CloseBoundary';
  readonly tabId: TabId;
}

// ── Identity commands ───────────────────────────────────────────────────

/**
 * Amend the SovereignIdentity. Per Article VI:
 * - Identity-defining properties are NOT directly commandable.
 * - Amendments follow the protocol: declared → ratified → amended → ratified.
 * - This command initiates an amendment; a subsequent RatifyIdentity
 *   completes it.
 */
export interface AmendIdentity extends BaseCommand {
  readonly type: 'AmendIdentity';
  readonly changes: IdentityChange[];
}

export interface RatifyIdentity extends BaseCommand {
  readonly type: 'RatifyIdentity';
  readonly expectedVersion: IdentityVersion;
}

export interface IdentityChange {
  readonly field: string;
  readonly from: unknown;
  readonly to: unknown;
}

// ── Agent commands ─────────────────────────────────────────────────────

/**
 * Register an agent as a participant in the Family Registry.
 * Per Article VII, the registry has no rank field.
 * Per Article IX, agents speak as their registered identity, never as Lycon.
 */
export interface RegisterAgent extends BaseCommand {
  readonly type: 'RegisterAgent';
  readonly agentName: string;
  readonly domain: string; // the agent's authorized domain
}

export interface UnregisterAgent extends BaseCommand {
  readonly type: 'UnregisterAgent';
  readonly agentName: string;
}

/**
 * An agent-originated suggestion (e.g., "Agent X suggests navigating to...").
 * Per Article IX: the agent commands the Core like any peer client.
 * It never bypasses the Core.
 */
export interface AgentSuggestion extends BaseCommand {
  readonly type: 'AgentSuggestion';
  readonly agentName: string;
  readonly suggestedAction: Command; // the agent's suggested command
}

// ── Command union ───────────────────────────────────────────────────────

export type Command =
  | BootCore
  | ShutdownCore
  | SuspendCore
  | ResumeCore
  | CreateSession
  | DestroySession
  | FocusSession
  | CreateWindow
  | CloseWindow
  | FocusWindow
  | ResizeWindow
  | CreateTab
  | CloseTab
  | ActivateTab
  | Navigate
  | GoBack
  | GoForward
  | StopNavigation
  | Reload
  | OpenBoundary
  | CloseBoundary
  | AmendIdentity
  | RatifyIdentity
  | RegisterAgent
  | UnregisterAgent
  | AgentSuggestion;

// ── Command envelope ───────────────────────────────────────────────────

/**
 * A CommandEnvelope wraps a Command with metadata the Core needs for
 * processing: the causality counter and the originating surface.
 *
 * Per Article III, every Event traces back to a Command via commandId.
 * The envelope ensures the commandId is assigned at the boundary.
 */
export interface CommandEnvelope {
  readonly command: Command;
  readonly causality: number; // monotonic counter assigned at envelope time
  /** The surface that issued this command (e.g., UI, Agent, Cron). */
  readonly origin: string;
}
