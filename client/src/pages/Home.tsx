// Design system: Quiet Field Instrument — the sidebar owns state and library information; the hero stays focused on browsing, voice input, and deliberate handoff.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import html2canvas from "html2canvas";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CircleDot,
  ChevronRight,
  Download,
  ExternalLink,
  FilePlus2,
  FolderDown,
  Globe2,
  History,
  Home as HomeIcon,
  LockKeyhole,
  Mic,
  Minus,
  Printer,
  Languages,
  Puzzle,
  KeyRound,
  Camera,
  HelpCircle,
  MoreHorizontal,
  AppWindow,
  Layers3,
  Palette,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  FileJson,
  Trash2,
  WifiOff,
  X,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

type View = "start" | "search" | "bookmarks" | "history" | "downloads" | "settings" | "online";
type Theme = "light" | "dark";
type PageKind = "local" | "online" | "search" | "file";
type SettingsSection = "appearance" | "privacy" | "search" | "permissions" | "tabs" | "extensions" | "passwords" | "translate" | "tools" | "help";

type Tab = {
  id: number;
  title: string;
  favicon?: string;
  isPrivate: boolean;
  history: PageRecord[];
  historyIndex: number;
};

type PageRecord = {
  title: string;
  url: string;
  kind: PageKind;
  view?: View;
  query?: string;
  favicon?: string;
};

type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  kind: PageKind;
  savedAt?: number;
};

type HistoryItem = PageRecord & { id: string; visited: string; visitedAt?: number };

type DownloadItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  added: string;
  addedAt?: number;
  content: string;
};

type BackupPayload = {
  format: "lycon-local-backup";
  version: 1;
  exportedAt: string;
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  downloads: DownloadItem[];
};

type ConfirmAction = { title: string; copy: string; confirmLabel: string; onConfirm: () => void } | null;

type SettingsState = {
  theme: Theme;
  shieldsEnabled: boolean;
  startupView: "start" | "last";
  microphonePermission: "ask" | "allow" | "block";
  locationPermission: "ask" | "block";
};

const initialHistory: HistoryItem[] = [
  { id: "history-1", title: "Lycon Start", url: "lycon://start", kind: "local", view: "start", visited: "Now", visitedAt: Date.now() },
  { id: "history-2", title: "Bookmarks", url: "lycon://bookmarks", kind: "local", view: "bookmarks", visited: "Today", visitedAt: Date.now() - 1000 * 60 * 60 * 4 },
  { id: "history-3", title: "Example Domain", url: "https://example.com", kind: "online", visited: "Yesterday", visitedAt: Date.now() - 1000 * 60 * 60 * 26 },
];

const initialTabs: Tab[] = [  { id: 1, title: "Start", isPrivate: false, favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png", history: [{ title: "Start", url: "lycon://start", kind: "local", view: "start", favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png" }], historyIndex: 0 }];

const defaultSettings: SettingsState = {
  theme: "dark",
  shieldsEnabled: true,
  startupView: "start",
  microphonePermission: "ask",
  locationPermission: "ask",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersistedState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback));
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing can reject storage */ }
  }, [key, value]);
  return [value, setValue] as const;
}

