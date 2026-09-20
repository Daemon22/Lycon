// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { RealEngineAdapter } from '../RealEngineAdapter';
import type { TabId } from '../types/00_ids';

describe('RealEngineAdapter', () => {
  it('conforms to the EngineAdapter contract and emits navigation events', async () => {
    const adapter = new RealEngineAdapter();
    const seen: string[] = [];

    adapter.subscribe((event) => {
      seen.push(event.type);
    });

    await adapter.attach({
      tabId: 'tb_real_1' as TabId,
      windowId: 'wn_real_1' as any,
      sessionId: 'ss_real_1' as any,
      effectiveCapabilities: ['CanNavigate', 'CanNetwork', 'CanAttachEngine'],
      thresholdState: 'open',
      initialUrl: 'https://example.com',
      container: null,
      sandboxAttributes: ['allow-scripts'],
      tabType: 'normal',
      sessionMode: 'persistent',
    });

    await adapter.navigate({
      tabId: 'tb_real_1' as TabId,
      url: 'https://example.com/about',
      replace: false,
    });

    expect(adapter.capabilities.name).toMatch(/real|browser|dom/i);
    await expect(adapter.verifyContract()).resolves.toBe(true);
    expect(seen).toContain('EngineNavigationStarted');
    expect(seen).toContain('EngineNavigationCompleted');
  });

  it('renders and drives an engine iframe inside a container bound via bindContainer', async () => {
    const adapter = new RealEngineAdapter();
    const container = document.createElement('div');
    document.body.appendChild(container);

    await adapter.attach({
      tabId: 'tb_real_2' as TabId,
      windowId: 'wn_real_2' as any,
      sessionId: 'ss_real_2' as any,
      effectiveCapabilities: ['CanNavigate', 'CanNetwork', 'CanAttachEngine'],
      thresholdState: 'open',
      initialUrl: 'about:start',
      container: null,
      sandboxAttributes: ['allow-scripts'],
      tabType: 'normal',
      sessionMode: 'persistent',
    });

    // No container bound yet → no iframe.
    expect(container.querySelector('iframe')).toBeNull();

    await adapter.bindContainer('tb_real_2' as TabId, container);
    // Bound but still on a local/reserved page → blank surface (no src).
    let iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.hasAttribute('src')).toBe(false);

    await adapter.navigate({ tabId: 'tb_real_2' as TabId, url: 'https://example.com', replace: false });
    iframe = container.querySelector('iframe');
    expect(iframe!.getAttribute('src')).toBe('https://example.com');

    // Back to a local page clears the src (reserved pages never go online).
    await adapter.goBack('tb_real_2' as TabId);
    expect(container.querySelector('iframe')!.hasAttribute('src')).toBe(false);

    // Detach clears the bound container and drops the surface.
    await adapter.detach('tb_real_2' as TabId);
    expect(container.querySelector('iframe')).toBeNull();
    container.remove();
  });
});
