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
});