function viewFromPath(pathname: string): View {
  const path = pathname.replace(/^\//, "").toLowerCase();
  if (["search", "bookmarks", "history", "downloads", "settings", "online"].includes(path)) return path as View;
  return "start";
}

function routePath(view: View) {
  return view === "start" ? "/" : `/${view}`;
}

function addressForPage(page: PageRecord) {
  return page.kind === "local" || page.kind === "search" ? page.query ?? "" : page.url;
}

function createDestination(value: string): PageRecord {
  const trimmed = value.trim();
  const localRoutes: Record<string, View> = {
    start: "start",
    "lycon://start": "start",
    bookmarks: "bookmarks",
    "lycon://bookmarks": "bookmarks",
    history: "history",
    "lycon://history": "history",
    downloads: "downloads",
    "lycon://downloads": "downloads",
    settings: "settings",
    "lycon://settings": "settings",
  };
  const normalized = trimmed.toLowerCase().replace(/^\//, "");
  if (localRoutes[normalized]) return { title: normalized, url: `lycon://${normalized}`, kind: "local", view: localRoutes[normalized], favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png" };
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    const url = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
    const domain = url.replace(/^https?:\/\//, "").split("/")[0];
    return { title: domain, url, kind: "online", favicon: `https://${domain}/favicon.ico` };
  }
  return { title: `Search: ${trimmed}`, url: `lycon://search?q=${encodeURIComponent(trimmed)}`, kind: "search", view: "search", query: trimmed, favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png" };
}

export default function Home() {
  const [settings, setSettings] = usePersistedState<SettingsState>("lycon-settings", defaultSettings);
  const [bookmarks, setBookmarks] = usePersistedState<BookmarkItem[]>("lycon-bookmarks", []);
  const [historyEntries, setHistoryEntries] = usePersistedState<HistoryItem[]>("lycon-history", initialHistory);
  const [downloads, setDownloads] = usePersistedState<DownloadItem[]>("lycon-downloads", readDownloads());
  const [tabs, setTabs] = usePersistedState<Tab[]>("lycon-tabs", initialTabs);
  const [activeTabId, setActiveTabId] = usePersistedState<number>("lycon-active-tab", 1);
  const [currentView, setCurrentView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [activePage, setActivePage] = useState<PageRecord>({ title: "Start", url: "lycon://start", kind: "local", view: "start" });
  const [address, setAddress] = useState("");
  const [onlineOpened, setOnlineOpened] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const [toast, setToast] = useState("");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<number | null>(null);
  const [pressingTabId, setPressingTabId] = useState<number | null>(null);
  const tabPointerRef = useRef<{ id: number; moved: boolean; touch: boolean } | null>(null);
  const tabLongPressRef = useRef<number | null>(null);
  const suppressTabClickRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const overflowShellRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const shellState = activeTab?.isPrivate ? "private" : activePage.kind === "online" ? "online" : "local";
  const isBookmarked = bookmarks.some((bookmark) => bookmark.url === activePage.url);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    try { window.localStorage.setItem("lycon-active-tab", JSON.stringify(activeTabId)); } catch { /* storage can be unavailable */ }
  }, [activeTabId]);

  useEffect(() => {
    const restoredTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
    if (!restoredTab) return;
    const restoredPage = restoredTab.history[restoredTab.historyIndex] ?? restoredTab.history[0];
    if (!restoredPage) return;
    setCurrentView(restoredPage.view ?? "online");
    setActivePage(restoredPage);
    setAddress(addressForPage(restoredPage));
    window.history.replaceState({}, "", routePath(restoredPage.view ?? "online"));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const view = viewFromPath(window.location.pathname);
      setCurrentView(view);
      if (view !== "online") {
        setActivePage({ title: view === "start" ? "Start" : view[0].toUpperCase() + view.slice(1), url: `lycon://${view}`, kind: "local", view });
        setAddress("");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const updateTab = (patch: Partial<Tab>) => {
    setTabs((previous) => previous.map((tab) => tab.id === activeTabId ? { ...tab, ...patch } : tab));
  };

  const navigateTo = (destination: PageRecord) => {
    const nextView = destination.view ?? "online";
    setOverflowOpen(false);
    setCurrentView(nextView);
    window.history.pushState({}, "", routePath(nextView));
    setActivePage(destination);
    setAddress(addressForPage(destination));
    setOnlineOpened(false);
    const nextHistory = [...(activeTab?.history ?? []), destination];
    updateTab({ title: destination.title, favicon: destination.favicon, history: nextHistory, historyIndex: nextHistory.length - 1 });
    const nextHistoryEntry: HistoryItem = { ...destination, id: `history-${Date.now()}`, visited: "Just now", visitedAt: Date.now() };
    setHistoryEntries((previous) => [nextHistoryEntry, ...previous.filter((item) => item.url !== destination.url)].slice(0, 50));
  };

  const navigateView = (view: View) => {
    const titles: Record<View, string> = { start: "Start", search: "Lycon Search", bookmarks: "Bookmarks", history: "History", downloads: "Downloads", settings: "Settings", online: activePage.title };
    navigateTo({ title: titles[view], url: `lycon://${view}`, kind: view === "online" ? activePage.kind : "local", view });
  };

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (address.trim()) navigateTo(createDestination(address));
  };

  const navigateBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const nextIndex = activeTab.historyIndex - 1;
    const destination = activeTab.history[nextIndex];
    updateTab({ historyIndex: nextIndex, title: destination.title, favicon: destination.favicon });
    setCurrentView(destination.view ?? "online");
    window.history.replaceState({}, "", routePath(destination.view ?? "online"));
    setActivePage(destination);
    setAddress(addressForPage(destination));
  };

  const navigateForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIndex = activeTab.historyIndex + 1;
    const destination = activeTab.history[nextIndex];
    updateTab({ historyIndex: nextIndex, title: destination.title, favicon: destination.favicon });
    setCurrentView(destination.view ?? "online");
    window.history.replaceState({}, "", routePath(destination.view ?? "online"));
    setActivePage(destination);
    setAddress(addressForPage(destination));
  };

  const newPrivateTab = () => {
    const id = Date.now();
    const startPage: PageRecord = { title: "Start", url: "lycon://start", kind: "local", view: "start", favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png" };
    setTabs((previous) => [...previous, { id, title: "Private", isPrivate: true, favicon: startPage.favicon, history: [startPage], historyIndex: 0 }]);
    setActiveTabId(id);
    setCurrentView("start");
    window.history.pushState({}, "", "/");
    setActivePage({ title: "Start", url: "lycon://start", kind: "local", view: "start" });
    setAddress("");
    showToast("Private tab opened");
  };

  const newTab = () => {
    const id = Date.now();
    const startPage: PageRecord = { title: "Start", url: "lycon://start", kind: "local", view: "start", favicon: "/manus-storage/lycon-canonical-logo_647e2a05.png" };
    setTabs((previous) => [...previous, { id, title: "Start", isPrivate: false, favicon: startPage.favicon, history: [startPage], historyIndex: 0 }]);
    setActiveTabId(id);
    setCurrentView("start");
    window.history.pushState({}, "", "/");
    setActivePage({ title: "Start", url: "lycon://start", kind: "local", view: "start" });
    setAddress("");
  };

  const closeTab = (id: number) => {
    if (tabs.length === 1) { showToast("Lycon keeps one tab open"); return; }
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[remaining.length - 1].id);
  };

  const togglePrivate = () => {
    updateTab({ isPrivate: !activeTab?.isPrivate });
    showToast(activeTab?.isPrivate ? "Private mode off" : "Private mode on");
  };

  const toggleBookmark = () => {
    if (activePage.kind === "local") { showToast("Local views are already in your field kit"); return; }
    if (isBookmarked) {
      setBookmarks((previous) => previous.filter((bookmark) => bookmark.url !== activePage.url));
      showToast("Bookmark removed");
    } else {
      setBookmarks((previous) => [...previous, { id: `bookmark-${Date.now()}`, title: activePage.title, url: activePage.url, kind: activePage.kind, savedAt: Date.now() }]);
      showToast("Saved to bookmarks");
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const textLike = file.type.startsWith("text/") || ["md", "markdown", "txt", "csv", "json", "html", "htm", "xml", "svg", "log"].includes(extension);
    let content = "";
    if (textLike && file.size <= 2_000_000) {
      try { content = (await file.text()).slice(0, 120_000); } catch { content = ""; }
    }
    const item: DownloadItem = { id: `download-${Date.now()}`, name: file.name, type: file.type || extension.toUpperCase() || "Local file", size: file.size, added: "Just now", addedAt: Date.now(), content };
    setDownloads((previous) => [item, ...previous].slice(0, 100));
    showToast(`${file.name} added to downloads${content ? " and indexed" : ""}`);
    event.target.value = "";
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((previous) => ({ ...previous, [key]: value }));
  const openSettingsSection = (section: SettingsSection) => { setSettingsSection(section); navigateTo({ title: "Settings", url: "lycon://settings", kind: "local", view: "settings" }); };
  const clearBrowsingData = () => { setHistoryEntries([]); setDownloads([]); showToast("History and downloads cleared"); setOverflowOpen(false); };
  const changeZoom = (delta: number) => setZoomLevel((value) => Math.min(150, Math.max(70, value + delta)));
  const resetZoom = () => setZoomLevel(100);
  const printCurrentPage = () => { window.print(); setOverflowOpen(false); };
  const findOnPage = () => { setOverflowOpen(false); addressInputRef.current?.focus(); addressInputRef.current?.select(); showToast("Type a term in the toolbar to search the local page index"); };
  const showUnsupported = (label: string) => { setOverflowOpen(false); showToast(`${label} is not available in this local web shell yet`); };
  const openNewWindow = () => { const opened = window.open(window.location.href, "_blank", "noopener,noreferrer"); if (!opened) showToast("Your browser blocked the new Lycon window"); else showToast("New Lycon window opened"); setOverflowOpen(false); };
  const captureLocalScreenshot = async () => {
    setOverflowOpen(false);
    setScreenshotBusy(true);
    showToast("Capturing local page snapshot…");
    try {
      const target = document.querySelector(".lycon-main") as HTMLElement | null;
      if (!target) throw new Error("Page surface unavailable");
      const canvas = await html2canvas(target, { backgroundColor: null, useCORS: true, allowTaint: false, logging: false, scale: Math.min(2, window.devicePixelRatio || 1) });
      const link = document.createElement("a");
      link.download = `lycon-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Local PNG snapshot saved");
    } catch {
      showToast("Snapshot could not be created for this page");
    } finally {
      setScreenshotBusy(false);
    }
  };

  useEffect(() => {
    if (!overflowOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => { if (!overflowShellRef.current?.contains(event.target as Node)) setOverflowOpen(false); };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [overflowOpen]);

  const moveTab = (tabId: number, targetIndex: number) => setTabs((previous) => { const currentIndex = previous.findIndex((tab) => tab.id === tabId); if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previous.length || currentIndex === targetIndex) return previous; const next = [...previous]; const [moved] = next.splice(currentIndex, 1); next.splice(targetIndex, 0, moved); return next; });
  const reorderTab = (tabId: number, targetId: number) => { const targetIndex = tabs.findIndex((tab) => tab.id === targetId); moveTab(tabId, targetIndex); setDraggingTabId(null); };
  const handleTabPointerDown = (event: React.PointerEvent<HTMLButtonElement>, tabId: number) => { if (event.button !== 0) return; const touch = event.pointerType !== "mouse"; tabPointerRef.current = { id: tabId, moved: false, touch }; if (touch) { setPressingTabId(tabId); tabLongPressRef.current = window.setTimeout(() => { setDraggingTabId(tabId); if ("vibrate" in navigator) navigator.vibrate?.(18); }, 420); } event.currentTarget.setPointerCapture?.(event.pointerId); };
  const handleTabPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => { const pointer = tabPointerRef.current; if (!pointer) return; if (Math.abs(event.movementX) + Math.abs(event.movementY) > 3) { pointer.moved = true; if (pointer.touch && draggingTabId === pointer.id) suppressTabClickRef.current = true; } if (pointer.touch && draggingTabId !== pointer.id) return; if (!pointer.moved) return; setPressingTabId(null); setDraggingTabId(pointer.id); const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-tab-id]"); const targetId = element ? Number(element.dataset.tabId) : null; if (targetId && targetId !== pointer.id) reorderTab(pointer.id, targetId); };
  const handleTabPointerUp = () => { if (tabLongPressRef.current) window.clearTimeout(tabLongPressRef.current); tabLongPressRef.current = null; tabPointerRef.current = null; setPressingTabId(null); setDraggingTabId(null); };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "t") { event.preventDefault(); newTab(); }
      else if (key === "n" && event.shiftKey) { event.preventDefault(); newPrivateTab(); }
      else if (key === "w") { event.preventDefault(); closeTab(activeTabId); }
      else if (key === "l") { event.preventDefault(); addressInputRef.current?.focus(); addressInputRef.current?.select(); }
      else if (key === "f") { event.preventDefault(); findOnPage(); }
      else if (key === "p") { event.preventDefault(); printCurrentPage(); }
      else if (key === "h") { event.preventDefault(); navigateView("history"); }
      else if (key === "j") { event.preventDefault(); navigateView("downloads"); }
      else if (key === "o" && event.shiftKey) { event.preventDefault(); navigateView("bookmarks"); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeTabId, tabs.length]);

  const requestClearBrowsingData = () => setConfirmAction({ title: "Clear browsing data?", copy: "This removes local history and downloaded document records from Lycon. Saved pages and settings stay untouched.", confirmLabel: "Clear local data", onConfirm: clearBrowsingData });
  const requestRemoveBookmark = (id: string) => { const item = bookmarks.find((bookmark) => bookmark.id === id); if (!item) return; setConfirmAction({ title: "Delete saved page?", copy: `Remove “${item.title}” from your local saved pages? This cannot be undone from Lycon.`, confirmLabel: "Delete saved page", onConfirm: () => { setBookmarks((previous) => previous.filter((bookmark) => bookmark.id !== id)); showToast("Saved page deleted"); } }); };
  const exportLocalData = () => { const payload: BackupPayload = { format: "lycon-local-backup", version: 1, exportedAt: new Date().toISOString(), bookmarks, history: historyEntries, downloads }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `lycon-local-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); showToast("Local backup exported"); };
  const importLocalData = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { const parsed = JSON.parse(await file.text()) as Partial<BackupPayload>; if (parsed.format !== "lycon-local-backup" || parsed.version !== 1) throw new Error("Unsupported backup"); const importedBookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks.filter(isBookmarkItem) : []; const importedHistory = Array.isArray(parsed.history) ? parsed.history.filter(isHistoryItem) : []; const importedDownloads = Array.isArray(parsed.downloads) ? parsed.downloads.filter(isDownloadItem) : []; setBookmarks((previous) => mergeById(previous, importedBookmarks)); setHistoryEntries((previous) => mergeById(previous, importedHistory).slice(0, 50)); setDownloads((previous) => mergeById(previous, importedDownloads).slice(0, 100)); showToast(`Imported ${importedBookmarks.length} saved pages and ${importedDownloads.length} documents`); } catch { showToast("That file is not a Lycon local backup"); } };

  return (
    <div className="lycon-app" style={{ "--lycon-zoom": `${zoomLevel / 100}` } as CSSProperties}>
      <main className="lycon-main">
        <div className="tab-strip">
          <button className="home-mark" onClick={() => navigateView("start")} aria-label="Home"><img src="/manus-storage/lycon-canonical-logo_647e2a05.png" alt="" /></button>
          <div className="tabs">
            {tabs.map((tab) => <button key={tab.id} data-tab-id={tab.id} className={`tab ${tab.id === activeTabId ? "active" : ""} ${draggingTabId === tab.id ? "dragging" : ""} ${pressingTabId === tab.id ? "long-pressing" : ""}`} draggable onDragStart={() => setDraggingTabId(tab.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingTabId !== null && reorderTab(draggingTabId, tab.id)} onDragEnd={() => setDraggingTabId(null)} onPointerDown={(event) => handleTabPointerDown(event, tab.id)} onPointerMove={handleTabPointerMove} onPointerUp={handleTabPointerUp} onPointerCancel={handleTabPointerUp} onKeyDown={(event) => { if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const index = tabs.findIndex((item) => item.id === tab.id); moveTab(tab.id, event.key === "ArrowLeft" ? index - 1 : index + 1); }} aria-grabbed={draggingTabId === tab.id} onClick={() => { if (suppressTabClickRef.current) { suppressTabClickRef.current = false; return; } setActiveTabId(tab.id); const page = tab.history[tab.historyIndex]; setCurrentView(page.view ?? "online"); setActivePage(page); setAddress(addressForPage(page)); }}><span className="tab-signal" /> <img className="tab-favicon" src={tab.favicon ?? tab.history[tab.historyIndex]?.favicon ?? (tab.history[tab.historyIndex]?.kind === "online" ? `https://${new URL(tab.history[tab.historyIndex]?.url ?? "https://example.com").hostname}/favicon.ico` : "/manus-storage/lycon-canonical-logo_647e2a05.png")} alt="" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> <span className="tab-title">{tab.isPrivate ? "Private · " : ""}{tab.title}</span><span className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} role="button" aria-label={`Close ${tab.title}`}><X size={13} /></span></button>)}
          </div>
          <button className="new-tab" onClick={newTab} aria-label="New tab"><Plus size={17} /></button>
          <div ref={overflowShellRef} className="window-actions"><button ref={overflowButtonRef} className={`icon-btn ${overflowOpen ? "active" : ""}`} onClick={() => setOverflowOpen((open) => !open)} aria-label="More browser actions" aria-expanded={overflowOpen}><MoreHorizontal size={17} /></button>{overflowOpen ? <OverflowMenu onNavigate={navigateView} onSettings={openSettingsSection} onClearData={requestClearBrowsingData} onNewTab={newTab} onNewWindow={openNewWindow} onNewPrivateTab={newPrivateTab} onCloseTab={() => closeTab(activeTabId)} onClose={() => { setOverflowOpen(false); window.setTimeout(() => overflowButtonRef.current?.focus(), 0); }} onScreenshot={captureLocalScreenshot} screenshotBusy={screenshotBusy} onToggleSplitView={() => { setSplitViewOpen((value) => !value); setOverflowOpen(false); }} splitViewOpen={splitViewOpen} zoomLevel={zoomLevel} onZoomIn={() => changeZoom(10)} onZoomOut={() => changeZoom(-10)} onZoomReset={resetZoom} onPrint={printCurrentPage} onFind={findOnPage} onUnsupported={showUnsupported} /> : null}</div>
        </div>
        <div className="toolbar tablet-compact-toolbar">
          <button className="icon-btn" onClick={navigateBack} disabled={!activeTab || activeTab.historyIndex <= 0} aria-label="Back"><ArrowLeft size={17} /></button>
          <button className="icon-btn" onClick={navigateForward} disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1} aria-label="Forward"><ArrowRight size={17} /></button>
          <button className="icon-btn" onClick={() => showToast("Local page refreshed")} aria-label="Reload local page"><RotateCw size={16} /></button>
          <form className="address-wrap" onSubmit={submitAddress}>
            {activeTab?.isPrivate ? <EyeOff size={15} className="private-ink" /> : <LockKeyhole size={14} className={activePage.kind === "local" ? "local-ink" : "online-ink"} />}
            <input ref={addressInputRef} className="address-input" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search locally or enter an address" aria-label="Address and search" />
            {address ? <button type="button" className="clear-btn" onClick={() => setAddress("")} aria-label="Clear address"><X size={13} /></button> : <Search size={14} className="muted-ink" />}
            <VoiceInputButton onTranscript={setAddress} onStatus={showToast} />
          </form>
          <div className={`console-signal signal-${shellState}`}><span className="console-signal-dot" /><span>{shellState === "private" ? "PRIVATE" : shellState === "online" ? "HANDOFF" : "LOCAL"}</span></div>
          <button className={`icon-btn ${isBookmarked ? "active" : ""}`} onClick={toggleBookmark} disabled={!activeTab || activePage.view === "start"} aria-label={isBookmarked ? "Remove bookmark" : "Save bookmark"}><Bookmark size={17} fill={isBookmarked ? "currentColor" : "none"} /></button>
          <button className={`icon-btn ${settings.shieldsEnabled ? "active" : ""}`} onClick={() => updateSetting("shieldsEnabled", !settings.shieldsEnabled)} aria-label="Toggle shields"><ShieldCheck size={17} /></button>
          <button className="icon-btn" onClick={togglePrivate} aria-label="Toggle private mode"><EyeOff size={17} /></button>
        </div>

        <div className={`content-scroll ${splitViewOpen ? "content-split-open" : ""}`}>
          <div className="primary-content">
          {currentView === "start" && <StartView />}
          {currentView === "search" && <SearchView page={activePage} bookmarks={bookmarks} historyEntries={historyEntries} downloads={downloads} onOpen={(url) => navigateTo(createDestination(url))} />}
          {currentView === "bookmarks" && <BookmarksView bookmarks={bookmarks} onOpen={(item) => navigateTo(createDestination(item.url))} onRemove={requestRemoveBookmark} />}
          {currentView === "history" && <HistoryView entries={historyEntries} onOpen={(entry) => navigateTo(createDestination(entry.url))} onClear={() => setConfirmAction({ title: "Clear history?", copy: "Remove every local visit from Lycon’s browsing history? Downloaded documents will remain.", confirmLabel: "Clear history", onConfirm: () => { setHistoryEntries([]); showToast("History cleared"); } })} />}
          {currentView === "downloads" && <DownloadsView downloads={downloads} onPick={() => fileInput.current?.click()} />}
          {currentView === "settings" && <SettingsView settings={settings} section={settingsSection} setSection={setSettingsSection} updateSetting={updateSetting} tabs={tabs} onExport={exportLocalData} onImport={() => backupInput.current?.click()} />}
          {currentView === "online" && <OnlineView page={activePage} onlineOpened={onlineOpened} onOpen={() => setOnlineOpened(true)} onBack={() => navigateView("start")} />}
          </div>
          {splitViewOpen ? <aside className="split-pane" aria-label="Lycon split screen"><div className="split-pane-heading"><span>LOCAL PANE</span><button className="icon-btn" onClick={() => setSplitViewOpen(false)} aria-label="Close split screen"><X size={14} /></button></div><strong>Keep a second surface close.</strong><p>Use this local pane for quick access while you browse.</p><div className="split-pane-actions"><button className="secondary-btn" onClick={() => navigateView("start")}><HomeIcon size={14} /> Start</button><button className="secondary-btn" onClick={() => navigateView("bookmarks")}><Bookmark size={14} /> Favorites</button><button className="secondary-btn" onClick={() => navigateView("history")}><History size={14} /> History</button></div></aside> : null}
        </div>
        <input ref={fileInput} type="file" hidden onChange={handleFile} />
        <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importLocalData} />
      </main>
      {confirmAction ? <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }} /> : null}
      {toast ? <div className="toast-note" role="status"><Check size={14} />{toast}</div> : null}
    </div>
  );
}

