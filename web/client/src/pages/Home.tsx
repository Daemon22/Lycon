// Design system: Quiet Field Instrument — the sidebar owns state and library information; the hero stays focused on browsing, voice input, and deliberate handoff.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  ExternalLink,
  FilePlus2,
  FolderDown,
  Globe2,
  History,
  Home as HomeIcon,
  LockKeyhole,
  Mic,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

type View = "start" | "search" | "bookmarks" | "history" | "downloads" | "settings" | "online";
type Theme = "light" | "dark";
type PageKind = "local" | "online" | "search" | "file";
type SettingsSection = "appearance" | "privacy" | "search" | "permissions";

type Tab = {
  id: number;
  title: string;
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
};

type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  kind: PageKind;
};

type HistoryItem = PageRecord & { id: string; visited: string };

type DownloadItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  added: string;
  content: string;
};

type SettingsState = {
  theme: Theme;
  shieldsEnabled: boolean;
  startupView: "start" | "last";
  microphonePermission: "ask" | "allow" | "block";
  locationPermission: "ask" | "block";
};

const initialHistory: HistoryItem[] = [
  { id: "history-1", title: "Lycon Start", url: "lycon://start", kind: "local", view: "start", visited: "Now" },
  { id: "history-2", title: "Bookmarks", url: "lycon://bookmarks", kind: "local", view: "bookmarks", visited: "Today" },
  { id: "history-3", title: "Example Domain", url: "https://example.com", kind: "online", visited: "Yesterday" },
];

const navItems: Array<{ view: View; label: string; icon: LucideIcon }> = [
  { view: "start", label: "Start", icon: HomeIcon },
];

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
  if (localRoutes[normalized]) return { title: normalized, url: `lycon://${normalized}`, kind: "local", view: localRoutes[normalized] };
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    const url = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
    return { title: url.replace(/^https?:\/\//, "").split("/")[0], url, kind: "online" };
  }
  return { title: `Search: ${trimmed}`, url: `lycon://search?q=${encodeURIComponent(trimmed)}`, kind: "search", view: "search", query: trimmed };
}

