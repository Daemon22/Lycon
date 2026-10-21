# LYCON product vision

## Product stance

Lycon is a complete browser before it is anything else. It must not assume that the user owns an AI agent, runs a local model, has an assistant installed, or wants intelligence working in the background. A user who connects nothing should receive a fast, secure, private browser with first-class local-file and developer workflows.

Optional intelligence is an extension of the browser, not a prerequisite for using it. Lycon should make it equally natural to connect a local LLM, a self-hosted API, a cloud model, a browser-native agent, an automation service, or another user-selected intelligence. The browser presents one consistent intermediary surface while clearly showing where the connection runs and what data it may receive.

## Required specializations

| Area | Requirement | Default behavior |
|---|---|---|
| Agent-agnostic intermediary | Support flexible connectors for local, self-hosted, cloud, browser-native, and other user-selected intelligence | No connector is configured or active by default |
| Intelligent browsing | Allow an optional connected intelligence to inspect, summarize, transform, or act on explicit user-selected page context | No background page inspection or autonomous action |
| Hunter posture | Provide adjustable sensitivity from permissive to hardened, with clear explanations of the protections enabled | Hardened protections enabled by default |
| Security | Resist tracking and fingerprinting, minimize egress, enforce permissions, isolate sessions, and log explicit outbound requests | Deny or ask unless the user orders an action |
| Privacy sovereignty | Never silently sync or transmit private browser data to a vendor or remote intelligence | Local-only persistence and no telemetry by default |
| Developer sanctuary | Treat localhost, local files, offline pages, local WASM, and self-hosted agent interfaces as first-class use cases | Local files and local paths open directly when explicitly selected |
| Usability | Remain understandable and useful for a non-technical user with zero intelligence connected | Empty-state guidance explains optional connections without implying a missing feature |

## Architectural principles

1. **No-agent completeness.** Every browser feature must work without an intelligence connector. Agent panels should communicate “Connect intelligence” rather than displaying a broken or assumed assistant.
2. **Explicit context.** An intelligence may receive only the page, selection, tab, or local file context the user explicitly chooses. Context scope must be visible before dispatch.
3. **Explicit egress.** Any request leaving the device must show its destination, provider, context scope, and user action. There is no default sync, telemetry, background prompt, or vendor-controlled pipeline.
4. **Uniform connector protocol.** Local and remote providers use the same renderer-facing contract, while the native layer owns secrets, transport, permissions, and audit records.
5. **Sensitivity is a posture, not a hidden toggle.** The user can set a global posture and override it per site, tab, or session. Each posture explains tracker blocking, fingerprinting defenses, permission behavior, script restrictions, and intelligence context rules.
6. **Local-first storage.** Settings, bookmarks, history, connector definitions, audit entries, and session metadata are persisted locally. Secrets must be stored using the platform’s protected storage rather than plain JSON.

## Initial implementation boundary

The first implementation should deliver the connector abstraction, no-agent UI states, a local/cloud connector management surface, explicit context selection, a three-level sensitivity dial, and an auditable request path. It should not invent a background autonomous agent, claim that arbitrary providers already work without adapters, or transmit page data merely because a connector exists.

## Acceptance criteria

- Lycon launches and remains fully usable with zero connectors configured.
- Users can add, test, disable, and remove a local or remote connector through one consistent interface.
- Connector records identify runtime location, endpoint, authentication state, and allowed context scopes.
- A page-context action previews what will be shared and remains cancelable before dispatch.
- Sensitivity posture is visible in the browser chrome and can be changed globally and per site/session.
- High sensitivity blocks or prompts for more categories of tracking, permission, script, and intelligence-context behavior than weak sensitivity.
- Local files, `file://`, localhost, offline pages, and local web apps remain accessible through explicit user actions.
- Every outbound intelligence request is represented in a local audit log with destination, timestamp, context scope, and result state.
- No background request is made when the user has not initiated an intelligence action.
- All shared UI assets and connector states remain local-first and offline-safe.
