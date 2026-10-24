import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { getSnapshot, saveSnapshot } = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
}));

vi.mock("./db", () => ({
  getBrowserSyncSnapshot: getSnapshot,
  saveBrowserSyncSnapshot: saveSnapshot,
}));

const context = (user: TrpcContext["user"] = {
  id: 7, openId: "user", name: "User", email: null, loginMethod: null, role: "user",
  createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
}): TrpcContext => ({
  user,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("sync router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the authenticated user's snapshot", async () => {
    getSnapshot.mockResolvedValue({ revision: 3, payload: '{"tabs":[]}', updatedAt: new Date() });
    const result = await appRouter.createCaller(context()).sync.get();
    expect(getSnapshot).toHaveBeenCalledWith(7);
    expect(result?.revision).toBe(3);
  });

  it("writes validated snapshots and returns the DB result", async () => {
    saveSnapshot.mockResolvedValue({ ok: true, revision: 4 });
    await expect(appRouter.createCaller(context()).sync.put({
      baseRevision: 3, payload: '{"tabs":[]}',
    })).resolves.toEqual({ ok: true, revision: 4 });
    expect(saveSnapshot).toHaveBeenCalledWith(7, 3, '{"tabs":[]}');
  });

  it("rejects invalid payloads before reaching the DB", async () => {
    await expect(appRouter.createCaller(context()).sync.put({
      baseRevision: -1, payload: "{}",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveSnapshot).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    await expect(appRouter.createCaller(context(null)).sync.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
