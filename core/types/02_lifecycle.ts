/**
 * Gate 2 — Lifecycle State Machines
 *
 * Every Core object has a lifecycle. These state machines enforce the
 * constitutional principle that "no object may be in an invalid state."
 *
 * Per Article III (Command/Event Discipline) and Shield invariant S8
 * (State Machine Integrity), transitions that violate the state machine
 * produce a CommandRejected event, never a silent state corruption.
 *
 * Each machine is:
 *   - A type describing all valid states
 *   - A transition-validator function: (from, to) => boolean
 *   - A terminal-state check: (state) => boolean
 *
 * The validators are pure functions with zero side effects.
 */

import type { BrowserId, SessionId, TabId, NavigationId, IdentityVersion } from './00_ids';

// ── Browser lifecycle ───────────────────────────────────────────────────
// boot → running ⇄ suspending ↔ suspended ↔ resuming → running
// running → shutdown (terminal)

export type BrowserState =
  | 'boot'
  | 'running'
  | 'suspending'
  | 'suspended'
  | 'resuming'
  | 'shutdown';

export const BrowserTransitions: ReadonlyArray<readonly [BrowserState, BrowserState]> = [
  ['boot', 'running'],
  ['running', 'suspending'],
  ['suspending', 'suspended'],
  ['suspended', 'resuming'],
  ['resuming', 'running'],
  ['running', 'shutdown'],
] as const;

