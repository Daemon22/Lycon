import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useLyconTheme } from "../contexts/LyconThemeContext";

const wolfLogo = "/assets/lycon-logo.png";

export function LyconHeader() {
  const { theme, toggleTheme } = useLyconTheme();
  return <header className="topbar">
    <Link className="mini-brand" href="/" aria-label="Lycon browser home"><img src={wolfLogo} alt="Lycon wolf mark" /><span>L<span className="brand-y">y</span>con</span></Link>
    <nav className="topnav" aria-label="Primary navigation"><Link href="/">Browser</Link><Link href="/download">Downloads</Link><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link></nav>
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === "dark" ? "Light" : "Dark"}</span></button>
  </header>;
}

export function LyconFooter() {
  return <footer className="footer"><span>Lycon Browser v1.0</span><span className="footer-separator">/</span><Link href="/privacy">Privacy</Link><span className="footer-separator">/</span><Link href="/security">Security</Link><span className="footer-separator">/</span><Link href="/download">Windows & Android downloads <ArrowUpRight size={12} /></Link><span className="footer-separator">/</span><a href="https://github.com/Daemon22/Lycon" target="_blank" rel="noreferrer">source on GitHub <ArrowUpRight size={12} /></a></footer>;
}

export function ProductPage({ children }: { children: React.ReactNode }) {
  return <main className="trailhead-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="trailhead-page product-page"><LyconHeader />{children}<LyconFooter /></div></main>;
}
