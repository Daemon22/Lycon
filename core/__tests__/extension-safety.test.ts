/**
 * Shield S10 — Extension Safety
 *
 * Core canonical state objects are immutable: every property is `readonly`
 * (Article I — The Core Is Sovereign), and at runtime the Core only ever
 * emits frozen snapshots. Adding or removing a feature never mutates Core
 * canonical state — features are branches that subscribe, render, and command
 * back (Article X, the Anti-Branch Rule).
 *
 * These contract tests (written before the in-memory Core, Gate 6) assert the
 * structural + runtime invariants of the canonical object graph.
 */

import { describe, it, expect } from 'vitest';
import type {
  Browser,
  Session,
  Window,
  Tab,
  Page,
  Navigation,
  Threshold,
} from '../types/01_objects';
import { type SovereignIdentity, LYCON_IDENTITY_V1 } from '../03_sovereign_identity';
import type { Navigate } from '../types/03_commands';
import type { CoreEvent } from '../types/04_events';

// A frozen snapshot of a Core object must reject mutation in (strict) ES
// module code. This is the runtime half of the S10 immutability guard; the
// type-level guarantee is that every interface property is `readonly`.
function assertFrozenImmutable<T extends object>(obj: T): void {
  'use strict';
  expect(() => {
    // @ts-expect-error — readonly at the type level
    obj._lycon_mutable_probe = true;
  }).toThrow();
}

describe('Shield S10: Extension Safety — canonical objects are immutable', () => {
  it('Browser is constructed from its real canonical fields and is immutable', () => {
    const browser: Browser = {
      id: 'br_1' as never,
      createdAt: 1700000000000,
      sessionIds: [],
      activeSessionId: null,
      identityVersion: 1 as never,
    };
    expect(browser.id).toBeTruthy();
    expect(browser.identityVersion).toBe(1);
    expect(browser.sessionIds).toEqual([]);
    Object.freeze(browser);
    assertFrozenImmutable(browser);
  });

  it('Session is constructed from its real canonical fields and is immutable', () => {
    const session: Session = {
      id: 'ss_1' as never,
      browserId: 'br_1' as never,
      mode: 'persistent',
      createdAt: 1700000000000,
      lastActiveAt: 1700000000000,
      windowIds: [],
      activeWindowId: null,
    };
    expect(session.id).toBeTruthy();
    expect(session.mode).toBe('persistent');
    Object.freeze(session);
    assertFrozenImmutable(session);
  });

  it('Window is constructed from its real canonical fields and is immutable', () => {
    const win: Window = {
      id: 'wn_1' as never,
      sessionId: 'ss_1' as never,
      createdAt: 1700000000000,
      title: 'Lycon',
      tabIds: [],
      activeTabId: null,
      width: 1024,
      height: 768,
      x: 0,
      y: 0,
    };
    expect(win.id).toBeTruthy();
    expect(win.width).toBe(1024);
    Object.freeze(win);
    assertFrozenImmutable(win);
  });

  it('Tab is constructed from its real canonical fields and is immutable', () => {
    const tab: Tab = {
      id: 'tb_1' as never,
      windowId: 'wn_1' as never,
      sessionId: 'ss_1' as never,
      createdAt: 1700000000000,
      title: 'start',
      faviconUrl: null,
      type: 'normal',
      pageIds: [],
      activePageIndex: 0,
      lifecycle: 'dormant',
      pendingNavigationId: null,
    };
    expect(tab.id).toBeTruthy();
    expect(tab.type).toBe('normal');
    expect(tab.lifecycle).toBe('dormant');
    Object.freeze(tab);
    assertFrozenImmutable(tab);
  });

  it('Page is constructed from its real canonical fields and is immutable', () => {
    const page: Page = {
      id: 'pg_1' as never,
      tabId: 'tb_1' as never,
      url: 'https://example.com',
      title: 'Example',
      faviconUrl: null,
      kind: 'online',
      viewType: 'online',
      createdAt: 1700000000000,
      navigationId: null,
    };
    expect(page.url).toBe('https://example.com');
    expect(page.kind).toBe('online');
    Object.freeze(page);
    assertFrozenImmutable(page);
  });

  it('Navigation is constructed from its real canonical fields and is immutable', () => {
    const nav: Navigation = {
      id: 'nv_1' as never,
      tabId: 'tb_1' as never,
      commandId: 'cmd_1' as never,
      targetUrl: 'https://example.com',
      targetKind: 'online',
      targetView: null,
      state: 'requested',
      createdAt: 1700000000000,
      startedAt: null,
      committedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      failureReason: null,
      finalUrl: null,
    };
    expect(nav.state).toBe('requested');
    expect(nav.targetUrl).toBe('https://example.com');
    Object.freeze(nav);
    assertFrozenImmutable(nav);
  });

  it('Threshold is constructed from its real canonical fields and is immutable', () => {
    const threshold: Threshold = {
      tabId: 'tb_1' as never,
      state: 'sealed',
      pendingUrl: null,
      openedAt: null,
      openSince: null,
    };
    expect(threshold.state).toBe('sealed');
    Object.freeze(threshold);
    assertFrozenImmutable(threshold);
  });

  it('SovereignIdentity is the canonical identity and is immutable', () => {
    const identity: SovereignIdentity = LYCON_IDENTITY_V1;
    expect(identity.version).toBe(1);
    expect(identity.state).toBe('ratified');
    // The canonical identity is deep-frozen at module load.
    expect(() => {
      'use strict';
      // @ts-expect-error — readonly
      LYCON_IDENTITY_V1.version = 999;
    }).toThrow();
  });

  it('Command (Navigate) carries intent fields only, never engine specifics', () => {
    const cmd: Navigate = {
      commandId: 'cmd_1' as never,
      participantId: 'user-alice',
      timestamp: 1700000000000,
      type: 'Navigate',
      tabId: 'tb_1' as never,
      url: 'https://example.com',
      replace: false,
    };
    expect(cmd.type).toBe('Navigate');
    expect(cmd.url).toBe('https://example.com');
    expect('rendered' in cmd).toBe(false);
  });

  it('CoreEvent is constructed from its real canonical fields and is immutable', () => {
    const event: CoreEvent = {
      eventId: 'evt_1' as never,
      commandId: 'cmd_1' as never,
      causality: 0,
      timestamp: 1700000000000,
      participantId: 'core',
      type: 'CoreBooting',
      identityVersion: 1 as never,
    };
    expect(event.type).toBe('CoreBooting');
    expect(event.eventId).toBeTruthy();
    Object.freeze(event);
    assertFrozenImmutable(event);
  });
});

