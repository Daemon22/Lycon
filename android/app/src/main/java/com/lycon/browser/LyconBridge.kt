package com.lycon.browser

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Bridge between GeckoView's JS and native Kotlin code.
 *
 * Protocol:
 *   JS -> Native:  GeckoSession prompt delegate intercepts window.prompt() calls
 *                  of the form: lycon:invoke:<callId>:<action>:<payloadJson>
 *                  (Using prompt() is the standard GeckoView bridge pattern.)
 *
 *   Native -> JS:  GeckoSession.evaluateJavaScript("window.__lyconBridge.onResponse(...)")
 *                  and "window.__lyconBridge.onEvent(...)"
 *
 * The bridge script (injected by MainActivity) creates window.__lyconNative
 * which calls window.prompt() with the encoded message.
 */
class LyconBridge(
    private val context: Context,
    private val dataService: LyconDataService,
    private val shieldsService: LyconShieldsService,
    private val onEventSender: (String, JSONObject) -> Unit,
    private val onWindowClose: () -> Unit,
    private val onWindowMinimize: () -> Unit,
    private val onWindowMaximize: () -> Unit,
) {

    private val handlers: Map<String, (JSONObject?) -> Any> = mapOf(
        "settings:get" to { _ -> dataService.loadSettings() },
        "settings:set" to { payload ->
            val patch = payload ?: JSONObject()
            dataService.updateSettings(patch)
        },
        "search:list" to { _ -> SEARCH_ENGINES },
        "search:build" to { payload ->
            val engine = payload?.optString("engine") ?: "duckduckgo"
            val query = payload?.optString("query") ?: ""
            val eng = SEARCH_ENGINES.optJSONObject(engine) ?: SEARCH_ENGINES.optJSONObject("duckduckgo")!!
            eng.optString("url").replace("%s", Uri.encode(query))
        },
        "bookmarks:list" to { _ -> dataService.listBookmarks() },
        "bookmarks:add" to { payload -> dataService.addBookmark(payload ?: JSONObject()) },
        "bookmarks:remove" to { payload ->
            dataService.removeBookmark(payload?.toString() ?: "")
        },
        "history:list" to { _ -> dataService.listHistory() },
        "history:add" to { payload -> dataService.addHistory(payload ?: JSONObject()) },
        "history:remove" to { payload -> dataService.removeHistory(payload?.toString() ?: "") },
        "history:clear" to { _ -> dataService.clearHistory(); JSONArray() },
        "downloads:list" to { _ -> dataService.listDownloads() },
        "downloads:open" to { payload ->
            val path = payload?.toString() ?: ""
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.fromFile(java.io.File(path)), "*/*")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Open").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            true
        },
        "downloads:show" to { _ -> true /* Android doesn't have a Finder equivalent */ },
        "downloads:clear" to { _ -> dataService.clearDownloads(); JSONArray() },
        "shields:toggle" to { payload ->
            val enabled = payload?.optBoolean("enabled") ?: true
            shieldsService.isEnabled = enabled
            val s = dataService.loadSettings()
            s.put("shieldsEnabled", enabled)
            dataService.updateSettings(s)
            s
        },
        "shields:status" to { _ ->
            JSONObject().apply {
                put("enabled", shieldsService.isEnabled)
                put("totalBlocked", shieldsService.totalBlocked)
                put("blockerLoaded", shieldsService.isLoaded)
            }
        },
        "window:minimize" to { _ -> onWindowMinimize(); true },
        "window:maximize" to { _ -> onWindowMaximize(); true },
        "window:close" to { _ -> onWindowClose(); true },
        "shell:openExternal" to { payload ->
            val url = payload?.toString() ?: ""
            if (url.isNotEmpty()) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
            true
        },
    )

    /**
     * Handle a JS invoke call. Returns the result synchronously.
     * Throws if the action is unknown or the handler fails.
     */
    fun handleInvoke(action: String, payload: JSONObject?): Any {
        val handler = handlers[action] ?: throw Exception("No handler for action '$action'")
        return try {
            handler(payload)
        } catch (e: Exception) {
            Log.e(TAG, "Handler error for $action", e)
            throw e
        }
    }

    /**
     * JS-side bridge source — creates window.__lyconNative via window.prompt()
     * (GeckoView's standard JS-to-native communication pattern).
     *
     * The prompt format is:  lycon:invoke:<callId>:<action>:<payloadJson>
     * Native intercepts via PromptDelegate and returns the response as the
     * prompt's return value (a JSON string).
     */
    fun getBridgeInitScript(): String = """
(function() {
  if (window.__lyconNative) return;
  const pending = new Map();
  let nextCallId = 1;

  function callNative(action, payload) {
    return new Promise((resolve, reject) => {
      const callId = nextCallId++;
      pending.set(callId, { resolve, reject });
      const msg = 'lycon:invoke:' + callId + ':' + action + ':' + (payload ? JSON.stringify(payload) : 'null');
      try {
        const response = window.prompt(msg);
        if (response === null || response === undefined) {
          pending.delete(callId);
          reject(new Error('Native returned null'));
          return;
        }
        const parsed = JSON.parse(response);
        pending.delete(callId);
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.result);
      } catch (e) {
        pending.delete(callId);
        reject(e);
      }
    });
  }

  const eventListeners = new Map();

  window.__lyconNative = {
    invoke: callNative,
    on: function(event, cb) {
      if (!eventListeners.has(event)) eventListeners.set(event, new Set());
      eventListeners.get(event).add(cb);
      return function() {
        const set = eventListeners.get(event);
        if (set) set.delete(cb);
      };
    },
    platform: 'android',
    versions: { geckoview: '124.0', os: 'Android' },
    initialUrl: null,
  };

  // Native code calls this to push events
  window.__lyconBridge = {
    onEvent: function(event, payload) {
      const set = eventListeners.get(event);
      if (set) for (const cb of set) {
        try { cb(payload); } catch (e) { console.error('[Lycon bridge] listener error', e); }
      }
    }
  };

  console.log('[Lycon] Android/GeckoView bridge initialized');
})();
""".trimIndent()

    /**
     * Push an event to the JS side via evaluateJavaScript.
     */
    fun sendEvent(event: String, payload: JSONObject) {
        onEventSender(event, payload)
    }

    companion object {
        private const val TAG = "LyconBridge"

        val SEARCH_ENGINES = JSONObject().apply {
            put("duckduckgo", JSONObject().apply {
                put("name", "DuckDuckGo")
                put("url", "https://duckduckgo.com/?q=%s")
                put("suggest", "https://duckduckgo.com/ac/?q=%s")
            })
            put("google", JSONObject().apply {
                put("name", "Google")
                put("url", "https://www.google.com/search?q=%s")
                put("suggest", "https://suggestqueries.google.com/complete/search?client=firefox&q=%s")
            })
            put("bing", JSONObject().apply {
                put("name", "Bing")
                put("url", "https://www.bing.com/search?q=%s")
                put("suggest", "https://www.bing.com/osjson.aspx?query=%s")
            })
            put("startpage", JSONObject().apply {
                put("name", "Startpage")
                put("url", "https://www.startpage.com/sp/search?query=%s")
                put("suggest", "https://www.startpage.com/sp/suggest?q=%s")
            })
        }
    }
}
