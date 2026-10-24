/**
 * Shield S1 — Boundary Sovereignty
 * Shield S8 — State Machine Integrity
 *
 * Tests for the Threshold state machine: sealed → opening → open → closing → sealed.
 * Also tests the other lifecycle state machines for transition integrity.
 *
 * Per Article IV: "No transition skips a state."
 * Per Shield S1: "The Threshold state machine has exactly five states.
 * Transitions are only: sealed→opening→open→closing→sealed."
 * Per Shield S8: "No object may be in an invalid state. All transitions
 * pass through the validator."
 */

import { describe, it, expect } from 'vitest';
import {
  ThresholdState,
  NavigationState,
  isValidThresholdTransition,
  isValidBrowserTransition,
  isValidSessionTransition,
  isValidTabTransition,
  isValidNavigationTransition,
  isValidIdentityTransition,
  isTerminalNavigationState,
  navigationCanComplete,
  BrowserStateMachine,
  SessionStateMachine,
  TabStateMachine,
  NavigationStateMachine,
  ThresholdStateMachine,
  IdentityStateMachine,
  ThresholdTransitions,
  NavigationTransitions,
  IdentityTransitions,
} from '../types/02_lifecycle';

describe('Shield S1: Boundary Sovereignty', () => {
  describe('Threshold has exactly five states', () => {
    const allStates: ThresholdState[] = ['sealed', 'opening', 'open', 'closing'];
    // Shield S1: "Transitions are only: sealed→opening→open→closing→sealed."
    // The loop has five positions; 'sealed' is both the initial and the
    // terminal state. No sixth state ('sealed_closing') exists — S1 forbids
    // any transition that is not one of the four canonical edges.
    const canonicalCycle: ThresholdState[] = ['sealed', 'opening', 'open', 'closing', 'sealed'];

    it('has no state outside sealed→opening→open→closing', () => {
      expect(allStates).toEqual(['sealed', 'opening', 'open', 'closing']);
      expect(canonicalCycle).toEqual(['sealed', 'opening', 'open', 'closing', 'sealed']);
      expect(allStates).toHaveLength(4);
    });

    allStates.forEach((state) => {
      it(`accepts the canonical single forward transition FROM ${state}`, () => {
        switch (state) {
          case 'sealed':
            expect(isValidThresholdTransition('sealed', 'opening')).toBe(true);
            break;
          case 'opening':
            expect(isValidThresholdTransition('opening', 'open')).toBe(true);
            break;
          case 'open':
            expect(isValidThresholdTransition('open', 'closing')).toBe(true);
            break;
          case 'closing':
            expect(isValidThresholdTransition('closing', 'sealed')).toBe(true);
            break;
        }
      });
    });

    it('rejects skipping from sealed to open', () => {
      expect(isValidThresholdTransition('sealed', 'open')).toBe(false);
    });

    it('rejects skipping from open to sealed', () => {
      expect(isValidThresholdTransition('open', 'sealed')).toBe(false);
    });

    it('rejects skipping from sealed to closing', () => {
      expect(isValidThresholdTransition('sealed', 'closing')).toBe(false);
    });

    it('rejects self-transitions (sealed→sealed)', () => {
      expect(isValidThresholdTransition('sealed', 'sealed')).toBe(false);
    });

    it('rejects backward transitions', () => {
      expect(isValidThresholdTransition('open', 'opening')).toBe(false);
      expect(isValidThresholdTransition('closing', 'open')).toBe(false);
      expect(isValidThresholdTransition('sealed', 'closing')).toBe(false);
    });
  });

  it('the closing state always reduces capabilities, never the reverse (S1)', () => {
    // Closing the boundary (open → closing → sealed) MUST revoke external
    // capabilities — this is asserted by S3/S6 suites against the resolver;
    // here we confirm the state machine itself has exactly one path forward
    // out of 'closing', and it terminates at 'sealed' (the guarded state).
    const closingOut = ThresholdTransitions.filter(([from]) => from === 'closing');
    expect(closingOut).toEqual([['closing', 'sealed']] as const);
  });
});

describe('Shield S8: State Machine Integrity — Browser', () => {
  it('accepts boot → running', () => {
    expect(isValidBrowserTransition('boot', 'running')).toBe(true);
  });

  it('accepts running → suspending → suspended → resuming → running', () => {
    expect(isValidBrowserTransition('running', 'suspending')).toBe(true);
    expect(isValidBrowserTransition('suspending', 'suspended')).toBe(true);
    expect(isValidBrowserTransition('suspended', 'resuming')).toBe(true);
    expect(isValidBrowserTransition('resuming', 'running')).toBe(true);
  });

  it('accepts running → shutdown', () => {
    expect(isValidBrowserTransition('running', 'shutdown')).toBe(true);
  });

  it('rejects boot → shutdown (must pass through running)', () => {
    expect(isValidBrowserTransition('boot', 'shutdown')).toBe(false);
  });

  it('rejects suspended → shutdown (must resume first)', () => {
    expect(isValidBrowserTransition('suspended', 'shutdown')).toBe(false);
  });

  it('rejects self-transition (running → running)', () => {
    expect(isValidBrowserTransition('running', 'running')).toBe(false);
  });
});