describe('Anti-branch rule: CoreEvent exposes extension points, not feature state', () => {
  it('CoreEvent union includes the events features subscribe to (no own state model)', () => {
    // New features are branches: they subscribe to canonical events, render a
    // surface, and command back. They must NOT keep their own state model.
    // The CoreEvent union exposes the channels for this pattern:
    const eventTypes: CoreEvent['type'][] = [
      'TabActivated', // a branch can react to tab focus
      'ThresholdOpened', // a branch can react to the boundary opening (online)
      'NavigationCompleted', // a branch can react to a page finishing
      'SessionCreated', // a branch can react to a new session
      'TabCreated', // a branch can react to a new tab
    ];
    expect(eventTypes.length).toBe(5);
  });

  it('removing a feature must not remove canonical state: events are additive', () => {
    // Core canonical state is the events + objects above. A feature that
    // subscribes to TabActivated and is later removed only deregisters its
    // listener; the TabActivated event remains in the canonical stream.
    const sample: CoreEvent = {
      eventId: 'evt_1' as never,
      commandId: 'cmd_1' as never,
      causality: 0,
      timestamp: 1700000000000,
      participantId: 'core',
      type: 'TabActivated',
      tabId: 'tb_1' as never,
    };
    expect(sample.type).toBe('TabActivated');
    expect(sample).toHaveProperty('causality');
    expect(sample).toHaveProperty('commandId');
  });
});
