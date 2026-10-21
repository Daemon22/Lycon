import { describe, expect, it } from "vitest";
import { SOUTH_AFRICAN_ENGLISH, VOSK_CATALOG, getCatalogEntry, interpretSpeechAvailability, normalizeVoiceLanguage } from "./voice";

describe("Lycon voice catalog", () => {
  it("defines South African English with the standard en-ZA tag", () => {
    expect(SOUTH_AFRICAN_ENGLISH).toEqual({ label: "English (South Africa)", code: "en-ZA" });
    expect(normalizeVoiceLanguage()).toBe("en-ZA");
  });

  it("finds catalog entries case-insensitively", () => {
    expect(getCatalogEntry("EN-za")?.code).toBe("en-ZA");
    expect(getCatalogEntry("en-US")?.status).toBe("downloadable");
    expect(getCatalogEntry("zu-ZA")).toBeUndefined();
  });

  it("does not mislabel the South African browser profile as a downloadable Vosk model", () => {
    const entry = getCatalogEntry("en-ZA");
    expect(entry?.status).toBe("profile");
    expect(entry?.size).toBe("Browser profile");
    expect(VOSK_CATALOG.some((item) => item.status === "downloadable" && item.code === "en-ZA")).toBe(false);
  });
});

describe("SpeechRecognition availability", () => {
  it.each([
    ["available", "available"],
    [true, "available"],
    ["downloadable", "downloadable"],
    ["unavailable", "unavailable"],
    [false, "unavailable"],
    [undefined, "unknown"],
  ] as const)("interprets %s as %s", (value, expected) => {
    expect(interpretSpeechAvailability(value)).toBe(expected);
  });
});
