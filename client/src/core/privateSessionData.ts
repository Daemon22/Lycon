export interface PrivateHistorySource {
  readonly isPrivate: boolean;
  readonly history?: readonly { readonly url: string }[];
}

export function persistentTabs<T extends { readonly isPrivate: boolean }>(tabs: readonly T[]): T[] {
  return tabs.filter((tab) => tab.isPrivate === false);
}

export function privateTabHistoryUrls(tabs: readonly PrivateHistorySource[]): Set<string> {
  return new Set(
    tabs
      .filter((tab) => tab.isPrivate)
      .flatMap((tab) => tab.history?.map((page) => page.url) ?? []),
  );
}

export function historyWithoutPrivateTabPages<T extends { readonly url: string }>(
  entries: readonly T[],
  tabs: readonly PrivateHistorySource[],
): T[] {
  return historyWithoutPrivateUrls(entries, privateTabHistoryUrls(tabs));
}

export function historyWithoutPrivateUrls<T extends { readonly url: string }>(
  entries: readonly T[],
  privateUrls: ReadonlySet<string>,
): T[] {
  return entries.filter((entry) => !privateUrls.has(entry.url));
}

export function persistentSessionRecords<
  TTab extends PrivateHistorySource & { readonly isPrivate: boolean },
  THistory extends { readonly url: string },
  TBookmark extends { readonly url: string },
>(
  tabs: readonly TTab[],
  history: readonly THistory[],
  bookmarks: readonly TBookmark[],
  protectedUrls: ReadonlySet<string> = new Set(),
): { tabs: TTab[]; history: THistory[]; bookmarks: TBookmark[] } {
  const privateUrls = new Set([...protectedUrls, ...privateTabHistoryUrls(tabs)]);
  return {
    tabs: persistentTabs(tabs),
    history: historyWithoutPrivateUrls(history, privateUrls),
    bookmarks: bookmarks.filter((bookmark) => !privateUrls.has(bookmark.url)),
  };
}

export function writePersistentValue<T>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  value: T,
  normalize: (value: T) => T,
): void {
  storage.setItem(key, JSON.stringify(normalize(value)));
}
