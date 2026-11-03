import { describe, expect, it } from 'vitest';
import { historyWithoutPrivateTabPages, persistentSessionRecords, persistentTabs, writePersistentValue } from './privateSessionData';

describe('private session data boundaries', () => {
  it('keeps private tabs out of persisted collections', () => {
    const tabs = [
      { id: 'normal', isPrivate: false },
      { id: 'private', isPrivate: true },
    ];

    expect(persistentTabs(tabs)).toEqual([{ id: 'normal', isPrivate: false }]);
  });

  it('removes legacy history records represented by a private tab history', () => {
    const tabs = [
      { isPrivate: false, history: [{ url: 'https://ordinary.example' }] },
      { isPrivate: true, history: [{ url: 'lycon://search?q=private-query' }] },
    ];
    const history = [
      { id: 'ordinary', url: 'https://ordinary.example' },
      { id: 'private', url: 'lycon://search?q=private-query' },
    ];

    expect(historyWithoutPrivateTabPages(history, tabs)).toEqual([history[0]]);
  });

  it('writes only persistent tabs to browser storage', () => {
    const writes: string[] = [];
    const storage = { setItem: (_key: string, value: string) => writes.push(value) };
    const tabs = [
      { id: 'normal', isPrivate: false },
      { id: 'private', isPrivate: true },
    ];

    writePersistentValue(storage, 'lycon-tabs', tabs, (value) => persistentTabs(value));

    expect(JSON.parse(writes[0])).toEqual([{ id: 'normal', isPrivate: false }]);
  });

  it('projects private pages out of serialized history, bookmarks, and tabs', () => {
    const privateUrl = 'https://private.example/path?q=secret';
    const projected = persistentSessionRecords(
      [
        { id: 'normal', isPrivate: false, history: [{ url: 'https://ordinary.example' }] },
        { id: 'private', isPrivate: true, history: [{ url: privateUrl }] },
      ],
      [{ id: 'public-history', url: 'https://ordinary.example' }, { id: 'private-history', url: privateUrl }],
      [{ id: 'public-bookmark', url: 'https://ordinary.example' }, { id: 'private-bookmark', url: privateUrl }],
    );

    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain(privateUrl);
    expect(projected.tabs.map((tab) => tab.id)).toEqual(['normal']);
    expect(projected.history.map((entry) => entry.id)).toEqual(['public-history']);
    expect(projected.bookmarks.map((bookmark) => bookmark.id)).toEqual(['public-bookmark']);
  });
});
