/**
 * Gate 7 — Full Lifecycle Integration (Core → Adapter → FakeEngine → Adapter → Core)
 *
 * EXIT CRITERION: the full lifecycle suite must be green against the fake engine:
 *   boot → identity restoration → session → window → tab → navigate → load →
 *   back → forward → close → suspend → restore-after-suspend.
 *
 * These tests drive the in-memory LyconCore with a deliberately boring
 * FakeEngineAdapter and verify the complete command/event loop:
 *
 *   Command → Core (validate/policy) → EngineAdapter → FakeEngine (signals) →
 *   EngineAdapter → Core (translation) → CoreEvents
 *
 * Guards in play:
 *   S2  — the Core only touches the engine through the adapter (a recording
 *         proxy asserts every engine interaction went through adapter methods).
 *   S4  — identity is restored and verified before any session exists.
 *   S5  — non-impersonation: the Core rejects Lycon-originated participants.
 *   S7  — every dispatched command leaves a causally-traceable event trail.
 *   S8  — objects only transition along legal state-machine edges; no dangling
 *         navigation is ever left in a non-terminal state.
 *   S9  — domain checks gate agents before any cross-domain action.
 *   S11 — the engine context never receives the identity record.
 */

import { describe, it, expect } from 'vitest';
import { LyconCore } from '../LyconCore';
import { FakeEngineAdapter } from '../FakeEngineAdapter';
import { Id } from '../types/00_ids';
import type { SessionId, WindowId, TabId } from '../types/00_ids';
import type {
  Command,
  CreateSession,
  CreateWindow,
  CreateTab,
  ActivateTab,
  Navigate,
  OpenBoundary,
  CloseBoundary,
  RegisterAgent,
  GoBack,
  GoForward,
  CloseTab,
  SuspendCore,
  ResumeCore,
} from '../types/03_commands';
import type { CoreEvent } from '../types/04_events';
import { PRIVATE_SESSION_FORBIDDEN_CAPABILITIES } from '../types/05_policy';
import { LYCON_IDENTITY_V1, verifyIdentity } from '../03_sovereign_identity';
import type { SovereignIdentity } from '../03_sovereign_identity';

const PARTICIPANT = 'surface:test';

function cmd<T extends Command>(
  partial: Omit<T, 'commandId' | 'participantId' | 'timestamp'>
): T {
  return {
    ...partial,
    commandId: Id.command(),
    participantId: PARTICIPANT,
    timestamp: Date.now(),
  } as T;
}

