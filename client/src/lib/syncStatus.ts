export type SyncIndicatorKind = "off" | "syncing" | "synced" | "attention";

export function syncIndicatorKind(status: string, enabled: boolean): SyncIndicatorKind {
  if (!enabled || status === "Sync is off") return "off";
  if (/Saving|Checking/i.test(status)) return "syncing";
  if (/Synced|Merged/i.test(status)) return "synced";
  return "attention";
}
