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

        // Set up the bridge — events are pushed via evaluateJavaScript
        bridge = LyconBridge(
            context = this,
            dataService = dataService,
            shieldsService = shieldsService,
            onEventSender = { event, payload -> sendEventToJs(event, payload) },
            onWindowClose = { finish() },
            onWindowMinimize = { /* Android: not applicable for an Activity */ },
            onWindowMaximize = { /* Android: full-screen toggle would go here */ },
        )

        session = GeckoSession()
        session.settings.userAgentOverride = "Mozilla/5.0 (Linux; Android 14) Gecko/124.0 Lycon/1.0"
        session.open(runtime)

        // Inject the bridge script before any page scripts run
        session.loadUri("about:blank")

        // Set up delegates
        setupSessionDelegates()

        // Load the Lycon UI bundle from assets/lycon-ui/index.html
        geckoView.setSession(session)
        loadLyconUI()

        // Restore settings into shields
        val settings = dataService.loadSettings()
        shieldsService.isEnabled = settings.optBoolean("shieldsEnabled", true)
    }

    private fun setupSessionDelegates() {
        // Prompt delegate — intercepts window.prompt() for the bridge protocol
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
            val parts = msg.split(":", limit = 4)
            if (parts.size != 4) return prompt.dismiss()
            val callId = parts[2]
            val action = parts[3].substringBefore(":")
            val payloadStr = parts[3].substringAfter(":", "")
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
        // Load the shared Lycon UI from assets/lycon-ui/index.html
        // GeckoView can load asset:// URLs
        session.loadUri("resource://android/assets/lycon-ui/index.html")
    }

    /**
     * Push an event to the JS side by calling window.__lyconBridge.onEvent().
     */
    private fun sendEventToJs(event: String, payload: JSONObject) {
        // GeckoView 124 removed GeckoSession.evaluateJavaScript (host->page JS execution)
        // with no direct public replacement. Native->JS live events (shields:blocked,
        // https:upgraded, tabs:openRequested, ...) are deferred until the app migrates to
        // the WebExtension messaging path. The JS->native prompt bridge still works fully.
        Log.w(TAG, "[Lycon] native->JS event push unavailable on GV124: $event = $payload")
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
