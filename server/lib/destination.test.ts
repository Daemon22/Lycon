import { describe, expect, it } from "vitest";
import { parseDestination } from "./destination";

describe("parseDestination", () => {
  it("recognizes local routes and query strings", () => {
    expect(parseDestination("/search?q=privacy")).toEqual({ kind: "search", query: "privacy" });
    expect(parseDestination("/settings")).toEqual({ kind: "local", route: "/settings" });
  });

  it("normalizes web destinations", () => {
    expect(parseDestination("example.com")).toEqual({ kind: "web", url: "https://example.com/" });
    expect(parseDestination("http://localhost:3000")).toEqual({ kind: "web", url: "http://localhost:3000/" });
  });

  it("treats ordinary text as a search", () => {
    expect(parseDestination("privacy settings")).toEqual({ kind: "search", query: "privacy settings" });
  });
});
