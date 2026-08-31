// Quiet Field Instrument: asymmetric browser shell, cinematic environment, deliberate public/private state, and tactile controls.
import { useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, CircleDot, Globe2, LockKeyhole, Menu, Mic, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";

type Mode = "public" | "private";

type Tab = { id: number; label: string; private?: boolean };

const ASSETS = {
  logo: "/manus-storage/lycon-supplied-logo_58eb806e.png",
  public: "/manus-storage/lycon-public-forest_ff72073a.jpg",
  private: "/manus-storage/lycon-private-cave_b05760f2.jpg",
  texture: "/manus-storage/lycon-signal-grid_c4142b8c.jpg",
  badge: "/manus-storage/lycon-wolf-badge_b5234c89.png",
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("public");
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: "Start" }]);
  const [activeTab, setActiveTab] = useState(1);
  const [address, setAddress] = useState("");
  const [notice, setNotice] = useState("");
  const active = tabs.find((tab) => tab.id === activeTab);
  const isPrivate = mode === "private";

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const toggleMode = () => {
    const next = isPrivate ? "public" : "private";
    setMode(next);
    announce(next === "private" ? "Private mode on" : "Public mode on");
  };

  const newTab = () => {
    const id = Math.max(...tabs.map((tab) => tab.id)) + 1;
    setTabs((current) => [...current, { id, label: "New tab", private: isPrivate }]);
    setActiveTab(id);
  };

  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
    const next = tabs.filter((tab) => tab.id !== id);
    setTabs(next);
    if (activeTab === id) setActiveTab(next[next.length - 1].id);
  };

  return (
    <main className={`app-shell ${isPrivate ? "private" : "public"}`} style={{ "--hero-image": `url(${isPrivate ? ASSETS.private : ASSETS.public})`, "--texture-image": `url(${ASSETS.texture})` } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="sidebar-topline">
          <button className="brand-button" aria-label="Lycon home" onClick={() => announce("Lycon home")}><img src={ASSETS.logo} alt="Lycon wolf mark" /></button>
          <span className="sidebar-caption">FIELD KIT / 01</span>
        </div>
        <div className="sidebar-rule" />
        <nav className="side-nav" aria-label="Primary navigation">
          <button className="side-link active"><Sparkles size={15} /><span>Start field</span><span className="side-key">01</span></button>
          <button className="side-link" onClick={() => announce("Bookmarks are ready in the full browser build")}><Bookmark size={15} /><span>Bookmarks</span><span className="side-key">02</span></button>
          <button className="side-link" onClick={() => announce("History stays on this device")}><RefreshCw size={15} /><span>Local history</span><span className="side-key">03</span></button>
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-status"><span className="status-light" /> <span>{isPrivate ? "PROVEN / LOCAL" : "CONNECTED / ONLINE"}</span></div>
          <p>Lycon keeps the local web close, then makes the wider web deliberate.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="browser-bar">
          <div className="window-controls"><span /><span /><span /></div>
          <div className="tab-strip">
            {tabs.map((tab) => <button key={tab.id} className={`browser-tab ${tab.id === activeTab ? "selected" : ""}`} onClick={() => setActiveTab(tab.id)}><span className="tab-dot" />{tab.private || isPrivate ? "Private · " : ""}{tab.label}<span className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X size={11} /></span></button>)}
            <button className="new-tab" onClick={newTab} aria-label="New tab"><Plus size={16} /></button>
          </div>
          <div className="window-menu"><button className="quiet-icon" onClick={() => announce("Browser settings")} aria-label="Browser menu"><Menu size={17} /></button></div>
        </header>

        <div className="toolbar">
          <button className="toolbar-icon" onClick={() => announce("Back") } aria-label="Back"><ArrowLeft size={17} /></button>
          <button className="toolbar-icon muted" onClick={() => announce("Forward")} aria-label="Forward"><ArrowRight size={17} /></button>
          <button className="toolbar-icon" onClick={() => announce("Field refreshed")} aria-label="Refresh"><RefreshCw size={16} /></button>
          <div className="address-bar"><LockKeyhole size={14} className={isPrivate ? "amber" : "blue"} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search locally or enter an address" aria-label="Address and search" /><Search size={15} className="address-search" /></div>
          <button className={`mode-switch ${isPrivate ? "active" : ""}`} onClick={toggleMode}><span className="mode-switch-icon">{isPrivate ? <LockKeyhole size={14} /> : <Globe2 size={14} />}</span><span>{isPrivate ? "Private" : "Public"}</span><ChevronDown size={13} /></button>
          <button className="toolbar-icon" onClick={() => announce("Shields are active")} aria-label="Shields"><ShieldCheck size={16} /></button>
        </div>

        <div className="mode-ribbon"><div className={`mode-pair-chip ${!isPrivate ? "current" : ""}`}><span className="ribbon-dot blue-dot" />PUBLIC / ONLINE</div><div className={`mode-pair-chip ${isPrivate ? "current private-chip" : ""}`}><span className="ribbon-dot amber-dot" />PRIVATE / PROVEN</div><span className="ribbon-divider" /><span className="ribbon-copy">{isPrivate ? "Your device, in focus" : "Online, global, connected"}</span><span className="ribbon-spacer" /><span className="ribbon-hint">{active?.label} <SlidersHorizontal size={13} /></span></div>

        <section className="hero">
          <div className="hero-overlay" />
          <div className="hero-grid" />
          <div className="hero-content">
            <div className="eyebrow"><CircleDot size={11} /> FIELD INSTRUMENT / 01</div>
            <h1>Browse <em>wild.</em><br />Browse free.</h1>
            <p className="hero-copy">A quiet home for the {isPrivate ? "local" : "open"} web. Lycon keeps your own device in focus, then puts you in control when a page needs the wider internet.</p>
            <div className="hero-actions"><button className="primary-action" onClick={() => announce(isPrivate ? "Private field ready" : "Public field ready")}>{isPrivate ? <LockKeyhole size={16} /> : <Globe2 size={16} />} {isPrivate ? "Keep it local" : "Open the wider web"}<ArrowRight size={15} /></button><button className="secondary-action" onClick={toggleMode}>Switch to {isPrivate ? "public" : "private"}</button></div>
            <div className="hero-metrics"><span><strong>{isPrivate ? "PROVEN" : "ONLINE"}</strong>{isPrivate ? "Local · secure · yours" : "Global · connected · deliberate"}</span><span className="metric-rule" /><span><Mic size={14} /> Voice-ready</span></div>
          </div>
          <div className="brand-plate"><div className="plate-kicker">IDENTITY / LYCON</div><div className="plate-mark"><img src={ASSETS.logo} alt="Lycon wolf mark" /></div><div className="plate-readout"><span>{isPrivate ? "PROVEN" : "REACH"}</span><strong>{isPrivate ? "LOCAL FIELD" : "OPEN WEB"}</strong></div></div><div className="hero-readout"><span>LAT 07° 29′ S</span><span>LONG 24° 40′ E</span><span className="readout-signal">SIGNAL {isPrivate ? "SHELTERED" : "LIVE"}</span></div>
          <div className="status-card"><div className="status-card-icon">{isPrivate ? <LockKeyhole size={18} /> : <Globe2 size={18} />}</div><div><strong>{isPrivate ? "Private Mode" : "Public Mode"}</strong><span>{isPrivate ? "Proven · Local · Secure" : "Online · Global · Connected"}</span></div><Check size={15} className="status-check" /></div>
          <div className="scroll-cue">SCROLL TO EXPLORE <ArrowRight size={13} /></div>
        </section>
      </section>
      {notice && <div className="toast"><span className="toast-pip" />{notice}</div>}
    </main>
  );
}
