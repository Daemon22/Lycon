# Configure a local self-hosted LLM in Lycon

This guide uses **Ollama** as the concrete example because Ollama exposes an OpenAI-compatible chat endpoint at `http://localhost:11434/v1/chat/completions`.[1]

> Lycon is useful with no intelligence connected. Adding a connector is an explicit opt-in, and creating a connector does not send page data.

## 1. Start a local model service

Install Ollama from the official distribution for your operating system, start the service, and download a model. For example:

```bash
ollama pull qwen3:8b
ollama serve
```

Verify the service locally with a request that contains no Lycon page context:

```bash
curl -X POST http://localhost:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"Reply with the word ready."}]}'
```

The Ollama compatibility documentation shows the same `/v1/chat/completions` shape and notes that an OpenAI-style API key may be supplied as a compatibility value but is ignored by Ollama.[1]

## 2. Select Hardened posture first

Open Lycon and click the **Balanced** posture indicator in the URL bar. Choose **Hardened**. Hardened posture keeps Lycon’s shields and HTTPS-only behavior active, and it prevents page, tab, and local-file context from being sent to a remote connector. A local connector remains available for local work.

Hardened posture does not turn on an agent, inspect pages, or transmit anything. It changes the guardrails that apply if you later order an intelligence request.

## 3. Add the local connector

Open the optional intelligence panel with the wolf-head toolbar button, or choose **Menu → Optional intelligence**. Select **Add an optional connection** and enter the following values:

| Lycon field | Value |
|---|---|
| Name | `Local Ollama` |
| Runs at | `On this device / local network` |
| Endpoint | `http://127.0.0.1:11434/v1/chat/completions` |
| Model | The exact model tag shown by `ollama list`, such as `qwen3:8b` |
| API key | Leave blank for Ollama, or enter `ollama` if a compatibility key is required by your local setup |

Click **Test endpoint**. Lycon performs an endpoint-only test without page context. A response such as HTTP 405 can still indicate that the endpoint is reachable but only accepts POST; use the real request path to validate a chat completion. Click **Add connection** when the endpoint is correct.

## 4. Make an explicit request

Choose a context scope. **Prompt only** sends no page material. **Selected text** sends only text you selected in the active page. **Current page** sends readable active-page text, and **Local file** sends content from a local page you explicitly opened. Under Hardened posture, page, tab, and local-file context are blocked for remote connectors but remain available to local connectors.

Write a prompt, review the destination preview, and tick the confirmation checkbox. Lycon will not dispatch the request until you confirm. The native host sends the request, returns the response, and records only metadata such as destination, scope, timestamp, and result state. Prompts and page contents are not stored in the audit history by default.

## 5. Verify local-first behavior

Use **Open Local File** or press **Ctrl+O** to select an HTML, PDF, text, image, audio, or video file. You can also paste an absolute path or a `~/...` path into the URL bar. A local file is opened as a `file://` URL; no intelligence request is implied by opening it.

To keep a local web application local, use a loopback URL such as `http://127.0.0.1:3000`. Lycon treats loopback HTTP as local development traffic. Remote connector records, by contrast, must use HTTPS.

## Platform credential storage

On Electron, Lycon keeps connector metadata in its local data directory and encrypts API keys using Electron’s `safeStorage` facility when available. On Windows, connector metadata is local JSON and API keys are stored in the per-user Windows Credential Locker using `PasswordVault`.[2] On Android, connector metadata is local app-private JSON and API keys are encrypted with an AES-GCM key held by Android Keystore.[3]

The renderer receives sanitized connector records only. It never receives an API key, and page scripts do not receive the connector object or native bridge credentials.

## References

[1]: https://docs.ollama.com/api/openai-compatibility "Ollama — OpenAI compatibility"
[2]: https://learn.microsoft.com/en-us/windows/apps/develop/security/credential-locker "Microsoft Learn — Credential locker for Windows apps"
[3]: https://developer.android.com/privacy-and-security/keystore "Android Developers — Android Keystore system"
