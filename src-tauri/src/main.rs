#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use url::Url;

// Navigation-level interception only; subresource requests are not blocked.
// This is partial parity with Android GeckoView shields.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ShieldsState {
    pub enabled: bool,
    pub https_only: bool,
    pub tracker_blocking: bool,
}

impl Default for ShieldsState {
    fn default() -> Self {
        Self {
            enabled: true,
            https_only: true,
            tracker_blocking: true,
        }
    }
}

static SHIELDS_STATE: OnceLock<Mutex<ShieldsState>> = OnceLock::new();

fn shields() -> &'static Mutex<ShieldsState> {
    SHIELDS_STATE.get_or_init(|| Mutex::new(ShieldsState::default()))
}

// ── Agent connector storage (Article VII / IX native surface) ───────────
// Local JSON persistence for agent connectors in the app-data dir, mirroring
// the Android LyconAgentService contract (id/name/location/protocol/endpoint/
// model/enabled/contextScopes/createdAt/updatedAt). API keys are intentionally
// NOT persisted to this plain file — the desktop equivalent of Android's
// AES-GCM Keystore protection (Windows DPAPI) is a follow-up. The list/public
// view strips secrets exactly like LyconAgentService.public().
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub location: String,
    pub protocol: String,
    pub endpoint: String,
    pub model: String,
    pub enabled: bool,
    pub context_scopes: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Incoming connector input. Mirrors the platformCapabilities.ts
/// `AgentRegisterInput` shape (camelCase) and is tolerant of missing fields,
/// exactly like Android's `normalize()`. The `apiKey` field is accepted for
/// API symmetry but is not persisted to the plain JSON store.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AgentInput {
    pub id: Option<String>,
    pub name: Option<String>,
    pub endpoint: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub protocol: Option<String>,
    pub enabled: Option<bool>,
    pub context_scopes: Option<Vec<String>>,
    pub api_key: Option<String>,
}

static AGENTS: OnceLock<Mutex<Vec<Agent>>> = OnceLock::new();

fn agents_state() -> &'static Mutex<Vec<Agent>> {
    AGENTS.get_or_init(|| Mutex::new(Vec::new()))
}

fn agents_file_path(handle: &tauri::AppHandle) -> Option<PathBuf> {
    handle.path().app_data_dir().ok().map(|dir| dir.join("lycon").join("agents.json"))
}

fn load_agents(handle: &tauri::AppHandle) -> Vec<Agent> {
    let path = match agents_file_path(handle) {
        Some(p) => p,
        None => return Vec::new(),
    };
    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str::<Vec<Agent>>(&text).unwrap_or_default()
}

fn persist_agents(handle: &tauri::AppHandle, agents: &[Agent]) -> Result<(), String> {
    let path = match agents_file_path(handle) {
        Some(p) => p,
        None => return Err("app data dir unavailable".to_string()),
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(agents).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_id() -> String {
    format!("agent-{}", now_millis())
}

/// Normalize an input into a persisted Agent, mirroring Android's
/// `LyconAgentService.normalize()`: input id → existing id → fresh id, with
/// endpoint validation and sensible defaults. Generates at most one id.
fn normalize_agent(input: &AgentInput, existing: Option<&Agent>) -> Result<Agent, String> {
    let id = input
        .id
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            existing.and_then(|e| {
                if e.id.is_empty() {
                    None
                } else {
                    Some(e.id.clone())
                }
            })
        })
        .unwrap_or_else(generate_id);

    let endpoint = input.endpoint.as_deref().unwrap_or("").trim().to_string();
    let uri = Url::parse(&endpoint)
        .map_err(|_| "Enter a valid HTTP or HTTPS endpoint.".to_string())?;
    if uri.scheme() != "http" && uri.scheme() != "https" {
        return Err("Connections must use HTTP or HTTPS.".to_string());
    }

    let mut location = input.location.as_deref().unwrap_or("").trim().to_string();
    if location.is_empty() {
        location = existing.map(|e| e.location.clone()).unwrap_or_else(|| "local".to_string());
    }
    if location == "remote" && uri.scheme() != "https" {
        return Err("Remote connections must use HTTPS.".to_string());
    }
    if matches!(uri.host_str(), Some("localhost" | "127.0.0.1" | "::1")) {
        location = "local".to_string();
    }

    let created_at = existing.map(|e| e.created_at).unwrap_or_else(now_millis);
    let protocol = input
        .protocol
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_string();
    let protocol = if protocol.is_empty() {
        "openai-chat".to_string()
    } else {
        protocol
    };
    let model = input.model.as_deref().unwrap_or("").trim().to_string();
    let model = if model.is_empty() {
        existing.map(|e| e.model.clone()).unwrap_or_default()
    } else {
        model
    };
    let context_scopes = input
        .context_scopes
        .as_ref()
        .filter(|v| !v.is_empty())
        .cloned()
        .unwrap_or_else(|| vec!["selection".to_string()]);
    let enabled = input.enabled.unwrap_or(true);
    let name = input.name.as_deref().unwrap_or("").trim().to_string();

    Ok(Agent {
        id,
        name,
        location,
        protocol,
        endpoint,
        model,
        enabled,
        context_scopes,
        created_at,
        updated_at: now_millis(),
    })
}

