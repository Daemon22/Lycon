import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronRight, Clock3, FileText, Github, Globe2, HardDrive, History, Home as HomeIcon, LockKeyhole, Menu, Mic, MonitorDown, Moon, Network, Plus, RotateCw, Search, Settings2, ShieldCheck, Sparkles, Star, Sun, X, Youtube } from "lucide-react";
import { useLyconTheme } from "../contexts/LyconThemeContext";

type Tab = { id: number; url: string; title: string; history: string[]; historyIndex: number };
type Visit = { url: string; title: string; visitedAt: number };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type RecognitionWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const wolfLogo = "/manus-storage/lycon-wolf-logo_b005ce17.png";
const HOME_URL = "about:lycon";
const starterLinks = [
  { label: "DuckDuckGo", domain: "duckduckgo.com", href: "https://duckduckgo.com", icon: Globe2, tone: "orange" },
  { label: "YouTube", domain: "youtube.com", href: "https://youtube.com", icon: Youtube, tone: "red" },
  { label: "Wikipedia", domain: "wikipedia.org", href: "https://wikipedia.org", icon: BookOpen, tone: "paper" },
  { label: "GitHub", domain: "github.com", href: "https://github.com/Daemon22/Lycon", icon: Github, tone: "ink" },
  { label: "Reddit", domain: "reddit.com", href: "https://reddit.com", icon: MessageBubble, tone: "orange" },
  { label: "Hacker News", domain: "news.ycombinator.com", href: "https://news.ycombinator.com", icon: Network, tone: "orange" },
  { label: "MDN Web Docs", domain: "developer.mozilla.org", href: "https://developer.mozilla.org", icon: FileText, tone: "paper" },
  { label: "Proton Mail", domain: "proton.me/mail", href: "https://proton.me/mail", icon: LockKeyhole, tone: "violet" },
];

function MessageBubble(props: { size?: number }) {
  return <svg width={props.size ?? 21} height={props.size ?? 21} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.2 4.8A10.1 10.1 0 0 0 12 2C6.5 2 2 5.9 2 10.7c0 2.8 1.5 5.4 4 7l-.8 3.3 3.4-1.8c1 .3 2.1.5 3.4.5 5.5 0 10-3.9 10-8.7 0-2.3-.7-4.5-1.8-6.2ZM8 11H6v-2h2v2Zm5 0h-2v-2h2v2Zm5 0h-2v-2h2v2Z" /></svg>;
}