export function isValidBrowserTransition(from: BrowserState, to: BrowserState): boolean {
  return BrowserTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalBrowserState(state: BrowserState): boolean {
  return state === 'shutdown';
}

// ── Session lifecycle ───────────────────────────────────────────────────
// created → active ⇄ suspended → destroyed

export type SessionState = 'created' | 'active' | 'suspended' | 'destroyed';

export const SessionTransitions: ReadonlyArray<readonly [SessionState, SessionState]> = [
  ['created', 'active'],
  ['active', 'suspended'],
  ['suspended', 'active'],
  ['active', 'destroyed'],
  ['suspended', 'destroyed'],
] as const;

export function isValidSessionTransition(from: SessionState, to: SessionState): boolean {
  return SessionTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalSessionState(state: SessionState): boolean {
  return state === 'destroyed';
}

// ── Tab lifecycle ───────────────────────────────────────────────────────
// dormant → active ⇄ inactive → dormant → destroyed

export type TabState = 'dormant' | 'active' | 'inactive' | 'destroyed';

export const TabTransitions: ReadonlyArray<readonly [TabState, TabState]> = [
  ['dormant', 'active'],
  ['active', 'inactive'],
  ['inactive', 'active'],
  ['active', 'dormant'],
  ['inactive', 'dormant'],
  ['dormant', 'destroyed'],
  ['active', 'destroyed'],
  ['inactive', 'destroyed'],
] as const;

export function isValidTabTransition(from: TabState, to: TabState): boolean {
  return TabTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalTabState(state: TabState): boolean {
  return state === 'destroyed';
}

// ── Navigation lifecycle ────────────────────────────────────────────────
// requested → started → committed → loading → completed
//                                   ↓
//                              failed | cancelled (terminal)
//
// NO dangling navigation is legal: every navigation must reach a
// terminal state (completed, failed, or cancelled).

export type NavigationState =
  | 'requested'
  | 'started'
  | 'committed'
  | 'loading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const NavigationTransitions: ReadonlyArray<readonly [NavigationState, NavigationState]> = [
  ['requested', 'started'],
  ['started', 'committed'],
  ['committed', 'loading'],
  ['loading', 'completed'],
  ['started', 'failed'],
  ['committed', 'failed'],
  ['loading', 'failed'],
  ['requested', 'cancelled'],
  ['started', 'cancelled'],
  ['committed', 'cancelled'],
  ['loading', 'cancelled'],
] as const;

export function isValidNavigationTransition(
  from: NavigationState,
  to: NavigationState
): boolean {
  return NavigationTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalNavigationState(state: NavigationState): boolean {
  return state === 'completed' || state === 'failed' || state === 'cancelled';
}

/**
 * Per Article IV and Shield S1: a navigation must never be left in a
 * non-terminal state without a valid transition path. This checks that
 * a navigation in a non-terminal state can still reach a terminal state.
 */
export function navigationCanComplete(state: NavigationState): boolean {
  if (isTerminalNavigationState(state)) return true;
  // From any non-terminal state, check if there's at least one path to a terminal state
  const queue: NavigationState[] = [state];
  const visited = new Set<NavigationState>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (isTerminalNavigationState(current)) return true;
    const nextStates = NavigationTransitions
      .filter(([f]) => f === current)
      .map(([, t]) => t);
    queue.push(...nextStates);
  }
  return false;
}

// ── Threshold (exposure / boundary) lifecycle ──────────────────────────
// sealed → opening → open → closing → sealed
// NO transition skips a state.

export type ThresholdState = 'sealed' | 'opening' | 'open' | 'closing';

export const ThresholdTransitions: ReadonlyArray<readonly [ThresholdState, ThresholdState]> = [
  ['sealed', 'opening'],
  ['opening', 'open'],
  ['open', 'closing'],
  ['closing', 'sealed'],
] as const;

export function isValidThresholdTransition(
  from: ThresholdState,
  to: ThresholdState
): boolean {
  return ThresholdTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalThresholdState(state: ThresholdState): boolean {
  return state === 'sealed';
}

// ── Identity lifecycle ──────────────────────────────────────────────────
// declared → ratified → amended → ratified
// Identity has NO silent path (Article VI, Paragraph 4).

export type IdentityState = 'declared' | 'ratified' | 'amended';

export const IdentityTransitions: ReadonlyArray<readonly [IdentityState, IdentityState]> = [
  ['declared', 'ratified'],
  ['ratified', 'amended'],
  ['amended', 'ratified'],
] as const;

export function isValidIdentityTransition(
  from: IdentityState,
  to: IdentityState
): boolean {
  return IdentityTransitions.some(([f, t]) => f === from && t === to);
}

export function isTerminalIdentityState(_state: IdentityState): boolean {
  // Identity does not have a terminal state — it cycles through declared/ratified
  return false;
}

// ── State machine registry ──────────────────────────────────────────────
// A single lookup that maps state-machine names to their validators.
// Used by the Core's command handlers to validate transitions uniformly.

export interface StateMachineDef<S extends string> {
  readonly name: string;
  readonly transitions: ReadonlyArray<readonly [S, S]>;
  readonly isValidTransition: (from: S, to: S) => boolean;
  readonly isTerminal: (state: S) => boolean;
}

export const BrowserStateMachine: StateMachineDef<BrowserState> = {
  name: 'Browser',
  transitions: BrowserTransitions,
  isValidTransition: isValidBrowserTransition,
  isTerminal: isTerminalBrowserState,
};

export const SessionStateMachine: StateMachineDef<SessionState> = {
  name: 'Session',
  transitions: SessionTransitions,
  isValidTransition: isValidSessionTransition,
  isTerminal: isTerminalSessionState,
};

export const TabStateMachine: StateMachineDef<TabState> = {
  name: 'Tab',
  transitions: TabTransitions,
  isValidTransition: isValidTabTransition,
  isTerminal: isTerminalTabState,
};

export const NavigationStateMachine: StateMachineDef<NavigationState> = {
  name: 'Navigation',
  transitions: NavigationTransitions,
  isValidTransition: isValidNavigationTransition,
  isTerminal: isTerminalNavigationState,
};

export const ThresholdStateMachine: StateMachineDef<ThresholdState> = {
  name: 'Threshold',
  transitions: ThresholdTransitions,
  isValidTransition: isValidThresholdTransition,
  isTerminal: isTerminalThresholdState,
};

export const IdentityStateMachine: StateMachineDef<IdentityState> = {
  name: 'Identity',
  transitions: IdentityTransitions,
  isValidTransition: isValidIdentityTransition,
  isTerminal: isTerminalIdentityState,
};