function VoiceInputButton({ onTranscript, onStatus }: { onTranscript: (value: string) => void; onStatus: (message: string) => void }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  useEffect(() => () => { recognitionRef.current?.stop?.(); }, []);
  const startListening = () => {
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { onStatus("Voice input is not supported in this browser"); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); if (transcript) onTranscript(transcript); };
    recognition.onerror = (event: any) => { setIsListening(false); onStatus(event.error === "not-allowed" ? "Microphone access was not allowed" : "Voice input could not hear you"); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };
  return <button type="button" className={`voice-btn ${isListening ? "listening" : ""}`} onClick={startListening} aria-label={isListening ? "Listening" : "Use voice input"} aria-pressed={isListening}><Mic size={15} /></button>;
}

function StartView() {
  return <div className="page start-page"><section className="hero"><div className="hero-copy-wrap"><div className="eyebrow">FIELD INSTRUMENT / 01</div><h1>Browse <em>wild.</em><br />Browse free.</h1><p className="hero-copy">A quiet home for the local web. Lycon keeps your own device in focus, then puts you in control when a page needs the wider internet.</p><div className="hero-note"><span><CircleDot size={9} /> Your device, in focus</span><span>Voice-ready</span></div></div></section></div>;
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="content-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="heading-actions">{actions}</div> : null}</div>;
}