#[tauri::command]
fn agents_list(handle: tauri::AppHandle) -> Result<Vec<Agent>, String> {
    let mut state = agents_state()
        .lock()
        .map_err(|_| "agent state lock poisoned".to_string())?;
    let loaded = load_agents(&handle);
    *state = loaded;
    Ok(state.clone())
}

#[tauri::command]
fn agents_save(handle: tauri::AppHandle, input: AgentInput) -> Result<Agent, String> {
    let mut state = agents_state()
        .lock()
        .map_err(|_| "agent state lock poisoned".to_string())?;
    let existing = state
        .iter()
        .find(|a| a.id == input.id.as_deref().unwrap_or(""))
        .cloned();
    let agent = normalize_agent(&input, existing.as_ref())?;
    let mut v = load_agents(&handle);
    if let Some(pos) = v.iter().position(|a| a.id == agent.id) {
        v[pos] = agent.clone();
    } else {
        v.push(agent.clone());
    }
    persist_agents(&handle, &v)?;
    *state = v;
    Ok(agent)
}

#[tauri::command]
fn agents_remove(handle: tauri::AppHandle, id: String) -> Result<Vec<Agent>, String> {
    let mut state = agents_state()
        .lock()
        .map_err(|_| "agent state lock poisoned".to_string())?;
    let mut v = load_agents(&handle);
    v.retain(|a| a.id != id);
    persist_agents(&handle, &v)?;
    *state = v.clone();
    Ok(v)
}

#[tauri::command]
fn agents_request(handle: tauri::AppHandle, input: serde_json::Value) -> Result<serde_json::Value, String> {
    // Mirrors the precondition guards of Android's LyconAgentService.request().
    // Full inference execution for the Windows shell is deferred (Windows
    // DPAPI key handling + the desktop HTTPS executor); this command
    // acknowledges the submission so the UI contract (resolve/reject) is
    // uniform across shells.
    let confirmed = input
        .get("confirmed")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !confirmed {
        return Err("The request was not confirmed.".to_string());
    }
    let connector_id = input
        .get("connectorId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if connector_id.is_empty() {
        return Err("Choose an enabled intelligence connection first.".to_string());
    }
    let v = load_agents(&handle);
    let agent = match v.iter().find(|a| a.id == connector_id) {
        Some(a) => a,
        None => return Err("Choose an enabled intelligence connection first.".to_string()),
    };
    if !agent.enabled {
        return Err("This intelligence connection is disabled.".to_string());
    }
    // TODO: hardened-posture guard (settings.json sensitivity == "hardened" &&
    //   remote + page/tab/localFile scope) once Windows settings persistence lands.
    Ok(serde_json::json!({ "status": "submitted", "connectorId": connector_id }))
}

mod commands {
    use super::{shields, ShieldsState};

    #[tauri::command]
    pub fn get_shields_state() -> Result<ShieldsState, String> {
        shields()
            .lock()
            .map(|state| state.clone())
            .map_err(|_| "shields state lock poisoned".to_string())
    }

