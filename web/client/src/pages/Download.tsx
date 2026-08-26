import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Download as DownloadIcon, MonitorDown, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { LyconFooter, LyconHeader } from "../components/LyconFrame";

type ReleaseAsset = { name: string; browser_download_url: string; size: number };
type Release = { tag_name: string; html_url: string; assets: ReleaseAsset[] };
const releasesUrl = "https://github.com/Daemon22/Lycon/releases";

/** Lycon Browser: release links discover signed native artifacts without inventing binaries or hiding an empty channel. */
export default function Download() {
  const [release, setRelease] = useState<Release | null>(null);
  const [releaseState, setReleaseState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    fetch("https://api.github.com/repos/Daemon22/Lycon/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => response.ok ? response.json() as Promise<Release> : Promise.reject(new Error("No published release")))
      .then((data) => { setRelease(data); setReleaseState("ready"); })
      .catch(() => setReleaseState("empty"));
  }, []);

  const windowsAsset = release?.assets.find((asset) => /windows|win32|msix|exe/i.test(asset.name));
  const androidAsset = release?.assets.find((asset) => /android|apk|aab/i.test(asset.name));
  const releaseLink = release?.html_url ?? releasesUrl;
  const statusText = releaseState === "loading" ? "Checking the signed release channel…" : releaseState === "ready" ? `Latest verified channel: ${release?.tag_name}` : "No public release artifacts are published yet.";

  return <main className="trailhead-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="trailhead-page product-page"><LyconHeader /><section className="subpage-hero"><Link className="back-link" href="/"><ArrowLeft size={14} /> Back to browser</Link><span className="subpage-kicker">Native applications / 02</span><h1>Take Lycon<br /><em>with you.</em></h1><p>Install the Hunter browser where local files, shields, posture controls, and optional intelligence can work with the device instead of around it.</p></section><section className="release-status"><span className={releaseState === "ready" ? "status-live" : "status-pending"}>{releaseState === "ready" ? <Check size={13} /> : <CircleAlert size={13} />}</span><span>{statusText}</span><a href={releaseLink} target="_blank" rel="noreferrer">Open release channel <ArrowUpRight size={13} /></a></section><section className="download-grid"><article className="download-card"><div className="download-card-top"><span className="download-icon"><MonitorDown size={24} /></span><span className="platform-tag">Desktop</span></div><h2>Lycon for Windows</h2><p>A native Windows browser with local paths, Windows Credential Locker storage, and adjustable Hunter’s Posture controls.</p><div className="check-list"><span><Check size={14} /> Local files and localhost</span><span><Check size={14} /> Windows protected credentials</span><span><Check size={14} /> Optional local or cloud intelligence</span></div><a className="primary-download" href={windowsAsset?.browser_download_url ?? releaseLink} target="_blank" rel="noreferrer">{windowsAsset ? <><DownloadIcon size={15} /> Download signed Windows build</> : <>View signed Windows releases <ArrowUpRight size={15} /></>}</a><small className="download-note">{windowsAsset ? `${windowsAsset.name} · ${(windowsAsset.size / 1024 / 1024).toFixed(1)} MB` : "Signed artifacts will appear here when published in GitHub Releases."}</small></article><article className="download-card"><div className="download-card-top"><span className="download-icon"><Smartphone size={24} /></span><span className="platform-tag">Mobile</span></div><h2>Lycon for Android</h2><p>A GeckoView-based mobile browser with Android Keystore-backed protection and a local-first browsing path.</p><div className="check-list"><span><Check size={14} /> Local content and file intents</span><span><Check size={14} /> Android Keystore protection</span><span><Check size={14} /> Explicit intelligence requests</span></div><a className="primary-download" href={androidAsset?.browser_download_url ?? releaseLink} target="_blank" rel="noreferrer">{androidAsset ? <><DownloadIcon size={15} /> Download signed Android build</> : <>View signed Android releases <ArrowUpRight size={15} /></>}</a><small className="download-note">{androidAsset ? `${androidAsset.name} · ${(androidAsset.size / 1024 / 1024).toFixed(1)} MB` : "Signed APK/AAB artifacts will appear here when published in GitHub Releases."}</small></article></section><section className="download-boundary"><strong>Signed release channel</strong><span>The page checks GitHub’s public release API for the latest platform-matched artifact. It never fabricates or silently substitutes a download.</span><a href={releasesUrl} target="_blank" rel="noreferrer">Open Releases <ArrowUpRight size={14} /></a></section><section className="download-boundary"><strong>Browser boundary</strong><span>This web page can link you to builds, but only the native Lycon applications can access local paths, platform credential stores, and browser-level shields.</span></section><LyconFooter /></div></main>;
}
