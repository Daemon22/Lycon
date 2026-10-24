// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { syncNativeShields, listAgents, registerAgent, type Agent, type AgentRegisterInput } from "./platformCapabilities";

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

describe("native agent boundary", () => {
  afterEach(() => {
    delete window.__lyconNative;
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("invokes the Android bridge to list agents", async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    window.__lyconNative = { invoke };

    await expect(listAgents()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith("agents:list");
  });

  it("invokes the Tauri command to register an agent connector", async () => {
    const saved: Agent = {
      id: "agent-x",
      name: "demo",
      location: "local",
      protocol: "openai-chat",
      endpoint: "https://api.example.com",
      model: "gpt",
      enabled: true,
      contextScopes: ["selection"],
      createdAt: 1,
      updatedAt: 1,
    };
    const invoke = vi.fn().mockResolvedValue(saved);
    (window as Window & { __TAURI_INTERNALS__?: { invoke: typeof invoke } }).__TAURI_INTERNALS__ = { invoke };

    const input: AgentRegisterInput = { name: "demo", endpoint: "https://api.example.com", model: "gpt" };
    await expect(registerAgent(input)).resolves.toEqual(saved);
    expect(invoke).toHaveBeenCalledWith("agents_save", input);
  });

  it("does not fabricate native support in the browser", async () => {
    await expect(listAgents()).resolves.toEqual([]);
  });

  it("surfaces native failures to the caller", async () => {
    window.__lyconNative = {
      invoke: vi.fn().mockRejectedValue(new Error("native unavailable")),
    };

    await expect(listAgents()).rejects.toThrow("native unavailable");
  });
});