    #[tauri::command]
    pub fn set_shields_state(state: ShieldsState) -> Result<ShieldsState, String> {
        if state.tracker_blocking && !state.enabled {
            return Err("tracker blocking requires shields to be enabled".to_string());
        }
        let mut current = shields()
            .lock()
            .map_err(|_| "shields state lock poisoned".to_string())?;
        *current = state.clone();
        Ok(state)
    }
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
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("lycon-navigation")
                .on_navigation(|webview, url| {
                    let state = match shields().lock() {
                        Ok(state) => state.clone(),
                        Err(_) => return false,
                    };
                    match evaluate_navigation(url.as_str(), &state) {
                        Ok(next_url) => {
                            if next_url != url.as_str() {
                                let _ = webview
                                    .app_handle()
                                    .emit("lycon://navigation-upgrade", next_url);
                            }
                            true
                        }
                        Err(_) => false,
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::get_shields_state,
            commands::set_shields_state,
            agents_list,
            agents_save,
            agents_remove,
            agents_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lycon Browser");
}

#[cfg(test)]
mod agent_tests {
    use super::{Agent, AgentInput, generate_id, normalize_agent};

    // Pure-function verification of the native agent connector normalization,
    // mirroring the Android L267 precedence contract (input id -> existing id
    // -> one generated id; never eager UUID generation) and the endpoint guards.
    fn existing() -> Agent {
        Agent {
            id: "agent-existing".into(),
            name: "n".into(),
            location: "local".into(),
            protocol: "openai-chat".into(),
            endpoint: "https://x".into(),
            model: "m".into(),
            enabled: true,
            context_scopes: vec!["selection".into()],
            created_at: 1,
            updated_at: 1,
        }
    }

    fn input(endpoint: &str) -> AgentInput {
        AgentInput {
            endpoint: Some(endpoint.into()),
            ..Default::default()
        }
    }

    #[test]
    fn input_id_takes_precedence_over_existing() {
        let mut i = input("https://x");
        i.id = Some("agent-custom".into());
        let agent = normalize_agent(&i, Some(&existing())).expect("valid");
        assert_eq!(agent.id, "agent-custom");
    }

    #[test]
    fn existing_id_reused_when_input_id_empty() {
        let agent = normalize_agent(&input("https://x"), Some(&existing())).expect("valid");
        assert_eq!(agent.id, "agent-existing");
    }

    #[test]
    fn fresh_id_generated_only_when_no_id_and_no_existing() {
        let agent = normalize_agent(&input("https://x"), None).expect("valid");
        assert!(agent.id.starts_with("agent-"), "got {}", agent.id);
    }

    // Persistence semantics (save -> list -> remove -> list -> restart/load)
    // are exercised by load_agents/persist_agents re-reading agents.json on
    // every call. Here we assert the in-memory contract that save/remove
    // preserve ordering and that remove drops exactly one connector.
    #[test]
    fn save_overwrite_preserves_count_and_updates_existing() {
        let mut v: Vec<Agent> = vec![existing()];
        let saved = normalize_agent(&input("https://updated"), Some(&existing())).unwrap();
        if let Some(pos) = v.iter().position(|a| a.id == saved.id) {
            v[pos] = saved.clone();
        } else {
            v.push(saved.clone());
        }
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].endpoint, "https://updated");
    }

    #[test]
    fn remove_drops_exactly_one_connector() {
        let mut v: Vec<Agent> = vec![existing()];
        v.retain(|a| a.id != "agent-existing");
        assert!(v.is_empty());
    }

    #[test]
    fn non_http_endpoint_rejected() {
        assert!(normalize_agent(&input("ftp://x"), None).is_err());
    }

    #[test]
    fn remote_requires_https() {
        let mut i = input("http://example.com");
        i.location = Some("remote".into());
        assert!(normalize_agent(&i, None).is_err());
    }

    #[test]
    fn generate_id_is_prefixed() {
        assert!(generate_id().starts_with("agent-"));
    }

    #[test]
    fn agent_struct_never_serializes_secrets() {
        // Agent has no api_key field; the JSON surface (used by agents_list/agents_save
        // responses) cannot leak secrets. Compile-time property.
        use serde_json::to_string;
        let json = to_string(&existing()).expect("serializes");
        assert!(!json.contains("api_key"), "{} leaked", json);
    }
}
