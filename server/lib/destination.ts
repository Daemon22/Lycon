export type ParsedDestination =
  | { kind: "local"; route: string; query?: string }
  | { kind: "search"; query: string }
  | { kind: "web"; url: string };

const LOCAL_ROUTES = new Set(["/", "/start", "/bookmarks", "/history", "/downloads", "/settings"]);

export function parseDestination(input: string): ParsedDestination {
  const value = input.trim();
  if (!value) throw new Error("Destination must not be empty");

  if (value.startsWith("/")) {
    const url = new URL(value, "http://lycon.local");
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) throw new Error("Search destination must include a query");
      return { kind: "search", query };
    }
    if (!LOCAL_ROUTES.has(url.pathname)) throw new Error(`Unknown local destination: ${url.pathname}`);
    return { kind: "local", route: url.pathname, ...(url.search ? { query: url.search.slice(1) } : {}) };
  }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported destination protocol");
    return { kind: "web", url: url.toString() };
  } catch {
    return { kind: "search", query: value };
  }
}
