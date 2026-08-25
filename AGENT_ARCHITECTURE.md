# Lycon agent-agnostic architecture

Lycon is complete without an intelligence connection. The agent layer is an optional, user-initiated intermediary that can speak to a local process, a self-hosted API, a cloud endpoint, a browser-native service, or another compatible provider through one renderer-facing contract.

## Connector record

The renderer sees a sanitized connector record. Secrets never cross into the renderer or enter the normal JSON settings file.

```json
{
  "id": "local-ollama",
  "name": "Local Ollama",
  "location": "local",
  "protocol": "openai-chat",
  "endpoint": "http://127.0.0.1:11434/v1/chat/completions",
  "model": "llama3.2",
  "enabled": true,
  "contextScopes": ["selection"],
  "createdAt": 0,
  "updatedAt": 0
}
```

`location` is descriptive and is never inferred from a hostname. `protocol` identifies the adapter. The first adapter is an OpenAI-compatible chat completion request because many local and hosted providers expose that shape; future adapters can be added without changing the page-context UI.

## Explicit context scopes

- `none`: send only the user’s prompt.
- `selection`: send text the user explicitly selected in the active page.
- `page`: send the active page title, URL, and readable text after an explicit confirmation.
- `tab`: send the active tab’s metadata and selected/page context; never other tabs by default.
- `local-file`: send a local file only after the user chose it through the file picker.

The default scope is `selection`. If there is no selection, Lycon does not silently escalate to the full page.

## Sensitivity postures

| Posture | Intended use | Default controls |
|---|---|---|
| Hardened | Unknown or hostile sites | Shields on, HTTPS-only, permission prompts, no implicit agent context, local-only connector preference; remote page/local-file context is blocked |
| Balanced | Normal browsing | Shields on, HTTPS-only, explicit context confirmation, permission prompts |
| Permissive | Trusted development environments | User-controlled exceptions for localhost and selected sites; remote endpoints still require HTTPS and context still requires an explicit action |

Changing posture does not silently send data or enable an agent. Site/session overrides are stored locally and can be cleared.

## Outbound request lifecycle

1. The user opens the intelligence surface and chooses a connector, action, and context scope.
2. Lycon previews the destination, provider location, model, and exact context category.
3. The user confirms the request.
4. The native host sends the request, records a local audit entry, and returns the result or a safe error.
5. Lycon never performs autonomous follow-up requests, page mutation, or background polling.

Each audit entry contains an id, timestamp, connector id/name, destination origin, context scope, request state, and a short error/result summary. Prompt and page contents are not stored in the audit log by default.

## Non-goals for the first pass

This pass does not assume a universal agent protocol, invent provider credentials, run a hidden background model, or claim that every arbitrary endpoint is compatible. Providers must expose the declared adapter shape or receive a future adapter implementation. Remote connectors must use HTTPS; loopback HTTP endpoints are treated as local. In Hardened posture, page, tab, and local-file context cannot be sent to a remote connector.
