export type VoiceAvailability = "available" | "downloadable" | "unavailable" | "unknown";

export type VoskCatalogEntry = {
  id: string;
  label: string;
  code: string;
  size: string;
  status: "profile" | "downloadable";
};

export const SOUTH_AFRICAN_ENGLISH = {
  label: "English (South Africa)",
  code: "en-ZA",
};

export const VOSK_CATALOG: VoskCatalogEntry[] = [
  { id: "en-ZA-profile", label: SOUTH_AFRICAN_ENGLISH.label, code: SOUTH_AFRICAN_ENGLISH.code, size: "Browser profile", status: "profile" },
  { id: "en-US-small", label: "English (US) · small", code: "en-US", size: "40 MB", status: "downloadable" },
];

export function normalizeVoiceLanguage(value?: string | null): string {
  return value?.trim() || SOUTH_AFRICAN_ENGLISH.code;
}

export function interpretSpeechAvailability(value: unknown): VoiceAvailability {
  if (value === "available" || value === true) return "available";
  if (value === "downloadable") return "downloadable";
  if (value === "unavailable" || value === false) return "unavailable";
  return "unknown";
}

export function getCatalogEntry(code: string): VoskCatalogEntry | undefined {
  return VOSK_CATALOG.find((entry) => entry.code.toLowerCase() === code.toLowerCase());
}