/** Wrap an adapter in a recording proxy so tests can assert S2 (adapter-only). */
function recording(
  engine: FakeEngineAdapter,
  log: Array<{ method: string; args: unknown[] }>
): FakeEngineAdapter {
  return new Proxy(engine, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          log.push({ method: String(prop), args });
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as unknown as FakeEngineAdapter;
}

interface Harness {
  core: LyconCore;
  calls: Array<{ method: string; args: unknown[] }>;
  sessionId: SessionId;
  windowId: WindowId;
  tabId: TabId;
}

/** Fixture: boot → identity → session → window → tab. Engine attached only on activate. */
async function bootWithTab(opts?: { identity?: SovereignIdentity }): Promise<Harness> {
  const engine = new FakeEngineAdapter();
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const core = new LyconCore(recording(engine, calls), opts?.identity ?? LYCON_IDENTITY_V1);
  const boot = await core.boot();
  expect(boot.ok).toBe(true);

  const sess = await core.dispatch(
    cmd<CreateSession>({ type: 'CreateSession', mode: 'persistent' })
  );
  expect(sess.some((e) => e.type === 'SessionCreated')).toBe(true);
  const sessionId = sess.find((e) => e.type === 'SessionCreated')!.sessionId;

  const win = await core.dispatch(
    cmd<CreateWindow>({ type: 'CreateWindow', sessionId, width: 1280, height: 800 })
  );
  expect(win.some((e) => e.type === 'WindowCreated')).toBe(true);
  const windowId = win.find((e) => e.type === 'WindowCreated')!.windowId;

  const tab = await core.dispatch(
    cmd<CreateTab>({ type: 'CreateTab', windowId, typeKind: 'normal' })
  );
  expect(tab.some((e) => e.type === 'TabCreated')).toBe(true);
  const tabId = tab.find((e) => e.type === 'TabCreated')!.tabId;

  return { core, calls, sessionId, windowId, tabId };
}

describe('Gate 7: Full lifecycle against the fake engine', () => {
  it('boot restores + verifies identity BEFORE any session (S4)', async () => {
    const engine = new FakeEngineAdapter();
    const core = new LyconCore(engine, LYCON_IDENTITY_V1);
    const result = await core.boot();

    expect(result.ok).toBe(true);
    expect(core.getIdentityRestored()).toBe(true);
    expect(core.getIdentity()).not.toBeNull();
    expect(verifyIdentity(core.getIdentity()!).ok).toBe(true);
    expect(core.getSessions()).toEqual([]);
    expect(core.getBrowserState()).toBe('running');

    const types = core.getEventTypes();
    expect(types.indexOf('IdentityDeclared')).toBeLessThan(types.indexOf('IdentityRatified'));
    expect(types.indexOf('IdentityRatified')).toBeLessThan(types.indexOf('CoreBooting'));
    expect(types.indexOf('CoreBooting')).toBeLessThan(types.indexOf('CoreReady'));

    // The engine adapter is resolved but nothing is attached at boot (lazy attach).
    expect(core.getTabs()).toEqual([]);
  });

  it('refuses to boot into a running state without a VERIFIED identity (S4)', async () => {
    const unverified: SovereignIdentity = { ...LYCON_IDENTITY_V1, state: 'declared' };
    const core = new LyconCore(new FakeEngineAdapter(), unverified);
    const result = await core.boot();

    expect(result.ok).toBe(false);
    expect(core.getBrowserState()).toBe('boot');
    expect(core.getSessions()).toEqual([]);
    expect(core.getIdentityRestored()).toBe(true); // restored, then verification failed
  });

  it('runs the lifecycle: tab → navigate → load → back → forward → close (S8, S2)', async () => {
    const { core, calls, tabId } = await bootWithTab();

    (console.log as (m: string, ...a: unknown[]) => void)(
      'TRACE after createTab:',
      'pages', core.getTab(tabId)!.pageIds.length,
      'index', core.getTab(tabId)!.activePageIndex
    );

    // Activate → lazy engine attach through the adapter (Article II §4).
    const activated = await core.dispatch(
      cmd<ActivateTab>({ type: 'ActivateTab', tabId })
    );
    expect(activated.some((e) => e.type === 'TabActivated')).toBe(true);
    expect(calls.some((c) => c.method === 'attach')).toBe(true);
    (console.log as (m: string, ...a: unknown[]) => void)(
      'TRACE after activate:',
      'pages', core.getTab(tabId)!.pageIds.length,
      'index', core.getTab(tabId)!.activePageIndex
    );

    // Open boundary (deliberate handoff), then navigate twice through the adapter.
    const opened = await core.dispatch(
      cmd<OpenBoundary>({ type: 'OpenBoundary', tabId, url: 'https://a.example' })
    );
    expect(opened.some((e) => e.type === 'ThresholdOpened')).toBe(true);

    const navA = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://a.example' })
    );
    const navATypes = navA.map((e) => e.type);
    expect(navATypes).toContain('NavigationRequested');
    expect(navATypes).toContain('NavigationStarted');
    expect(navATypes).toContain('NavigationCommitted');
    expect(navATypes).toContain('NavigationLoading');
    expect(navATypes).toContain('NavigationCompleted');
    expect(calls.some((c) => c.method === 'navigate')).toBe(true);

    const navB = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://b.example' })
    );
    expect(navB.some((e) => e.type === 'NavigationCompleted')).toBe(true);

    const tabAfterAB = core.getTab(tabId)!;
    (console.log as (m: string, ...a: unknown[]) => void)(
      'TRACE after two navs:',
      'pages', tabAfterAB.pageIds.length,
      'index', tabAfterAB.activePageIndex
    );

    // Back — the Core drives the engine's goBack; the fake engine emits signals
    // that travel back through the adapter and are translated to CoreEvents.
    const back = await core.dispatch(cmd<GoBack>({ type: 'GoBack', tabId }));
    expect(back.some((e) => e.type === 'NavigationCompleted')).toBe(true);
    expect(calls.some((c) => c.method === 'goBack')).toBe(true);
    expect(core.getTab(tabId)!.activePageIndex).toBe(0);

    // Forward.
    const forward = await core.dispatch(cmd<GoForward>({ type: 'GoForward', tabId }));
    expect(forward.some((e) => e.type === 'NavigationCompleted')).toBe(true);
    expect(calls.some((c) => c.method === 'goForward')).toBe(true);
    expect(core.getTab(tabId)!.activePageIndex).toBe(1);

    // No dangling navigation remains (S8).
    const navigations = core.getStateSnapshot().navigations;
    for (const nav of navigations) {
      if (nav.tabId === tabId) {
        expect(['completed', 'failed', 'cancelled']).toContain(nav.state);
      }
    }

    // Close — engine detaches.
    const closed = await core.dispatch(cmd<CloseTab>({ type: 'CloseTab', tabId }));
    expect(closed.some((e) => e.type === 'TabClosed')).toBe(true);
    expect(calls.some((c) => c.method === 'detach')).toBe(true);
    expect(core.getTab(tabId)).toBeUndefined();
  });

  it('online navigation is gated by the threshold (Article IV)', async () => {
    const { core, tabId } = await bootWithTab();

    // While the boundary is sealed, CanNetwork is revoked BY CONSTRUCTION.
    const sealedNav = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://example.com' })
    );
    const rejected = sealedNav.find((e) => e.type === 'CommandRejected');
    expect(rejected).toBeDefined();
    expect(rejected!.reason).toMatch(/CanNetwork/);

    // Open the boundary, navigate, then close it.
    await core.dispatch(
      cmd<OpenBoundary>({ type: 'OpenBoundary', tabId, url: 'https://example.com' })
    );
    const onlineNav = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://example.com' })
    );
    expect(onlineNav.some((e) => e.type === 'NavigationCompleted')).toBe(true);

    const sealedEvts = await core.dispatch(cmd<CloseBoundary>({ type: 'CloseBoundary', tabId }));
    const sealed = sealedEvts.find((e) => e.type === 'ThresholdSealed');
    expect(sealed).toBeDefined();
    expect((sealed as { capabilitiesRevoked: string[] }).capabilitiesRevoked).toContain('CanNetwork');

    // After sealing, online navigation is again impossible.
    const again = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://example.com' })
    );
    expect(again.some((e) => e.type === 'CommandRejected')).toBe(true);
  });

  it('private sessions receive their restricted capability set BY CONSTRUCTION (S3)', async () => {
    const engine = new FakeEngineAdapter();
    const core = new LyconCore(engine, LYCON_IDENTITY_V1);
    await core.boot();

    const sess = await core.dispatch(
      cmd<CreateSession>({ type: 'CreateSession', mode: 'private' })
    );
    const sessionId = sess.find((e) => e.type === 'SessionCreated')!.sessionId;

    const win = await core.dispatch(
      cmd<CreateWindow>({ type: 'CreateWindow', sessionId, width: 800, height: 600 })
    );
    const windowId = win.find((e) => e.type === 'WindowCreated')!.windowId;

    const tab = await core.dispatch(
      cmd<CreateTab>({ type: 'CreateTab', windowId, typeKind: 'private' })
    );
    const tabId = tab.find((e) => e.type === 'TabCreated')!.tabId;

    const caps = core.getCapabilities(sessionId, tabId);
    for (const forbidden of PRIVATE_SESSION_FORBIDDEN_CAPABILITIES) {
      expect(caps.capabilities.has(forbidden), `private session must lack ${forbidden}`).toBe(false);
    }

    // The engine context for the private tab never carries the identity record (S11),
    // and its sandbox is stricter (no allow-same-origin).
    const ctx = core.getEngineContext(tabId)!;
    expect(ctx.effectiveCapabilities).toContain('CanNavigate');
    expect('identity' in ctx).toBe(false);
    expect('charter' in ctx).toBe(false);
    expect('family' in ctx).toBe(false);
    expect(ctx.sandboxAttributes).not.toContain('allow-same-origin');
  });

  it('core suspends (revoking capabilities) and restores-after-suspend', async () => {
    const { core, tabId } = await bootWithTab();

    await core.dispatch(cmd<ActivateTab>({ type: 'ActivateTab', tabId }));

    const suspended = await core.dispatch(
      cmd<SuspendCore>({ type: 'SuspendCore', reason: 'test-disconnect' })
    );
    expect(suspended.some((e) => e.type === 'CoreSuspended')).toBe(true);
    expect(core.getBrowserState()).toBe('suspended');

    // While suspended the effective capability set is EMPTY (by construction).
    const sessionId = core.getBrowser()!.activeSessionId!;
    expect(core.getCapabilities(sessionId, tabId).capabilities.size).toBe(0);

    // Commands are rejected while suspended.
    const duringSuspend = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'about:start' })
    );
    expect(duringSuspend.some((e) => e.type === 'CommandRejected')).toBe(true);

    const resumed = await core.dispatch(cmd<ResumeCore>({ type: 'ResumeCore' }));
    (console.log as (m: string, ...a: unknown[]) => void)(
      'TRACE resume events:',
      resumed.map((e) => e.type),
      'state', core.getBrowserState()
    );
    expect(resumed.some((e) => e.type === 'CoreReady')).toBe(true);
    expect(core.getBrowserState()).toBe('running');

    // Restore-after-suspend: the object graph survives, and commands work again.
    const tabAfter = core.getTab(tabId)!;
    expect(tabAfter.lifecycle).toBe('active');
    expect(tabAfter.pageIds.length).toBeGreaterThan(0);
    const renav = await core.dispatch(
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'about:start', replace: true })
    );
    expect(renav.some((e) => e.type === 'NavigationCompleted')).toBe(true);
  });

  it('rejects non-impersonation and out-of-domain agents (S5, S9)', async () => {
    const engine = new FakeEngineAdapter();
    const core = new LyconCore(engine, LYCON_IDENTITY_V1);
    await core.boot();

    const bad = await core.dispatch({
      type: 'CreateSession',
      mode: 'persistent',
      commandId: Id.command(),
      participantId: 'lycon',
      timestamp: Date.now(),
    });
    expect(bad.some((e) => e.type === 'CommandRejected')).toBe(true);
    expect(bad.find((e) => e.type === 'CommandRejected')!.reason).toMatch(/non-impersonation/);

    // An agent must not act inside ORA's territory (observation/sky).
    const oraAgent = await core.dispatch(
      cmd<RegisterAgent>({ type: 'RegisterAgent', agentName: 'agent:sky-watcher', domain: 'observation' })
    );
    expect(oraAgent.some((e) => e.type === 'CommandRejected')).toBe(true);
    expect(oraAgent.find((e) => e.type === 'CommandRejected')!.reason).toMatch(/checkDomain/);
  });

  it('every dispatched command is causally traceable (S7) and never leaves a rumour', async () => {
    const { core, calls, sessionId, tabId } = await bootWithTab();

    const commands: Command[] = [
      cmd<ActivateTab>({ type: 'ActivateTab', tabId }),
      cmd<OpenBoundary>({ type: 'OpenBoundary', tabId, url: 'https://a.example' }),
      cmd<Navigate>({ type: 'Navigate', tabId, url: 'https://a.example' }),
      cmd<CreateWindow>({ type: 'CreateWindow', sessionId, width: 800, height: 600 }),
      cmd<CloseBoundary>({ type: 'CloseBoundary', tabId }),
    ];

    for (const command of commands) {
      const events = await core.dispatch(command);
      // ARTICLE III: command without event is a rumour — never allowed.
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(event.commandId).toBe(command.commandId);
      }
    }
    expect(calls.length).toBeGreaterThan(0); // engine stayed behind the adapter
  });
});