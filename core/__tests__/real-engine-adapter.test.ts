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

    await expect(adapter.navigate({
      tabId: 'tb_real_2' as TabId,
      url: 'javascript:alert(1)',
      replace: false,
    })).rejects.toThrow('unsupported-engine-url-scheme');
    expect(iframe!.getAttribute('src')).toBe('https://example.com');

    await adapter.sealBoundary('tb_real_2' as TabId);
    expect(iframe!.getAttribute('src')).toBe('about:blank');

    // Back to a local page clears the src (reserved pages never go online).
    await adapter.goBack('tb_real_2' as TabId);
    expect(container.querySelector('iframe')!.hasAttribute('src')).toBe(false);

    // Detach clears the bound container and drops the surface.
    await adapter.detach('tb_real_2' as TabId);
    expect(container.querySelector('iframe')).toBeNull();
    container.remove();
  });

  it('keeps private local navigation local and rejects remote loads without profile isolation', async () => {
    const adapter = new RealEngineAdapter();
    const tabId = 'tb_private_real' as TabId;
    const container = document.createElement('div');
    document.body.appendChild(container);

    await adapter.attach({
      tabId,
      windowId: 'wn_private_real' as any,
      sessionId: 'ss_private_real' as any,
      effectiveCapabilities: ['CanNavigate', 'CanNetwork', 'CanAttachEngine'],
      thresholdState: 'open',
      initialUrl: 'about:start',
      container: null,
      sandboxAttributes: ['allow-scripts', 'allow-forms'],
      tabType: 'private',
      sessionMode: 'private',
    });
    await adapter.bindContainer(tabId, container);
    await adapter.navigate({ tabId, url: 'lycon://search?q=local', replace: false });

    expect(container.querySelector('iframe')?.hasAttribute('src')).toBe(false);
    await expect(adapter.navigate({ tabId, url: 'https://private.example', replace: false }))
      .rejects.toThrow('private-engine-isolation-unavailable');
    expect(container.querySelector('iframe')?.hasAttribute('src')).toBe(false);

    await adapter.detach(tabId);
    container.remove();
  });

  it('rejects inconsistent private tab and persistent session engine contexts', async () => {
    const adapter = new RealEngineAdapter();
    await expect(adapter.attach({
      tabId: 'tb_mismatch_real' as TabId,
      windowId: 'wn_mismatch_real' as any,
      sessionId: 'ss_mismatch_real' as any,
      effectiveCapabilities: ['CanNavigate'],
      thresholdState: 'sealed',
      initialUrl: 'about:start',
      container: null,
      sandboxAttributes: ['allow-scripts'],
      tabType: 'private',
      sessionMode: 'persistent',
    })).rejects.toThrow('tab-type-session-mode-mismatch');
  });
});
