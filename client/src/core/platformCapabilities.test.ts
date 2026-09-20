// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { syncNativeShields } from "./platformCapabilities";

describe("native shield boundary", () => {
  afterEach(() => {
    delete window.__lyconNative;
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("invokes the Android bridge with the constitutional shield state", async () => {
    const invoke = vi.fn().mockResolvedValue({ enabled: false });
    window.__lyconNative = { invoke };

    await expect(syncNativeShields(false)).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("shields:toggle", { enabled: false });
  });

  it("invokes the Tauri command with native enforcement enabled", async () => {
    const invoke = vi.fn().mockResolvedValue({ enabled: true });
    (window as Window & {
      __TAURI_INTERNALS__?: { invoke: typeof invoke };
    }).__TAURI_INTERNALS__ = { invoke };

    await expect(syncNativeShields(true)).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("set_shields_state", {
      state: { enabled: true, https_only: true, tracker_blocking: true },
    });
  });

  it("does not fabricate native support in the browser", async () => {
    await expect(syncNativeShields(true)).resolves.toBe(false);
  });

  it("surfaces native failures to the caller", async () => {
    window.__lyconNative = {
      invoke: vi.fn().mockRejectedValue(new Error("native unavailable")),
    };

    await expect(syncNativeShields(true)).rejects.toThrow("native unavailable");
  });
});