type SearchFilter = "ALL" | "SAVED" | "HISTORY" | "DOCUMENTS" | "CORE";
type DateFilter = "ALL" | "TODAY" | "WEEK" | "OLDER";
type ContentFilter = "ALL" | "PAGES" | "DOCUMENTS";
type SearchRecord = { title: string; url: string; copy: string; category: SearchFilter; meta: string; contentType: "PAGE" | "DOCUMENT"; dateAt?: number };

function SearchView({ page, bookmarks, historyEntries, downloads, onOpen }: { page: PageRecord; bookmarks: BookmarkItem[]; historyEntries: HistoryItem[]; downloads: DownloadItem[]; onOpen: (url: string) => void }) {
  const [filter, setFilter] = useState<SearchFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("ALL");
  const query = page.query ?? page.title.replace(/^Search: /, "");
  const coreIndex: SearchRecord[] = [{ title: "Start", url: "lycon://start", copy: "The local-first Lycon home surface.", category: "CORE", meta: "Local surface", contentType: "PAGE" }, { title: "Saved pages", url: "lycon://bookmarks", copy: "Your locally saved pages and deliberate handoffs.", category: "CORE", meta: "Library", contentType: "PAGE" }, { title: "History", url: "lycon://history", copy: "A quiet trace of local visits and handoffs.", category: "CORE", meta: `${historyEntries.length} records`, contentType: "PAGE" }, { title: "Downloads", url: "lycon://downloads", copy: "Files held in your local field kit.", category: "CORE", meta: "Library", contentType: "PAGE" }, { title: "Settings", url: "lycon://settings", copy: "Appearance, privacy, permissions, and search controls.", category: "CORE", meta: "Control room", contentType: "PAGE" }];
  const savedIndex: SearchRecord[] = bookmarks.map((item) => ({ title: item.title, url: item.url, copy: item.kind === "online" ? "Saved online handoff" : "Saved local page", category: "SAVED", meta: "Saved page", contentType: "PAGE", dateAt: item.savedAt }));
  const historyIndex: SearchRecord[] = historyEntries.map((item) => ({ title: item.title, url: item.url, copy: item.kind === "online" ? "Visited online handoff" : "Visited local surface", category: "HISTORY", meta: item.visited, contentType: "PAGE", dateAt: item.visitedAt }));
  const downloadIndex: SearchRecord[] = downloads.map((item) => ({ title: item.name, url: "lycon://downloads", copy: item.content ? excerptAround(item.content, query) : `${item.type} download · metadata indexed locally`, category: "DOCUMENTS", meta: `${formatBytes(item.size)} · ${item.added}`, contentType: "DOCUMENT", dateAt: item.addedAt }));
  const allMatches = [...coreIndex, ...savedIndex, ...historyIndex, ...downloadIndex].filter((item, index, items) => `${item.title} ${item.copy} ${item.url}`.toLowerCase().includes(query.toLowerCase()) && items.findIndex((candidate) => candidate.url === item.url && candidate.title === item.title) === index);
  const dateCutoff = dateFilter === "TODAY" ? Date.now() - 1000 * 60 * 60 * 24 : dateFilter === "WEEK" ? Date.now() - 1000 * 60 * 60 * 24 * 7 : dateFilter === "OLDER" ? Date.now() - 1000 * 60 * 60 * 24 * 7 : 0;
  const matches = allMatches.filter((item) => (filter === "ALL" || item.category === filter) && (contentFilter === "ALL" || item.contentType === (contentFilter === "DOCUMENTS" ? "DOCUMENT" : "PAGE")) && (dateFilter === "ALL" || (item.dateAt ? (dateFilter === "OLDER" ? item.dateAt < dateCutoff : item.dateAt >= dateCutoff) : true)));
  const results = matches.length ? matches : [{ title: filter === "ALL" ? `No local match for “${query}”` : `No ${filter.toLowerCase()} match for “${query}”`, url: "lycon://start", copy: "Lycon Search only indexes this workspace. Try another term or filter.", category: "NO MATCH", meta: "Local index" }];
  const filters: Array<{ id: SearchFilter; label: string; count: number }> = [{ id: "ALL", label: "All", count: allMatches.length }, { id: "SAVED", label: "Saved", count: savedIndex.length }, { id: "HISTORY", label: "History", count: historyIndex.length }, { id: "DOCUMENTS", label: "Documents", count: downloadIndex.length }, { id: "CORE", label: "Core", count: coreIndex.length }];
  const dates: Array<{ id: DateFilter; label: string }> = [{ id: "ALL", label: "Any date" }, { id: "TODAY", label: "Today" }, { id: "WEEK", label: "Past 7 days" }, { id: "OLDER", label: "Older" }];
  const contentTypes: Array<{ id: ContentFilter; label: string }> = [{ id: "ALL", label: "Any type" }, { id: "PAGES", label: "Pages" }, { id: "DOCUMENTS", label: "Documents" }];
  return <div className="page library-page search-page"><PageHeading eyebrow="LYCON SEARCH / LOCAL INDEX" title={`Results for “${query}”`} description="Lycon Search indexes this workspace, including saved pages, browsing history, downloads, and extracted document text. Ordinary searches never leave the app." /><div className="search-filters" role="toolbar" aria-label="Filter local search results">{filters.map((item) => <button key={item.id} className={`filter-chip ${filter === item.id ? "active" : ""}`} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>{item.label}<span>{item.count}</span></button>)}</div><div className="search-subfilters"><label>Date <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>{dates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Type <select value={contentFilter} onChange={(event) => setContentFilter(event.target.value as ContentFilter)}>{contentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div><div className="search-results">{results.map((result, index) => <button className="search-result" key={result.url + result.title} onClick={() => onOpen(result.url)}><span className="result-index">{String(index + 1).padStart(2, "0")}</span><span className="result-body"><strong>{result.title}</strong><span>{result.copy}</span><small>{result.category} · {result.meta} · {result.url}</small></span><ChevronRight size={16} /></button>)}</div></div>;
}

function BookmarksView({ bookmarks, onOpen, onRemove }: { bookmarks: BookmarkItem[]; onOpen: (item: BookmarkItem) => void; onRemove: (id: string) => void }) {
  return <div className="page library-page"><PageHeading eyebrow="LIBRARY / SAVED" title="Bookmarks" description="The places you chose to keep close. Remove any saved page directly from this list." />{bookmarks.length ? <div className="list-panel">{bookmarks.map((item) => <div className="list-row" key={item.id}><div className="row-icon"><Bookmark size={16} /></div><button className="row-main" onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{item.url}</span></button><button className="icon-btn delete-bookmark" onClick={() => onRemove(item.id)} aria-label={`Delete saved page ${item.title}`} title="Delete saved page"><Trash2 size={15} /></button></div>)}</div> : <EmptyState icon={Bookmark} title="Nothing saved yet" copy="When a page earns a place in your field kit, save it with the bookmark in the toolbar." />}</div>;
}

function HistoryView({ entries, onOpen, onClear }: { entries: HistoryItem[]; onOpen: (entry: HistoryItem) => void; onClear: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => `${entry.title} ${entry.url}`.toLowerCase().includes(query.trim().toLowerCase()));
  const localCount = entries.filter((entry) => entry.kind !== "online").length;
  const onlineCount = entries.filter((entry) => entry.kind === "online").length;
  const grouped = filtered.reduce<Record<string, HistoryItem[]>>((groups, entry) => { const key = historyGroup(entry); (groups[key] ??= []).push(entry); return groups; }, {});
  const groupOrder = ["Today", "Yesterday", "Earlier"];
  return <div className="page library-page history-page"><PageHeading eyebrow="LIBRARY / TRACE" title="History" description="A locally stored record of the pages and handoffs you have visited. Lycon retrieves it from this device only." actions={entries.length ? <button className="text-btn" onClick={onClear}>Clear history</button> : undefined} />{entries.length ? <><div className="history-summary"><span><strong>{entries.length}</strong> visits</span><span><strong>{localCount}</strong> local</span><span><strong>{onlineCount}</strong> handoffs</span></div><label className="history-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter history" aria-label="Filter history" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear history filter"><X size={13} /></button> : null}</label>{filtered.length ? <div className="history-groups">{groupOrder.filter((group) => grouped[group]?.length).map((group) => <section className="history-group" key={group}><div className="history-group-heading"><span>{group}</span><small>{grouped[group].length} {grouped[group].length === 1 ? "visit" : "visits"}</small></div><div className="list-panel">{grouped[group].map((entry) => <div className="list-row" key={entry.id}><div className={`row-icon ${entry.kind === "online" ? "online-history-icon" : ""}`}><History size={16} /></div><button className="row-main" onClick={() => onOpen(entry)}><strong>{entry.title}</strong><span>{entry.url}</span></button><span className="row-meta">{entry.visited}</span></div>)}</div></section>)}</div> : <EmptyState icon={Search} title="No matching visits" copy="Try a different page title, destination, or local route." />}</> : <EmptyState icon={History} title="No history" copy="Future local visits and deliberate handoffs will appear here." />}</div>;
}

function readDownloads(): DownloadItem[] {
  const stored = readStorage<unknown[]>("lycon-downloads", []);
  if (!Array.isArray(stored)) return [];
  return stored.map((item, index) => {
    if (typeof item === "string") return { id: `legacy-download-${index}`, name: item, type: "Local file", size: 0, added: "Earlier", content: "" };
    if (!item || typeof item !== "object") return null;
    const record = item as Partial<DownloadItem>;
    return { id: record.id ?? `download-${index}`, name: record.name ?? "Untitled local file", type: record.type ?? "Local file", size: record.size ?? 0, added: record.added ?? "Earlier", content: record.content ?? "" };
  }).filter((item): item is DownloadItem => Boolean(item));
}

function excerptAround(content: string, query: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const matchIndex = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex < 0) return normalized.slice(0, 120) || "Local document with extracted text";
  const start = Math.max(0, matchIndex - 42);
  const excerpt = normalized.slice(start, start + 150);
  return `${start > 0 ? "…" : ""}${excerpt}${start + 150 < normalized.length ? "…" : ""}`;
}

function historyGroup(entry: HistoryItem) { if (!entry.visitedAt) return entry.visited === "Yesterday" ? "Yesterday" : "Earlier"; const age = Date.now() - entry.visitedAt; if (age < 1000 * 60 * 60 * 24) return "Today"; if (age < 1000 * 60 * 60 * 48) return "Yesterday"; return "Earlier"; }

function formatBytes(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; }

function DownloadsView({ downloads, onPick }: { downloads: DownloadItem[]; onPick: () => void }) {
  return <div className="page library-page"><PageHeading eyebrow="LIBRARY / INTAKE" title="Downloads" description="Files you have pulled into your local field kit." actions={<button className="primary-btn" onClick={onPick}><FilePlus2 size={15} /> Add file</button>} />{downloads.length ? <div className="list-panel">{downloads.map((file) => <div className="list-row" key={file.id}><div className="row-icon"><FolderDown size={16} /></div><div className="row-main"><strong>{file.name}</strong><span>{file.type} · {formatBytes(file.size)} · {file.content ? "Indexed locally" : "Metadata only"}</span></div><span className="row-meta">{file.added}</span></div>)}</div> : <EmptyState icon={Download} title="No downloads" copy="Files you choose to keep close will be listed in your local library." />}</div>;
}

function OverflowMenu({ onNavigate, onSettings, onClearData, onNewTab, onNewWindow, onNewPrivateTab, onCloseTab, onClose, onScreenshot, screenshotBusy, onToggleSplitView, splitViewOpen, zoomLevel, onZoomIn, onZoomOut, onZoomReset, onPrint, onFind, onUnsupported }: { onNavigate: (view: View) => void; onSettings: (section: SettingsSection) => void; onClearData: () => void; onNewTab: () => void; onNewWindow: () => void; onNewPrivateTab: () => void; onCloseTab: () => void; onClose: () => void; onScreenshot: () => void; screenshotBusy: boolean; onToggleSplitView: () => void; splitViewOpen: boolean; zoomLevel: number; onZoomIn: () => void; onZoomOut: () => void; onZoomReset: () => void; onPrint: () => void; onFind: () => void; onUnsupported: (label: string) => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button"));
    buttons[0]?.focus();
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleMenuKeyDown);
    return () => document.removeEventListener("keydown", handleMenuKeyDown);
  }, [onClose]);
  const item = (label: string, icon: ReactNode, onClick: () => void, shortcut?: string, className = "") => <button role="menuitem" className={className} onClick={onClick}><span className="menu-icon">{icon}</span><span>{label}</span>{shortcut ? <small>{shortcut}</small> : null}</button>;
  return <div ref={menuRef} className="overflow-menu" role="menu" aria-label="Browser application menu"><div className="overflow-heading">LYCON MENU <span>Browser controls · Esc to close</span></div>{item("New tab", <Plus size={15} />, onNewTab, "Ctrl+T")}{item("New window", <AppWindow size={15} />, onNewWindow, "Ctrl+N")}{item("New private tab", <EyeOff size={15} />, onNewPrivateTab, "Ctrl+Shift+N")}<div className="menu-zoom-row"><button onClick={onZoomOut} aria-label="Zoom out"><Minus size={14} /></button><button onClick={onZoomReset}>{zoomLevel}%</button><button onClick={onZoomIn} aria-label="Zoom in"><Plus size={14} /></button></div><div className="overflow-divider" />{item("Favorites", <Bookmark size={15} />, () => onNavigate("bookmarks"), "Ctrl+Shift+O")}{item("History", <History size={15} />, () => onNavigate("history"), "Ctrl+H")}{item("Downloads", <Download size={15} />, () => onNavigate("downloads"), "Ctrl+J")}{item("Tab groups", <Layers3 size={15} />, () => onSettings("tabs"), "›")}{item("Extensions", <Puzzle size={15} />, () => onSettings("extensions"), "›")}{item("Passwords", <KeyRound size={15} />, () => onSettings("passwords"), "›")}<div className="overflow-divider" />{item("Delete browsing data", <Trash2 size={15} />, onClearData, "Ctrl+Shift+Delete", "danger-item")}{item("Print", <Printer size={15} />, onPrint, "Ctrl+P")}{item("Translate", <Languages size={15} />, () => onSettings("translate"))}{item(splitViewOpen ? "Close split screen" : "Split screen", <Layers3 size={15} />, onToggleSplitView)}{item(screenshotBusy ? "Capturing snapshot…" : "Screenshot", <Camera size={15} />, onScreenshot, "Ctrl+Shift+S")}{item("Find on page", <Search size={15} />, onFind, "Ctrl+F")}{item("More tools", <MoreHorizontal size={15} />, () => onSettings("tools"), "›")}<div className="overflow-divider" />{item("Settings", <Settings size={15} />, () => onSettings("appearance"))}{item("Help and feedback", <HelpCircle size={15} />, () => onSettings("help"), "›")}{item("Close tab", <X size={15} />, onCloseTab)}</div>;
}

