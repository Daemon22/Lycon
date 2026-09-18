import { tabSchema } from "../../shared/validators";

export type Tab = {
  id: string | number;
  title: string;
  url: string;
  active?: boolean;
};

export function addTab(tabs: readonly Tab[], tab: Tab): Tab[] {
  return [...tabs, tabSchema.parse(tab)];
}

export function closeTab(tabs: readonly Tab[], id: Tab["id"]): Tab[] {
  return tabs.filter(tab => tab.id !== id);
}

export function updateTab(tabs: readonly Tab[], id: Tab["id"], patch: Partial<Tab>): Tab[] {
  return tabs.map(tab => tab.id === id ? tabSchema.parse({ ...tab, ...patch }) : tab);
}

export function reorderTabs(tabs: readonly Tab[], fromIndex: number, toIndex: number): Tab[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || toIndex < 0 || fromIndex >= tabs.length || toIndex >= tabs.length) {
    throw new RangeError("Tab indexes are out of range");
  }
  const result = [...tabs];
  const [tab] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, tab);
  return result;
}
