import { FormEvent, useMemo, useState } from "react";
import { useLyconTheme } from "../contexts/LyconThemeContext";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  FileText,
  Github,
  Globe2,
  HardDrive,
  LockKeyhole,
  Menu,
  Moon,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Youtube,
} from "lucide-react";

/**
 * Lycon Trailhead Utility: the public companion keeps online browsing clear and useful,
 * while explicitly distinguishing native filesystem, shield, and credential features.
 */

const wolfLogo = "/manus-storage/lycon-wolf-logo_b005ce17.png";

const shortcuts = [
  { label: "DuckDuckGo", domain: "duckduckgo.com", href: "https://duckduckgo.com", icon: Globe2, tone: "orange" },
  { label: "YouTube", domain: "youtube.com", href: "https://youtube.com", icon: Youtube, tone: "red" },
  { label: "Wikipedia", domain: "wikipedia.org", href: "https://wikipedia.org", icon: BookOpen, tone: "paper" },
  { label: "GitHub", domain: "github.com", href: "https://github.com/Daemon22/Lycon", icon: Github, tone: "ink" },
  { label: "Reddit", domain: "reddit.com", href: "https://reddit.com", icon: MessageBubble, tone: "orange" },
  { label: "Hacker News", domain: "news.ycombinator.com", href: "https://news.ycombinator.com", icon: Network, tone: "orange" },
  { label: "MDN Web Docs", domain: "developer.mozilla.org", href: "https://developer.mozilla.org", icon: FileText, tone: "paper" },
  { label: "Proton Mail", domain: "proton.me/mail", href: "https://proton.me/mail", icon: LockKeyhole, tone: "violet" },
];

function MessageBubble(props: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={props.size ?? 22} height={props.size ?? 22} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.2 4.8A10.1 10.1 0 0 0 12 2C6.5 2 2 5.9 2 10.7c0 2.8 1.5 5.4 4 7l-.8 3.3 3.4-1.8c1 .3 2.1.5 3.4.5 5.5 0 10-3.9 10-8.7 0-2.3-.7-4.5-1.8-6.2ZM8 11H6v-2h2v2Zm5 0h-2v-2h2v2Zm5 0h-2v-2h2v2Z" />
    </svg>
  );
}

function ShortcutCard({ item }: { item: (typeof shortcuts)[number] }) {
  const Icon = item.icon;
  return (
    <a className="shortcut-card" href={item.href} target="_blank" rel="noreferrer">
      <span className={`shortcut-icon ${item.tone}`}><Icon size={20} strokeWidth={2.1} /></span>
      <span className="shortcut-copy">
        <strong>{item.label}</strong>
        <small>{item.domain}</small>
      </span>
      <ArrowUpRight className="shortcut-arrow" size={15} aria-hidden="true" />
    </a>
  );
}

export default function Home() {
  const { theme, toggleTheme } = useLyconTheme();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const shortcutCount = useMemo(() => shortcuts.length, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setNotice("Type a search or web address to continue.");
      return;
    }
    const destination = /^https?:\/\//i.test(value) ? value : `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
    window.open(destination, "_blank", "noopener,noreferrer");
    setNotice(/^https?:\/\//i.test(value) ? "Opened in a new tab." : "Search opened in a new tab.");
  }

  return (
    <main className="trailhead-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="trailhead-page">
        <header className="topbar">
          <a className="mini-brand" href="/" aria-label="Lycon home">
            <img src={wolfLogo} alt="Lycon wolf mark" />
            <span>L<span className="brand-y">y</span>con</span>
          </a>
          <nav className="topnav" aria-label="Primary navigation">
            <a href="#local-first">Local-first</a>
            <a href="#posture">Security posture</a>
            <a className="download-link" href="/download">Get Lycon <ArrowUpRight size={14} /></a>
          </nav>
          <div className="header-actions"><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === "dark" ? "Light" : "Dark"}</span></button><button className="menu-button" type="button" aria-label="Open navigation menu" onClick={() => setNotice("Use the links above to explore Lycon online.")}><Menu size={19} /></button></div>
        </header>

        <div className="console-frame">
        <section className="hero-block" aria-labelledby="hero-title">
          <div className="hero-kicker"><span className="kicker-dot" /> Online companion <span className="kicker-line" /></div>
          <div className="hero-mark-wrap"><img className="hero-mark" src={wolfLogo} alt="Lycon wolf mascot" /></div>
          <p className="eyebrow">Privacy-first browsing, with the boundary visible</p>
          <h1 id="hero-title">Browse wild.<br /><em>Browse free.</em></h1>
          <p className="hero-copy">Lycon keeps the web in your hands. The online companion gives you a clear trailhead; the full Hunter browser brings local files, shields, and optional intelligence to your device.</p>

          <form className="search-box" onSubmit={handleSearch} role="search">
            <Search size={19} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or type a web address" aria-label="Search or type a web address" />
            <button type="submit">Search <ChevronRight size={16} /></button>
          </form>
          <div className="search-note"><span>DuckDuckGo</span> is the default trailhead · opens in a new tab</div>
          <p className="sr-status" aria-live="polite">{notice}</p>
        </section>

        <section className="web-section" aria-labelledby="web-title">
          <div className="section-heading"><div><span className="section-index">01</span><h2 id="web-title">Your web</h2></div><span>{shortcutCount} field links</span></div>
          <div className="shortcut-grid">{shortcuts.map((item) => <ShortcutCard key={item.label} item={item} />)}</div>
        </section>

        <section className="feature-band" id="local-first" aria-labelledby="local-title">
          <div className="section-heading"><div><span className="section-index">02</span><h2 id="local-title">On your device</h2></div><span>Native Lycon</span></div>
          <div className="feature-layout">
            <article className="local-feature">
              <div className="feature-icon"><HardDrive size={20} /></div>
              <div><span className="feature-label">Local-first by design</span><h3>Keep the important trail offline.</h3><p>The full Lycon browser opens local paths, supports <code>file://</code> and <code>localhost</code>, and keeps native capabilities on the device where they belong.</p><a className="text-link" href="https://github.com/Daemon22/Lycon" target="_blank" rel="noreferrer">View the browser project <ArrowUpRight size={14} /></a></div>
            </article>
            <div className="boundary-stack" id="posture">
              <div className="boundary-card"><ShieldCheck size={18} /><div><strong>Hunter’s Posture</strong><span>Hardened, Balanced, or Permissive — you choose the sensitivity.</span></div></div>
              <div className="boundary-card"><Sparkles size={18} /><div><strong>Intelligence is optional</strong><span>Local or cloud connectors are explicit, auditable, and never assumed.</span></div></div>
            </div>
          </div>
        </section>

        </div>
        <footer className="footer"><span>Lycon Browser v1.0</span><span className="footer-separator">/</span><a href="/privacy">Privacy</a><span className="footer-separator">/</span><a href="/security">Security</a><span className="footer-separator">/</span><a href="/download">Windows & Android downloads <ArrowUpRight size={12} /></a><span className="footer-separator">/</span><a href="https://github.com/Daemon22/Lycon" target="_blank" rel="noreferrer">source on GitHub <ArrowUpRight size={12} /></a></footer>
      </div>
    </main>
  );
}
