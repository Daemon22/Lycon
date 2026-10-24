package com.lycon.browser

import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.AllowOrDeny

class MainActivity : AppCompatActivity() {

    private lateinit var geckoView: GeckoView
    private lateinit var runtime: GeckoRuntime
    private lateinit var session: GeckoSession
    private lateinit var dataService: LyconDataService
    private lateinit var shieldsService: LyconShieldsService
    private lateinit var bridge: LyconBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge UI
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        )

        setContentView(R.layout.activity_main)
        geckoView = findViewById(R.id.geckoView)

        dataService = LyconDataService(this)
        shieldsService = LyconShieldsService()

        // GeckoRuntime is per-process; create once
        // GeckoRuntime is recreated per Activity lifecycle (GeckoView 124 removed the
        // onRetainNonConfigurationInstance retention path used by older samples).
        runtime = GeckoRuntime.create(this)
        shieldsService.configureRuntime(runtime)

        // Set up the bridge — events are queued and drained by the shell
        bridge = LyconBridge(
            context = this,
            dataService = dataService,
            shieldsService = shieldsService,
            onWindowClose = { finish() },
            onWindowMinimize = { /* Android: not applicable for an Activity */ },
            onWindowMaximize = { /* Android: full-screen toggle would go here */ },
        )

        session = GeckoSession()
        session.settings.userAgentOverride = "Mozilla/5.0 (Linux; Android 14) Gecko/124.0 Lycon/1.0.0"
        session.open(runtime)

        // The Lycon UI is the canonical React frontend built from client/
        // (same bundle that Tauri serves on Windows). The React app is
        // self-contained — it manages its own tabs, bookmarks, history, and
        // settings via localStorage. GeckoView provides the native platform
        // features that the React layer cannot implement on its own:
        //   - Built-in content blocking (shields) via TrackingProtection
        //   - HTTPS-Only mode via the navigation delegate below
        //   - System download handling
        // The prompt-RPC bridge (LyconBridge.kt) is retained so that
        // future native↔JS features can be added without changing the
        // asset bundle structure.

        // Set up delegates
        setupSessionDelegates()

        // Load the canonical React frontend from assets/lycon-ui/index.html
        // (synced from client/ via ./sync-ui-bundle.sh — identical to the
        //  Windows Tauri build).
        geckoView.setSession(session)
        loadLyconUI()

        // Restore settings into shields
        val settings = dataService.loadSettings()
        shieldsService.isEnabled = settings.optBoolean("shieldsEnabled", true)
    }

    private fun setupSessionDelegates() {
        // Prompt delegate — intercepts window.prompt() calls from the UI.
        // The canonical React frontend does not use the prompt-RPC bridge for
        // data (it manages state in localStorage), but the delegate is retained
        // so that native↔JS features can be invoked from future UI modules or
        // the bridge.js fallback path.
        session.promptDelegate = object : GeckoSession.PromptDelegate {
            override fun onTextPrompt(
                session: GeckoSession,
                prompt: GeckoSession.PromptDelegate.TextPrompt
            ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse> {
                return GeckoResult.fromValue(handleBridgePrompt(prompt))
            }
        }

        // Content blocking delegate — increments shields counter when requests are blocked
        session.contentBlockingDelegate = object : ContentBlocking.Delegate {
            override fun onContentBlocked(session: GeckoSession, event: ContentBlocking.BlockEvent) {
                shieldsService.onBlocked()
                bridge.sendEvent("shields:blocked", JSONObject().apply {
                    put("url", "")
                    put("tabId", session.hashCode())
                    put("private", false)
                    put("filter", "geckoview-tp")
                })
            }
        }

        // Navigation delegate — handle window.open (new tabs)
        session.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLoadRequest(
                session: GeckoSession,
                request: GeckoSession.NavigationDelegate.LoadRequest
            ): GeckoResult<AllowOrDeny> {
                // HTTPS-Only: upgrade http:// to https://
                val settings = dataService.loadSettings()
                if (settings.optBoolean("httpsOnly", true) && request.uri.startsWith("http://")) {
                    try {
                        val uri = android.net.Uri.parse(request.uri)
                        if (uri.host != "localhost" && uri.host != "127.0.0.1") {
                            val upgraded = "https://" + request.uri.substring(7)
                            bridge.sendEvent("https:upgraded", JSONObject().apply {
                                put("from", request.uri)
                                put("to", upgraded)
                            })
                            session.loadUri(upgraded)
                            return GeckoResult.fromValue(AllowOrDeny.DENY)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "HTTPS upgrade failed: ${e.message}")
                    }
                }
                return GeckoResult.fromValue(AllowOrDeny.ALLOW)
            }

            override fun onNewSession(
                session: GeckoSession,
                uri: String
            ): GeckoResult<GeckoSession> {
                // window.open() — tell JS to open in a new tab
                bridge.sendEvent("tabs:openRequested", JSONObject().apply { put("url", uri) })
                // Return a dummy session that we immediately close
                val dummy = GeckoSession()
                dummy.open(runtime)
                dummy.close()
                return GeckoResult.fromValue(dummy)
            }
        }

        // Progress delegate — could update loading state in UI
        session.progressDelegate = object : GeckoSession.ProgressDelegate {}
    }

    /**
     * Handles a window.prompt() call from JS that uses the bridge protocol:
     *   lycon:invoke:<callId>:<action>:<payloadJson>
     */
    private fun handleBridgePrompt(
        prompt: GeckoSession.PromptDelegate.TextPrompt
    ): GeckoSession.PromptDelegate.PromptResponse {
        val msg = prompt.message ?: ""
        if (!msg.startsWith("lycon:invoke:")) {
            // Not our bridge — show as normal prompt (or dismiss)
            return prompt.dismiss()
        }
        try {
            val body = msg.removePrefix("lycon:invoke:")
            val colon1 = body.indexOf(':')
            if (colon1 <= 0) return prompt.dismiss()
            val rest = body.substring(colon1 + 1)

            // Action names contain ':' themselves (settings:get, shell:collectEvents)
            // and payloads may contain ':' too, so resolve the action against the
            // known handler vocabulary instead of blind colon-splitting.
            var action: String? = null
            var payloadStr = ""
            for (key in bridge.actions()) {
                if (rest == key) {
                    action = key
                    payloadStr = ""
                    break
                }
                if (rest.startsWith("$key:")) {
                    action = key
                    payloadStr = rest.substring(key.length + 1)
                    break
                }
            }
            if (action == null) return prompt.dismiss()
            val payload = if (payloadStr.isNotEmpty() && payloadStr != "null") {
                JSONObject(payloadStr)
            } else null

            val result = bridge.handleInvoke(action, payload)
            val resultJson = JSONObject().apply {
                put("result", result)
                put("error", JSONObject.NULL)
            }
            return prompt.confirm(resultJson.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Bridge invoke failed", e)
            val errorJson = JSONObject().apply {
                put("result", JSONObject.NULL)
                put("error", e.message ?: "Unknown error")
            }
            return prompt.confirm(errorJson.toString())
        }
    }

    private fun loadLyconUI() {
        // Load the canonical React frontend (built from client/) from
        // assets/lycon-ui/index.html. This is the same bundle that Tauri
        // serves on Windows — ensuring UI parity across platforms.
        // GeckoView can load asset:// URLs.
        session.loadUri("resource://android/assets/lycon-ui/index.html")
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            session.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing session: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "LyconMainActivity"
    }
}
