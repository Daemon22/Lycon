import { describe, expect, it } from "vitest";
import { addTab, closeTab, reorderTabs, updateTab, type Tab } from "./tabOps";

const tabs: Tab[] = [
  { id: "a", title: "A", url: "/start" },
  { id: "b", title: "B", url: "/settings" },
];

describe("tabOps", () => {
  it("adds, updates, and closes without mutating the source", () => {
    expect(addTab(tabs, { id: "c", title: "C", url: "/history" })).toHaveLength(3);
    expect(updateTab(tabs, "a", { title: "Updated" })[0]?.title).toBe("Updated");
    expect(closeTab(tabs, "a")).toEqual([tabs[1]]);
    expect(tabs[0]?.title).toBe("A");
  });

  it("reorders tabs and rejects invalid indexes", () => {
    expect(reorderTabs(tabs, 0, 1).map(tab => tab.id)).toEqual(["b", "a"]);
    expect(() => reorderTabs(tabs, -1, 0)).toThrow(RangeError);
  });
});
