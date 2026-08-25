using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace LyconWindows;

/// <summary>
/// Implements the Lycon bridge contract on WinUI 3 + WebView2.
/// Receives invoke() calls from JS via postMessage and routes them to handlers.
/// </summary>
public class LyconBridge
{
    private readonly LyconDataService _data;
    private readonly LyconShieldsService _shields;
    private readonly MainWindow _window;
    private readonly Dictionary<string, Func<JToken?, Task<object>>> _handlers;
    private int _nextCallId = 1;
    private readonly Dictionary<int, TaskCompletionSource<object>> _pendingJsCalls = new();

    public LyconBridge(LyconDataService data, LyconShieldsService shields, MainWindow window)
    {
        _data = data;
        _shields = shields;
        _window = window;

        // ----- Search engines (mirror Electron main.js) -----
        var searchEngines = new Dictionary<string, object>
        {
            ["duckduckgo"] = new { name = "DuckDuckGo", url = "https://duckduckgo.com/?q=%s", suggest = "https://duckduckgo.com/ac/?q=%s" },
            ["google"] = new { name = "Google", url = "https://www.google.com/search?q=%s", suggest = "https://suggestqueries.google.com/complete/search?client=firefox&q=%s" },
            ["bing"] = new { name = "Bing", url = "https://www.bing.com/search?q=%s", suggest = "https://www.bing.com/osjson.aspx?query=%s" },
            ["startpage"] = new { name = "Startpage", url = "https://www.startpage.com/sp/search?query=%s", suggest = "https://www.startpage.com/sp/suggest?q=%s" },
        };

        _handlers = new Dictionary<string, Func<JToken?, Task<object>>>
        {
            ["settings:get"] = _ => Task.FromResult<object>(_data.LoadSettings()),
            ["settings:set"] = payload =>
            {
                var patch = payload?.ToObject<LyconSettings>() ?? new LyconSettings();
                return Task.FromResult<object>(_data.UpdateSettings(patch));
            },
            ["search:list"] = _ => Task.FromResult<object>(searchEngines),
            ["search:build"] = payload =>
            {
                var args = payload?.ToObject<SearchBuildArgs>() ?? new SearchBuildArgs();
                var eng = searchEngines.TryGetValue(args.Engine ?? "duckduckgo", out var e) ? e : searchEngines["duckduckgo"];
                var urlProp = ((dynamic)e).url as string;
                return Task.FromResult<object>(urlProp.Replace("%s", Uri.EscapeDataString(args.Query ?? "")));
            },
            ["bookmarks:list"] = _ => Task.FromResult<object>(_data.LoadBookmarks()),
            ["bookmarks:add"] = payload =>
            {
                var bm = payload?.ToObject<LyconBookmark>() ?? new LyconBookmark();
                return Task.FromResult<object>(_data.AddBookmark(bm));
            },
            ["bookmarks:remove"] = payload => Task.FromResult<object>(_data.RemoveBookmark(payload?.ToObject<string>() ?? "")),
            ["history:list"] = _ => Task.FromResult<object>(_data.LoadHistory()),
            ["history:add"] = payload =>
            {
                var entry = payload?.ToObject<LyconHistoryEntry>() ?? new LyconHistoryEntry();
                return Task.FromResult<object>(_data.AddHistory(entry));
            },
            ["history:remove"] = payload => Task.FromResult<object>(_data.RemoveHistory(payload?.ToObject<string>() ?? "")),
            ["history:clear"] = _ => { _data.ClearHistory(); return Task.FromResult<object>(new object[0]); },
            ["downloads:list"] = _ => Task.FromResult<object>(_data.LoadDownloads()),
            ["downloads:open"] = payload => { Process.Start("explorer.exe", payload?.ToObject<string>() ?? ""); return Task.FromResult<object>(true); },
            ["downloads:show"] = payload => { Process.Start("explorer.exe", "/select," + (payload?.ToObject<string>() ?? "")); return Task.FromResult<object>(true); },
            ["downloads:clear"] = _ => { _data.ClearDownloads(); return Task.FromResult<object>(new object[0]); },
            ["shields:toggle"] = payload =>
            {
                var enabled = payload?.ToObject<bool>() ?? true;
                _shields.IsEnabled = enabled;
                var s = _data.LoadSettings(); s.ShieldsEnabled = enabled; _data.SaveSettings(s);
                return Task.FromResult<object>(s);
            },
            ["shields:status"] = _ => Task.FromResult<object>(new { enabled = _shields.IsEnabled, totalBlocked = _shields.TotalBlocked, blockerLoaded = true }),
            ["window:minimize"] = _ => { _window.Minimize(); return Task.FromResult<object>(true); },
            ["window:maximize"] = _ => { _window.Maximize(); return Task.FromResult<object>(true); },
            ["window:close"] = _ => { _window.Close(); return Task.FromResult<object>(true); },
            ["shell:openExternal"] = payload =>
            {
                var url = payload?.ToObject<string>() ?? "";
                if (!string.IsNullOrEmpty(url)) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                return Task.FromResult<object>(true);
            },
        };
    }