function normalizeUrl(value: string) {
  const clean = value.trim();
  if (!clean) return HOME_URL;
  if (clean === HOME_URL || clean.startsWith("/")) return clean;
  if (/^(https?:\/\/)/i.test(clean)) return clean;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(clean)) return `http://${clean}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
}

function titleForUrl(url: string) {
  if (url === HOME_URL) return "New tab — Lycon";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Lycon Browser"; }
}

function BrowserHome({ onNavigate, onBookmark }: { onNavigate: (url: string) => void; onBookmark: (url: string) => void }) {
  return <div className="browser-home-view"><div className="hero-kicker"><span className="kicker-dot" /> New tab <span className="kicker-line" /></div><div className="hero-mark-wrap"><img className="hero-mark" src={wolfLogo} alt="Lycon wolf mascot" /></div><p className="eyebrow">Privacy-first browsing, with the boundary visible</p><h1>Browse wild.<br /><em>Browse free.</em></h1><p className="hero-copy">Lycon is a local-first browser for the open web. Keep navigation practical, keep sensitive context explicit, and keep the important trail on your device.</p><div className="browser-note"><Search size={14} /><span>DuckDuckGo</span> default search · enter a web address above</div><section className="web-section browser-links-section" aria-labelledby="web-title"><div className="section-heading"><div><span className="section-index">01</span><h2 id="web-title">Your web</h2></div><span>{starterLinks.length} field links</span></div><div className="shortcut-grid">{starterLinks.map((item) => { const Icon = item.icon; return <button key={item.label} className="shortcut-card" type="button" onClick={() => { onNavigate(item.href); onBookmark(item.href); }}><span className={`shortcut-icon ${item.tone}`}><Icon size={20} strokeWidth={2.1} /></span><span className="shortcut-copy"><strong>{item.label}</strong><small>{item.domain}</small></span><ArrowUpRight className="shortcut-arrow" size={15} /></button>; })}</div></section><section className="feature-band browser-feature-band"><div className="section-heading"><div><span className="section-index">02</span><h2>On your device</h2></div><span>Native Lycon</span></div><div className="feature-layout"><article className="local-feature"><div className="feature-icon"><HardDrive size={20} /></div><div><span className="feature-label">Local-first by design</span><h3>Keep the important trail offline.</h3><p>The native Lycon browser opens local paths, supports <code>file://</code> and <code>localhost</code>, and keeps native capabilities on the device where they belong.</p><a className="text-link" href="/download">Get the native browser <ArrowUpRight size={14} /></a></div></article><div className="boundary-stack"><div className="boundary-card"><ShieldCheck size={18} /><div><strong>Hunter’s Posture</strong><span>Hardened, Balanced, or Permissive — you choose the sensitivity.</span></div></div><div className="boundary-card"><Sparkles size={18} /><div><strong>Intelligence is optional</strong><span>Local or cloud connectors are explicit, auditable, and never assumed.</span></div></div></div></div></section></div>;
}

export default function Home() {
  const { theme, toggleTheme } = useLyconTheme();
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, url: HOME_URL, title: "New tab — Lycon", history: [HOME_URL], historyIndex: 0 }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [address, setAddress] = useState("");
  const [history, setHistory] = useState<Visit[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);
  const nextTabId = useRef(2);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    try { setHistory(JSON.parse(window.localStorage.getItem("lycon-history") ?? "[]")); setBookmarks(JSON.parse(window.localStorage.getItem("lycon-bookmarks") ?? "[]")); } catch { setHistory([]); setBookmarks([]); }
  }, []);
  useEffect(() => { window.localStorage.setItem("lycon-history", JSON.stringify(history.slice(0, 100))); }, [history]);
  useEffect(() => { window.localStorage.setItem("lycon-bookmarks", JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") { event.preventDefault(); addressRef.current?.focus(); addressRef.current?.select(); } if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); goHistory(-1); } if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); goHistory(1); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });

  function navigate(rawUrl: string, tabId = activeTabId) {
    const url = normalizeUrl(rawUrl);
    setTabs((current) => current.map((tab) => { if (tab.id !== tabId) return tab; const nextHistory = tab.history.slice(0, tab.historyIndex + 1); if (nextHistory[nextHistory.length - 1] !== url) nextHistory.push(url); return { ...tab, url, title: titleForUrl(url), history: nextHistory, historyIndex: nextHistory.length - 1 }; }));
    setAddress(url === HOME_URL ? "" : url);
    if (url !== HOME_URL) setHistory((current) => [{ url, title: titleForUrl(url), visitedAt: Date.now() }, ...current.filter((visit) => visit.url !== url)].slice(0, 100));
    setNotice(url.startsWith("http") ? "Loaded in the active tab. Some sites may block embedded views; use Open externally when needed." : "New tab ready.");
  }
  function goHistory(direction: -1 | 1) { if (!activeTab) return; const nextIndex = activeTab.historyIndex + direction; if (nextIndex < 0 || nextIndex >= activeTab.history.length) return; const url = activeTab.history[nextIndex]; setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, url, title: titleForUrl(url), historyIndex: nextIndex } : tab)); setAddress(url === HOME_URL ? "" : url); }
  function newTab() { const id = nextTabId.current++; setTabs((current) => [...current, { id, url: HOME_URL, title: "New tab — Lycon", history: [HOME_URL], historyIndex: 0 }]); setActiveTabId(id); setAddress(""); setShowHistory(false); }
  function closeTab(id: number) { if (tabs.length === 1) { setTabs([{ id: 1, url: HOME_URL, title: "New tab — Lycon", history: [HOME_URL], historyIndex: 0 }]); setActiveTabId(1); return; } const remaining = tabs.filter((tab) => tab.id !== id); setTabs(remaining); if (activeTabId === id) setActiveTabId(remaining[Math.max(0, remaining.length - 1)].id); }
  function handleAddress(event: FormEvent<HTMLFormElement>) { event.preventDefault(); navigate(address); }
  function toggleBookmark(url = activeTab.url) { if (url === HOME_URL) { setNotice("Open a page before bookmarking it."); return; } setBookmarks((current) => current.includes(url) ? current.filter((item) => item !== url) : [url, ...current]); }
  function startVoice() { const RecognitionCtor = (window as RecognitionWindow).SpeechRecognition ?? (window as RecognitionWindow).webkitSpeechRecognition; if (!RecognitionCtor) { setNotice("Voice input is not available in this browser. Use the address field instead."); return; } const recognition = new RecognitionCtor(); recognition.continuous = false; recognition.interimResults = false; recognition.lang = navigator.language || "en-US"; recognition.onresult = (event) => { const spoken = event.results[0]?.[0]?.transcript ?? ""; setAddress(spoken); navigate(spoken); }; recognition.onend = () => setListening(false); setListening(true); recognition.start(); }
  const isHome = activeTab.url === HOME_URL;
  const isBookmarked = bookmarks.includes(activeTab.url);
  const tabCountLabel = useMemo(() => `${tabs.length} tab${tabs.length === 1 ? "" : "s"}`, [tabs.length]);

  return <main className="trailhead-shell browser-app"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="trailhead-page"><header className="topbar"><a className="mini-brand" href="/" aria-label="Lycon browser home"><img src={wolfLogo} alt="Lycon wolf mark" /><span>L<span className="brand-y">y</span>con</span></a><nav className="topnav" aria-label="Browser product navigation"><a href="/download">Downloads</a><a href="/privacy">Privacy</a><a href="/security">Security</a></nav><div className="header-actions"><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === "dark" ? "Light" : "Dark"}</span></button><button className="menu-button" type="button" aria-label="Open browser menu" onClick={() => setNotice("Browser settings are available in the native Lycon application.")}><Menu size={19} /></button></div></header><section className="tab-strip" aria-label="Browser tabs">{tabs.map((tab) => <button key={tab.id} className={`tab ${tab.id === activeTabId ? "active" : ""}`} type="button" onClick={() => { setActiveTabId(tab.id); setAddress(tab.url === HOME_URL ? "" : tab.url); }}><span className="tab-favicon"><img src={wolfLogo} alt="" /></span><span>{tab.title}</span>{tabs.length > 1 && <X size={13} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} />}</button>)}<button className="new-tab" type="button" onClick={newTab} aria-label="New tab"><Plus size={16} /></button><span className="tab-count">{tabCountLabel}</span></section><div className="browser-toolbar" aria-label="Browser toolbar"><div className="browser-nav-buttons"><button type="button" aria-label="Go back" onClick={() => goHistory(-1)} disabled={!activeTab || activeTab.historyIndex === 0}><ArrowLeft size={14} /></button><button type="button" aria-label="Go forward" onClick={() => goHistory(1)} disabled={!activeTab || activeTab.historyIndex === activeTab.history.length - 1}><ArrowRight size={14} /></button><button type="button" aria-label="Reload page" onClick={() => window.location.reload()}><RotateCw size={14} /></button><a href="/" aria-label="Browser home"><HomeIcon size={14} /></a></div><form className="address-bar" onSubmit={handleAddress} role="search"><LockKeyhole size={14} aria-hidden="true" /><input ref={addressRef} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter web address" aria-label="Search or enter web address" /><button className={`voice-button ${listening ? "listening" : ""}`} type="button" onClick={startVoice} aria-label="Use voice input"><Mic size={14} /></button><button className={`bookmark-button ${isBookmarked ? "saved" : ""}`} type="button" onClick={() => toggleBookmark()} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark page"}><Bookmark size={14} /></button><span className="address-status">Private</span></form><button className={`toolbar-tool ${showHistory ? "selected" : ""}`} type="button" onClick={() => setShowHistory((current) => !current)} aria-label="Show browsing history"><History size={15} /></button><button className="toolbar-tool" type="button" onClick={() => setNotice("Settings are currently managed by the native Lycon browser.")} aria-label="Browser settings"><Settings2 size={15} /></button></div>{showHistory && <aside className="history-drawer" aria-label="Browsing history"><div className="history-heading"><span><Clock3 size={15} /> Recent trail</span><button type="button" onClick={() => { setHistory([]); setNotice("Local browsing history cleared."); }}><span>Clear</span></button></div>{history.length === 0 ? <p className="empty-history">No visits stored yet. Lycon keeps this list locally in your browser profile.</p> : history.slice(0, 8).map((visit) => <button key={visit.url} className="history-row" type="button" onClick={() => { navigate(visit.url); setShowHistory(false); }}><span className="history-favicon"><Globe2 size={13} /></span><span><strong>{visit.title}</strong><small>{visit.url}</small></span></button>)}</aside>}
      <div className="console-frame browser-viewport">{isHome ? <BrowserHome onNavigate={navigate} onBookmark={toggleBookmark} /> : <div className="remote-view"><div className="remote-view-head"><span><Globe2 size={16} /> {titleForUrl(activeTab.url)}</span><a href={activeTab.url} target="_blank" rel="noreferrer">Open externally <ArrowUpRight size={14} /></a></div><iframe src={activeTab.url} title={titleForUrl(activeTab.url)} sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" /><div className="remote-boundary"><ShieldCheck size={16} /><span>Cross-origin sites may block embedded views by policy. Lycon keeps that boundary visible instead of silently proxying the page.</span></div></div>}<p className="sr-status" aria-live="polite">{notice}</p></div><footer className="footer"><span>Lycon Browser v1.0</span><span className="footer-separator">/</span><a href="/download">Downloads</a><span className="footer-separator">/</span><a href="/privacy">Privacy</a><span className="footer-separator">/</span><a href="/security">Security</a><span className="footer-separator">/</span><a href="https://github.com/Daemon22/Lycon" target="_blank" rel="noreferrer">source on GitHub <ArrowUpRight size={12} /></a></footer></div></main>;
}
