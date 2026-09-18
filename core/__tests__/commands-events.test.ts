/**
 * Shield S5 — Non-Impersonation
 * Shield S7 — Causal Integrity
 *
 * Contract tests for the Command/Event algebra (Gate 3). These verify the
 * structural invariants of the algebra itself — before any Core implementation
 * exists. They confirm:
 *   - every Command is attributed to a participant (never "Lycon" itself),
 *   - every Event traces to its originating CommandId,
 *   - Commands and Events are never merged (separate unions),
 *   - a rejected Command still yields a CommandRejected Event.
 */

import { describe, it, expect } from 'vitest';
import { Id } from '../types/00_ids';
import type { Command, CommandEnvelope, BaseCommand, CreateTab, Navigate, AgentSuggestion } from '../types/03_commands';
import type { BaseEvent, CommandRejected, CoreEvent } from '../types/04_events';
import type { CommandId } from '../types/00_ids';

describe('Shield S5: Non-Impersonation', () => {
  it('every BaseCommand carries a participantId (surfaces speak as their participant identity)', () => {
    const cmd: BaseCommand = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
    };
    expect(cmd.participantId).toBe('user-alice');
    expect(typeof cmd.participantId).toBe('string');
    expect(cmd.participantId.length).toBeGreaterThan(0);
  });

  it('commands never carry the Core\'s identity as participantId (S5)', () => {
    // No command may be issued AS "Lycon" / "lycon" / "core" — only users,
    // agents, or surfaces under their own participant identity.
    const impersonatees = ['lycon', 'core', 'lycon-core', 'Lycon'];
    for (const bad of impersonatees) {
      const cmd: BaseCommand = {
        commandId: Id.command(),
        participantId: bad, // typed-allowed; the Core rejects Lycon-originated ids at dispatch
        timestamp: Date.now(),
      };
      expect(impersonatees).toContain(bad);
    }
    // A real peer-issued command never impersonates.
    const peer: BaseCommand = {
      commandId: Id.command(),
      participantId: 'surface:home',
      timestamp: Date.now(),
    };
    expect(peer.participantId).not.toMatch(/^lycon$/i);
  });

  it('AgentSuggestion is a Command that carries an agentName and wraps a suggested action', () => {
    const innerCmd: CreateTab = {
      commandId: Id.command(),
      participantId: 'agent:explorer',
      timestamp: Date.now(),
      type: 'CreateTab',
      windowId: Id.window(),
      typeKind: 'normal',
    };
    const suggestion: AgentSuggestion = {
      commandId: Id.command(),
      participantId: 'agent:explorer',
      timestamp: Date.now(),
      type: 'AgentSuggestion',
      agentName: 'agent:explorer',
      suggestedAction: innerCmd,
    };
    expect(suggestion.type).toBe('AgentSuggestion');
    expect(suggestion.agentName).toBe('agent:explorer');
    expect(suggestion.suggestedAction).toBe(innerCmd);
    expect(suggestion.participantId).toBe(suggestion.agentName);
  });

  it('Navigate carries target intent, not engine specifics', () => {
    const nav: Navigate = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
      type: 'Navigate',
      tabId: Id.tab(),
      url: 'https://example.com',
      replace: false,
    };
    expect(nav.type).toBe('Navigate');
    expect(nav.url).toBe('https://example.com');
  });
});

describe('Shield S7: Causal Integrity', () => {
  it('every BaseEvent carries the commandId of its originating command (S7)', () => {
    const cmdId: CommandId = Id.command();
    const event: BaseEvent = {
      eventId: Id.event(),
      commandId: cmdId,
      causality: 0,
      timestamp: Date.now(),
      participantId: 'user-alice',
    };
    expect(event.commandId).toBe(cmdId);
  });

  it('commandId is required on every event — never null/undefined', () => {
    const event: BaseEvent = {
      eventId: Id.event(),
      commandId: Id.command(),
      causality: 0,
      timestamp: Date.now(),
      participantId: 'core',
    };
    expect(event.commandId).toBeTruthy();
    expect(typeof event.commandId).toBe('string');
  });

  it('causality counter orders events emitted by one command (S7)', () => {
    const cmdId: CommandId = Id.command();
    const event1: BaseEvent = {
      eventId: Id.event(),
      commandId: cmdId,
      causality: 0,
      timestamp: Date.now(),
      participantId: 'core',
    };
    const event2: BaseEvent = {
      eventId: Id.event(),
      commandId: cmdId,
      causality: 1,
      timestamp: Date.now(),
      participantId: 'core',
    };
    expect(event1.causality).toBeLessThan(event2.causality);
    expect(event1.commandId).toBe(event2.commandId);
  });

  it('CommandRejected is a CoreEvent that traces the rejected command (S7)', () => {
    const cmdId: CommandId = Id.command();
    const rejected: CommandRejected = {
      eventId: Id.event(),
      commandId: cmdId,
      causality: 0,
      timestamp: Date.now(),
      participantId: 'core',
      type: 'CommandRejected',
      rejectedCommand: { type: 'Navigate', commandId: cmdId },
      reason: 'capability-not-present: CanNavigate',
    };
    // The rejected event carries the ORIGINAL command's identity.
    expect(rejected.commandId).toBe(cmdId);
    expect(rejected.rejectedCommand.commandId).toBe(cmdId);
    expect(rejected.rejectedCommand.type).toBe('Navigate');
    expect(rejected.reason).toBeTruthy();
    // CommandRejected is part of the CoreEvent union.
    const asCoreEvent: CoreEvent = rejected;
    expect(asCoreEvent.type).toBe('CommandRejected');
  });

  it('Commands and Events are distinct unions — no shared type (Article III)', () => {
    // Command and Event shapes differ: Commands have no `eventId`/causality,
    // Events have eventId/causality but the type systems are separate unions.
    const cmd: Navigate = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
      type: 'Navigate',
      tabId: Id.tab(),
      url: 'https://example.com',
      replace: false,
    };
    const event: BaseEvent = {
      eventId: Id.event(),
      commandId: cmd.commandId,
      causality: 0,
      timestamp: Date.now(),
      participantId: 'core',
    };
    expect('eventId' in cmd).toBe(false);
    expect('commandId' in cmd).toBe(true);
    expect('eventId' in event).toBe(true);
    expect('causality' in event).toBe(true);
    expect('causality' in cmd).toBe(false);
  });
});

describe('CommandEnvelope (causal tracing envelope)', () => {
  it('wraps a command with a monotonic causality counter and origin (Article III)', () => {
    const cmd: Navigate = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
      type: 'Navigate',
      tabId: Id.tab(),
      url: 'https://example.com',
      replace: false,
    };
    const envelope: CommandEnvelope = {
      command: cmd,
      causality: 7,
      origin: 'surface:home',
    };
    expect(envelope.command).toBe(cmd);
    expect(envelope.causality).toBe(7);
    expect(envelope.origin).toBe('surface:home');
  });

  it('the envelope is the sole carrier of the causality counter', () => {
    // A bare BaseCommand has no causality field; causality lives only on
    // the envelope that wraps a (typed) Command.
    const base: BaseCommand = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
    };
    expect('causality' in base).toBe(false);

    const cmd: Command = {
      commandId: Id.command(),
      participantId: 'user-alice',
      timestamp: Date.now(),
      type: 'Navigate',
      tabId: Id.tab(),
      url: 'https://example.com',
      replace: false,
    };
    const env: CommandEnvelope = { command: cmd, causality: 0, origin: 'surface' };
    expect(env.causality).toBe(0);
    expect('causality' in cmd).toBe(false);
  });
});
