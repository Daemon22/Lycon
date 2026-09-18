/**
 * FakeEngineAdapter — Gate 7 test double for the EngineAdapter contract.
 *
 * Per Article II ("The EngineAdapter is the only gate") and 06_engine.ts, this
 * is a *deliberately boring* stand-in: it does NOT render HTML. It simulates
 * engine-level signals (navigation started/completed/loaded) and keeps a
 * per-tab in-memory session history so back/forward can be exercised through
 * the Core → EngineAdapter channel exactly as a real engine would.
 *
 * The Core never imports this file — the test injects an instance (or a factory
 * returning one). Swapping a real GeckoView / Tauri adapter for this one is a
 * shell-only change (Article II, Paragraph 4).
 */

import type {
  EngineAdapter,
  EngineCapabilities,
  EngineContext,
  EngineNavigationRequest,
  EngineEvent,
  EngineEventListener,
  Unsubscribe,
} from './types/06_engine';
import type { TabId } from './types/00_ids';

/** Per-tab simulated session history the fake engine keeps in memory. */
interface TabHistory {
  urls: string[];
  index: number;
}

export class FakeEngineAdapter implements EngineAdapter {
  readonly capabilities: EngineCapabilities = {
    canRenderHtml: true,
    canEmbedContent: true,
    canBlockRequests: true,
    canInjectScripts: true,
    canScreenshot: true,
    canDownload: true,
    canAccessFile: true,
    canRunJavaScript: true,
    canManageCookies: true,
    canGeolocation: true,
    canMedia: true,
    canFullscreen: true,
    canClipboard: true,
    canZoom: true,
    name: 'FakeEngine',
    version: '0.1.0-fake',
  };

  private listeners = new Set<EngineEventListener>();
  private attachedTabs = new Set<string>();
  private history = new Map<TabId, TabHistory>();
  private zoom = new Map<TabId, number>();

  /** Emit an engine event to all current subscribers (synchronously). */
  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  attach(context: EngineContext): Promise<void> {
    this.attachedTabs.add(context.tabId as string);
    this.zoom.set(context.tabId, 1);
    if (context.initialUrl) {
      this.history.set(context.tabId, { urls: [context.initialUrl], index: 0 });
      this.emit({ type: 'EngineNavigationStarted', tabId: context.tabId, url: context.initialUrl });
      this.emit({ type: 'EngineNavigationCompleted', tabId: context.tabId, url: context.initialUrl, statusCode: 200 });
      this.emit({ type: 'EnginePageLoaded', tabId: context.tabId, url: context.initialUrl, statusCode: 200, finalUrl: context.initialUrl });
    } else {
      this.history.set(context.tabId, { urls: [], index: -1 });
    }
    return Promise.resolve();
  }

  detach(tabId: TabId): Promise<void> {
    this.attachedTabs.delete(tabId as string);
    this.history.delete(tabId);
    this.zoom.delete(tabId);
    return Promise.resolve();
  }

  navigate(request: EngineNavigationRequest): Promise<void> {
    const h = this.history.get(request.tabId) ?? { urls: [], index: -1 };
    // Truncate any "forward" entries when navigating to a new URL, mirroring a
    // real engine's session-history semantics.
    if (request.replace === true && h.urls.length > 0) {
      if (h.index >= 0) h.urls[h.index] = request.url;
    } else {
      h.urls = h.urls.slice(0, h.index + 1);
      h.urls.push(request.url);
      h.index = h.urls.length - 1;
    }
    this.history.set(request.tabId, h);

    const url = request.url;
    this.emit({ type: 'EngineNavigationStarted', tabId: request.tabId, url });
    this.emit({ type: 'EngineNavigationCompleted', tabId: request.tabId, url, statusCode: 200 });
    this.emit({ type: 'EnginePageLoaded', tabId: request.tabId, url, statusCode: 200, finalUrl: url });
    return Promise.resolve();
  }

  goBack(tabId: TabId): Promise<void> {
    const h = this.history.get(tabId);
    if (!h || h.index <= 0) return Promise.resolve();
    h.index -= 1;
    this.history.set(tabId, h);
    const url = h.urls[h.index];
    this.emit({ type: 'EngineNavigationStarted', tabId, url });
    this.emit({ type: 'EngineNavigationCompleted', tabId, url, statusCode: 200 });
    this.emit({ type: 'EnginePageLoaded', tabId, url, statusCode: 200, finalUrl: url });
    return Promise.resolve();
  }

  goForward(tabId: TabId): Promise<void> {
    const h = this.history.get(tabId);
    if (!h || h.index >= h.urls.length - 1) return Promise.resolve();
    h.index += 1;
    this.history.set(tabId, h);
    const url = h.urls[h.index];
    this.emit({ type: 'EngineNavigationStarted', tabId, url });
    this.emit({ type: 'EngineNavigationCompleted', tabId, url, statusCode: 200 });
    this.emit({ type: 'EnginePageLoaded', tabId, url, statusCode: 200, finalUrl: url });
    return Promise.resolve();
  }

  stop(_tabId: TabId): Promise<void> {
    return Promise.resolve();
  }

  subscribe(listener: EngineEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getZoom(tabId: TabId): Promise<number> {
    return Promise.resolve(this.zoom.get(tabId) ?? 1);
  }

  setZoom(tabId: TabId, level: number): Promise<void> {
    this.zoom.set(tabId, level);
    return Promise.resolve();
  }

  verifyContract(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
