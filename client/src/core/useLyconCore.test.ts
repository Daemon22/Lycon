/**
 * Integration tests for useLyconCore hook
 *
 * These tests run the REAL LyconCore with the REAL RealEngineAdapter in jsdom
 * and assert the constitutional call path:
 *
 *   UI → command/event → LyconCore → policy/capability → engine contract →
 *   RealEngineAdapter
 *
 * They only differ from the old suite in one essential way: they FAIL if the
 * integration layer bypasses the core, because every assertion is made against
 * the live core state and the live adapter (reached via the dev diagnostic
 * `window.__lycon`, which is only installed after a real boot).
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act, type RenderHookResult } from '@testing-library/react';
import { useLyconCore, type LyconCoreBridge } from './useLyconCore';
import type { EngineAdapter } from '../../../core/types/06_engine';
import type { LyconCore } from '../../../core/LyconCore';
import { Id } from '../../../core/types/00_ids';
import type { CoreEvent, CommandRejected, AgentRegistered, AgentUnregistered } from '../../../core/types/04_events';
import { PRIVATE_SESSION_FORBIDDEN_CAPABILITIES } from '../../../core/types/05_policy';

interface LyconDiagnostic {
  core: LyconCore;
  adapter: EngineAdapter;
  getState: () => { thresholdState: string | null; activeTabId: string | null };
  getEvents: () => readonly CoreEvent[];
}

function diag(): LyconDiagnostic {
  const d = (window as unknown as { __lycon?: LyconDiagnostic }).__lycon;
  if (!d) throw new Error('window.__lycon not installed — core did not boot');
  return d;
}

function rejected(events: readonly CoreEvent[], command: string): boolean {
  return events.some(
    (e) => e.type === 'CommandRejected' && (e as CommandRejected).rejectedCommand.type === command
  );
}

describe('useLyconCore constitutional integration', () => {
  let hook: RenderHookResult<LyconCoreBridge, unknown> | null = null;

  afterEach(() => {
    hook?.unmount();
    delete (window as unknown as { __lycon?: LyconDiagnostic }).__lycon;
    document.body.innerHTML = '';
  });

  async function boot(): Promise<LyconDiagnostic> {
    hook = renderHook(() => useLyconCore());
    await waitFor(() => expect(hook!.result.current.state.isReady).toBe(true), { timeout: 15000 });
    const d = diag();
    expect(d.adapter.capabilities.name).toMatch(/real/i);
    return d;
  }

  function bridge(): LyconCoreBridge {
    if (!hook) throw new Error('hook not rendered');
    return hook.result.current;
  }

  it('boots one live core, attaches the real engine, and mirrors sealed start state', async () => {
    const d = await boot();
    expect(d.getState().activeTabId).toBeTruthy();
    expect(d.getState().thresholdState).toBe('sealed');
    expect(d.getEvents().filter((e) => e.type === 'TabCreated')).toHaveLength(1);
    expect(bridge().state.tabs).toHaveLength(1);
    expect(bridge().state.activeTabId).toBe(d.getState().activeTabId);
  });

  it('rejects online navigation while the threshold is sealed (policy before engine)', async () => {
    const d = await boot();
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');
    const tabId = bridge().state.activeTabId as string;

    const events = await act(async () => bridge().navigate(tabId, 'https://example.com'));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(rejected(events, 'Navigate')).toBe(true);
  });

  it('opens the boundary, then routes online navigation through the engine adapter', async () => {
    const d = await boot();
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');
    const tabId = bridge().state.activeTabId as string;

    await act(async () => {
      await bridge().openBoundary(tabId, 'https://example.com');
    });
    expect(d.getState().thresholdState).toBe('open');

    await act(async () => {
      await bridge().navigate(tabId, 'https://example.com');
    });
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tabId, url: 'https://example.com' })
    );
    expect(bridge().state.currentUrl).toBe('https://example.com');
  });

  it('routes local navigation through the engine adapter without opening the boundary', async () => {
    const d = await boot();
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');
    const tabId = bridge().state.activeTabId as string;

    await act(async () => {
      await bridge().navigate(tabId, 'lycon://bookmarks');
    });
    expect(navigateSpy).toHaveBeenCalledWith(expect.objectContaining({ url: 'lycon://bookmarks' }));
    expect(d.getState().thresholdState).toBe('sealed');
    expect(bridge().state.currentUrl).toBe('lycon://bookmarks');
  });

  it('drives tab creation, activation, and closure through the core', async () => {
    const d = await boot();
    const windowId = bridge().state.windowId as string;
    const originalTabId = bridge().state.activeTabId as string;

    const created = await act(async () => bridge().createTab(windowId, false));
    const tabCreated = created.find((e): e is Extract<CoreEvent, { type: 'TabCreated' }> => e.type === 'TabCreated');
    expect(tabCreated).toBeTruthy();
    expect(bridge().state.tabs).toHaveLength(2);

    await act(async () => {
      await bridge().activateTab(tabCreated!.tabId);
    });

    expect(bridge().state.activeTabId).toBe(tabCreated!.tabId);

    const closed = await act(async () => bridge().closeTab(tabCreated!.tabId));
    expect(closed.some((e) => e.type === 'TabClosed')).toBe(true);
    expect(bridge().state.tabs).toHaveLength(1);
    expect(bridge().state.activeTabId).toBe(originalTabId);
  });

  it('creates, activates, and destroys a distinct private session through Core', async () => {
    const d = await boot();
    const persistentTabId = bridge().state.activeTabId as string;
    const persistentSessionId = bridge().state.sessionId;
    const persistentWindowId = bridge().state.windowId;
    const events = await act(async () => bridge().createPrivateTab());
    const session = events.find((event): event is Extract<CoreEvent, { type: 'SessionCreated' }> => event.type === 'SessionCreated');
    const window = events.find((event): event is Extract<CoreEvent, { type: 'WindowCreated' }> => event.type === 'WindowCreated');
    const tab = events.find((event): event is Extract<CoreEvent, { type: 'TabCreated' }> => event.type === 'TabCreated');

    expect(session?.mode).toBe('private');
    expect(window?.sessionId).toBe(session?.sessionId);
    expect(tab).toMatchObject({ sessionId: session?.sessionId, windowId: window?.windowId, tabType: 'private' });
    expect(tab).toBeTruthy();

    await act(async () => bridge().activateTab(tab!.tabId));
    const coreTab = d.core.getTab(tab!.tabId)!;
    const engineContext = d.core.getEngineContext(tab!.tabId)!;
    const capabilities = d.core.getCapabilities(session!.sessionId, tab!.tabId);
    expect(d.core.getSession(coreTab.sessionId)?.mode).toBe('private');
    expect(coreTab.windowId).toBe(window!.windowId);
    expect(engineContext.sessionId).toBe(session!.sessionId);
    expect(engineContext.sessionMode).toBe('private');
    expect(engineContext.tabType).toBe('private');
    expect(bridge().state.sessionId).toBe(session!.sessionId);
    expect(bridge().state.windowId).toBe(window!.windowId);
    for (const forbidden of PRIVATE_SESSION_FORBIDDEN_CAPABILITIES) {
      expect(capabilities.capabilities.has(forbidden)).toBe(false);
    }
    expect(d.adapter.capabilities.canIsolatePrivateSessions).toBe(false);
    await act(async () => bridge().navigate(tab!.tabId, 'lycon://search?q=private-marker'));
    expect(bridge().state.currentUrl).toBe('lycon://search?q=private-marker');
    expect(JSON.stringify(d.core.getEvents())).not.toContain('private-marker');

    await act(async () => bridge().activateTab(persistentTabId));
    expect(bridge().state.activeTabId).toBe(persistentTabId);
    expect(bridge().state.sessionId).toBe(persistentSessionId);
    expect(bridge().state.windowId).toBe(persistentWindowId);
    expect(bridge().state.currentUrl).toBeNull();

    await act(async () => bridge().activateTab(tab!.tabId));
    expect(bridge().state.activeTabId).toBe(tab!.tabId);
    expect(bridge().state.sessionId).toBe(session!.sessionId);
    expect(bridge().state.windowId).toBe(window!.windowId);

    const closed = await act(async () => bridge().closeTab(tab!.tabId));
    expect(closed.some((event) => event.type === 'TabClosed')).toBe(true);
    expect(closed.some((event) => event.type === 'WindowClosed')).toBe(true);
    expect(closed.some((event) => event.type === 'SessionDestroyed')).toBe(true);
    expect(d.core.getSession(session!.sessionId)).toBeUndefined();
    expect(bridge().state.currentUrl).toBeNull();
    expect(bridge().state.sessionId).toBe(persistentSessionId);
    expect(bridge().state.windowId).toBe(persistentWindowId);
  }, 30000);

  it('refuses private online boundary operations when the adapter cannot isolate site storage', async () => {
    const d = await boot();
    const events = await act(async () => bridge().createPrivateTab());
    const tab = events.find((event): event is Extract<CoreEvent, { type: 'TabCreated' }> => event.type === 'TabCreated')!;
    await act(async () => bridge().activateTab(tab.tabId));
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');

    const boundaryEvents = await act(async () => bridge().openBoundary(tab.tabId, 'https://private.example'));
    const navigationEvents = await act(async () => bridge().navigate(tab.tabId, 'https://private.example'));

    expect(rejected(boundaryEvents, 'OpenBoundary')).toBe(true);
    expect(rejected(navigationEvents, 'Navigate')).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('routes back/forward through the engine adapter history', async () => {
    const d = await boot();
    const tabId = bridge().state.activeTabId as string;
    const goBackSpy = vi.spyOn(d.adapter, 'goBack');
    const goForwardSpy = vi.spyOn(d.adapter, 'goForward');

    await act(async () => {
      await bridge().navigate(tabId, 'lycon://start');
      await bridge().navigate(tabId, 'lycon://history');
    });
    expect(bridge().state.currentUrl).toBe('lycon://history');

    await act(async () => {
      await bridge().goBack(tabId);
    });
    expect(goBackSpy).toHaveBeenCalledWith(tabId);
    expect(bridge().state.currentUrl).toBe('lycon://start');

    await act(async () => {
      await bridge().goForward(tabId);
    });
    expect(goForwardSpy).toHaveBeenCalledWith(tabId);
    expect(bridge().state.currentUrl).toBe('lycon://history');
  });

  it('seals the threshold via closeBoundary and revokes online navigation again', async () => {
    const d = await boot();
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');
    const tabId = bridge().state.activeTabId as string;

    await act(async () => {
      await bridge().openBoundary(tabId, 'https://example.com');
      await bridge().navigate(tabId, 'https://example.com');
    });
    expect(navigateSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await bridge().closeBoundary(tabId);
    });
    expect(d.getState().thresholdState).toBe('sealed');

    const events = await act(async () => bridge().navigate(tabId, 'https://bar.com'));
    expect(rejected(events, 'Navigate')).toBe(true);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it('routes the shield toggle through the constitutional threshold commands', async () => {
    const d = await boot();
    const tabId = bridge().state.activeTabId as string;
    const openSpy = vi.spyOn(d.adapter, 'navigate');

    const opened = await act(async () => bridge().setShields(tabId, false, 'https://example.com'));
    expect(opened.some((event) => event.type === 'ThresholdOpened')).toBe(true);
    expect(d.getState().thresholdState).toBe('open');

    const sealed = await act(async () => bridge().setShields(tabId, true, 'https://example.com'));
    expect(sealed.some((event) => event.type === 'ThresholdSealed')).toBe(true);
    expect(d.getState().thresholdState).toBe('sealed');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('renders and updates the real engine surface when bindEngineSurface binds a container', async () => {
    const d = await boot();
    const tabId = bridge().state.activeTabId as string;
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      await bridge().openBoundary(tabId, 'https://example.com');
      await bridge().navigate(tabId, 'https://example.com');
      await bridge().bindEngineSurface(container);
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe('https://example.com');
    expect(iframe!.getAttribute('sandbox')).toContain('allow-scripts');

    await act(async () => {
      await bridge().navigate(tabId, 'https://example.com/about');
    });
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe('https://example.com/about');

    await act(async () => {
      await bridge().bindEngineSurface(null);
    });
    expect(() => diag()).not.toThrow();
  }, 15000);

  it('reloads the active online page through the core and engine adapter', async () => {
    const d = await boot();
    const navigateSpy = vi.spyOn(d.adapter, 'navigate');
    const tabId = bridge().state.activeTabId as string;

    await act(async () => {
      await bridge().openBoundary(tabId, 'https://example.com');
      await bridge().navigate(tabId, 'https://example.com');
    });
    expect(navigateSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await bridge().reload(tabId);
    });
    // Reload re-issues the same URL through the engine adapter (replace=true),
    // keeping web / Windows / Android shells in lock-step via the Core.
    expect(navigateSpy).toHaveBeenCalledWith(expect.objectContaining({ tabId, url: 'https://example.com' }));
    expect(navigateSpy).toHaveBeenCalledTimes(2);
    expect(bridge().state.currentUrl).toBe('https://example.com');
  });

  it('registers an agent through the Core when the domain is authorized', async () => {
    await boot();
    const events = await act(async () => bridge().registerAgent('demo-agent', 'browser'));
    const registered = events.find((e): e is AgentRegistered => e.type === 'AgentRegistered');
    expect(registered).toBeTruthy();
    expect(registered).toMatchObject({ agentName: 'demo-agent', domain: 'browser' });
  });

  it('rejects agent registration for an unauthorized domain (Core policy before state)', async () => {
    await boot();
    const events = await act(async () => bridge().registerAgent('spy-agent', 'observation'));
    expect(rejected(events, 'RegisterAgent')).toBe(true);
    const rejection = events.find((e): e is CommandRejected => e.type === 'CommandRejected');
    expect(rejection?.reason).toMatch(/checkDomain/);
    expect(rejection?.reason).toMatch('observation');
  });

  it('unregisters an agent through the Core', async () => {
    await boot();
    const events = await act(async () => bridge().unregisterAgent('demo-agent'));
    const unregistered = events.find((e): e is AgentUnregistered => e.type === 'AgentUnregistered');
    expect(unregistered).toBeTruthy();
    expect(unregistered).toMatchObject({ agentName: 'demo-agent' });
  });

  it('records an agent suggestion as a Core rejection for surface re-issue', async () => {
    await boot();
    const tabId = bridge().state.activeTabId as string;
    const events = await act(async () =>
      bridge().agentSuggestion('demo-agent', {
        commandId: Id.command(),
        participantId: 'demo-agent',
        timestamp: Date.now(),
        type: 'Navigate',
        tabId,
        url: 'https://example.com',
      }),
    );
    // The Core never auto-executes a suggestion — it records a rejection whose
    // rejectedCommand.target is the suggested command, so the surface can
    // re-issue an attributed Command if it chooses to honor it.
    expect(rejected(events, 'Navigate')).toBe(true);
    const rejection = events.find((e): e is CommandRejected => e.type === 'CommandRejected');
    expect(rejection?.reason).toBe('agent-suggestion-requires-surface-re-issue');
    expect(rejection?.rejectedCommand).toMatchObject({ type: 'Navigate' });
  });
});