function SettingsView({ settings, section, setSection, updateSetting, tabs, onExport, onImport }: { settings: SettingsState; section: SettingsSection; setSection: (section: SettingsSection) => void; updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void; tabs: Tab[]; onExport: () => void; onImport: () => void }) {
  const settingNav: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [{ id: "appearance", label: "Appearance", icon: Palette }, { id: "privacy", label: "Privacy", icon: ShieldCheck }, { id: "permissions", label: "Permissions", icon: LockKeyhole }, { id: "search", label: "Search", icon: Search }, { id: "tabs", label: "Tabs", icon: Layers3 }, { id: "extensions", label: "Extensions", icon: Puzzle }, { id: "passwords", label: "Passwords", icon: KeyRound }, { id: "translate", label: "Translate", icon: Languages }, { id: "tools", label: "More tools", icon: MoreHorizontal }, { id: "help", label: "Help", icon: HelpCircle }];
  return <div className="page settings-page"><PageHeading eyebrow="CONTROL ROOM / SETTINGS" title="Settings" description="Keep the browser’s posture in your hands." /><div className="settings-layout"><div className="settings-nav">{settingNav.map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} key={id} onClick={() => setSection(id)}><Icon size={15} />{label}</button>)}</div><div className="settings-card">{section === "appearance" && <><SettingHeader title="Appearance" copy="Choose how the field looks when you return." /><SettingSelect label="Theme" value={settings.theme} options={[{ value: "dark", label: "Night watch" }, { value: "light", label: "Day field" }]} onChange={(value) => updateSetting("theme", value as Theme)} /><SettingSelect label="Startup view" value={settings.startupView} options={[{ value: "start", label: "Start page" }, { value: "last", label: "Last active view" }]} onChange={(value) => updateSetting("startupView", value as "start" | "last")} /></>}{section === "privacy" && <><SettingHeader title="Privacy" copy="Make the local boundary visible and easy to adjust." /><SettingToggle label="Shields" copy="Keep known trackers and noisy requests at a distance." checked={settings.shieldsEnabled} onChange={(checked) => updateSetting("shieldsEnabled", checked)} /><SettingToggle label="Private tabs" copy="Keep this session out of the standard local trace." checked={activeBoolean(false)} onChange={() => undefined} /></>}{section === "permissions" && <><SettingHeader title="Site permissions" copy="Keep microphone and location requests explicit." /><SettingSelect label="Microphone" value={settings.microphonePermission} options={[{ value: "ask", label: "Ask every time" }, { value: "allow", label: "Allow" }, { value: "block", label: "Block" }]} onChange={(value) => updateSetting("microphonePermission", value as SettingsState["microphonePermission"])} /><SettingSelect label="Location" value={settings.locationPermission} options={[{ value: "ask", label: "Ask every time" }, { value: "block", label: "Block" }]} onChange={(value) => updateSetting("locationPermission", value as SettingsState["locationPermission"])} /></>}{section === "search" && <><SettingHeader title="Search" copy="Lycon Search indexes this workspace directly. Ordinary queries never leave the app." /><div className="setting-note"><Search size={16} /><div><strong>Native Lycon Search</strong><p>Local pages, saved content, history, downloads, and settings stay in Lycon’s own index.</p></div></div><div className="backup-card"><div className="backup-card-heading"><FileJson size={16} /><div><strong>Local backup</strong><p>Export or restore bookmarks and the local search index without sending data away.</p></div></div><div className="backup-actions"><button className="secondary-btn" onClick={onExport}><Download size={14} /> Export JSON</button><button className="primary-btn" onClick={onImport}><Upload size={14} /> Import JSON</button></div></div></>}{section === "tabs" && <><SettingHeader title="Tabs and windows" copy="Keep work separated without leaving the Lycon shell." /><div className="setting-note"><Layers3 size={16} /><div><strong>{tabs.length} open {tabs.length === 1 ? "tab" : "tabs"}</strong><p>New tabs and private tabs stay inside Lycon. New window opens another Lycon workspace when the browser allows it.</p></div></div></>}{section === "extensions" && <><SettingHeader title="Extensions" copy="A safe place for local browser add-ons when this capability is enabled." /><div className="setting-note"><Puzzle size={16} /><div><strong>No extensions installed</strong><p>Lycon’s static shell does not execute third-party extensions. This surface is reserved for signed, local add-ons.</p></div></div></>}{section === "passwords" && <><SettingHeader title="Passwords" copy="Keep credentials out of Lycon until secure encrypted storage is available." /><div className="setting-note"><KeyRound size={16} /><div><strong>Managed by your device</strong><p>Lycon does not collect, sync, or store passwords in localStorage.</p></div></div></>}{section === "translate" && <><SettingHeader title="Translate" copy="Choose a preferred reading language for future translation support." /><SettingSelect label="Preferred language" value="system" options={[{ value: "system", label: "Use device language" }, { value: "en", label: "English" }, { value: "zu", label: "isiZulu" }, { value: "af", label: "Afrikaans" }]} onChange={() => undefined} /><div className="setting-note"><Languages size={16} /><div><strong>Translation stays deliberate</strong><p>Lycon will never send page text to a translation service without an explicit handoff.</p></div></div></>}{section === "tools" && <><SettingHeader title="More tools" copy="Utilities that help you inspect, capture, and organize this workspace." /><div className="setting-note"><MoreHorizontal size={16} /><div><strong>Local tools are ready</strong><p>Use Find on page, Screenshot, Print, Split screen, local backups, and the downloads index from the application menu.</p></div></div></>}{section === "help" && <><SettingHeader title="Help and feedback" copy="Understand Lycon’s boundaries and keep the browser useful." /><div className="setting-note"><HelpCircle size={16} /><div><strong>Lycon is local by default</strong><p>Local pages, history, bookmarks, and indexed documents remain in this browser profile. Online pages are deliberate embedded handoffs.</p></div></div></>}</div></div></div>;
}