export default function Home() {
  const [settings, setSettings] = usePersistedState<SettingsState>("lycon-settings", defaultSettings);
  const [bookmarks, setBookmarks] = usePersistedState<BookmarkItem[]>("lycon-bookmarks", []);
  const [historyEntries, setHistoryEntries] = usePersistedState<HistoryItem[]>("lycon-history", initialHistory);
  const [downloads, setDownloads] = usePersistedState<DownloadItem[]>("lycon-downloads", readDownloads());
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, title: "Start", isPrivate: false, history: [{ title: "Start", url: "lycon://start", kind: "local", view: "start" }], historyIndex: 0 }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [currentView, setCurrentView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [activePage, setActivePage] = useState<PageRecord>({ title: "Start", url: "lycon://start", kind: "local", view: "start" });
  const [address, setAddress] = useState("");
  const [onlineOpened, setOnlineOpened] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const [toast, setToast] = useState("");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const shellState = activeTab?.isPrivate ? "private" : activePage.kind === "online" ? "online" : "local";
  const isBookmarked = bookmarks.some((bookmark) => bookmark.url === activePage.url);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

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
    updateTab({ title: destination.title, history: nextHistory, historyIndex: nextHistory.length - 1 });
    const nextHistoryEntry: HistoryItem = { ...destination, id: `history-${Date.now()}`, visited: "Just now" };
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
    updateTab({ historyIndex: nextIndex, title: destination.title });
    setCurrentView(destination.view ?? "online");
    window.history.replaceState({}, "", routePath(destination.view ?? "online"));
    setActivePage(destination);
    setAddress(addressForPage(destination));
  };

  const navigateForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIndex = activeTab.historyIndex + 1;
    const destination = activeTab.history[nextIndex];
    updateTab({ historyIndex: nextIndex, title: destination.title });
    setCurrentView(destination.view ?? "online");
    window.history.replaceState({}, "", routePath(destination.view ?? "online"));
    setActivePage(destination);
    setAddress(addressForPage(destination));
  };

  const newTab = () => {
    const id = Date.now();
    setTabs((previous) => [...previous, { id, title: "Start", isPrivate: false, history: [{ title: "Start", url: "lycon://start", kind: "local", view: "start" }], historyIndex: 0 }]);
    setActiveTabId(id);
    setCurrentView("start");
    window.history.pushState({}, "", "/");
    setActivePage({ title: "Start", url: "lycon://start", kind: "local", view: "start" });
    setAddress("");
  };

  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
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
      setBookmarks((previous) => [...previous, { id: `bookmark-${Date.now()}`, title: activePage.title, url: activePage.url, kind: activePage.kind }]);
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
    const item: DownloadItem = { id: `download-${Date.now()}`, name: file.name, type: file.type || extension.toUpperCase() || "Local file", size: file.size, added: "Just now", content };
    setDownloads((previous) => [item, ...previous].slice(0, 100));
    showToast(`${file.name} added to downloads${content ? " and indexed" : ""}`);
    event.target.value = "";
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((previous) => ({ ...previous, [key]: value }));
  const openSettingsSection = (section: SettingsSection) => { setSettingsSection(section); navigateTo({ title: "Settings", url: "lycon://settings", kind: "local", view: "settings" }); };
  const clearBrowsingData = () => { setHistoryEntries([]); setDownloads([]); showToast("History and downloads cleared"); setOverflowOpen(false); };

  return (
    <div className="lycon-app">
      <aside className="lycon-sidebar">
        <div className="brand-lockup">
          <img className="brand-mark" src="/assets/lycon-logo.png" alt="Lycon wolf mark" />
          <div className="brand-copy"><strong>LYCON</strong><span>LOCAL BY DEFAULT</span></div>
        </div>
        <div className="side-label">LIBRARY</div>
        <nav className="side-nav" aria-label="Primary browser navigation">
          {navItems.map(({ view, label, icon: Icon }) => <button key={view} className={`nav-item ${currentView === view ? "active" : ""}`} onClick={() => navigateView(view)} aria-current={currentView === view ? "page" : undefined}><Icon size={15} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-footnote"><span className="status-line"><CircleDot size={9} /> Local mode</span><p>Your library lives here. Online pages wait for your deliberate handoff.</p></div>
      </aside>

      <main className="lycon-main">
        <div className="tab-strip">
          <div className="tabs">
            {tabs.map((tab) => <button key={tab.id} className={`tab ${tab.id === activeTabId ? "active" : ""}`} onClick={() => { setActiveTabId(tab.id); const page = tab.history[tab.historyIndex]; setCurrentView(page.view ?? "online"); setActivePage(page); setAddress(addressForPage(page)); }}><span className="tab-signal" /> <span className="tab-title">{tab.isPrivate ? "Private · " : ""}{tab.title}</span><span className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} role="button" aria-label={`Close ${tab.title}`}><X size={13} /></span></button>)}
          </div>
          <button className="new-tab" onClick={newTab} aria-label="New tab"><Plus size={17} /></button>
          <div className="window-actions"><button className={`icon-btn ${overflowOpen ? "active" : ""}`} onClick={() => setOverflowOpen((open) => !open)} aria-label="More browser actions" aria-expanded={overflowOpen}><MoreHorizontal size={17} /></button>{overflowOpen ? <OverflowMenu onNavigate={navigateView} onSettings={openSettingsSection} onClearData={clearBrowsingData} /> : null}</div>
        </div>
        <div className="toolbar">
          <button className="icon-btn" onClick={navigateBack} disabled={!activeTab || activeTab.historyIndex <= 0} aria-label="Back"><ArrowLeft size={17} /></button>
          <button className="icon-btn" onClick={navigateForward} disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1} aria-label="Forward"><ArrowRight size={17} /></button>
          <button className="icon-btn" onClick={() => showToast("Local page refreshed")} aria-label="Reload local page"><RotateCw size={16} /></button>
          <form className="address-wrap" onSubmit={submitAddress}>
            {activeTab?.isPrivate ? <EyeOff size={15} className="private-ink" /> : <LockKeyhole size={14} className={activePage.kind === "local" ? "local-ink" : "online-ink"} />}
            <input className="address-input" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search locally or enter an address" aria-label="Address and search" />
            {address ? <button type="button" className="clear-btn" onClick={() => setAddress("")} aria-label="Clear address"><X size={13} /></button> : <Search size={14} className="muted-ink" />}
            <VoiceInputButton onTranscript={setAddress} onStatus={showToast} />
          </form>
          <div className={`console-signal signal-${shellState}`}><span className="console-signal-dot" /><span>{shellState === "private" ? "PRIVATE" : shellState === "online" ? "HANDOFF" : "LOCAL"}</span></div>
          <button className={`icon-btn ${isBookmarked ? "active" : ""}`} onClick={toggleBookmark} disabled={!activeTab || activePage.view === "start"} aria-label={isBookmarked ? "Remove bookmark" : "Save bookmark"}><Bookmark size={17} fill={isBookmarked ? "currentColor" : "none"} /></button>
          <button className={`icon-btn ${settings.shieldsEnabled ? "active" : ""}`} onClick={() => updateSetting("shieldsEnabled", !settings.shieldsEnabled)} aria-label="Toggle shields"><ShieldCheck size={17} /></button>
          <button className="icon-btn" onClick={togglePrivate} aria-label="Toggle private mode"><EyeOff size={17} /></button>
        </div>

        <div className="content-scroll">
          {currentView === "start" && <StartView />}
          {currentView === "search" && <SearchView page={activePage} bookmarks={bookmarks} historyEntries={historyEntries} downloads={downloads} onOpen={(url) => navigateTo(createDestination(url))} />}
          {currentView === "bookmarks" && <BookmarksView bookmarks={bookmarks} onOpen={(item) => navigateTo(createDestination(item.url))} onRemove={(id) => { setBookmarks((previous) => previous.filter((item) => item.id !== id)); showToast("Bookmark removed"); }} />}
          {currentView === "history" && <HistoryView entries={historyEntries} onOpen={(entry) => navigateTo(createDestination(entry.url))} onClear={() => { setHistoryEntries([]); showToast("History cleared"); }} />}
          {currentView === "downloads" && <DownloadsView downloads={downloads} onPick={() => fileInput.current?.click()} />}
          {currentView === "settings" && <SettingsView settings={settings} section={settingsSection} setSection={setSettingsSection} updateSetting={updateSetting} />}
          {currentView === "online" && <OnlineView page={activePage} onlineOpened={onlineOpened} onOpen={() => setOnlineOpened(true)} onBack={() => navigateView("start")} />}
        </div>
        <input ref={fileInput} type="file" hidden onChange={handleFile} />
      </main>
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

function SearchView({ page, bookmarks, historyEntries, downloads, onOpen }: { page: PageRecord; bookmarks: BookmarkItem[]; historyEntries: HistoryItem[]; downloads: DownloadItem[]; onOpen: (url: string) => void }) {
  const query = page.query ?? page.title.replace(/^Search: /, "");
  const coreIndex = [{ title: "Start", url: "lycon://start", copy: "The local-first Lycon home surface.", category: "CORE", meta: "Local surface" }, { title: "Saved pages", url: "lycon://bookmarks", copy: "Your locally saved pages and deliberate handoffs.", category: "CORE", meta: "Library" }, { title: "History", url: "lycon://history", copy: "A quiet trace of local visits and handoffs.", category: "CORE", meta: `${historyEntries.length} records` }, { title: "Downloads", url: "lycon://downloads", copy: "Files held in your local field kit.", category: "CORE", meta: "Library" }, { title: "Settings", url: "lycon://settings", copy: "Appearance, privacy, permissions, and search controls.", category: "CORE", meta: "Control room" }];
  const savedIndex = bookmarks.map((item) => ({ title: item.title, url: item.url, copy: item.kind === "online" ? "Saved online handoff" : "Saved local page", category: "SAVED", meta: "Saved page" }));
  const historyIndex = historyEntries.map((item) => ({ title: item.title, url: item.url, copy: item.kind === "online" ? "Visited online handoff" : "Visited local surface", category: "HISTORY", meta: item.visited }));
  const downloadIndex = downloads.map((item) => ({ title: item.name, url: "lycon://downloads", copy: item.content ? excerptAround(item.content, query) : `${item.type} download · metadata indexed locally`, category: "DOCUMENT", meta: `${formatBytes(item.size)} · ${item.added}` }));
  const matches = [...coreIndex, ...savedIndex, ...historyIndex, ...downloadIndex].filter((item, index, items) => `${item.title} ${item.copy} ${item.url}`.toLowerCase().includes(query.toLowerCase()) && items.findIndex((candidate) => candidate.url === item.url && candidate.title === item.title) === index);
  const results = matches.length ? matches : [{ title: `No local match for “${query}”`, url: "lycon://start", copy: "Lycon Search only indexes this workspace. Try a page name, saved page, or browser function.", category: "NO MATCH", meta: "Local index" }];
  return <div className="page library-page search-page"><PageHeading eyebrow="LYCON SEARCH / LOCAL INDEX" title={`Results for “${query}”`} description="Lycon Search indexes this workspace, including saved pages, browsing history, downloads, and extracted document text. Ordinary searches never leave the app." /><div className="search-results">{results.map((result, index) => <button className="search-result" key={result.url + result.title} onClick={() => onOpen(result.url)}><span className="result-index">{String(index + 1).padStart(2, "0")}</span><span className="result-body"><strong>{result.title}</strong><span>{result.copy}</span><small>{result.category} · {result.meta} · {result.url}</small></span><ChevronRight size={16} /></button>)}</div></div>;
}

function BookmarksView({ bookmarks, onOpen, onRemove }: { bookmarks: BookmarkItem[]; onOpen: (item: BookmarkItem) => void; onRemove: (id: string) => void }) {
  return <div className="page library-page"><PageHeading eyebrow="LIBRARY / SAVED" title="Bookmarks" description="The places you chose to keep close." />{bookmarks.length ? <div className="list-panel">{bookmarks.map((item) => <div className="list-row" key={item.id}><div className="row-icon"><Bookmark size={16} /></div><button className="row-main" onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{item.url}</span></button><button className="icon-btn" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}><Trash2 size={15} /></button></div>)}</div> : <EmptyState icon={Bookmark} title="Nothing saved yet" copy="When a page earns a place in your field kit, save it with the bookmark in the toolbar." />}</div>;
}

