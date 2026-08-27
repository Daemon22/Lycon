import { describe, expect, it } from "vitest";
import { syncIndicatorKind } from "./syncStatus";

describe("syncIndicatorKind", () => {
  it("reports off when account sync is disabled", () => {
    expect(syncIndicatorKind("Synced just now", false)).toBe("off");
  });

  it("reports syncing while checking or saving", () => {
    expect(syncIndicatorKind("Checking account sync…", true)).toBe("syncing");
    expect(syncIndicatorKind("Saving to your account…", true)).toBe("syncing");
  });

  it("reports synced after a successful or merged snapshot", () => {
    expect(syncIndicatorKind("Synced just now", true)).toBe("synced");
    expect(syncIndicatorKind("Merged with your account", true)).toBe("synced");
  });

  it("reports attention for authentication and transport problems", () => {
    expect(syncIndicatorKind("Sign in to enable account sync", true)).toBe("attention");
    expect(syncIndicatorKind("Sync failed; local data remains active", true)).toBe("attention");
  });
});