    /// <summary>
    /// Generates the JS source that creates window.__lyconNative on the page.
    /// The script uses postMessage for invoke() and listens for messages
    /// from native for both invoke responses and events.
    /// </summary>
    public string GetBridgeInitScript()
    {
        return @"
(function() {
  if (window.__lyconNative) return; // already initialized
  const pending = new Map(); // callId -> { resolve, reject }
  let nextCallId = 1;
  const eventListeners = new Map(); // event -> Set<cb>

  function sendToNative(msg) {
    window.chrome.webview.postMessage(JSON.stringify(msg));
  }

  window.chrome.webview.addEventListener('message', function(e) {
    let data;
    try { data = JSON.parse(e.data); } catch(_) { return; }
    if (data.type === 'lycon:response') {
      const p = pending.get(data.callId);
      if (p) {
        pending.delete(data.callId);
        if (data.error) p.reject(new Error(data.error));
        else p.resolve(data.result);
      }
    } else if (data.type === 'lycon:event') {
      const set = eventListeners.get(data.event);
      if (set) for (const cb of set) {
        try { cb(data.payload); } catch(err) { console.error('[Lycon bridge] listener error', err); }
      }
    }
  });

  window.__lyconNative = {
    invoke: function(action, payload) {
      return new Promise((resolve, reject) => {
        const callId = nextCallId++;
        pending.set(callId, { resolve, reject });
        sendToNative({ type: 'lycon:invoke', callId, action, payload: payload ?? null });
      });
    },
    on: function(event, cb) {
      if (!eventListeners.has(event)) eventListeners.set(event, new Set());
      eventListeners.get(event).add(cb);
      return function() {
        const set = eventListeners.get(event);
        if (set) set.delete(cb);
      };
    },
    platform: 'winui',
    versions: { webview2: '1.0.2739.15', os: 'Windows' },
    initialUrl: null,
  };
  console.log('[Lycon] WinUI bridge initialized');
})();
";
    }

    /// <summary>
    /// Handles a JSON message received from JS via WebMessageReceived.
    /// </summary>
    public async void HandleMessageFromJs(string json)
    {
        try
        {
            var msg = JObject.Parse(json);
            var type = msg["type"]?.ToString();
            if (type != "lycon:invoke")
            {
                Debug.WriteLine($"[Lycon] Unknown message type: {type}");
                return;
            }

            var callId = msg["callId"]?.Value<int>() ?? 0;
            var action = msg["action"]?.ToString() ?? "";
            var payload = msg["payload"];

            try
            {
                if (!_handlers.TryGetValue(action, out var handler))
                    throw new Exception($"No handler registered for action '{action}'");

                var result = await handler(payload);
                SendResponse(callId, result, error: null);
            }
            catch (Exception ex)
            {
                SendResponse(callId, null, error: ex.Message);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Lycon] HandleMessageFromJs error: {ex.Message}");
        }
    }

    private void SendResponse(int callId, object? result, string? error)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            type = "lycon:response",
            callId,
            result,
            error,
        });
        _window.SendEventToJsRaw(json);
    }

    /// <summary>
    /// Pushes an event to the JS side.
    /// </summary>
    public void SendEvent(string eventType, object payload)
    {
        _window.SendEventToJs(eventType, payload);
    }
}

internal class SearchBuildArgs
{
    [JsonProperty("engine")] public string? Engine { get; set; }
    [JsonProperty("query")] public string? Query { get; set; }
}