function activeBoolean(value: boolean) { return value; }

function SettingHeader({ title, copy }: { title: string; copy: string }) { return <div className="setting-header"><h2>{title}</h2><p>{copy}</p></div>; }
function SettingSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <label className="setting-control"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>; }
function SettingToggle({ label, copy, checked, onChange }: { label: string; copy: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="setting-toggle"><div><strong>{label}</strong><p>{copy}</p></div><button className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}><span /></button></div>; }

function OnlineView({ page, onlineOpened, onOpen, onBack }: { page: PageRecord; onlineOpened: boolean; onOpen: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { if (!onlineOpened) { setLoading(false); setBlocked(false); return; } setLoading(true); setBlocked(false); const timeout = window.setTimeout(() => { setLoading(false); setBlocked(true); }, 9000); return () => window.clearTimeout(timeout); }, [onlineOpened, page.url]);
  return <div className={`page online-page ${onlineOpened ? "online-page-open" : ""}`}>{onlineOpened ? <div className="embedded-browser"><div className="embedded-label"><span className={`status-dot ${loading ? "status-pulse" : ""}`} /> {loading ? "Connecting inside Lycon" : blocked ? "Embedded page unavailable" : "Rendering inside Lycon"}</div>{loading ? <div className="load-progress" role="progressbar" aria-label="Loading embedded page"><span /></div> : null}{blocked ? <div className="embed-fallback"><WifiOff size={19} /><strong>This site did not allow an embedded view.</strong><p>Lycon kept the request inside this workspace and did not open another browser.</p><button className="secondary-btn" onClick={onBack}><HomeIcon size={14} /> Return to local</button></div> : <iframe title={`Lycon view of ${page.title}`} src={page.url} referrerPolicy="no-referrer" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-scripts" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setBlocked(true); }} />}</div> : <><div className="online-visual"><Globe2 size={26} /></div><div className="eyebrow">INTENTIONAL HANDOFF / ONLINE</div><h1>The wild starts here.</h1><p>This address belongs to the wider web. Lycon keeps it inside this workspace until you say go.</p><div className="online-status"><span className="status-dot" /> Online available</div><div className="handoff-card"><div className="handoff-url"><LockKeyhole size={14} /> {page.url}</div><div className="handoff-actions"><button className="primary-btn" onClick={onOpen}><ExternalLink size={15} /> Open inside Lycon</button><button className="secondary-btn" onClick={onBack}><HomeIcon size={14} /> Return to local</button></div><small className="handoff-note">Some sites may restrict embedded rendering. Lycon will never open an external browser window.</small></div></>}</div>;
}

function PrivacyNotice({ onDismiss, onReview }: { onDismiss: () => void; onReview: () => void }) {
  return <aside className="privacy-notice" aria-label="Lycon privacy notice"><div className="privacy-notice-icon"><LockKeyhole size={16} /></div><div className="privacy-notice-copy"><strong>Your field stays local</strong><p>Lycon indexes pages, files, and history on this device. Voice input only listens after you press the microphone and follows your browser permission.</p></div><div className="privacy-notice-actions"><button className="text-btn" onClick={onReview}>Review permissions</button><button className="icon-btn" onClick={onDismiss} aria-label="Dismiss privacy notice"><X size={14} /></button></div></aside>;
}

function isBookmarkItem(item: unknown): item is BookmarkItem { return Boolean(item && typeof item === "object" && typeof (item as BookmarkItem).id === "string" && typeof (item as BookmarkItem).title === "string" && typeof (item as BookmarkItem).url === "string"); }
function isHistoryItem(item: unknown): item is HistoryItem { return isBookmarkItem(item) && typeof (item as HistoryItem).visited === "string"; }
function isDownloadItem(item: unknown): item is DownloadItem { return Boolean(item && typeof item === "object" && typeof (item as DownloadItem).id === "string" && typeof (item as DownloadItem).name === "string"); }
function mergeById<T extends { id: string }>(current: T[], incoming: T[]) { const merged = new Map(current.map((item) => [item.id, item])); incoming.forEach((item) => merged.set(item.id, item)); return Array.from(merged.values()); }
function ConfirmDialog({ action, onCancel, onConfirm }: { action: NonNullable<ConfirmAction>; onCancel: () => void; onConfirm: () => void }) { return <div className="dialog-backdrop" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-copy"><div className="confirm-dialog-icon"><Trash2 size={17} /></div><div><h2 id="confirm-title">{action.title}</h2><p id="confirm-copy">{action.copy}</p></div><div className="confirm-actions"><button className="secondary-btn" onClick={onCancel}>Cancel</button><button className="danger-btn" onClick={onConfirm}>{action.confirmLabel}</button></div></div></div>; }
function EmptyState({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) { return <div className="empty-state"><div className="empty-icon"><Icon size={17} /></div><strong>{title}</strong><p>{copy}</p></div>; }
