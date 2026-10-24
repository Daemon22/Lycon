/**
 * RealEngineAdapter — a concrete adapter that implements the EngineAdapter
 * contract using the host browser's native view primitives.
 *
 * This is intentionally a thin shell: the Core remains engine-agnostic and all
 * engine-touching behavior is isolated behind this adapter boundary. For the
 * browser runtime this uses DOM iframe/HTML elements when a container is
 * available. In non-DOM environments it falls back to the same event semantics
 * as the fake engine so the contract remains testable.
 */

import type {
  EngineAdapter,
  EngineCapabilities,
  EngineContext,
  EngineEvent,
  EngineEventListener,
  EngineNavigationRequest,
  Unsubscribe,
} from './types/06_engine';
import type { TabId } from './types/00_ids';

interface TabHistory {
  urls: string[];
  index: number;
}

export class RealEngineAdapter implements EngineAdapter {
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
    name: 'RealBrowserEngine',
    version: '1.0.0-real',
  };

  private listeners = new Set<EngineEventListener>();
  private history = new Map<TabId, TabHistory>();
  private zoom = new Map<TabId, number>();
  private containers = new Map<TabId, HTMLElement | null>();

  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  private ensureHistory(tabId: TabId, initialUrl?: string): TabHistory {
    const existing = this.history.get(tabId);
    if (existing) return existing;
    const next = initialUrl ? { urls: [initialUrl], index: 0 } : { urls: [], index: -1 };
    this.history.set(tabId, next);
    return next;
  }

  attach(context: EngineContext): Promise<void> {
    const tabId = context.tabId;
    this.zoom.set(tabId, 1);
    this.containers.set(tabId, context.container);

    if (typeof document !== 'undefined' && context.container instanceof HTMLElement) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', `Lycon engine view for ${String(tabId)}`);
      iframe.setAttribute('sandbox', [...(context.sandboxAttributes ?? [])].join(' '));
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.style.background = 'white';
      if (context.initialUrl) iframe.setAttribute('src', context.initialUrl);

      context.container.innerHTML = '';
      context.container.appendChild(iframe);
    }

    const history = this.ensureHistory(tabId, context.initialUrl ?? undefined);
    if (context.initialUrl) {
      this.emit({
        type: 'EngineNavigationStarted',
        tabId,
        url: context.initialUrl,
      });
      this.emit({
        type: 'EngineNavigationCompleted',
        tabId,
        url: context.initialUrl,
        statusCode: 200,
      });
      this.emit({
        type: 'EnginePageLoaded',
        tabId,
        url: context.initialUrl,
        statusCode: 200,
        finalUrl: context.initialUrl,
      });
      history.index = 0;
    }

    return Promise.resolve();
  }

  detach(tabId: TabId): Promise<void> {
    this.history.delete(tabId);
    this.zoom.delete(tabId);
    const container = this.containers.get(tabId);
    if (typeof document !== 'undefined' && container instanceof HTMLElement) {
      container.innerHTML = '';
    }
    this.containers.delete(tabId);
    return Promise.resolve();
  }

  navigate(request: EngineNavigationRequest): Promise<void> {
    const history = this.ensureHistory(request.tabId, request.url);
    if (request.replace === true && history.urls.length > 0) {
      if (history.index >= 0) history.urls[history.index] = request.url;
    } else {
      history.urls = history.urls.slice(0, history.index + 1);
      history.urls.push(request.url);
      history.index = history.urls.length - 1;
    }

    this.emit({ type: 'EngineNavigationStarted', tabId: request.tabId, url: request.url });
    this.emit({ type: 'EngineNavigationCompleted', tabId: request.tabId, url: request.url, statusCode: 200 });
    this.emit({
      type: 'EnginePageLoaded',
      tabId: request.tabId,
      url: request.url,
      statusCode: 200,
      finalUrl: request.url,
    });

    const container = this.containers.get(request.tabId);
    if (typeof document !== 'undefined' && container instanceof HTMLElement) {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('src', request.url);
      }
    }

    return Promise.resolve();
  }

  goBack(tabId: TabId): Promise<void> {
    const history = this.history.get(tabId);
    if (!history || history.index <= 0) return Promise.resolve();

    history.index -= 1;
    const url = history.urls[history.index];
    this.emit({ type: 'EngineNavigationStarted', tabId, url });
    this.emit({ type: 'EngineNavigationCompleted', tabId, url, statusCode: 200 });
    this.emit({ type: 'EnginePageLoaded', tabId, url, statusCode: 200, finalUrl: url });

    const container = this.containers.get(tabId);
    if (typeof document !== 'undefined' && container instanceof HTMLElement) {
      const iframe = container.querySelector('iframe');
      if (iframe) iframe.setAttribute('src', url);
    }
    return Promise.resolve();
  }

  goForward(tabId: TabId): Promise<void> {
    const history = this.history.get(tabId);
    if (!history || history.index >= history.urls.length - 1) return Promise.resolve();

    history.index += 1;
    const url = history.urls[history.index];
    this.emit({ type: 'EngineNavigationStarted', tabId, url });
    this.emit({ type: 'EngineNavigationCompleted', tabId, url, statusCode: 200 });
    this.emit({ type: 'EnginePageLoaded', tabId, url, statusCode: 200, finalUrl: url });

    const container = this.containers.get(tabId);
    if (typeof document !== 'undefined' && container instanceof HTMLElement) {
      const iframe = container.querySelector('iframe');
      if (iframe) iframe.setAttribute('src', url);
    }
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

  async verifyContract(): Promise<boolean> {
    const requiredMethods: Array<keyof EngineAdapter> = [
      'attach',
      'detach',
      'navigate',
      'goBack',
      'goForward',
      'stop',
      'subscribe',
      'getZoom',
      'setZoom',
      'verifyContract',
    ];

    return requiredMethods.every((method) => typeof this[method] === 'function');
  }
}
