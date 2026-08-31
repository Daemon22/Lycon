import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

let snapshot: { revision: number; payload: string } | undefined;
let persistenceFailure = false;

vi.mock("./db", () => ({
  getLibrarySnapshot: vi.fn(async () => snapshot && { id: 1, userId: 987654, ...snapshot, createdAt: new Date(), updatedAt: new Date() }),
  putLibrarySnapshot: vi.fn(async (userId: number, payload: string, baseRevision: number) => {
    if (persistenceFailure) throw new Error("Database is not available");
    if (snapshot && snapshot.revision !== baseRevision) {
      return { ok: false as const, conflict: snapshot };
    }
    snapshot = { revision: (snapshot?.revision ?? 0) + 1, payload };
    return { ok: true as const, revision: snapshot.revision };
  }),
}));

function createContext(): TrpcContext {
  return {
    user: {
      id: 987654,
      openId: "library-test-user",
      name: "Library Test",
      email: "library@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("library snapshots", () => {
  it("round-trips the complete authenticated library payload and detects stale writes", async () => {
    snapshot = undefined;
    persistenceFailure = false;
    const caller = appRouter.createCaller(createContext());
    const payload = JSON.stringify({
      version: 1,
      bookmarks: [{ id: "bookmark-1", title: "Saved field note", url: "lycon://search?q=field" }],
      history: [{ id: "history-1", title: "History item", url: "lycon://history", visited: "Now", visitedAt: Date.now() }],
      downloads: [{ id: "download-1", name: "field.json", size: "2 KB", status: "ready" }],
      tabs: [{ id: 1, title: "Start", url: "lycon://start", isPrivate: false, history: [], historyIndex: 0 }],
      activeTabId: 1,
      settings: { syncEnabled: true, theme: "dark" },
    });

    const saved = await caller.library.put({ baseRevision: 0, payload });
    expect(saved).toEqual({ ok: true, revision: 1 });

    const loaded = await caller.library.get();
    expect(loaded).toEqual({ revision: 1, payload });

    const staleWrite = await caller.library.put({ baseRevision: 0, payload: JSON.stringify({ version: 1, bookmarks: [] }) });
    expect(staleWrite.ok).toBe(false);
    if (!staleWrite.ok) expect(staleWrite.conflict.payload).toBe(payload);
  });

  it("surfaces persistence failures to the caller", async () => {
    snapshot = undefined;
    persistenceFailure = true;
    const caller = appRouter.createCaller(createContext());
    await expect(caller.library.put({ baseRevision: 0, payload: JSON.stringify({ version: 1 }) })).rejects.toThrow("Database is not available");
    persistenceFailure = false;
  });
});