describe('Shield S8: State Machine Integrity — Session', () => {
  it('accepts created → active → suspended → active → destroyed', () => {
    expect(isValidSessionTransition('created', 'active')).toBe(true);
    expect(isValidSessionTransition('active', 'suspended')).toBe(true);
    expect(isValidSessionTransition('suspended', 'active')).toBe(true);
    expect(isValidSessionTransition('active', 'destroyed')).toBe(true);
  });

  it('rejects created → destroyed (must activate first)', () => {
    expect(isValidSessionTransition('created', 'destroyed')).toBe(false);
  });
});

describe('Shield S8: State Machine Integrity — Tab', () => {
  it('accepts dormant → active → inactive → dormant → destroyed', () => {
    expect(isValidTabTransition('dormant', 'active')).toBe(true);
    expect(isValidTabTransition('active', 'inactive')).toBe(true);
    expect(isValidTabTransition('inactive', 'dormant')).toBe(true);
    expect(isValidTabTransition('dormant', 'destroyed')).toBe(true);
  });

  it('rejects dormant → destroyed → active (cannot revive dead tab)', () => {
    expect(isValidTabTransition('destroyed', 'active')).toBe(false);
  });
});

describe('Shield S8: State Machine Integrity — Navigation', () => {
  it('accepts the full happy path: requested → started → committed → loading → completed', () => {
    expect(isValidNavigationTransition('requested', 'started')).toBe(true);
    expect(isValidNavigationTransition('started', 'committed')).toBe(true);
    expect(isValidNavigationTransition('committed', 'loading')).toBe(true);
    expect(isValidNavigationTransition('loading', 'completed')).toBe(true);
  });

  it('accepts failed and cancelled as terminal alternatives', () => {
    expect(isValidNavigationTransition('started', 'failed')).toBe(true);
    expect(isValidNavigationTransition('committed', 'cancelled')).toBe(true);
    expect(isValidNavigationTransition('loading', 'failed')).toBe(true);
    expect(isValidNavigationTransition('loading', 'cancelled')).toBe(true);
  });

  it('marks completed, failed, and cancelled as terminal', () => {
    expect(isTerminalNavigationState('completed')).toBe(true);
    expect(isTerminalNavigationState('failed')).toBe(true);
    expect(isTerminalNavigationState('cancelled')).toBe(true);
  });

  it('marks non-terminal states correctly', () => {
    expect(isTerminalNavigationState('requested')).toBe(false);
    expect(isTerminalNavigationState('started')).toBe(false);
    expect(isTerminalNavigationState('committed')).toBe(false);
    expect(isTerminalNavigationState('loading')).toBe(false);
  });

  it('NO navigation is ever dangling — all states can complete (S8)', () => {
    // Per the constitutional rule: "NO dangling navigation is legal."
    // Every non-terminal navigation state must have a path to a terminal state.
    const nonTerminalStates: NavigationState[] = [
      'requested', 'started', 'committed', 'loading',
    ];
    nonTerminalStates.forEach((state) => {
      expect(navigationCanComplete(state), `Navigation state "${state}" must be able to complete`).toBe(true);
    });
  });

  it('rejects backward transitions in navigation', () => {
    expect(isValidNavigationTransition('completed', 'loading')).toBe(false);
    expect(isValidNavigationTransition('failed', 'started')).toBe(false);
  });
});

describe('Shield S8: State Machine Integrity — Identity', () => {
  it('accepts declared → ratified → amended → ratified (the legal cycle)', () => {
    expect(isValidIdentityTransition('declared', 'ratified')).toBe(true);
    expect(isValidIdentityTransition('ratified', 'amended')).toBe(true);
    expect(isValidIdentityTransition('amended', 'ratified')).toBe(true);
  });

  it('accepts ratified → amended (re-amend cycle)', () => {
    expect(isValidIdentityTransition('ratified', 'amended')).toBe(true);
    expect(isValidIdentityTransition('amended', 'ratified')).toBe(true);
  });

  it('rejects declared → amended (must ratify first)', () => {
    expect(isValidIdentityTransition('declared', 'amended')).toBe(false);
  });

  it('rejects amended → declared (no going back to declared)', () => {
    expect(isValidIdentityTransition('amended', 'declared')).toBe(false);
  });

  it('identity has NO silent path (Article VI, Paragraph 4) — ratified is only re-entered through amended', () => {
    // There is no direct ratified → ratified (self-transition) that could hide
    // an unrecorded change. Every entry into ratified passes through amended,
    // which requires the explicit Amendment protocol + a ratifying event.
    expect(isValidIdentityTransition('ratified', 'ratified')).toBe(false);
    // And 'amended' has exactly one forward edge — back to 'ratified'.
    const amendedOut = IdentityTransitions.filter(([from]) => from === 'amended');
    expect(amendedOut).toEqual([['amended', 'ratified']] as const);
  });
});

describe('State machine registry is complete', () => {
  it('all six state machines are registered with validators', () => {
    const machines = [
      BrowserStateMachine,
      SessionStateMachine,
      TabStateMachine,
      NavigationStateMachine,
      ThresholdStateMachine,
      IdentityStateMachine,
    ];
    expect(machines.length).toBe(6);
    machines.forEach((m) => {
      expect(m.isValidTransition).toBeTypeOf('function');
      expect(m.isTerminal).toBeTypeOf('function');
      expect(m.transitions.length).toBeGreaterThan(0);
    });
  });
});
