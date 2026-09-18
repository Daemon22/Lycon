#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Mutex, OnceLock};
use tauri::{command, AppHandle, Runtime};
use url::Url;

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ShieldsState {
    pub enabled: bool,
    pub https_only: bool,
    pub tracker_blocking: bool,
}

static SHIELDS_STATE: OnceLock<Mutex<ShieldsState>> = OnceLock::new();

fn shields() -> &'static Mutex<ShieldsState> {
    SHIELDS_STATE.get_or_init(|| Mutex::new(ShieldsState::default()))
}

#[command]
pub fn get_shields_state() -> ShieldsState {
    shields().lock().unwrap().clone()
}

#[command]
pub fn set_shields_state(state: ShieldsState) -> ShieldsState {
    let mut current = shields().lock().unwrap();
    *current = state.clone();
    state
}

fn is_local_host(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1" | "0.0.0.0")
        || host.ends_with(".localhost")
}

fn upgrade_http_to_https(raw_url: &str) -> Option<String> {
    let parsed = Url::parse(raw_url).ok()?;
    if parsed.scheme() != "http" {
        return None;
    }

    let host = parsed.host_str()?;
    if is_local_host(host) {
        return None;
    }

    let mut upgraded = parsed.clone();
    upgraded.set_scheme("https").ok()?;
    Some(upgraded.to_string())
}

fn is_tracker_domain(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    let blocked = [
        "doubleclick.net",
        "googlesyndication.com",
        "google-analytics.com",
        "adservice.google.com",
        "ads.google.com",
        "facebook.net",
        "twitter.com",
        "x.com",
    ];

    blocked.iter().any(|blocked_host| {
        host == *blocked_host || host.ends_with(&format!(".{blocked_host}"))
    })
}

fn evaluate_navigation(raw_url: &str, state: &ShieldsState) -> Result<String, String> {
    if !state.enabled {
        return Ok(raw_url.to_string());
    }

    if state.https_only {
        if let Some(upgraded) = upgrade_http_to_https(raw_url) {
            return Ok(upgraded);
        }
    }

    if state.tracker_blocking {
        if let Ok(parsed) = Url::parse(raw_url) {
            if let Some(host) = parsed.host_str() {
                if is_tracker_domain(host) {
                    return Err("request blocked by ad/tracker blocklist".to_string());
                }
            }
        }
    }

    Ok(raw_url.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_navigation(move |_app, url| {
                    let state = shields().lock().unwrap().clone();
                    match evaluate_navigation(url.as_str(), &state) {
                        Ok(next_url) => {
                            if next_url != url.as_str() {
                                let _ = app_handle.emit_all("lycon://navigation-upgrade", next_url);
                            }
                            Ok(())
                        }
                        Err(_) => Err("blocked by Lycon shields".to_string()),
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_shields_state, set_shields_state])
        .run(tauri::generate_context!())
        .expect("error while running Lycon Browser");
}