function HistoryView({ entries, onOpen, onClear }: { entries: HistoryItem[]; onOpen: (entry: HistoryItem) => void; onClear: () => void }) {
  return <div className="page library-page"><PageHeading eyebrow="LIBRARY / TRACE" title="History" description="A quiet record of where the field has taken you." actions={entries.length ? <button className="text-btn" onClick={onClear}>Clear history</button> : undefined} />{entries.length ? <div className="list-panel">{entries.map((entry) => <div className="list-row" key={entry.id}><div className="row-icon"><History size={16} /></div><button className="row-main" onClick={() => onOpen(entry)}><strong>{entry.title}</strong><span>{entry.url}</span></button><span className="row-meta">{entry.visited}</span></div>)}</div> : <EmptyState icon={History} title="No history" copy="Future local visits and deliberate handoffs will appear here." />}</div>;
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

function formatBytes(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; }

function DownloadsView({ downloads, onPick }: { downloads: DownloadItem[]; onPick: () => void }) {
  return <div className="page library-page"><PageHeading eyebrow="LIBRARY / INTAKE" title="Downloads" description="Files you have pulled into your local field kit." actions={<button className="primary-btn" onClick={onPick}><FilePlus2 size={15} /> Add file</button>} />{downloads.length ? <div className="list-panel">{downloads.map((file) => <div className="list-row" key={file.id}><div className="row-icon"><FolderDown size={16} /></div><div className="row-main"><strong>{file.name}</strong><span>{file.type} · {formatBytes(file.size)} · {file.content ? "Indexed locally" : "Metadata only"}</span></div><span className="row-meta">{file.added}</span></div>)}</div> : <EmptyState icon={Download} title="No downloads" copy="Files you choose to keep close will be listed in your local library." />}</div>;
}

function OverflowMenu({ onNavigate, onSettings, onClearData }: { onNavigate: (view: View) => void; onSettings: (section: SettingsSection) => void; onClearData: () => void }) {
  return <div className="overflow-menu" role="menu" aria-label="Browser menu"><div className="overflow-heading">MORE <span>Browser controls</span></div><button role="menuitem" onClick={() => onNavigate("bookmarks")}><Bookmark size={15} />Saved pages</button><button role="menuitem" onClick={() => onNavigate("history")}><History size={15} />History</button><button role="menuitem" onClick={() => onNavigate("downloads")}><Download size={15} />Downloads</button><div className="overflow-divider" /><button role="menuitem" onClick={() => onSettings("appearance")}><Settings size={15} />Settings</button><button role="menuitem" onClick={() => onSettings("privacy")}><ShieldCheck size={15} />Privacy &amp; security</button><button role="menuitem" onClick={() => onSettings("permissions")}><LockKeyhole size={15} />Site permissions</button><div className="overflow-divider" /><button role="menuitem" className="danger-item" onClick={onClearData}><Trash2 size={15} />Clear browsing data</button></div>;
}

function SettingsView({ settings, section, setSection, updateSetting }: { settings: SettingsState; section: SettingsSection; setSection: (section: SettingsSection) => void; updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  const settingNav: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [{ id: "appearance", label: "Appearance", icon: Palette }, { id: "privacy", label: "Privacy", icon: ShieldCheck }, { id: "permissions", label: "Permissions", icon: LockKeyhole }, { id: "search", label: "Search", icon: Search }];
  return <div className="page settings-page"><PageHeading eyebrow="CONTROL ROOM / SETTINGS" title="Settings" description="Keep the browser’s posture in your hands." /><div className="settings-layout"><div className="settings-nav">{settingNav.map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} key={id} onClick={() => setSection(id)}><Icon size={15} />{label}</button>)}</div><div className="settings-card">{section === "appearance" && <><SettingHeader title="Appearance" copy="Choose how the field looks when you return." /><SettingSelect label="Theme" value={settings.theme} options={[{ value: "dark", label: "Night watch" }, { value: "light", label: "Day field" }]} onChange={(value) => updateSetting("theme", value as Theme)} /><SettingSelect label="Startup view" value={settings.startupView} options={[{ value: "start", label: "Start page" }, { value: "last", label: "Last active view" }]} onChange={(value) => updateSetting("startupView", value as "start" | "last")} /></>}{section === "privacy" && <><SettingHeader title="Privacy" copy="Make the local boundary visible and easy to adjust." /><SettingToggle label="Shields" copy="Keep known trackers and noisy requests at a distance." checked={settings.shieldsEnabled} onChange={(checked) => updateSetting("shieldsEnabled", checked)} /><SettingToggle label="Private tabs" copy="Keep this session out of the standard local trace." checked={activeBoolean(false)} onChange={() => undefined} /></>}{section === "permissions" && <><SettingHeader title="Site permissions" copy="Keep microphone and location requests explicit." /><SettingSelect label="Microphone" value={settings.microphonePermission} options={[{ value: "ask", label: "Ask every time" }, { value: "allow", label: "Allow" }, { value: "block", label: "Block" }]} onChange={(value) => updateSetting("microphonePermission", value as SettingsState["microphonePermission"])} /><SettingSelect label="Location" value={settings.locationPermission} options={[{ value: "ask", label: "Ask every time" }, { value: "block", label: "Block" }]} onChange={(value) => updateSetting("locationPermission", value as SettingsState["locationPermission"])} /></>}{section === "search" && <><SettingHeader title="Search" copy="Lycon Search indexes this workspace directly. Ordinary queries never leave the app." /><div className="setting-note"><Search size={16} /><div><strong>Native Lycon Search</strong><p>Local pages, saved content, history, downloads, and settings stay in Lycon’s own index.</p></div></div></>}</div></div></div>;
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

function EmptyState({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) { return <div className="empty-state"><div className="empty-icon"><Icon size={17} /></div><strong>{title}</strong><p>{copy}</p></div>; }
