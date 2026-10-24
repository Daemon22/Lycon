/**
 * useLyconCore — React integration layer for LyconCore
 *
 * This hook bridges the React UI with the constitutional LyconCore. It
 * provides a single live core instance and routes all browser operations
 * through the core's command/event discipline (Article III):
 *
 *   UI → command/event → LyconCore → policy/capability →
 *   engine contract → RealEngineAdapter
 *
 * The UI is a MIRROR: it never mutates authoritative browser state directly.
 * Navigation, tab lifecycle, and the threshold (boundary) are all owned by
 * LyconCore; this hook simply projects core events onto React state.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { LyconCore } from '../../../core/LyconCore';
import { createRuntimeEngineAdapter } from '../../../core/RealEngineAdapterFactory';
import type { Command } from '../../../core/types/03_commands';
import type { CoreEvent } from '../../../core/types/04_events';
import type { TabId, WindowId, SessionId } from '../../../core/types/00_ids';
import { Id } from '../../../core/types/00_ids';
import type { ThresholdState } from '../../../core/types/02_lifecycle';
import type { EngineAdapter, EngineAdapterFactory } from '../../../core/types/06_engine';

const PARTICIPANT_ID = 'lycon-ui';

export interface CoreTabMirror {
  id: TabId;
  title: string;
  isPrivate: boolean;
}

export interface CoreState {
  isReady: boolean;
  sessionId: SessionId | null;
  windowId: WindowId | null;
  activeTabId: TabId | null;
  tabs: CoreTabMirror[];
  currentUrl: string | null;
  thresholdState: ThresholdState | null;
}

export interface LyconCoreBridge {
  /** Projected core state (a mirror — the core remains authoritative). */
  state: CoreState;
  /** The live LyconCore instance (null until boot completes). */
  core: LyconCore | null;
  /**
   * Raw command dispatch. Prefer the typed wrappers below; this is the
   * Article III escape hatch for commands without a dedicated wrapper.
   */
  dispatch: (cmd: Command) => Promise<CoreEvent[]>;
  navigate: (tabId: TabId, url: string) => Promise<CoreEvent[]>;
  goBack: (tabId: TabId) => Promise<CoreEvent[]>;
  goForward: (tabId: TabId) => Promise<CoreEvent[]>;
  createTab: (windowId: WindowId, isPrivate?: boolean) => Promise<CoreEvent[]>;
  activateTab: (tabId: TabId) => Promise<CoreEvent[]>;
  closeTab: (tabId: TabId) => Promise<CoreEvent[]>;
  openBoundary: (tabId: TabId, url: string) => Promise<CoreEvent[]>;
  closeBoundary: (tabId: TabId) => Promise<CoreEvent[]>;
  setShields: (tabId: TabId, enabled: boolean, url: string) => Promise<CoreEvent[]>;
  /**
   * Reload the tab's current page through the Core -> EngineAdapter path
   * (Article II: no UI-to-engine shortcuts). Keeps every shell — web, Windows
   * (Tauri), and Android (GeckoView) — refreshing via the same Core capability.
   */
  reload: (tabId: TabId) => Promise<CoreEvent[]>;
  /**
   * Register an agent participant (Article VII / IX). The Core validates the
   * agent's authorized domain before emitting AgentRegistered, so the surface
   * never bypasses Core policy.
   */
  registerAgent: (agentName: string, domain: string) => Promise<CoreEvent[]>;
  /**
   * Unregister an agent participant. The Core emits AgentUnregistered so peer
   * surfaces observe the removal through the event stream.
   */
  unregisterAgent: (agentName: string) => Promise<CoreEvent[]>;
  /**
   * Submit an agent-originated suggestion. Per Article IX the agent never
   * bypasses the Core: it records a CommandRejected so the surface can
   * re-issue an attributed Command if it chooses to honor the suggestion.
   */
  agentSuggestion: (agentName: string, suggestedAction: Command) => Promise<CoreEvent[]>;
  /** Bind the real engine surface (the iframe host) for the active tab. */
  bindEngineSurface: (container: HTMLElement | null) => Promise<void>;
}

