// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import * as React from 'react';

const mocks = vi.hoisted(() => ({
  syncEnabledValues: [] as boolean[],
  syncPut: vi.fn(),
  listAgents: vi.fn(async () => []),
  nativeAction: vi.fn(async () => undefined),
}));

vi.mock('@/_core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1 }, loading: false, error: null, isAuthenticated: true, logout: vi.fn() }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    sync: {
      get: {
        useQuery: (_input: unknown, options: { enabled: boolean }) => {
          mocks.syncEnabledValues.push(options.enabled);
          return { data: undefined, error: null, isLoading: true };
        },
      },
      put: { useMutation: () => ({ mutate: mocks.syncPut }) },
    },
  },
}));

vi.mock('@/core/platformCapabilities', () => ({
  syncNativeShields: mocks.nativeAction,
  listAgents: mocks.listAgents,
  registerAgent: mocks.nativeAction,
  unregisterAgent: mocks.nativeAction,
}));

vi.mock('@/const', () => ({ startLogin: vi.fn() }));

import Home from './Home';

configure({ asyncUtilTimeout: 15000 });

describe('Home private-session flow', () => {
  let storedValues: Map<string, string>;
  let storage: Storage;

  beforeEach(() => {
    vi.stubGlobal('React', React);
    storedValues = new Map();
    storage = {
      get length() { return storedValues.size; },
      clear: () => storedValues.clear(),
      getItem: (key) => storedValues.get(key) ?? null,
      key: (index) => [...storedValues.keys()][index] ?? null,
      removeItem: (key) => { storedValues.delete(key); },
      setItem: (key, value) => { storedValues.set(key, String(value)); },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    mocks.syncEnabledValues.length = 0;
    mocks.syncPut.mockClear();
    mocks.listAgents.mockClear();
    mocks.nativeAction.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    configure({ asyncUtilTimeout: 1000 });
  });

  it('creates a private Core session without persisting its tab or navigation', async () => {
    window.localStorage.setItem('lycon-settings', JSON.stringify({
      theme: 'dark',
      displayMode: 'auto',
      desktopSite: false,
      shieldsEnabled: true,
      startupView: 'start',
      microphonePermission: 'ask',
      locationPermission: 'ask',
      voiceMode: 'online',
      voiceLanguage: 'en-ZA',
      syncEnabled: true,
    }));

    render(createElement(Home));
    await waitFor(() => expect((window as Window & { __lycon?: unknown }).__lycon).toBeTruthy());
    await waitFor(() => expect(mocks.syncEnabledValues.at(-1)).toBe(true));
    await waitFor(() => expect(window.localStorage.getItem('lycon-active-tab')).not.toBeNull());
    const persistentActiveTabId = JSON.parse(window.localStorage.getItem('lycon-active-tab')!);

    fireEvent.click(screen.getByRole('button', { name: 'More browser actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /New private tab/ }));
    await screen.findByText(/Private · Start/);

    const address = screen.getByRole('textbox', { name: 'Address and search' });
    fireEvent.change(address, { target: { value: 'private-session-marker' } });
    fireEvent.submit(address.closest('form')!);
    await screen.findByRole('heading', { name: /Results for/ });
    await waitFor(() => expect(window.localStorage.getItem('lycon-tabs')).not.toContain('private-session-marker'));

    const persistedValues = Array.from({ length: window.localStorage.length }, (_, index) => {
      const key = window.localStorage.key(index);
      return key ? window.localStorage.getItem(key) : null;
    }).join('\n');
    expect(persistedValues).not.toContain('private-session-marker');
    expect(mocks.syncEnabledValues.at(-1)).toBe(false);
    expect(mocks.syncPut).not.toHaveBeenCalled();
    const tabs = JSON.parse(window.localStorage.getItem('lycon-tabs') ?? '[]') as Array<{ isPrivate: boolean }>;
    expect(tabs.every((tab) => !tab.isPrivate)).toBe(true);

    fireEvent(window, new Event('offline'));
    fireEvent(window, new Event('online'));
    expect(mocks.syncEnabledValues.at(-1)).toBe(false);
    expect(mocks.syncPut).not.toHaveBeenCalled();
    expect(Array.from({ length: window.localStorage.length }, (_, index) => {
      const key = window.localStorage.key(index);
      return key ? window.localStorage.getItem(key) : null;
    }).join('\n')).not.toContain('private-session-marker');

    fireEvent.click(screen.getByRole('button', { name: /Close Search: private-session-marker/ }));
    await waitFor(() => expect(screen.queryByText(/Private ·/)).toBeNull());
    expect(JSON.parse(window.localStorage.getItem('lycon-active-tab')!)).toBe(persistentActiveTabId);
  }, 90000);
});