export function useLyconCore(): LyconCoreBridge {
  const coreRef = useRef<LyconCore | null>(null);
  const adapterRef = useRef<EngineAdapter | null>(null);
  const stateRef = useRef<CoreState>({
    isReady: false,
    sessionId: null,
    windowId: null,
    activeTabId: null,
    tabs: [],
    currentUrl: null,
    thresholdState: null,
  });
  const [state, setState] = useState<CoreState>(stateRef.current);

  const applyState = useCallback((next: CoreState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const handleCoreEvent = useCallback((event: CoreEvent) => {
    setState((prev) => {
      let next: CoreState = prev;
      switch (event.type) {
        case 'TabCreated':
          next = {
            ...prev,
            tabs: [...prev.tabs, { id: event.tabId, title: 'New Tab', isPrivate: event.tabType === 'private' }],
          };
          break;
        case 'TabActivated':
          next = { ...prev, activeTabId: event.tabId };
          break;
        case 'TabClosed':
          next = {
            ...prev,
            tabs: prev.tabs.filter((t) => t.id !== event.tabId),
            activeTabId:
              prev.activeTabId === event.tabId
                ? (prev.tabs.find((t) => t.id !== event.tabId)?.id ?? null)
                : prev.activeTabId,
          };
          break;
        case 'NavigationCompleted':
          next = { ...prev, currentUrl: event.finalUrl };
          break;
        case 'ThresholdOpening':
          next = { ...prev, thresholdState: 'opening' };
          break;
        case 'ThresholdOpened':
          next = { ...prev, thresholdState: 'open' };
          break;
        case 'ThresholdClosing':
          next = { ...prev, thresholdState: 'closing' };
          break;
        case 'ThresholdSealed':
          next = { ...prev, thresholdState: 'sealed' };
          break;
        default:
          break;
      }
      stateRef.current = next;
      return next;
    });
  }, []);

  // Boot one core instance for this mounted browser session.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const engineFactory: EngineAdapterFactory = async () => {
      const adapter = await createRuntimeEngineAdapter();
      adapterRef.current = adapter;
      return adapter;
    };
    const instance = new LyconCore(engineFactory);
    coreRef.current = instance;

    async function bootCore(): Promise<void> {
      try {
        const bootResult = await instance.boot();
        if (!bootResult.ok) {
          console.error('LyconCore boot failed:', bootResult.reason);
          return;
        }

        const sessionEvents = await instance.dispatch({
          commandId: Id.command(),
          participantId: PARTICIPANT_ID,
          timestamp: Date.now(),
          type: 'CreateSession',
          mode: 'persistent',
        });
        const sessionCreated = sessionEvents.find((e): e is Extract<CoreEvent, { type: 'SessionCreated' }> => e.type === 'SessionCreated');
        if (!sessionCreated) {
          console.error('Core: failed to create session');
          return;
        }

        const windowEvents = await instance.dispatch({
          commandId: Id.command(),
          participantId: PARTICIPANT_ID,
          timestamp: Date.now(),
          type: 'CreateWindow',
          sessionId: sessionCreated.sessionId,
          width: typeof window !== 'undefined' ? window.innerWidth : 1280,
          height: typeof window !== 'undefined' ? window.innerHeight : 800,
        });
        const windowCreated = windowEvents.find((e): e is Extract<CoreEvent, { type: 'WindowCreated' }> => e.type === 'WindowCreated');
        if (!windowCreated) {
          console.error('Core: failed to create window');
          return;
        }

        const tabEvents = await instance.dispatch({
          commandId: Id.command(),
          participantId: PARTICIPANT_ID,
          timestamp: Date.now(),
          type: 'CreateTab',
          windowId: windowCreated.windowId,
          typeKind: 'normal',
        });
        const tabCreated = tabEvents.find((e): e is Extract<CoreEvent, { type: 'TabCreated' }> => e.type === 'TabCreated');
        if (!tabCreated) {
          console.error('Core: failed to create tab');
          return;
        }

        if (coreRef.current !== instance) return;

        // Lazy engine attach (Article II §4): attach only when the tab becomes
        // visible. Without this the engine (RealEngineAdapter) never goes live.
        await instance.dispatch({
          commandId: Id.command(),
          participantId: PARTICIPANT_ID,
          timestamp: Date.now(),
          type: 'ActivateTab',
          tabId: tabCreated.tabId,
        });

        unsubscribe = instance.subscribe(handleCoreEvent);

        applyState({
          isReady: true,
          sessionId: sessionCreated.sessionId,
          windowId: windowCreated.windowId,
          activeTabId: tabCreated.tabId,
          tabs: [{ id: tabCreated.tabId, title: 'Start', isPrivate: false }],
          currentUrl: 'about:start',
          thresholdState: 'sealed',
        });

        if (import.meta.env.DEV && typeof window !== 'undefined') {
          const w = window as unknown as {
            __lycon: {
              core: LyconCore;
              adapter: EngineAdapter;
              getState: () => CoreState;
              getEvents: () => readonly CoreEvent[];
            };
          };
          w.__lycon = {
            core: instance,
            adapter: (() => {
              const a = adapterRef.current;
              if (!a) throw new Error('engine adapter not ready');
              return a;
            })(),
            getState: () => stateRef.current,
            getEvents: () => instance.getEvents(),
          };
        }
      } catch (error) {
        console.error('Core boot error:', error);
      }
    }

    void bootCore();

    return () => {
      unsubscribe?.();
      if (coreRef.current === instance) coreRef.current = null;
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const w = window as unknown as { __lycon?: unknown };
        delete w.__lycon;
      }
      void instance.shutdown();
    };
  }, [applyState, handleCoreEvent]);

  // Bind the engine surface (the live iframe host). The Shell owns DOM
  // lifecycle: the UI calls bindEngineSurface when its container mounts.
  // (Deliberately NOT resolved from a ref here — that would race the DOM.)

  const dispatchCommand = useCallback(async (cmd: Command): Promise<CoreEvent[]> => {
    if (!coreRef.current) {
      console.error('Core not initialized');
      return [];
    }
    return coreRef.current.dispatch(cmd);
  }, []);

  const navigate = useCallback((tabId: TabId, url: string) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'Navigate',
      tabId,
      url,
    });
  }, [dispatchCommand]);

  const goBack = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'GoBack',
      tabId,
    });
  }, [dispatchCommand]);

  const goForward = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'GoForward',
      tabId,
    });
  }, [dispatchCommand]);

  const createTab = useCallback((windowId: WindowId, isPrivate: boolean = false) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'CreateTab',
      windowId,
      typeKind: isPrivate ? 'private' : 'normal',
    });
  }, [dispatchCommand]);

  const activateTab = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'ActivateTab',
      tabId,
    });
  }, [dispatchCommand]);

  const closeTab = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'CloseTab',
      tabId,
    });
  }, [dispatchCommand]);

  const openBoundary = useCallback((tabId: TabId, url: string) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'OpenBoundary',
      tabId,
      url,
    });
  }, [dispatchCommand]);

  const closeBoundary = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'CloseBoundary',
      tabId,
    });
  }, [dispatchCommand]);

  const setShields = useCallback((tabId: TabId, enabled: boolean, url: string) => {
    return enabled ? closeBoundary(tabId) : openBoundary(tabId, url);
  }, [closeBoundary, openBoundary]);

  // Article III: Reload is a constitutional command routed through LyconCore
  // so every shell refreshes via the same capability (no direct engine access).
  const reload = useCallback((tabId: TabId) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'Reload',
      tabId,
    });
  }, [dispatchCommand]);

  // ── Agents (Article VII / IX) ───────────────────────────────────────
  // These are pure Core command dispatches — the surface never bypasses the
  // Core's domain policy or event discipline. Native persistence of agent
  // connectors is handled separately at the platform boundary.
  const registerAgent = useCallback((agentName: string, domain: string) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'RegisterAgent',
      agentName,
      domain,
    });
  }, [dispatchCommand]);

  const unregisterAgent = useCallback((agentName: string) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'UnregisterAgent',
      agentName,
    });
  }, [dispatchCommand]);

  const agentSuggestion = useCallback((agentName: string, suggestedAction: Command) => {
    return dispatchCommand({
      commandId: Id.command(),
      participantId: PARTICIPANT_ID,
      timestamp: Date.now(),
      type: 'AgentSuggestion',
      agentName,
      suggestedAction,
    });
  }, [dispatchCommand]);

  const bindEngineSurface = useCallback(async (container: HTMLElement | null): Promise<void> => {
    const adapter = adapterRef.current;
    const tabId = stateRef.current.activeTabId;
    if (!adapter || !tabId) return;
    await adapter.bindContainer?.(tabId, container);
  }, []);

  return {
    state,
    core: coreRef.current,
    dispatch: dispatchCommand,
    navigate,
    goBack,
    goForward,
    createTab,
    activateTab,
    closeTab,
    openBoundary,
    closeBoundary,
    setShields,
    reload,
    registerAgent,
    unregisterAgent,
    agentSuggestion,
    bindEngineSurface,
  };
}